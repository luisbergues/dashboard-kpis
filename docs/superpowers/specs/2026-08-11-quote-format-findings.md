# Formato real del Quote — hallazgos

**Fecha:** 2026-08-11
**Estado:** análisis cerrado, rediseño pendiente de decisiones del usuario

Evidencia: cuatro Quotes reales de JL Closets, texto extraído y redactado, en
`src/utils/essParsers/__tests__/fixtures/quotes/`. Confirmado por el usuario
como **el formato correcto** en que llegan los Quotes.

## Causa raíz anterior a todo lo demás: la extracción borra los renglones

`pagesToPlainText` (`src/utils/essPdfExtract.js:42`) hace
`page.items.map(i => i.text).join(' ')` — **una página entera queda como un
único renglón**. Los saltos de línea sólo separan páginas.

Todos los regex de `parseQuote.js` están anclados con `^...$`
(`AREA_HEADER_RE`, `ITEM_LINE_RE`, `COLOR_LABEL_RE`). Contra un renglón de
cientos de caracteres en mayúsculas y minúsculas mezcladas, ninguno puede
matchear jamás. El parser de Quote está muerto antes de mirar el formato.

`parseDrawings.js` se salva porque consume `pages[].items` con coordenadas, no
el texto plano. `parseContract.js` se salva a medias: sus regex no están
anclados, por eso `TEAROUT_RE` sí matchea.

**Corrección a la medición previa de este documento.** Los fixtures `.txt` los
generó `dump-pdf.mjs`, que reagrupa los fragmentos por coordenada `y` antes de
imprimirlos (líneas 47-57). O sea que los fixtures tienen la estructura de
renglones que la app descarta. La tabla de abajo mide una entrada que la app
nunca produce; es optimista. La corrida real da cero áreas en todos los casos.

| Fixture | `looksLikeQuote` | Áreas | Ítems | Color |
|---|---|---|---|---|
| `area-mwic` | false | MWIC | 0 | null |
| `area-ric` | false | RIC | 0 | null |
| `area-garage` | false | **0** | 0 | null |
| `summary` | false | MWIC | 0 | null |

Cero ítems en los cuatro, y `looksLikeQuote` falso en todos — la app rechaza
como "esto no parece un Quote" a un Quote legítimo.

El primer arreglo, previo a cualquier recalibración, es reconstruir renglones
por `y` en la extracción. `dump-pdf.mjs` ya tiene el algoritmo probado.

## Los supuestos equivocados

**1. El área no es un renglón en mayúsculas.** Sale de un renglón literal
`Area:` seguido del nombre en el renglón siguiente. `MWIC` y `RIC` matchean el
regex viejo por casualidad (son siglas); `Garage` no matchea nada, y ese Quote
queda sin ninguna área.

**2. Los códigos de producto son numéricos**: `801.42.641`, `4501090`. El
parser busca `letras-guión-números` (`VR-100`). Nunca puede matchear.

**3. Los ítems son una tabla, no un renglón `desc - código - Qty: n`.** Y el
orden de columnas cambia entre documentos:

- Garage: `Quantity / Sq. FT. | Product | Description | Product Code | Amt. | Selection | Total`
- RIC: `Products | Description | Amt. | Priced By | Quantity / Sq. FT. | Selection | Total`

**4. El color existe pero sin etiqueta.** Vive en la tabla `Area Price`, en una
fila de datos debajo del encabezado
`Description color 2nd color where Fronts Selection Amt.`. Valores reales
vistos: `dune elm (white tossini elm)`, `White` + `Silver Drift (Ctop)`.
Ninguno está en `COLOR_MAP`, que hoy sólo tiene `SNOW WHITE` y
`BLEACHED LINEN`.

## Lo que reordena el diseño de los tres documentos

El diseño original asumía tres roles: Contract → alcance (depósito, tearout,
baseboards), Quote → ítems por área, Drawings → dimensiones. Los documentos
reales no se reparten así.

