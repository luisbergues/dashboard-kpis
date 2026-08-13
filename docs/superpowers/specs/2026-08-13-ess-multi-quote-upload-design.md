# Carga de varios Quotes por proyecto — diseño

**Fecha:** 2026-08-13
**Estado:** diseño aprobado por el usuario, pendiente de plan de implementación

## El problema

La pantalla de carga tiene tres ranuras fijas: Contract, Quote, Drawings. Un
Quote real no es un archivo: es una hoja `Summary` con la lista de ambientes
más **un PDF por ambiente**. Un trabajo de tres ambientes son cuatro archivos y
hoy entra uno solo.

Consecuencia directa: la app no puede saber cuántos ambientes tiene un trabajo,
que es justamente lo que el generador necesita para armar una página de ESS por
ambiente.

Contexto completo del formato en
[2026-08-11-quote-format-findings.md](2026-08-11-quote-format-findings.md).

## Decisiones tomadas

Del análisis del formato (2026-08-11):

1. Los archivos llegan como Summary + un PDF por ambiente.
2. La cantidad (`Quantity / Sq. FT.`) viaja verbatim, sin auto-clasificar.
3. El Quote manda para color y tipo de frente; la matriz de materiales es
   respaldo.
4. La prosa de `Area Price → Description` se copia tal cual a las notas.

De esta ronda (2026-08-13):

5. **El Summary es obligatorio.** Se sube y se guarda siempre.
6. **Los planos son un archivo único** para todo el trabajo, con una página por
   ambiente, como el `KDC_Drawings` ya visto.
7. **No hay migración.** Los archivos cargados con el modelo viejo se vuelven a
   subir. La ESS ya generada se conserva.
8. **Las páginas se agrupan por color, no por ambiente.** Ambientes con el mismo
   conjunto de colores comparten hoja; un conjunto distinto abre una hoja nueva.
9. **El color sale del Quote**, de la tabla `Area Price`, columnas `color` y
   `2nd color where`.

## De dónde sale la lista de ambientes

**El renglón `Area:` de cada Quote.** La cantidad de ambientes de un trabajo es
la cantidad de Quotes cargados.

El Summary parece la fuente más natural, y a futuro lo será, pero la evidencia
disponible no alcanza todavía: hay **un solo Summary de muestra y tiene un solo
ambiente**, así que la estructura de su tabla de áreas con múltiples filas es
desconocida. El renglón `Area:` en cambio está verificado contra tres Quotes
reales (MWIC, RIC, Garage) y sale limpio en los tres.

El Summary se sube y se guarda igual desde el día uno. Cuando haya un Summary
multi-ambiente de muestra se agrega el cruce, que es lo que va a permitir
avisar *"el Summary lista 3 ambientes y subiste 2, falta Garage"*. Ese agregado
no cambia ni el almacenamiento ni la pantalla definidos acá.

## Almacenamiento

Hoy:

```
ess_files/{SO}/{contract|quote|drawings}      = { name, mimeType, data, uploadedAt }
ess_file_index/{SO}/{contract|quote|drawings} = { name, uploadedAt }
ess_file_index/{SO}/purgeMarkedAt             = ISO string
```

Nuevo:

```
ess_files/{SO}/contract                       = { name, mimeType, data, uploadedAt }
ess_files/{SO}/summary                        = idem          ← nuevo
ess_files/{SO}/drawings                       = idem
ess_files/{SO}/quotes/{quoteId}               = { name, mimeType, data, uploadedAt, area }
ess_file_index/{SO}/contract|summary|drawings = { name, uploadedAt }
ess_file_index/{SO}/quotes/{quoteId}          = { name, uploadedAt, area }
ess_file_index/{SO}/purgeMarkedAt             = ISO string
```

`quoteId` es una clave generada, no el nombre del archivo: los nombres se
repiten entre proyectos (`Room 2.pdf`) y el ambiente no se conoce hasta
parsear el PDF, así que no sirve como identidad en el momento de escribir.

