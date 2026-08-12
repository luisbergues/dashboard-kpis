# Quotes reales — texto extraído

Texto tal como pdf.js lo saca de Quotes reales de JL Closets, con los datos de
cliente redactados (nombre, dirección, mail, teléfono, y el nombre de quien lo
preparó). Nada más se tocó: los encabezados, el orden de las columnas, los
cortes de renglón y los espacios están exactamente como vienen.

`parseQuoteText` consume un string, no un PDF, así que estos archivos alcanzan
para cubrir el parser entero. Se versionan a propósito: son la única evidencia
del formato real que existe en el repo.

| Archivo | Origen | Qué aporta |
|---|---|---|
| `area-mwic.txt` | Room 2.pdf | Área `MWIC`, un accesorio, color compuesto (`dune elm (white tossini elm)`), medidas `85T x 14D` |
| `summary.txt` | Summary.pdf | La hoja resumen: lista de áreas y totales, sin ítems |
| `area-garage.txt` | 5_GaragePricing_LF.pdf | Área `Garage` en minúsculas, color `White` + 2do color, con descuento |
| `area-ric.txt` | 3_Screenshot...pdf | Área `RIC` con descripción propia, tabla de accesorios con **otro orden de columnas** |

## Lo que estos archivos prueban sobre el formato

- **El área sale de un renglón `Area:` seguido del nombre**, no de un renglón
  suelto en mayúsculas. `Garage` no es mayúscula; `RIC` y `MWIC` sí, pero eso es
  coincidencia, no regla.
- **Los códigos de producto son numéricos**: `801.42.641`, `4501090`. No tienen
  la forma letras-guión-números que el parser buscaba.
- **La tabla de accesorios cambia el orden de las columnas** entre documentos.
- **El color vive en la tabla "Area Price"**, en una fila de datos debajo de un
  encabezado, sin ninguna etiqueta `Color:`.
- **El Quote trae medidas** (`85T x 14D`) y datos de alcance (`no backing`,
  `no tearout`) que el diseño asumía que venían del Contract.
- **Un trabajo son varios PDFs**: una hoja resumen más una por área. El
  generador hoy espera un único `quote.pdf`.
