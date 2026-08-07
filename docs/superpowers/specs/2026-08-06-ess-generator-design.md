# Diseño — Generador de ESS (Engineering Shop Sheet)

**Fecha:** 2026-08-06
**Estado:** Aprobado, listo para implementation plan

## Objetivo

Módulo nuevo, visible solo para el súper admin (`isSuperAdminRole`), que automatiza el armado del borrador de la **ESS (Engineering Shop Sheet)** — la orden técnica de corte y producción para el taller/CNC — a partir de tres PDFs que ya existen por proyecto: **Contract**, **Quote** y **Drawings**.

Sin API de IA: los PDFs son generados digitalmente (texto seleccionable, confirmado por el usuario), así que toda la extracción es determinística por reglas (regex + posición del texto en la página), no OCR ni LLM.

## Terminología del dominio (JL Closets)

| Doc | Qué es | Qué aporta a la ESS |
|---|---|---|
| **Contract** | Acuerdo comercial firmado | Depósito %, si tearout/baseboards están contratados |
| **Quote** | Desglose de productos/accesorios cotizados por el diseñador | Por área: accesorios con product code y cantidad, material/puerta, descuento — es el "check de inventario": todo lo cobrado DEBE estar en el plano |
| **Drawings** | Plano CAD del proyecto | Medidas por opening (ancho/alto/profundidad), asociadas a cada área |
| **IP** (ya existe, no forma parte de este diseño) | Instrucciones para instaladores | — |
| **ESS** (lo que este módulo genera) | Orden de taller/CNC | Job Name, colores traducidos a código interno, medidas ya calculadas con las fórmulas de corte, herrajes, misceláneos |

## Alcance de esta v1

Genera un **borrador editable** de ESS — no un documento final automático sin revisión. El súper admin siempre corrige antes de exportar. Fuera de alcance para v1:

- OCR / PDFs escaneados (no aplica: confirmado que todos tienen texto digital).
- UI para editar la tabla de colores o las fórmulas de corte — quedan hardcodeadas en código (`essRules.js`), versionadas por git.
- Multi-usuario / edición concurrente del borrador (un solo actor: el súper admin).

## Relación con el "Completar ESS" existente

**Descubrimiento clave (post-aprobación inicial del spec):** la app ya tiene un generador de ESS manual — botón "Completar ESS" en My Projects → `PDFGeneratorModal.jsx`, datos en RTDB `essData/{so}`, impresión vía `PDFPrintLayout.jsx`. Cualquier usuario aprobado (no solo súper admin) puede abrirlo y llenarlo a mano hoy. Forma de los datos (un array de "páginas", una por room/área, vía el hook genérico `usePagedModal`):

```js
{
  headerData: { jobName, color, rooms, designer, engineer },
  drawerOptions: { fronts, box, slides, handles },   // SLAB/THERMOFOIL, PRFV/DOVETAIL, etc.
  drawers: [{ front, qty, open, box, room, handles }],
  rods: [{ room, type, qty, size }],
  miscCol1, miscCol2   // texto libre
}
```

Esto reemplaza el plan original de inventar una tabla de borrador y un layout de impresión nuevos. Confirmado con el usuario: **esta feature nueva NO debe pisar ni compartir carpeta con `essData`** — queda completamente separada en Firebase — pero **reusa el generador existente como base**: mismo shape de página, mismo `usePagedModal`, mismo `PDFPrintLayout`. La diferencia es de dónde sale el contenido inicial (parseo de PDFs en vez de un formulario en blanco) y dónde se guarda (nodo propio, no `essData`).

## Acceso y navegación

