# Auditoría — Dashboard KPIs (primer barrido)
Fecha: 2026-07-10 · Stack: React 19 + Vite, Firebase (RTDB + Auth), funciones serverless en Vercel (`/api`), integración con Google Sheets y Gemini.

Este es un primer barrido manual (no exhaustivo). Cubre errores funcionales y de seguridad encontrados al revisar los endpoints de `/api`, las reglas de Firebase, y la lógica core de cálculo de KPIs.

---

## 🔴 Crítico

### 1. Endpoints `/api/*` sin autenticación
`api/chat.js`, `api/translate.js` y `api/sync.js` son funciones serverless públicas sin ningún chequeo de auth, API key propia, ni CORS/origen restringido. Cualquiera que descubra la URL puede:
- Quemar la cuota de `GEMINI_API_KEY` llamando a `/api/chat` o `/api/translate` repetidamente (costo + posible DoS).
- Escribir datos arbitrarios en la hoja de Google Sheets de la empresa vía `/api/sync` (ver hallazgo #2), sin ninguna validación de que la llamada venga de la app real.

**Recomendación:** agregar un secreto compartido (header `x-api-key` validado server-side) o, mejor, verificar el ID token de Firebase Auth del usuario en cada función; añadir rate limiting.

### 2. Inyección de fórmulas en Google Sheets (`api/sync.js`)
`mapEventToCells` toma texto del request (`noteText`, `engineer`, fechas) y se escribe directo en celdas con `valueInputOption: 'USER_ENTERED'`. Si un valor empieza con `=`, `+`, `-` o `@`, Sheets lo interpreta como fórmula. Combinado con el hallazgo #1 (endpoint sin auth), un atacante externo podría inyectar una fórmula (p. ej. `=IMPORTXML(...)`) que se ejecute cuando alguien del equipo abra la hoja — riesgo de exfiltración de datos o macro/fórmula maliciosa.

**Recomendación:** sanitizar valores que empiecen con esos caracteres (anteponer `'` o rechazar) antes de escribir, además de resolver #1.

---

## 🟠 Alto

### 3. `predictBottlenecks()` nunca recibe la fecha real
`src/services/kpiCalculator.js:151` — el parámetro `referenceDateStr` tiene default hardcodeado `'2026-06-11'`. En `DashboardView.jsx:125` se llama como `predictBottlenecks(filteredProjects)`, **sin pasar la fecha**, así que en producción siempre calcula contra el 11 de junio de 2026 en vez de la fecha actual. Las alertas de "cuellos de botella de instalación" (próximos 7 días) están rotas: comparan contra una fecha fija en el pasado.

**Recomendación:** cambiar la llamada a `predictBottlenecks(filteredProjects, new Date().toISOString())` (y revisar si `getDelayedProjectsCount`, con el mismo patrón de default hardcodeado, tiene el mismo problema donde se use — no se encontró ningún call site en `src`, posible código muerto o llamada faltante).

### 4. `.env.local` con credenciales reales, entrada duplicada y mal formada
El archivo contiene `SYNC_SHEET_ID` y `GOOGLE_SERVICE_ACCOUNT_KEY` **duplicados**, y el segundo `GOOGLE_SERVICE_ACCOUNT_KEY` está pegado como JSON multilínea sin escapar (en vez de una sola línea con `\n` escapados). Esto es fràgil: un parser de `.env` estándar puede leer solo la primera línea del JSON y truncar la clave privada, rompiendo el sync con Sheets, o comportarse de forma inconsistente entre entornos.

Nota: confirmé que `.env*` está en `.gitignore` y el archivo no está trackeado en git, así que no se filtró al repo. Aun así, como la clave de la cuenta de servicio quedó expuesta en texto plano durante esta revisión (por el propio problema de formato), **recomiendo rotar esa clave de service account en Google Cloud** como precaución, y luego corregir el archivo a una sola línea válida por variable, sin duplicados.

---

## 🟡 Medio

### 5. Reglas de Firebase RTDB — comodín `$other` muy permisivo
`database.rules.json:64-67` da lectura/escritura a **cualquier** nodo no listado explícitamente a todo usuario `approved`, sin distinguir rol. Si en el futuro se agrega un nodo nuevo sin actualizar las reglas, queda accesible por defecto a todos los roles (incluido `designer`, que sí está restringido explícitamente en otros nodos). Es un patrón "allow por defecto" en vez de "deny por defecto".

**Recomendación:** listar explícitamente los nodos permitidos y dejar `$other` en `false`/`false`.

### 6. `api/sync.js` filtra info interna en errores
Cuando falta configuración, la respuesta 500 incluye `diag_nearMatchKeys` (nombres de env vars del servidor) y longitud del sheet ID. Es info de diagnóstico útil en dev, pero se sirve igual en producción a cualquier caller no autenticado.

**Recomendación:** solo devolver el diagnóstico detallado si `NODE_ENV !== 'production'`.

### 7. CSV export sin protección contra inyección de fórmulas
`src/utils/csvExport.js` escapa comillas pero no neutraliza valores que empiezan con `=`, `+`, `-`, `@`. Si datos de proyecto/notas (que pueden originarse en el sync sin auth del hallazgo #1) se exportan a CSV y se abren en Excel/Sheets, aplica el mismo riesgo de fórmula que en #2.

---

## 🟢 Notas menores
- 16 comentarios `TODO` pendientes repartidos en 8 archivos (`DashboardView`, `Navbar`, `engineeringManual`, `translations`, etc.) — no son bugs, pero vale revisarlos.
- El resto de `kpiCalculator.js` (conversion rate, budget deviation, promedios de validación) está bien defendido: chequea división por cero, `NaN`, y duraciones negativas/absurdas antes de usarlas.
- El chatbot (`ProjectChatbot.jsx`) renderiza markdown a mano en vez de `dangerouslySetInnerHTML` — buen patrón, evita XSS ahí.
- Las reglas de Firebase previenen correctamente la auto-escalación de rol a `engineer-admin` (ese valor está fuera de la lista de roles permitidos por `.validate`, y solo se puede asignar por escritura directa en consola).

---

## Resumen de prioridad
| # | Hallazgo | Severidad |
|---|---|---|
| 1 | Endpoints `/api/*` sin auth | Crítico |
| 2 | Inyección de fórmulas en Sheets vía sync | Crítico |
| 3 | `predictBottlenecks` usa fecha hardcodeada | Alto |
| 4 | `.env.local` duplicado/mal formado, clave de servicio expuesta | Alto |
| 5 | Regla Firebase `$other` demasiado permisiva | Medio |
| 6 | Filtración de info interna en errores de `/api/sync` | Medio |
| 7 | CSV export sin sanitizar fórmulas | Medio |

Esto es un primer barrido — no cubre dependencias (`npm audit`), pruebas de carga, ni revisión línea por línea de cada componente. Si querés, puedo profundizar en cualquiera de estos puntos o hacer una segunda pasada más exhaustiva con Opus.
