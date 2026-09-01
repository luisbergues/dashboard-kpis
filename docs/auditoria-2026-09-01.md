# Auditoría completa — Dashboard KPIs

**Fecha:** 2026-09-01 · **Commit:** `07b94a0` (main) · **Alcance:** 151 archivos fuente, ~26.000 LOC (`src/` + `api/`)

Barrido sobre seis ejes: seguridad, corrección, rendimiento, calidad de código, dependencias y operación.
Todo hallazgo lleva `archivo:línea`. Donde no pude confirmar algo leyendo el código, lo digo.

**Estado de las herramientas al momento de auditar:**

| | resultado |
|---|---|
| `vitest run` | ✅ **1176 pasan**, 5 skipped, 0 fallan (89 archivos, 104 s) |
| `npm run build` | ✅ compila en 1,94 s |
| `npm run lint` | ❌ **209 errores**, 9 warnings |
| `npm audit --omit=dev` | ⚠️ 16 vulnerabilidades (1 crítica, 6 altas) |

> Nota sobre los tests: fallan por *timeout* con la configuración por defecto de 5 s.
> Corridos con `--testTimeout=30000` pasan los 1176. El problema es el umbral, no los tests.

---

## 🔴 Crítico

### 1. La planilla completa es legible por cualquiera, sin autenticación

