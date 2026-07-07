# Chatbot: Gemini-first con contexto enriquecido y memoria conversacional

Date: 2026-07-07

## Problem

`ProjectChatbot.jsx` resuelve casi todo con reglas locales (regex/keyword
matching) y solo llama a Gemini (`api/chat.js` vía `llmChat.js`) como último
recurso, cuando ninguna regla matchea. Esto significa:

- Preguntas de manual de ingeniería, materiales, o contactos de diseñadores
  responden con templates fijos y exact/keyword matching frágil, en vez de
  lenguaje natural.
- Cada llamada a Gemini es stateless: no manda historial de conversación, así
  que el bot no puede seguir el hilo ("¿y cuándo instala?" después de
  preguntar por un proyecto).
- El contexto que se manda a Gemini hoy (`buildProjectContext`) es solo una
  lista de hasta 8 proyectos — no incluye manual de ingeniería, materiales, ni
  contactos.

## Goals

1. Gemini pasa a ser el camino principal de respuesta para preguntas de
   contenido/consulta. Las reglas locales se reservan solo para lo que debe
   seguir siendo 100% determinista.
2. El contexto que recibe Gemini se enriquece con manual de ingeniería,
   matriz de materiales y contactos de diseñadores, cuando son relevantes al
   query.
3. Gemini recibe los últimos 6 mensajes (3 turnos) de historial de la
   conversación actual, para poder mantener contexto conversacional.
4. Ningún comportamiento existente de escritura de datos (agregar nota) o de
   control de conversación (cancelar/ayuda/selección de opciones) cambia.

## Non-goals

- No se cambia el modelo (`gemini-2.0-flash`), ni `api/translate.js`, ni el
  flujo de traducción del resumen ejecutivo.
- No se persiste el historial en Firebase; se sigue usando el `messages`
  state / localStorage existente como fuente del historial reciente.
- No se agrega streaming de respuesta.

## Design

### 1. Pipeline de decisión en `ProjectChatbot.jsx` (`processInput`)

Orden nuevo (los pasos 1–2 son EXACTAMENTE el código actual, sin cambios de
comportamiento):

1. **Estado multi-turno de notas** (`AWAITING_PROJECT_FOR_NOTE` /
   `AWAITING_NOTE_TEXT`) — sin cambios. Escribe en Firebase vía
   `addProjectNote`; debe seguir siendo determinista.
2. **Comandos de control**: `cancelar`/`cancel`, `ayuda`/`help`/`?`, trigger
   de "agregar nota" — sin cambios.
3. **Búsqueda de entidad única** (match inequívoco de un solo
   proyecto/diseñador/ingeniero vía `extractEntityQuery` + filtrado): se
   mantiene el template fijo actual (`buildEntityAnswer`), sin pasar por
   Gemini. Es el caso más frecuente del bot y ya es 100% correcto/rápido; no
   tiene sentido pagar latencia de LLM para redactarlo distinto.
4. **Selección múltiple (picker)**: cuando `extractEntityQuery` matchea más
   de una opción, se sigue devolviendo la lista de botones (`options`) para
   que el usuario elija — sin cambios. Evita que el LLM "adivine" cuál de
   varios proyectos ambiguos es el correcto.
5. **Todo lo demás → Gemini** (nuevo camino principal). Esto reemplaza y
   elimina las siguientes reglas actuales, que hoy responden con template
   fijo antes de llegar al fallback de LLM:
   - Búsqueda en manual de ingeniería (bloque `searchEngineeringManual`
     directo con respuesta fija).
   - Consulta de matriz de materiales (bloque `materialsMatrix.find`).
   - Consulta de contacto de diseñador (bloque `designerContacts.find`).
   - Pipeline de filtros complejos (hold / install / soonest / staff
     mencionado).

   Todas estas siguen existiendo como **fuentes de datos** para el contexto
   enriquecido (paso 2 del diseño de `llmChat.js` abajo) — no se borra la
   lógica de búsqueda, se deja de usar para generar la respuesta final
   directamente y se usa para alimentar a Gemini.