**El alcance está en el Quote, no en un Contract aparte.** La descripción del
área de MWIC dice literalmente `no backing, no tearout`. Eso es exactamente lo
que `parseContract.js` busca con `TEAROUT_RE`.

**El depósito está en el Summary.** El Summary dice
`Deposit of 50% required to Secure price and set installation date`, que es lo
que `DEPOSIT_RE` y `looksLikeContract` buscan.

**El Quote trae dimensiones.** `85T x 14D` aparece tanto en la descripción del
área como en la descripción de Area Price. El diseño asumía que alto y
profundidad venían sólo de los planos.

**El Quote trae el tipo de frente.** La columna `Fronts` de Area Price trae
`Flat` o `n/a`. Hoy el ESS saca `fronts` de la matriz de materiales
(`thermofoil === 'Yes'`).

**Un trabajo son varios PDFs.** Una hoja `Summary` con las áreas y sus totales,
más un PDF por área. El generador hoy espera un único `quote.pdf` en una
pantalla de tres ranuras fijas.

## Contenido real del cierre, por si sirve al ESS

La columna `Description` de `Area Price` trae el alcance en prosa:

- Garage: `Uppers, Lowers, 1 set of drawers, 5 Tall Cabinets with Doors, 2 Open Tall Cabinets.`
- RIC: `Hanging, Shelving, 5 Drawers. Soft Closing. Standard rods and pull handles.`
- MWIC: `85T x 14D, no backing`

Es la descripción más fiel de lo que lleva el mueble que hay en todo el Quote,
pero es prosa: trae conteos (`5 Drawers`) y no medidas por cajón.

## Nota metodológica

La primera redacción de los fixtures usó `CLIENT ONE` en mayúsculas, lo que
hacía matchear el regex de área y producía un hallazgo falso (el nombre del
cliente detectado como área). Los nombres reales son Título Capitalizado y no
matchean. Los fixtures se corrigieron a nombres ficticios con la misma
capitalización que los reales (`Jane Doe`). La tabla de medición de arriba es
la posterior a esa corrección.

## Decisiones tomadas (usuario, 2026-08-11)

**1. Los archivos llegan como Summary + un PDF por ambiente.** Siempre. Un
proyecto de tres ambientes son cuatro archivos.

*Consecuencia:* la pantalla de carga de tres ranuras fijas
(Contract / Quote / Drawings) ya no representa la realidad. Hace falta carga
múltiple. Esto es lo más caro de todo el rediseño y es UI, no parser.

**2. La columna `Quantity / Sq. FT.` significa distinto según el producto.**
`4.00` en un barral son 4 unidades; `10.00` en Garage Feet son 10 pies.

*Consecuencia y riesgo:* inferir cuál es cuál a partir del nombre del producto
es exactamente el tipo de adivinanza silenciosa que causó los problemas
originales. La cantidad debe viajar **verbatim** junto al texto del producto,
para que el ingeniero lea `4.00 — Round Elite Closet rod(12"/Matt Nickel)` y
decida. No auto-clasificar unidades contra pies.

**3. Manda el Quote para color y tipo de frente.** Es lo que firmó el cliente.
La matriz de materiales queda como respaldo cuando el Quote no lo diga.

*Consecuencia:* `essOptionsFromMaterials()` deja de ser la fuente y pasa a ser
el fallback. Y hace falta un mapeo nuevo para la columna `Fronts`: el valor
real visto es `Flat` (y `n/a`), mientras el vocabulario del ESS es
`SLAB` / `THERMOFOIL`. `Flat` es casi seguro `SLAB`, pero **falta confirmarlo**
y falta saber qué otros valores existen. Es una tabla de lookup nueva, hermana
de `COLOR_MAP`.

**4. La prosa de `Area Price` → `Description` se copia tal cual a las notas**
de la página de esa área en la ESS. Sin interpretar, sin extraer conteos.

