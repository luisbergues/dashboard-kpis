# AUDIT-FIXES — auditoría frontend (BUG-01 … BUG-14)

Correcciones de **UI / UX / robustez**. No se tocó la lógica de cálculo de KPIs,
las reglas de permisos/roles ni los endpoints de Firebase/Sheets.

- **Tests:** 1279 → **1285** en verde (106 archivos).
- **Build:** `npx vite build` sin errores.
- **Dependencias nuevas:** **ninguna**. La única que se evaluó fue una librería
  de virtualización para BUG-10; se descartó (ver ahí).
- **Sin commits**: solo se modificaron archivos, según tu regla de siempre.

---

## Mapeo bug → archivos

| Bug | Prio | Título | Archivos |
|---|---|---|---|
| BUG-01 | P0 | Desborde horizontal de la página | `src/index.css`, `src/views/PipelineView.css`, `src/views/CalendarView.css` |
| BUG-02 | P0 | Strings fuera de i18n + proxy de traducción ruidoso | `src/components/Navbar.jsx`, `src/utils/stageUtils.js`, `src/views/ProjectDetailView.jsx`, `src/utils/translations.js`, `src/utils/translateContent.js` |
| BUG-03 | P0 | La X ocultaba el widget de notificaciones entero | `src/components/NotificationBubble.jsx`, `src/components/NotificationBubble.css`, `src/App.jsx` |
| BUG-04 | P1 | Chart semanal con huecos y etiquetas en idioma del SO | `src/services/kpiCalculator.js`, `src/views/MyProjectsView.jsx`, `src/utils/translations.js` |
| BUG-05 | P1 | Afordancias inconsistentes en Calendar | `src/views/CalendarView.css` |
| BUG-06 | P1 | Contenedor de scroll de tablas sin regla | `src/index.css`, `src/views/MaterialsView.css` |
| BUG-07 | P1 | El FAB del chat tapaba controles destructivos | `src/index.css` |
| BUG-08 | P1 | Scrollbar parásito en tarjetas expandidas | `src/views/MyProjectsView.css` |
| BUG-09 | P2 | Arranque pesado, sin feedback de carga | `src/App.jsx`, `src/components/ViewSkeleton.jsx` *(nuevo)* |
| BUG-10 | P2 | Jank de scroll en Materials | `src/views/MaterialsView.jsx`, `src/views/MaterialsView.css`, `src/utils/translations.js`, `src/views/__tests__/MaterialsView.test.jsx` *(nuevo)* |
| BUG-11 | P2 | Scroll descolocado al cambiar de mes | `src/views/CalendarView.jsx` |
| BUG-12 | P3 | Sidebar colapsado sin nombre accesible / foco invisible | `src/components/Navbar.jsx`, `src/index.css` |
| BUG-13 | P3 | Líneas de texto demasiado largas | `src/index.css` |
| BUG-14 | P3 | Revisión responsive | `src/views/DashboardView.css` |

Extra no listado en la auditoría, encontrado al redirigir notificaciones:
notas de diseñador → **My Projects** en vez de Pipeline (`src/App.jsx`,
`src/views/MyProjectsView.jsx`).

---

## P0

### BUG-01 — El desborde de cualquier fila movía la página entera

**Causa raíz.** Un hijo de un contenedor flex usa `min-width: auto`, o sea el
ancho de su contenido: se niega a encogerse. En Pipeline la fila de
`.filter-chips` y el `input` de búsqueda de 330px fijos imponían su ancho a
toda la cadena `.app-container → .main-content → .view-header`, hasta `body`.
Como el sidebar es `position: fixed`, el scroll horizontal resultante lo
arrastraba también y se veía la app "corrida".

**Solución.**
- `min-width: 0` en la cadena de contenedores (`.app-container`,
  `.main-content`, `.view-header`, `.pipeline-view`, `.calendar-view`,
  `.calendar-layout`, `.calendar-container`).
- `html, body { overflow-x: hidden }` como red de seguridad: ningún desborde
  interno puede volver a mover la página.