`area` se guarda en la entrada al subir, para que el listado muestre el
ambiente sin volver a abrir el PDF. Es un dato derivado y cacheado: la
generación vuelve a parsear el archivo y no confía en este campo.

### No hace falta republicar reglas

`database.rules.json:161-168` otorga `.read`/`.write` sobre los nodos raíz
`ess_files` y `ess_file_index` completos, sin reglas por hijo. Cualquier forma
anidada debajo queda cubierta por lo que ya está publicado. Esto es una
restricción real del proyecto: publicar reglas es un paso manual en la Firebase
Console y ya bloqueó una feature antes.

## Detección del ambiente

Hoy no existe código que lea el ambiente de un Quote. `parseQuote.js` usa
`AREA_HEADER_RE = /^[A-Z][A-Z '&-]{2,40}$/`, que matchea `MWIC` y `RIC` por
casualidad —son siglas— y **falla con `Garage`**. Ese regex se reemplaza en el
rewrite del parser; este cambio necesita una pieza mucho más chica y aislada:

```
detectQuoteArea(text) -> string | null
```

Busca el renglón literal `Area:` y devuelve el contenido del renglón siguiente.
Verificado contra los tres fixtures reales: `MWIC`, `RIC`, `Garage`. Vive en
`essParsers/parseQuote.js` y se exporta aparte de `parseQuoteText`, para que el
rewrite del parser pueda avanzar sin romper la carga de archivos.

**Cuándo corre:** al subir, en el mismo punto donde ya corre el chequeo de
"¿esto parece un Quote?" en `handleFileSelect`. El resultado se pasa a
`addEssQuote` y queda guardado en la entrada del índice.

**Si no detecta nada:** el Quote se sube igual y la fila queda como *"Ambiente
sin detectar"*, con un campo para escribirlo a mano. No se rechaza el archivo ni
se inventa un nombre. Es el mismo criterio que el resto del pipeline: preferir
un hueco visible antes que una adivinanza silenciosa.

**Si dos Quotes declaran el mismo ambiente:** se suben los dos y se marcan como
duplicados en la lista. Puede ser un error de carga o dos hojas del mismo
ambiente, y la app no tiene forma de saber cuál es. Decide el ingeniero.

## Cambios de API en `essFiles.js`

Se conserva sin cambios, ahora para tres singulares en vez de dos:

- `saveEssFile(so, docType, file)` con `docType ∈ {contract, summary, drawings}`
- `loadEssFile(so, docType)`
- `loadEssFileIndexEntry(so, docType)`

Se agrega:

- `addEssQuote(so, file, area)` — genera el `quoteId` y escribe las dos rutas en
  el mismo `update()` atómico que ya usa `saveEssFile`, para que el índice nunca
  describa un archivo que no está.
- `removeEssQuote(so, quoteId)` — borra las dos rutas. Primero el nodo pesado,
  después el índice, por la misma razón que `purgeEssFiles`: si falla en el
  medio, queda el índice apuntando a algo que no está (visible y reintentable)
  y no megabytes de Base64 sin nada que los referencie (invisible).
- `loadEssQuoteIndex(so)` — metadata de todos los Quotes, sin los Base64.
- `loadEssQuotes(so)` — los Quotes completos, sólo para generar.

`addEssQuote` incluye en su `update()` un `ess_files/{SO}/quote: null` y
`ess_file_index/{SO}/quote: null`, que borra el Quote singular del modelo viejo.
Es una línea, no código de migración: sin eso quedan megabytes de Base64
huérfanos hasta que se dispare la retención.

## Retención

`essRetention.js` recorre hoy un `DOC_TYPES` fijo de entradas escalares en dos
lugares, y ambos ignorarían una colección anidada:

- `hasAnyFile(entry)` — un SO con sólo Quotes cargados daría `false` y quedaría
  **fuera de la retención por completo**, o sea sus PDFs no se borrarían nunca.
- `latestUploadAt(entry)` — no vería la subida de un Quote posterior a la marca,
  así que no cancelaría un borrado programado.

