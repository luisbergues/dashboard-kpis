# Retención de PDFs de ESS

**Fecha:** 2026-08-11
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Los tres PDFs que alimentan el generador de ESS (Contract, Quote, Drawings) se
guardan en RTDB como strings Base64 de hasta 7MB cada uno, bajo
`ess_files/{SO}/{docType}`. Hoy no existe ningún camino de limpieza: una vez
subidos quedan ahí para siempre, aunque el proyecto ya haya pasado por
ingeniería y esté en producción.

Esto ya había sido señalado en la review final de la rama `worktree-ess-generator`
como hallazgo diferido #9 ("`ess_files` no tiene retención"), postergado porque
requería una decisión de política que no le correspondía tomar a un revisor.

Los PDFs dejan de tener valor una vez que el proyecto fue checkeado y arrancó el
nesteo: a esa altura la ESS ya se generó, se revisó y se bajó a planta.

## Alcance

**Dentro:** la política de retención y su ejecución.

**Fuera:** el lugar de carga, que ya existe (pestaña ESS → proyecto → 3 slots) y
no se modifica. Tampoco se abre la carga a ingenieros: la feature sigue siendo
super-admin-only mientras esté en beta.

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Quién carga | Solo super admin | La feature está en beta; evita tocar reglas RTDB |
| Dónde se carga | Pestaña ESS, sin cambios | Ya existe y funciona |
| Qué se borra | Solo `ess_files` + `ess_file_index` | Son el peso real; el borrador es el producto de trabajo |
| Qué sobrevive | `essAutoData`, `ess_corrections` | El borrador se puede necesitar; las correcciones calibran los parsers |
| Cuándo | Al entrar en NESTING | El PDF ya cumplió su función |
| Cómo | Dos fases: marcar, después purgar | Ventana de recuperación ante un estado erróneo del sheet |
| Ventana | ≥ 7 días **y** una visita posterior | Ambas condiciones, no una sola |

## Arquitectura

### Dónde vive la marca

`ess_file_index/{SO}/purgeMarkedAt` — un campo ISO dentro del índice que ya
existe, **no un nodo nuevo**.

Esto es deliberado: un nodo nuevo obligaría a publicar reglas RTDB otra vez, y
las reglas recién se publicaron. `ess_file_index` ya tiene su bloque con
lectura/escritura para `engineer-admin`.

Es seguro porque todos los consumidores leen claves explícitas:

- `loadEssFileIndexEntry(so, docType)` pide un docType nombrado.
- `statusFor()` en `EssView.jsx` chequea `files.contract || files.quote || files.drawings`.

Ninguno itera las claves de `ess_file_index/{SO}` a ciegas, así que un campo
extra no los altera. El bloque de reglas no tiene `.validate`, así que tampoco
lo rechaza.

Cuando un proyecto se purga, se borra `ess_file_index/{SO}` entero, y la marca
se va con él.

### La política, como función pura

Módulo nuevo `src/utils/essRetention.js`, sin dependencia de Firebase:

```js
// ¿El proyecto llegó a NESTING o más allá?
// Usa STATUS_INDEX_MAP de stageUtils.js: NESTING=4, INSTALL=5, COMPLETED=5.
export function hasReachedNesting(project)

// Decide las tres transiciones para todos los proyectos de una.
// projects:  [{ so, status }]        — de data.priorityAnalysis
// fileIndex: { [so]: { contract?, quote?, drawings?, purgeMarkedAt? } }
// now:       number (Date.now())
// graceMs:   number (default 7 días)
export function planRetention({ projects, fileIndex, now, graceMs })
// → { toMark: [so], toUnmark: [so], toPurge: [so], orphans: [so] }
```

Toda la decisión vive acá y se testea sin tocar la base ni montar componentes.

Una capa fina aparte, en `essFiles.js`, ejecuta el plan:

```js
export async function markForPurge(so, markedAt)
export async function clearPurgeMark(so)
export async function purgeEssFiles(so)   // borra ess_files/{so} + ess_file_index/{so}
```

### Las tres transiciones