- Tab nuevo **"ESS"** en el Navbar, gateado igual que el tab `admin` en [App.jsx:644-645](../../../src/App.jsx#L644-L645): `isSuperAdminRole(userProfile?.role) ? <EssView ... /> : <DashboardView ... />`.
- `EssView.jsx`: lista de proyectos (reusa `mergedData.priorityAnalysis`, mismo patrón que `MyProjectsView`), con estado por proyecto: `Sin PDFs` / `PDFs cargados` / `ESS generada`.
- Click en un proyecto → `EssProjectDetail.jsx`, con 3 slots de carga (Contract / Quote / Drawings), botón "Generar ESS", panel de resumen de extracción, y botón "Abrir ESS generada" que lanza `EssAutoGeneratorModal.jsx`.

`PDFGeneratorModal`/`essData` (el flujo manual) no se toca — cero riesgo de regresión sobre lo que ya está en producción.

## Arquitectura

Todo client-side, siguiendo el mismo patrón que ya usa el repo para datos externos (`sheetParser.js`, `masterSchedule.js`): fetch/parseo en el navegador, sin backend nuevo.

**Por qué client-side y no una función serverless nueva:** el parseo de Drawings necesita no solo el texto sino la **posición (x/y)** de cada texto en la página, para inferir a qué símbolo de gabinete pertenece cada número. `pdfjs-dist` da esa posición vía `page.getTextContent()` y corre nativamente en el navegador; en Node/serverless requiere workarounds (canvas, fuentes) sin beneficio real, porque el parseo no toca secretos ni datos privilegiados.

```
Upload (RTDB, base64) ──┐
                         ├─→ pdfjs-dist (browser) → texto + posición
                         │
        parseContract(text) → { deposit, tearout, baseboards }
        parseQuote(text)    → { areas: [{ name, items: [{code, qty, ...}] }] }
        parseDrawings(items)→ { areas: [{ name, openings: [{width, height, depth}] }] }
                         │
                         ▼
        essMatcher.js (usa essRules.js: fórmulas + color map)
                         │
                         ▼
        pages[] — mismo shape que essData/PDFGeneratorModal
                         │
                         ▼
        saveEssAutoData(so, pages) ──→ EssAutoGeneratorModal (editar/imprimir, = PDFGeneratorModal clonado)
```

### Componentes nuevos

- `src/views/EssView.jsx` — lista de proyectos.
- `src/views/EssProjectDetail.jsx` — carga de PDFs + botón "Generar ESS" + panel de resumen de extracción (checklist matched/unmatched) + botón para abrir el modal generado.
- `src/components/EssAutoGeneratorModal.jsx` — clon de `PDFGeneratorModal.jsx`: mismo `usePagedModal`, mismo `PDFPrintLayout`, mismos campos editables (drawers/rods/misc). Cambia solo la fuente de datos (`essAutoData.js` en vez de `essData.js`) y agrega, por fila de drawer/rod, un ícono de inspección + "Reportar error" (ver "Corrección de errores").
- `src/utils/essPdfExtract.js` — wrapper sobre `pdfjs-dist` que da texto + posición por página.
- `src/utils/essParsers/parseContract.js`, `parseQuote.js`, `parseDrawings.js` — un parser por tipo de doc.
- `src/utils/essRules.js` — tabla de colores, fórmulas de corte. Funciones puras, fácil de testear.
- `src/utils/essMatcher.js` — cruza Quote↔Drawings y arma `pages[]` en el shape de `essData`, usando `essRules.js`.
- `src/utils/essAutoData.js` — `saveEssAutoData`/`loadEssAutoData`, mismo patrón que `essData.js` pero apuntando a `essAutoData/{so}` (nodo separado).
- `src/utils/essFiles.js` — codificar/decodificar los PDFs a Base64 y guardarlos/leerlos de `ess_files/{so}/{docType}`.

No hace falta ningún componente de impresión nuevo — `PDFPrintLayout.jsx` se reusa tal cual.

### Storage

El repo no usa Firebase Storage en ningún lado — el único precedente de subida de archivos (`uploadNoteAttachment` en [imageService.js](../../../src/services/imageService.js)) guarda adjuntos como **string Base64 directo en RTDB**, no en un bucket. Esto no es casualidad: las Storage Security Rules de Firebase no pueden leer el rol del usuario desde Realtime Database (a diferencia de las RTDB rules, que sí se referencian entre nodos vía `root.child(...)`). Gatear un bucket de Storage por rol requeriría Auth custom claims + un endpoint server-side nuevo para asignarlos — contradice la premisa de "sin backend nuevo". Se sigue el mismo patrón ya probado, en nodos **separados de `essData`**:

- **RTDB** `ess_files/{so}/{contract|quote|drawings}`: PDF original como Base64, gateado a `role === 'engineer-admin' && status === 'approved'` (lectura y escritura). Límite de 8MB por archivo (los PDFs de este flujo son texto, no escaneos, así que no deberían acercarse a ese tamaño; si lo superan se corta con error explícito, mismo patrón que el `FILE_TOO_LARGE` que ya usa `MyProjectsView`).
- **RTDB** `essAutoData/{so}`: el `pages[]` generado — mismo shape que `essData/{so}`, pero nodo distinto, gateado igual que `ess_files` (solo súper admin; a diferencia de `essData`, que cualquier aprobado puede leer/escribir).
- **RTDB** `ess_corrections/{so}/{campo}`: casos reportados para ajustar reglas (ver "Corrección de errores"), mismo gateo.

## Motor de reglas (`essRules.js` + `essMatcher.js`)

`essRules.js` — datos fijos, provistos por el usuario, hardcodeados y versionados en git:

- **Mapeo de color:** comercial → código interno de melamina/HPL (ej. "Snow White" → "White Classic 300").
- **Fórmulas de corte:** PRFV = opening − 1", Dovetail = opening − 3/8", recorte de tubo de colgar = vano − 1/4", descuento de profundidad por backing = − 3/4".
- **Misceláneos:** boring pattern 32mm, scar cleats, tapas decorativas, edge banding 4S front & back — reglas fijas, no derivadas de los PDFs.

`essMatcher.js` cruza cada accesorio/ítem de la Quote con su opening correspondiente en el Drawing (por área + posición), aplica la fórmula de `essRules.js` según tipo de frente, y arma un `pages[]` — una página por área/room detectada — con las filas de `drawers`/`rods` ya llenas, en el mismo shape que consume `PDFGeneratorModal`/`PDFPrintLayout`.

## Manejo de errores y casos límite

- **Falta algún PDF:** "Generar ESS" deshabilitado, indica cuáles slots faltan. No se genera nada parcial.
- **PDF en el slot equivocado:** validación liviana no bloqueante — busca palabras clave esperadas por tipo de doc (ej. "DEPOSIT"/"CANCELLATION" en Contract) y avisa si no aparecen, sin impedir continuar.
- **PDF sin texto extraíble** (protegido o, contra lo esperado, escaneado): si `pdfjs-dist` devuelve texto vacío/mínimo, corta con error explícito en vez de generar una ESS vacía.
- **PDF corrupto/inválido:** parseo en try/catch, usando el `ErrorBoundary` ya existente en el repo — un archivo roto no debe tirar abajo la vista.
- **Parseo parcial** (ej. ningún opening matcheado): no bloquea — muestra el borrador con lo que sí se armó, más un banner de advertencia con la cantidad de ítems sin matchear.
- **Reemplazo de un PDF ya cargado:** si ya se había generado `essAutoData/{so}` a partir de una versión anterior, regenerar avisa que va a reemplazar ese borrador (no `essData`, que ni se toca) antes de sobrescribir.
- **Performance:** Drawings puede tener varias páginas — parseo con spinner, procesado por página para no congelar la UI.

## Corrección de errores (ciclo de mejora sin IA)

Como no hay aprendizaje automático, cada mejora del parser es un cambio de código deliberado. Dos niveles:

1. **Corrección puntual:** editar el campo mal calculado directamente en `EssAutoGeneratorModal` (mismos inputs que ya tiene `PDFGeneratorModal`) — arregla ese proyecto, no el parser.
2. **Corrección de la regla:** en `EssAutoGeneratorModal`, cada fila de drawer/rod tiene un ícono de inspección que muestra el texto crudo extraído, su posición en el PDF, y qué regla decidió su clasificación. Botón "Reportar error" guarda el caso en `ess_corrections/{so}/{campo}` (valor del parser vs. valor correcto + referencia al PDF). Esos reportes son la lista de casos a revisar y convertir en ajustes de `essRules.js`/`essMatcher.js`/los parsers.

## Testing

- **Fixtures reales:** 3-4 PDFs representativos (Contract/Quote/Drawings de proyectos reales, con distintos estilos de plano si varían) guardados como fixtures de test, mismo patrón que `redFlags.test.ts`/`chatbotLocalMatch.test.js`. Cada ajuste de parser corre contra este set antes de darse por bueno, para no arreglar un caso rompiendo otro.
- **`essRules.js`/`essMatcher.js`:** tests unitarios directos sobre las fórmulas y el cruce Quote↔Drawings — son funciones puras, no dependen de PDFs reales.

## Salida final

- **Guardar:** `EssProjectDetail` llama `saveEssAutoData(so, pages)` apenas termina de generar; `EssAutoGeneratorModal` sigue auto-guardando cualquier corrección manual ahí mismo (mismo comportamiento que `PDFGeneratorModal` ya tiene sobre `essData`).
- **Exportar:** `react-to-print` sobre `PDFPrintLayout.jsx` (reusado sin cambios) → mismo PDF final que ya conoce el taller, ahora generado por dos caminos posibles (manual o automático) que nunca se pisan entre sí.