6. Si la llamada a Gemini falla (sin `GEMINI_API_KEY`, red caída, 500/502):
   fallback a `getHelpText()` — igual que hoy.

### 2. Contexto enriquecido — `buildLLMContext` en `llmChat.js`

Reemplaza a `buildProjectContext` (mismo archivo, nueva función con más
inputs). Firma:

```js
export function buildLLMContext({ query, projects, materialsMatrix, designerContacts }) {
  // returns a single string with labeled sections, only including
  // sections that have relevant matches
}
```

Secciones, cada una condicional (se omite si no hay datos relevantes):

- **Proyectos relevantes**: misma lógica actual de `buildProjectContext`
  (hasta 8 proyectos filtrados por palabras clave del query, mismo formato de
  línea).
- **Manual de Ingeniería**: `searchEngineeringManual(query)` (ya existe en
  `engineeringManual.js`, sin cambios); si devuelve resultados, incluir las
  2 primeras entradas como texto (`titleES`/`titleEN` + `answerES`/`answerEN`
  según idioma, con su número de sección).
- **Matriz de Materiales**: reutiliza el matching actual (por SO o por
  palabra del nombre de proyecto contenida en el query) sobre
  `materialsMatrix`; si hay match, incluir esa fila (thermofoil/no
  holes/dovetail/element).
- **Contactos de Diseñadores**: reutiliza el matching actual (nombre o
  apellido contenido en el query) sobre `designerContacts`; si hay match,
  incluir nombre/tel/email/ciudad.

El texto final concatena las secciones con headers simples (p.ej.
`"--- Proyectos ---"`, `"--- Manual de Ingeniería ---"`, etc.) para que
Gemini distinga el origen de cada dato.

### 3. Memoria conversacional

- `askLLM` gana un parámetro `history`: array de los últimos 6 mensajes de
  `messages` (3 turnos), mapeados a `{ role: 'user' | 'model', text }`
  (`sender: 'user'` → `role: 'user'`, `sender: 'bot'` → `role: 'model'`).
  Se excluye el mensaje de bienvenida (`id: 'welcome'`) y cualquier bubble de
  loading.
- `api/chat.js` acepta `history` en el body (array, opcional, default `[]`),
  valida que cada item tenga `role` (`'user'`|`'model'`) y `text` (string), y
  antepone esos turnos al array `contents` antes del mensaje actual:
  `contents: [...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })), { role: 'user', parts: [{ text: message }] }]`.
- Si `history` viene malformado (no es array), se ignora silenciosamente
  (se trata como `[]`) — no debe romper la request.

### 4. Prompt del sistema

Se actualiza el texto de `systemInstruction` en `api/chat.js` para mencionar
que el contexto puede incluir varias secciones (proyectos, manual técnico,
materiales, contactos) y reforzar la instrucción existente de "si el
contexto no alcanza, decilo honestamente" — ya cubre el caso de secciones
vacías, no requiere lógica nueva.

## Error handling

- Fallo de red o de Gemini (ya existe): cae a `getHelpText()`.
- `history` malformado: se ignora, se trata como conversación nueva.
- Ninguna sección de contexto con datos: `buildLLMContext` devuelve string
  vacío; Gemini responde solo con su system prompt (mismo comportamiento que
  hoy cuando `context` es `''`).

## Testing

- Manual: abrir el chatbot, hacer una pregunta de manual técnico en lenguaje
  natural (no keyword exacto) y confirmar que responde con datos del manual
  vía Gemini.
- Manual: preguntar por un proyecto, luego hacer una pregunta de
  seguimiento corta ("¿y el diseñador?") y confirmar que Gemini usa el
  historial para entender a qué proyecto se refiere.
- Manual: confirmar que "agregar nota" y "cancelar"/"ayuda" siguen
  funcionando exactamente igual (no deben pasar por Gemini).
- Manual: confirmar que una pregunta con un único proyecto/diseñador
  inequívoco sigue respondiendo instantáneo con el template fijo (sin
  llamada a red visible en devtools).