- El scroll horizontal se contiene **dentro** del elemento que lo genera:
  `.filter-chips` con `overflow-x: auto` + `min-width: 0` + `max-width: 100%`,
  y `.chip { flex: 0 0 auto }` para que no se compriman.
- Debajo de 768px los chips **envuelven** en vez de scrollear (son pocos y dos
  filas se leen mejor que un carrusel en mobile).
- El `input` de búsqueda mantiene los 330px como base, pero con `min-width: 0`
  y `max-width: 100%` para poder encogerse.

**Verificación manual.** Pipeline a 375px de ancho: la página no debe scrollear
horizontalmente, el sidebar/tabbar queda quieto y los chips envuelven en dos
filas. A 900px los chips scrollean dentro de su fila, sin mover nada más.

---

### BUG-02 — Textos fuera del sistema de traducción + proxy ruidoso

**Causa raíz.** Dos problemas distintos con el mismo síntoma ("aparece en el
idioma equivocado"):

1. Strings fijos en código: `'Team Stats'` y `'Designer Perf.'` en el sidebar,
   y las etiquetas de `STAGES` en `stageUtils.js` (donde además `'Ingeniería'`
   quedaba en español con la app en inglés).
2. `translateContent.js` (el proxy Gemini para texto libre de la Sheet)
   reintentaba errores no recuperables y hacía `console.error` en cada render,
   inundando la consola.

**Solución.**
- Las etiquetas pasan por `t()`. `STAGES` gana un `labelKey` (el `id` es la
  clave de persistencia en `project_qa_checklist/{so}/{id}` y **no se tocó**);
  se conserva `label` como respaldo para contextos sin acceso a `t()`.
- Claves nuevas en EN y ES: `navbar.teamStats`, `navbar.designerPerf`,
  `stages.*`, `charts.*`, `admin.roleChangeError`. Hay un test de paridad
  EN/ES que falla si una queda sin traducir.
- `translateContent.js`: reintento sólo ante red/429/5xx (máx. 3, backoff
  400ms), caché en `sessionStorage` por hash del texto, y **un** `console.warn`
  por sesión en vez de un `console.error` por render.

**Verificación manual.** Cambiar ES ⇄ EN con el toggle: sidebar, etapas de
proyecto y leyendas de gráficos cambian de idioma. La consola no se llena de
errores rojos si el proxy de traducción falla.

---

### BUG-03 — La X hacía desaparecer las notificaciones por el resto de la sesión

**Causa raíz.** Una X de 22×22 flotaba sobre la campana; al tocarla se ocultaba
**todo** el widget (`isSuppressed`) sin confirmación, sin deshacer y sin forma
de recuperarlo salvo recargar. Lo que se perdía eran las alertas de
instalaciones urgentes y notas. La única vía de retorno era un efecto que lo
restauraba al entrar a Dashboard — invisible para el usuario.

**Solución.** Se eliminó `isSuppressed` y el prop `activeTab`. La X ahora cierra
el desplegable, que es lo que cualquiera espera de una X en un popover. Se
agregaron `aria-label` y `aria-expanded` a la campana; se borró el CSS de
`.notification-dismiss-btn`.

**Verificación manual.** Abrir la campana, tocar la X (o "Cerrar"): el
desplegable se cierra y la campana **sigue visible** con su contador. Navegar
entre tabs no cambia ese comportamiento.

---

## P1

### BUG-04 — "Projects Completed (Weekly)" con huecos y etiquetas del SO

**Causa raíz.** El eje X sólo contenía semanas **con** actividad: dos semanas
separadas por un hueco quedaban contiguas y con una sola semana el gráfico
degeneraba en puntos sueltos sin línea. Además las etiquetas usaban
`toLocaleString('default')` → el locale del **sistema operativo**, no el idioma
de la app, y las leyendas de las series estaban fijas en inglés.

**Solución.** `calculateWeeklyCompletions` rellena con 0 las semanas sin datos
entre la primera y la última, devuelve `weeksWithData`, formatea con el idioma
de la app (`es-ES` / `en-US`) y cada dataset expone un `labelKey` que la vista
resuelve con `t()`. Con menos de 2 semanas se muestra el mismo empty state que
ya usaba Team Stats.

> El **conteo** por semana no cambió: sólo se agregan semanas en cero y se
> traduce el rótulo.

**Verificación manual.** My Projects → Personal Analytics: el eje X avanza
semana a semana sin saltos; con un solo dato aparece el mensaje en vez de un
gráfico vacío; las leyendas cambian con el idioma.

---

### BUG-05 — En Calendar, cosas clickeables que no parecían clickeables

**Causa raíz.** `.cal-event` tenía `cursor: default` aunque el click **sí**
burbujeaba a la celda y abría el detalle del día. De ahí la sensación de que
los badges INST respondían y los FIN no: hacían lo mismo, pero uno parecía
inerte. Además el header del calendario era `flex-wrap: nowrap` con los dos
hijos en `flex-shrink: 0`, así que a anchos medios el botón "Add Custom Note"
se empujaba fuera del contenedor y quedaba clippeado contra la campana.

**Solución.** `cursor: pointer` en `.cal-event`, con las celdas deshabilitadas
(días fuera del mes) volviendo a `default` para no aparentar interacción. El
header pasa a `flex-wrap: wrap`: el título cede espacio primero
(`flex: 1 1 auto; min-width: 0`) y la acción conserva su tamaño pero puede bajar
de línea (`flex: 0 0 auto`).

**Verificación manual.** Pasar el mouse por cualquier badge de un día del mes
actual: mano. Sobre un día gris de otro mes: flecha. Achicar la ventana a
~800px: "Add Custom Note" baja de línea, no se corta.

---

### BUG-06 — Contenedores de tabla sin regla de scroll

**Causa raíz.** `.materials-table` mide `min-width: 800px`. Sus tres usos
esperaban un contenedor con scroll, pero:
- `.table-container` estaba definido **sólo** dentro de `MaterialsView.css`, así
  que Admin y el modal de PDF dependían de que esa vista estuviera cargada.
- `.table-responsive` (OrphanedProjectsPanel) **no tenía ninguna regla** en todo
  el proyecto: esa tabla desbordaba sin nada que la frenara.

**Solución.** Un único patrón en `index.css` — `overflow-x: auto`,
`-webkit-overflow-scrolling: touch`, `max-width: 100%`, `min-width: 0` — con los
tres nombres (`.table-scroll-container`, `.table-container`,
`.table-responsive`). En `MaterialsView.css` queda sólo lo propio de la vista.

**Verificación manual.** A 375px, en Materials y en Admin: la tabla scrollea
**dentro** de su tarjeta; la página no se mueve. En Admin → "Buscar huérfanos",
la tabla de resultados hace lo mismo.

---

### BUG-07 — El FAB del chat tapaba "Revoke Access"

**Causa raíz.** En desktop `.main-content` no reservaba espacio inferior; el FAB
(56px + 24px de offset) se montaba sobre los controles de la última fila. En
Admin llegaba a tapar "Revoke Access", que es una acción destructiva.

**Solución.** `padding-bottom: 96px` en `.main-content` a partir de 768px.

**Verificación manual.** Admin en desktop, scrollear hasta el final: el botón
"Revoke Access" del último usuario queda completamente clickeable, sin el FAB
encima.

---

### BUG-08 — Scrollbar parásito dentro de las tarjetas expandidas

**Causa raíz.** Los 6 `.stage-step` del timeline son `flex: 1` con
`min-width: auto`, o sea imponían su ancho de contenido. Aparecía un scrollbar
horizontal **dentro** de la tarjeta y todo su contenido se desplazaba.

**Solución.** `min-width: 0` + `max-width: 100%` en el contenedor del timeline.

**Verificación manual.** My Projects → expandir una tarjeta: el timeline de 6
etapas entra completo, sin barra de scroll interna.

---

## P2

### BUG-09 — Arranque pesado y sin feedback

**Causa raíz.** Todo era **un solo bundle de 1,644 kB** (506 kB gzip): abrir el
login descargaba también Designer Performance entera, las tablas de admin, el
generador de PDFs y el logbook. Mientras tanto la pantalla mostraba un renglón
de texto ("Loading application…") que no daba ninguna pista de lo que venía.

**Solución.**
- `React.lazy` + `<Suspense>` para 8 vistas. Quedan estáticas las cuatro que
  no conviene partir (ver más abajo).
- `ViewSkeleton` nuevo: placeholder con la forma de la página, en el mismo
  lenguaje visual que el skeleton que DashboardView ya usaba. Se usa tanto
  durante el fetch/auth inicial como de fallback del `<Suspense>`.
- El `<ErrorBoundary>` queda **por fuera** del `<Suspense>`: si falla la
  descarga de un chunk, React la propaga como error de render y tiene que
  atraparla el boundary.

**Resultado medido (`vite build`):**

| | antes | después | |
|---|---|---|---|
| JS inicial | 1.644,84 kB | **996,36 kB** | −39% |
| JS inicial (gzip) | 506,39 kB | **314,68 kB** | −38% |
| CSS inicial | 114,39 kB | **78,64 kB** | −31% |

**Por qué 4 vistas siguen estáticas.** `LoginView`, `DashboardView` y
`PipelineView` son las únicas que pueden ser la *primera* pantalla (login,
landing de ingeniería, landing de diseñador): partirlas sólo agregaría un
round-trip antes del primer render útil. **`CalendarView` es un caso aparte y
está documentado en el código**: su CSS es el que define los primitivos
compartidos de toda la app — `.btn-primary`, `.btn-secondary`, `.form-input`,
`.modal-overlay`, `.status-badge`, `.toggle-label` — que hoy llegan a las demás
vistas *sólo* porque ese import es estático. Se probó pasarla a lazy y dejaba
sin estilo al login, al modal de perfil del Navbar y a todos los modales. Ver
"Deuda técnica" al final.

Para verificarlo se auditó el grafo de imports: **cero** dependencias cruzadas
entre chunks lazy (ninguna vista lazy usa una clase definida en el CSS de otra).

**Verificación manual.** DevTools → Network, recarga dura: sólo debe bajar el
chunk `index`. Al entrar a Materials / Admin / Designer Performance aparece un
request nuevo y, si la red está lenta, el skeleton. **Todas las vistas deben
verse con estilo la primera vez que se abren**, sin pasar antes por Calendar.

---

### BUG-10 — Jank de scroll en Materials

**Causa raíz.** La matriz completa se renderizaba de una sola vez y cada fila
trae 4 badges con su propio SVG: con varios cientos de proyectos el árbol pasa
los ~10k nodos.

**Solución.** Render progresivo: 100 filas de entrada, botones "Ver más"
(+100) y "Ver todo", y un contador `mostradas / total` para que quede claro que
hay más abajo. Sin dependencias nuevas.

> **Por qué no virtualización.** Es la solución "correcta" para esto, pero
> requiere `@tanstack/react-virtual` (no instalada) y virtualizar un `<table>`
> real a mano es frágil. La vía sin JS —`content-visibility: auto`— **no sirve**
> acá: la especificación de CSS Containment excluye los elementos internos de
> tabla (`table-row`, `table-row-group`), así que no tiene efecto sobre `<tr>`.
> Dado tu punto 3 ("sin dependencias nuevas salvo que sean indispensables"),
> el render progresivo resuelve el jank sin sumar una.

De paso: `data.materialRequirements` ahora tiene guard (`?? []`) — antes, si
llegaba `data` sin esa sección, el `.map` sobre `undefined` tumbaba la vista — y
la `key` de fila pasa de `idx` a `item.so`.

**Cubierto por tests:** `src/views/__tests__/MaterialsView.test.jsx` (6 casos).

**Verificación manual.** Materials: se ven 100 filas y "100 / N". "Ver más" suma
100 sin perder las anteriores; "Ver todo" pinta el resto y esconde los botones.
Con menos de 100 proyectos no aparece ningún control.

---

### BUG-11 — El calendario quedaba cortado al cambiar de mes

**Causa raíz.** Un mes con 6 filas es más alto que uno con 5. Al cambiar de mes
la página cambiaba de alto sin avisar y el navegador conservaba el scroll
anterior: el header quedaba cortado a media altura.

**Solución.** `goToMonth()` lleva la vista al tope del calendario en cada cambio
(`scrollIntoView` dentro de `requestAnimationFrame`, para que corra después de
que React haya pintado el mes nuevo).

**Verificación manual.** Calendar, scrollear hasta abajo y pasar de mes con las
flechas: la vista vuelve al tope del calendario, con el header completo.

---

## P3

### BUG-12 — Sidebar colapsado sin nombre accesible + foco invisible

**Causa raíz.** Con el sidebar colapsado el `.nav-label` se oculta por CSS, así
que el botón se quedaba sin nombre accesible: en el árbol de accesibilidad
aparecía como un botón vacío. Y el `outline` por defecto del navegador estaba
pisado por varios resets, así que navegar por teclado era casi ciego.

**Solución.** `aria-label` (siempre presente) + `title` (tooltip al pasar el
mouse) + `aria-current="page"` en el tab activo. `type="button"` explícito.
Regla global de `:focus-visible` (outline azul 2px, `outline-offset: 2px`) sobre
`button, a, input, select, textarea, [tabindex]` — `:focus-visible` no molesta
al usuario de mouse.

**Verificación manual.** Colapsar el sidebar y recorrerlo con Tab: cada ítem
muestra un anillo azul visible y su tooltip. Con un lector de pantalla los
botones se anuncian por su nombre.

---

### BUG-13 — Líneas de texto demasiado largas

**Causa raíz.** El párrafo descriptivo de cada vista se estiraba a todo el ancho
disponible (hasta 1400px en desktop).

**Solución.** `max-width: 65ch` en `.view-header p` y `.view-subtitle` — el
ancho de línea legible estándar.

**Verificación manual.** Cualquier vista en pantalla ancha: el subtítulo corta
alrededor de los 65 caracteres en vez de cruzar toda la pantalla.

---

### BUG-14 — Revisión responsive

Se revisaron estáticamente los anchos fijos, los `minmax()` de grid y los
paneles flotantes contra los cuatro breakpoints objetivo. **Un hallazgo real:**

`.action-plan-split-container` (Dashboard → Action Plan) usaba
`minmax(320px, 1fr)`. A 375px de ancho quedan 279px útiles (24px de padding de
`.main-content` + 24px del `.glass-card`, por lado), así que la pista de 320px
desbordaba ~40px y las tarjetas quedaban cortadas a la derecha. Corregido con
`minmax(min(320px, 100%), 1fr)`: en desktop no cambia nada (el contenedor
siempre supera los 320px) y en mobile la columna se adapta.

Ya estaban bien y no se tocaron: el chatbot (`max-width: calc(100vw - 48px)`),
el popover de notificaciones (idem), el input de búsqueda de Pipeline
(`max-width: 100%`) y el resto de los `minmax()` (≤220px).

---

## Checklist de regresión

Recorrer las 8 secciones **en ES y en EN**, y **en tema claro y oscuro**
(4 pasadas). En cada una: la página **no** debe scrollear horizontalmente, y el
FAB del chat no debe tapar ningún control.

| # | Sección | Qué mirar |
|---|---|---|
| 1 | **Dashboard** | Action Plan entero visible a 375px (BUG-14). Textos del Action Plan traducidos. Subtítulo cortado a ~65ch (BUG-13). |
| 2 | **Pipeline** | Chips: envuelven <768px, scrollean dentro de su fila arriba de eso (BUG-01). Buscador se encoge sin empujar. Click en una notificación de instalación urgente aterriza acá, con la tarjeta resaltada. |
| 3 | **My Projects** | Tarjeta expandida sin scrollbar interna (BUG-08). Chart semanal: eje continuo, leyendas traducidas, empty state con <2 semanas (BUG-04). Click en una notificación de **nota de diseñador** aterriza acá (no en Pipeline), expande y resalta la tarjeta. |
| 4 | **Calendar** | Cursor mano sobre badges del mes, flecha sobre días grises (BUG-05). "Add Custom Note" baja de línea a ~800px, no se corta. Cambiar de mes vuelve al tope (BUG-11). |
| 5 | **Materials** | 100 filas + "100 / N". "Ver más" / "Ver todo" (BUG-10). Tabla scrollea dentro de su tarjeta a 375px (BUG-06). |
| 6 | **Team Stats** | Nombre del tab traducido (BUG-02). Tabla contenida. |
| 7 | **Designer Performance** | Carga como chunk aparte con skeleton, **con estilo correcto sin haber pasado por Calendar** (BUG-09). Nombre del tab traducido. |
| 8 | **Admin** *(super admin)* | "Revoke Access" del último usuario clickeable, sin FAB encima (BUG-07). Ambas tablas con scroll propio. Cambiar un rol y fallar muestra el error (`admin.roleChangeError`). |

**Transversal, una sola pasada:**

- **Notificaciones:** abrir la campana, tocar la X y "Cerrar" → sólo se cierra
  el desplegable, la campana sigue visible con su contador (BUG-03).
- **Teclado:** recorrer el sidebar colapsado con Tab → anillo azul visible y
  tooltip en cada ítem (BUG-12).
- **Red:** DevTools → Network, recarga dura → sólo baja el chunk `index`; cada
  vista nueva agrega su request (BUG-09).
- **Breakpoints:** repetir las secciones 1–5 a **375 / 768 / 1024 / 1440px**.

---

## Deuda técnica detectada (no corregida)

1. **Primitivos compartidos dentro de `CalendarView.css`.** ~200 líneas
   (`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.form-*`, `.modal-*`,
   `.status-badge`, `.toggle-*`) que usa toda la app viven en el CSS de una
   vista. Es lo único que impide partir Calendar en su propio chunk. Mudarlas a
   `index.css` es mecánico, pero es un cambio visual de superficie amplia que
   conviene hacer solo y verificar en navegador, no colgado de esta tanda.
   Mismo caso, más chico: `.focused-glow` vive en `PipelineView.css` y lo usa
   también My Projects (funciona porque Pipeline es estática).
2. **Clases usadas sin definir.** La auditoría del grafo de CSS encontró ~30
   clases referenciadas en JSX que no existen en ninguna hoja de estilos
   (`text-muted`, `nav-icon`, `analytics-card`, `deadlines-card`,
   `admin-users-view`, `design-quality-view`, …). Son previas a esta tanda y no
   rompen nada — pero varias parecen estilos que se perdieron en algún
   refactor y hoy se ven sin formato.
3. **El service worker sigue precacheando los 30 chunks.** El code splitting
   mejora el *parse/execute* del primer render, pero la descarga total en
   segundo plano no bajó. Cambiar eso afecta el comportamiento offline de la
   PWA y merece decidirse aparte.
4. **Stale-while-revalidate real.** El `queryFn` ya sirve del caché de RTDB
   dentro de la ventana de frescura, pero en arranque en frío el usuario espera
   el fetch completo. Partirlo en dos fases (pintar caché → revalidar) implica
   reestructurar la obtención de datos, que quedó explícitamente fuera de
   alcance.

---

## Recordatorio: reglas de Firebase sin publicar

Independiente de esta auditoría, pero sigue pendiente y bloquea funcionalidad:
`archive`, `archive_lock`, `checklistData`, `designer_performance_projects` y la
regla por-nota de `project_notes` están en `database.rules.json` pero **no
publicadas** en Firebase Console. Hasta publicarlas, Completed Projects sigue
dando `Permission denied` y los guardados de checklist fallan en silencio.