Ambas pasan a recorrer también los valores de `entry.quotes`. `purgeMarkedAt`
sigue siendo un hermano de las claves de documento y sigue leyéndose por nombre,
así que no se confunde con la colección. El borrado no cambia: ya elimina el
nodo entero del SO.

## Agrupación de páginas por color

**Una página de ESS no es un ambiente: es un conjunto de colores.** Los
ambientes que comparten exactamente los mismos colores se generan juntos en una
sola hoja; un ambiente con otro conjunto se lleva su propia hoja. Por eso el
campo del encabezado dice `ROOM(S)` en plural.

La clave de agrupación es el **conjunto completo de colores** del ambiente. No
alcanza con que se solapen en alguno:

| Ambiente A | Ambiente B | ¿Misma página? |
|---|---|---|
| `{White}` | `{White}` | sí |
| `{White, Sand Linen}` | `{White, Sand Linen}` | sí |
| `{White}` | `{White, Sand Linen}` | **no** |
| `{White, Silver Drift (Ctop)}` | `{White, —}` | **no** |

La última fila es el caso real de los fixtures: Garage y RIC comparten el color
principal pero no el segundo, así que van separados.

`n/a` y `—` significan lo mismo —sin segundo color— y se normalizan antes de
comparar. Sin eso, dos ambientes idénticos escritos distinto quedarían en hojas
separadas.

**En el encabezado de la página**, `ROOM(S)` lista los ambientes del grupo y
`COLOR` muestra el conjunto de colores del grupo, traducido a código de taller
por `COLOR_MAP` donde exista. Como todos los ambientes de una página comparten
el mismo conjunto por construcción, no hay ambigüedad posible en ese campo.

## De dónde sale el color

De la tabla `Area Price` de cada Quote, columnas `color` y `2nd color where`.
Una fila real:

```
Description                                     color   2nd color where      Fronts
Uppers, Lowers, 1 set of drawers, 5 Tall Ca...  White   Silver Drift (Ctop)  Flat
```

**El color es por ambiente, no del trabajo.** Hoy `resolveColor(quote, project)`
devuelve un color único para todo el Quote; pasa a resolverse por área.

**Y se cae el fallback a `project.color`.** `resolveColor` hoy usa el color del
registro del proyecto cuando el Quote no dice nada. En producción eso ya era
letra muerta —el registro que arma el Google Sheet no tiene campo de color, como
documenta el comentario de la propia función— así que sólo lo ejercitaban los
tests. El color pasa a salir únicamente del Quote.

**Se lee por coordenada x, no partiendo el renglón con regex.** La columna
`Description` contiene comas, espacios y puntos, así que cualquier separación
por texto es frágil. `extractPdfPages` ya entrega la posición de cada fragmento,
así que las columnas son rangos de x: se ubica la fila de encabezado
(`Description color 2nd color where Fronts Selection Amt.`), se toma la x de
cada título como borde de columna, y cada fragmento de la fila de datos cae en
la columna cuyo rango lo contiene.

## Generación

`buildEssPages({ project, contract, quote, drawings, boxType, fronts })` recibe
hoy un único `quote` y produce una página por área. Pasa a recibir `quotes` como
arreglo y a producir **una página por conjunto de colores**, agrupando las áreas
según la regla de arriba.

Lo que eso arrastra dentro de `buildEssPages`:

- `headerFor` recibe la lista de ambientes del grupo en vez de un nombre suelto.
- Los cajones y barrales de todos los ambientes del grupo se concatenan en la
  misma página. Esto ya funciona sin cambios: cada fila lleva su propio campo
  `room`, así que una hoja con tres ambientes igual identifica fila por fila a
  cuál pertenece.
- La nota de tearout, que hoy escribe `quoteArea.name`, pasa a nombrar cada
  ambiente del grupo al que aplica.
- `ROD_SIZE_AMBIGUOUS_{area}` sigue siendo por área, no por página: la
  ambigüedad es entre los vanos de un ambiente y agruparla por color la
  volvería ilegible.

`handleGenerate` carga los N Quotes, parsea cada uno y arma el arreglo. La
condición para habilitar el botón pasa a ser: Contract + Summary + Drawings +
al menos un Quote.