**Confirmado empíricamente, no inferido.** Hice un `GET` sin credenciales a la URL que está hardcodeada en
[`src/utils/sheetParser.js:3`](../src/utils/sheetParser.js#L3) y devolvió **HTTP 200 con 16 KB de CSV real**
(345 filas: SO, nombres de cliente, ingenieros, fechas, costos).

Tres hechos que se combinan:

1. La URL `…/export?format=csv` está en el bundle del cliente, en texto plano — cualquiera la extrae con Ver Fuente.
2. El documento está compartido como *"cualquiera con el link"*: si no, ese `fetch()` sin credenciales fallaría.
3. La query **no tiene guard de sesión**: `useQuery` en [`App.jsx:112`](../src/App.jsx#L112) no define `enabled`,
   así que dispara en el montaje, **antes del login**. `LoginView` incluso recibe `data` ([`App.jsx:675`](../src/App.jsx#L675)).

Consecuencia: el login de la app **no protege los datos de negocio**. Protege la escritura y los nodos de RTDB,
pero la planilla semanal entera es pública para quien tenga la URL. Las 4 pestañas (KPI, Quality, Materials,
Master Schedule) usan el mismo documento, así que aplica a todas.

**Corrección sugerida** (en orden de solidez):
1. Despublicar el documento y mover la lectura del CSV detrás de `/api/` — la service account de Sheets
   ya existe y ya se usa para escribir en [`api/sync.js:16`](../api/sync.js#L16).
2. Mínimo inmediato: `enabled: !!currentUser` en la query. **Ojo: esto dispara el hallazgo #3 — leer antes de aplicarlo.**

---

## 🟡 Medio — *reclasificado desde Crítico durante esta auditoría*

### 2. `project_notes` crece sin techo y se baja entero una vez por sesión

> **Corrección respecto de un borrador anterior de esta auditoría.** Escribí primero que "cada cambio en
> cualquier nota reenvía el árbol completo ×4 listeners". **Eso es falso**, por dos motivos: RTDB envía
> **deltas** después del attach inicial (no reenvía el nodo), y el SDK **deduplica** listeners sobre la
> misma ruta — como el de [`App.jsx:319`](../src/App.jsx#L319) vive toda la sesión, los otros tres se
> sirven del caché local del cliente y no generan tráfico extra. El diagnóstico de agosto de 2026 ya
> había llegado a esta conclusión y **la decisión de dejar los Base64 fue deliberada**. No la revierto.

Lo que **sí** queda como riesgo, acotado hoy pero creciente:

| hecho | evidencia |
|---|---|
| Los adjuntos se guardan como Base64 **dentro de la nota** | [`imageService.js:40-44`](../src/services/imageService.js#L40-L44) devuelve `reader.result`; se asigna a `attachments[].url` en [`MyProjectsView.jsx:886`](../src/views/MyProjectsView.jsx#L886) |
| Pesan: imágenes ~200 KB comprimidas, documentos hasta 1 MB | [`imageService.js:10-13`](../src/services/imageService.js#L10-L13), [`MyProjectsView.jsx:882`](../src/views/MyProjectsView.jsx#L882) |
| **Cero constraints de query en todo el repo** | 0 usos de `orderByChild`, `limitToLast`, `startAt`, `query()` |

`project_notes` se descarga **entero, una vez por sesión y por pestaña**, y no hay paginación en ninguna
parte de la app. El costo es hoy acotado —se sacó el amplificador que lo multiplicaba por 2880— pero
**crece monótonamente con el historial**: cada adjunto que se sube se agrega al peso que toda pestaña
nueva paga al abrir. Nunca se libera, porque no hay retención para notas (a diferencia de ESS, que sí
la tiene en [`essRetention.js`](../src/utils/essRetention.js)).

**Qué mirar, y cuándo actuar.** No hace falta tocarlo ahora. El umbral a vigilar es el peso de
`project_notes` en la consola de Firebase: cuando se acerque a los pocos MB, el patrón a copiar ya está
escrito y probado en este mismo repo — `ess_files` (pesado) separado de `ess_file_index` (metadata),
por el motivo exacto que explica el comentario de [`EssView.jsx:36-39`](../src/views/EssView.jsx#L36-L39).

---

## 🟠 Alto

### 3. 98 violaciones de `rules-of-hooks`: `if (!data) return null` antes de todos los hooks

En las cuatro vistas principales el early-return está **arriba de todo**, así que todos los hooks quedan
condicionados:

- [`PipelineView.jsx:53`](../src/views/PipelineView.jsx#L53) — 26 violaciones
- [`CalendarView.jsx:20`](../src/views/CalendarView.jsx#L20) — 15
- [`MyProjectsView.jsx:87`](../src/views/MyProjectsView.jsx#L87) — 54
- `DashboardView.jsx` — 3

**Hoy es latente, no está rompiendo nada.** [`App.jsx:671`](../src/App.jsx#L671) gatea con
`if (loading || authLoading) return <ViewSkeleton />`, y React Query conserva `data` entre refetches
(incluso ante error), así que la transición *non-null → null* con la vista montada no ocurre.

**Pero es una mina.** Cualquier cambio que permita que `mergedData` vuelva a `null` con la vista montada
provoca `Rendered fewer hooks than expected` y tumba la vista completa. Y el arreglo natural del hallazgo #1
—agregar `enabled: !!currentUser`— **es exactamente ese cambio.**

> **Orden de trabajo: arreglar #3 antes que #1.** Mover cada `if (!data) return null` debajo de todos los
> hooks es mecánico y sin riesgo; hacerlo al revés rompe producción.

### 4. Dependencias: 1 crítica, 6 altas — pero con exposición real baja

`npm audit --omit=dev` reporta 16. Rastreadas una por una, el riesgo efectivo es menor de lo que sugiere el número:

- **Crítica — `websocket-driver` ≤0.7.4** (GHSA-mp7j-qc5w-4988): entra por
  `firebase → @firebase/database → faye-websocket`. `faye-websocket` es el transporte **de Node**; esta app
  usa RTDB solo desde el navegador (que usa el `WebSocket` nativo) y en el servidor usa `firebase-admin` y
  REST ([`requireApprovedUser.js:39`](../api/lib/requireApprovedUser.js#L39)). **No se ejecuta.**
- **Altas — `vite`**: está en `devDependencies`; afectan al dev server en Windows, no al build desplegado.

Igual conviene correr `npm audit fix` (hay arreglos sin *breaking changes*) para bajar el ruido y que el
próximo `audit` sea legible.

---

## 🟡 Medio

### 5. Listener vivo sobre un nodo fósil

[`MyProjectsView.jsx:535`](../src/views/MyProjectsView.jsx#L535) mantiene un `onValue` sobre `project_stages`,
un nodo que **nadie escribe**. Lo confirman los propios comentarios del repo:
[`completedProjectsArchive.js:33`](../src/utils/completedProjectsArchive.js#L33) y
[`ProjectDetailView.jsx:26`](../src/views/ProjectDetailView.jsx#L26) — *"hasn't been written to in a long time"*.
Las fechas reales por etapa salen del `statusHistory` de la planilla. Es descarga inútil y una pista falsa
para quien lea el código.

### 6. Código muerto que se mantiene y se compila

- **`GlobalFilterBar.jsx`** — **cero imports** en todo el repo. Escrita, con CSS propio, nunca conectada.
- **`CostAnalysisView.jsx`** — el único rastro es un comentario en
  [`DashboardView.jsx:734`](../src/views/DashboardView.jsx#L734): *"Cost Analysis Section relocated from CostAnalysisView"*.
  Se mudó el contenido y quedó el archivo.

### 7. Las reglas de RTDB no tienen CI

La **cobertura es correcta**: verifiqué los 33 nodos que usa el código contra `database.rules.json` y todos
tienen regla propia; `$other` deniega lectura y escritura. El problema es el despliegue: el único mecanismo
es manual (`npm run deploy:rules`, [`package.json:13`](../package.json#L13)) y **nada garantiza que lo
publicado en Firebase coincida con el archivo del repo**. Un `.md` bien escrito no es un control de acceso.

### 8. El lint está en rojo, así que no sirve de gate

209 errores. Además del #3:

- **`no-dupe-keys`** — `background` duplicado en [`MyProjectsView.jsx:2500`](../src/views/MyProjectsView.jsx#L2500)
  y [`PipelineView.jsx:717`](../src/views/PipelineView.jsx#L717) (código copiado). El primer valor (`'none'`)
  es muerto: gana el segundo. Efecto visual nulo, pero es exactamente la clase de error que un lint verde detectaría.
- **`react-hooks/purity`** — `Date.now()` durante el render en [`PipelineView.jsx:330`](../src/views/PipelineView.jsx#L330)
  genera el `id` de la nota. IDs inestables si React re-renderiza antes de confirmar.
- **64 `no-unused-vars`**, 12 `static-components`, 7 `set-state-in-effect`.

---

## 🔵 Bajo · higiene

9. **148 `console.*` y 16 `alert()`** en código de producción. Los `alert()` bloquean el hilo y no son
   theme-aware; conviene un toast (`react-hot-toast` ya está en dependencias).
10. **Bundle principal 1.025 kB** (324 kB gzip), con el warning subido a 2000 kB en
    [`vite.config.js:44`](../vite.config.js#L44) — silencia la señal en vez de resolverla. `EssView` (510 kB)
    y `logbookData` (400 kB, jsPDF) ya están en chunks lazy, que es lo correcto.
11. **La ficha compartible entrega de más.** `?project=SO` monta `ProjectDetailView` con `mergedData` **entero**
    ([`App.jsx:660`](../src/App.jsx#L660)), no solo el proyecto del link. Es consecuencia directa de #1; se
    cierra al cerrar aquel.

---

## ✅ Lo que está bien (y lo que se cerró desde julio)

La auditoría de `auditoria_dashboard_kpis.md` (2026-07-10) tenía 5 hallazgos. **Cuatro están corregidos:**

| hallazgo de julio | estado hoy |
|---|---|
| #1 `/api/*` sin autenticación | ✅ **cerrado** — `verifyAuth.js:33` verifica el ID token y `requireApprovedUser.js:39` valida rol+status, fallando cerrado |
| #2 Inyección de fórmulas en Sheets | ✅ **cerrado** — `sanitize()` en [`syncMapping.js:8`](../api/lib/syncMapping.js#L8) |
| #3 `predictBottlenecks` con fecha fija | ✅ **cerrado** — [`DashboardView.jsx:134`](../src/views/DashboardView.jsx#L134) pasa `new Date().toISOString()` |
| #5 comodín `$other` permisivo | ✅ **cerrado** — ahora `{".read": false, ".write": false}` |
| #4 `.env.local` mal formado | ⚠️ **no verificable** — el archivo está fuera de mi alcance de lectura |

Además, en este barrido:

- **Sin XSS**: cero usos de `dangerouslySetInnerHTML`. El chatbot parsea markdown a elementos React
  a propósito ([`ProjectChatbot.jsx:25`](../src/components/ProjectChatbot.jsx#L25)).
- **Sin secretos en el bundle**: las 7 variables `VITE_*` son todas config pública de Firebase.
  `GEMINI_API_KEY` y `GOOGLE_SERVICE_ACCOUNT_KEY` viven solo en el servidor.
- **`.env*` está en `.gitignore`** (línea 27) y no hay `.env` trackeado.
- **Escrituras concurrentes con lease**: `withArchiveLease` + `runTransaction`
  ([`archiveCoordinator.js:23`](../src/utils/archiveCoordinator.js#L23)) evita que dos pestañas pisen el archivo.
- **1176 tests** cubriendo parsers, reglas de ESS, sync mapping y permisos.

---

## Orden de trabajo sugerido

1. **#3 primero** (hooks) — mecánico, sin riesgo, y desbloquea el #1 de forma segura.
2. **#1** (planilla pública) — es el único hallazgo crítico y el de mayor impacto real.
3. **#7** (CI de reglas) — barato y elimina una clase entera de "creí que estaba desplegado".
4. **#5, #6, #8** — limpieza; dejan el lint utilizable como gate.
5. **#2** — no requiere acción hoy. Es un umbral a vigilar, no una tarea.

**Un solo hallazgo crítico.** El resto es deuda acotada o higiene. Para una app de ~26k LOC con
1176 tests en verde, es un resultado sólido: los cuatro hallazgos de la auditoría de julio que sí
eran graves están cerrados y verificados uno por uno.

## Lo que no pude verificar

- Si `database.rules.json` está realmente publicado en Firebase (requiere consola).
- El contenido de `.env.local` (fuera de alcance de lectura).
- Si `SYNC_SHEET_ID` apunta al mismo documento que se lee por CSV — es una env var del servidor.
- El peso real hoy de `project_notes` y `ess_files` en la base (requiere consola de Firebase).
- Comportamiento en runtime con varias pestañas abiertas: el análisis de listeners es estático.