*Consecuencia:* nada que adivinar acá, y `5 Drawers` no genera filas
automáticas. El ingeniero lee la nota y completa.

## Corrida real end-to-end (SO #12116, 2026-08-12)

Primera corrida del generador con los tres documentos reales cargados:
Contract `1_1_2026 JL Closets Contract - HO.pdf`, Quote `Room 2.pdf` (el área
MWIC), Drawings `KDC_Drawings_James Aiello.pdf`. Warnings obtenidos:

```
DEPOSIT_NOT_FOUND
BASEBOARDS_NOT_FOUND
NO_AREAS_FOUND
COLOR_NOT_FOUND
UNCLASSIFIED_NUMBERS_MWIC: 412, 561, 14, 27, 14, 27, ... (≈55 números)
UNCLASSIFIED_NUMBERS_TOP SHELF IS REMOVABLE TO: 42, 44 5/8, 2 1/2, ... (≈60)
Drawing areas with no matching quote item:
  MWIC (1 openings) · TOP SHELF IS REMOVABLE TO (0) · MWIC (0)
```

**El Contract sí existe como documento aparte, y sí trae el tearout.** Cierra
la pregunta abierta: `TEAROUT_NOT_FOUND` **no** aparece en la lista, o sea que
`TEAROUT_RE` matcheó dentro del Contract. Los tres roles de documento siguen
en pie; lo que cambia es que el Quote *también* trae alcance, no que el
Contract sea prescindible.

**`DEPOSIT_RE` falla por una palabra.** Busca `Deposit: 50%`; el texto real
dice `Deposit of 50% required`. El `of` rompe el `[:\s]+`.

**El parser de planos tiene un problema propio, distinto del de Quote.**
Sobrevive al bug de renglones (usa coordenadas), pero:

- `findAreaName` toma el ítem en mayúsculas más alto de la página, y en un
  plano eso suele ser una nota: `TOP SHELF IS REMOVABLE TO` quedó como nombre
  de área. Hacen falta anclas más confiables que "está arriba y en mayúsculas".
- 1 opening en tres páginas contra ~115 números sin clasificar. La heurística
  de etiqueta `OPENING`/`HEIGHT`/`DEPTH` a menos de 60pt no describe cómo acota
  KDC: los planos usan líneas de cota, no la palabra escrita al lado.
- Lo bueno: el parseo de fracciones funciona. `23 1/4`, `5 5/8`, `21 5/8`,
  `44 5/8`, `85 3/16` salieron todos correctos. El arreglo de `parseInchValue`
  quedó confirmado contra un plano real.

## Corrida posterior al arreglo de renglones (mismo SO, 2026-08-13)

Confirmado contra el PDF real, no contra fixtures sintéticos:

- **`NO_AREAS_FOUND` desapareció.** El parser de Quote encuentra el área MWIC.
  La reconstrucción de renglones por `y` era, efectivamente, lo que faltaba.
- **Las dos áreas MWIC salieron de "sin ítem en el Quote".** La lista pasó de
  tres entradas a una: quedó sólo el área fantasma
  `TOP SHELF IS REMOVABLE TO`, que es el bug de `findAreaName` en los planos.
  O sea que el matcher ya está cruzando plano contra Quote.
- Siguen, como estaba previsto: `DEPOSIT_NOT_FOUND`, `BASEBOARDS_NOT_FOUND`,
  `COLOR_NOT_FOUND`, cero ítems, y los ~115 números sin clasificar.

## Lo que queda abierto

- Qué valores puede tomar la columna `Fronts` además de `Flat` y `n/a`, y a qué
  corresponde cada uno en el vocabulario del ESS.
- Falta el volcado de texto del Contract y de los Drawings (`dump-pdf.mjs`).
  Sin eso no se puede calibrar `BASEBOARDS_RE` ni el reconocimiento de cotas.