**Marcar** — el proyecto tiene al menos un archivo, llegó a NESTING, y no tiene
`purgeMarkedAt`. Se escribe `purgeMarkedAt = now`.

**Desmarcar** — el proyecto tiene `purgeMarkedAt` pero se da alguna de estas:

- su estado ya no está en NESTING o más (el sheet se corrigió), o
- algún archivo tiene `uploadedAt` posterior a `purgeMarkedAt` (se resubió).

Se borra la marca. Esta transición es la razón de ser del diseño de dos fases:
sin ella, un parpadeo del sheet borra archivos de forma irreversible.

**Purgar** — el proyecto tiene `purgeMarkedAt`, sigue en NESTING o más, y
`now - purgeMarkedAt >= graceMs`. Se borran `ess_files/{SO}` y
`ess_file_index/{SO}`.

Como el barrido corre al abrir la pestaña, exigir que hayan pasado 7 días
implica necesariamente una visita posterior: las dos condiciones del requisito
quedan cubiertas por una sola comparación.

**Huérfanos** — proyectos con archivos que no figuran en la lista del sheet. No
se puede evaluar su etapa, así que **no se tocan**; se devuelven en `orphans`
para mostrarlos y que un humano decida. Borrar a ciegas algo que no se puede
evaluar es exactamente lo que esta feature evita.

### Dónde corre

Un `useEffect` en `EssView.jsx`, con el mismo patrón que ya usa
`cleanupESSData` en `MyProjectsView.jsx`. Como la pestaña ESS está gateada a
super admin, los permisos de RTDB siempre alcanzan.

Corre después de que llegan `data.priorityAnalysis` y la suscripción a
`ess_file_index`, y sólo cuando ambos tienen contenido — un `fileIndex` vacío
por una lectura fallida no debe interpretarse como "no hay nada que hacer", ni
un `projects` vacío como "todos los proyectos son huérfanos".

## Interfaz

En la tabla de la pestaña ESS, un estado nuevo por fila:

- `Sin PDFs` / `PDFs cargados` / `ESS generada` (ya existen)
- **`Se borra en N días`** para los marcados

Después de una purga, un aviso con qué proyectos se limpiaron. Si hay
huérfanos, una lista aparte con su SO.

## Manejo de errores

Cada proyecto se procesa por separado, no en un `update` multi-path gigante: un
fallo en un proyecto no deja a otro a medio borrar ni frena el barrido. Los
fallos se loguean y se siguen — el barrido es oportunista y va a volver a correr
en la próxima visita.

El orden dentro de una purga importa: primero `ess_files/{SO}` (el peso), después
`ess_file_index/{SO}` (la marca). Si falla entre medio, el índice sobrevive con
su marca y el próximo barrido reintenta. Al revés dejaría archivos pesados sin
índice que los referencie, invisibles para la UI y para el propio barrido.

## Tests

El grueso va en `planRetention`, que al ser pura cubre todo sin mocks:

- marca un proyecto exactamente en NESTING
- marca uno en INSTALL y en COMPLETED (índice 5)
- no marca uno en PAPERWORK ni en CHECK
- no marca uno sin archivos
- no re-marca uno que ya tiene `purgeMarkedAt`
- desmarca cuando el estado retrocede antes de NESTING
- desmarca cuando un archivo se resubió después de la marca
- no purga antes de que pase la ventana
- purga cuando la ventana se cumplió exactamente y cuando se pasó
- devuelve como huérfano un SO con archivos ausente del sheet, sin marcarlo ni purgarlo
- tolera `status` vacío, nulo o desconocido sin romper

Para la capa de Firebase, tests de que `purgeEssFiles` borra los dos nodos y en
el orden correcto.

## Riesgos

**La purga es irreversible.** Recuperar significa volver a subir los tres PDFs.
La ventana de 7 días y el desmarcado automático son las dos defensas; no hay
papelera.

**Depende del `status` del sheet.** Si el sheet trae un estado incorrecto
sostenido por más de 7 días, los archivos se van. El desmarcado sólo protege de
errores transitorios.