## Pantalla

Arriba, tres ranuras fijas para los singulares: **Contract**, **Summary**,
**Drawings**.

Abajo, una sección **Ambientes** con:

- el conteo visible (*"3 ambientes"*), que es el pedido original;
- una fila por Quote cargado, con el ambiente detectado, el nombre del archivo y
  un botón para quitarlo;
- un botón *Agregar Quote*.

Acá se resuelven los dos puntos de accesibilidad que se difirieron a propósito
en la auditoría del 2026-08-13, porque el componente donde vivían se reescribe
en este cambio:

- el `<input type="file">` con `display: none` dentro de un `<label>` no es
  alcanzable por teclado;
- las tres ranuras no tenían `aria-label`, así que un lector de pantalla no
  distinguía una de otra.

## Lo que este cambio NO hace

**Los ítems del Quote siguen sin extraerse.** `ITEM_LINE_RE` busca
`descripción - código - Qty: n` y los ítems reales son una tabla con códigos
numéricos y orden de columnas variable entre documentos. Eso queda para el
rewrite del parser. En la práctica: los accesorios de la tabla `Accessories`
—barrales, herrajes— no van a aparecer en la ESS todavía.

Lo que sí queda funcionando de punta a punta: los ambientes, su agrupación por
color, el campo `COLOR`, el campo `ROOM(S)`, y los cajones derivados de los
vanos del plano.

Tampoco toca `PDFGeneratorModal` ni `IPGeneratorModal`, que comparten CSS con el
modal de ESS pero no su flujo de archivos.

## Nota de alcance

Este diseño creció respecto de lo aprobado inicialmente. Empezó como "poder
subir varios Quotes" y terminó incluyendo la extracción de color por área y la
agrupación de páginas, porque la regla de agrupación que define el usuario
—ambientes con los mismos colores comparten hoja— hace imposible separarlas: sin
el color no se sabe cuántas páginas hay.

Sigue siendo una sola feature coherente, pero conviene que el plan de
implementación la parta en etapas verificables por separado, empezando por el
almacenamiento y la pantalla, que no dependen de nada de lo anterior.

Tampoco toca `PDFGeneratorModal` ni `IPGeneratorModal`, que comparten CSS con el
modal de ESS pero no su flujo de archivos.

## Pruebas

Todo lo que no es React se prueba sin Firebase, siguiendo lo que ya hace el
repo:

- `essRetention.js` es puro: los casos nuevos (SO con sólo Quotes, Quote subido
  después de la marca) son tests de tabla como los existentes.
- `essFiles.js` se prueba contra el `update()` mockeado, verificando que las dos
  rutas salgan en el mismo write y que el borrado del `quote` viejo esté
  incluido.
- La pantalla se prueba con Testing Library como `EssView.test.jsx`: conteo de
  ambientes, alta y baja de un Quote, y el botón de generar habilitándose sólo
  con los cuatro requisitos.
- `detectQuoteArea` se prueba contra los tres fixtures reales ya commiteados en
  `essParsers/__tests__/fixtures/quotes/`, incluido `area-garage.txt`, que es el
  que rompe el regex actual.
- La agrupación por color es una función pura sobre áreas ya parseadas, así que
  se prueba directo con las cuatro combinaciones de la tabla de arriba, más la
  normalización de `n/a` contra `—`.
- La lectura de columnas por coordenada x necesita fixtures **con posiciones**,
  que los `.txt` actuales no tienen: son texto ya aplanado. Hay que agregar
  fixtures en JSON con la forma `{ text, x, y, width, height }` que devuelve
  `extractPdfPages`, generados con `dump-pdf.mjs --pos` desde los Quotes reales.

## Lo que queda abierto

- Conseguir un Summary de un trabajo multi-ambiente para agregar el cruce que
  detecta Quotes faltantes.
- Qué valores puede tomar la columna `Fronts` además de `Flat` y `n/a`.
- Los volcados de texto del Contract y de los Drawings, que siguen faltando
  para calibrar `BASEBOARDS_RE` y el reconocimiento de cotas.
