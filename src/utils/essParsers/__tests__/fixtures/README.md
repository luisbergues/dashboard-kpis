# PDFs de muestra para calibrar los parsers de ESS

Dejá acá los tres PDFs de un mismo proyecto real, con estos nombres exactos:

```
contract.pdf
quote.pdf
drawings.pdf
```

`realPdfs.test.js` (en el directorio de arriba) los levanta y corre el pipeline
completo — extracción, los tres parsers y `buildEssPages` — igual que lo hace la
app. Si no están, ese test **se saltea solo**, así que el repo sigue verde para
cualquiera que no los tenga.

## Por qué hacen falta

Hasta ahora los parsers están calibrados contra input sintético únicamente. El
formato de dimensiones (`23 5/8"`) se dedujo de los `DEFAULT_DRAWERS` del propio
`PDFGeneratorModal.jsx`, que es evidencia interna fuerte pero no es un Drawings
real. Estas tres heurísticas son las que más probablemente necesiten ajuste
contra documentos reales:

- `parseQuote.js` — `AREA_HEADER_RE` e `ITEM_LINE_RE` asumen
  `"{descripción} - {código} - Qty: {n}"`.
- `parseDrawings.js` — `MAX_LABEL_DISTANCE = 60` puntos entre una etiqueta
  (OPENING/HEIGHT/DEPTH) y su número. Es el número más frágil de todo el
  pipeline.
- `parseContract.js` — detección de tearout y baseboards.

## Datos de cliente

Estos PDFs son documentos comerciales reales. `.gitignore` de este directorio
los excluye del repo a propósito — quedan sólo en tu máquina. Si alguna vez
querés commitear un juego de fixtures, usá un proyecto ficticio o redactá
nombre, dirección y precios primero.
