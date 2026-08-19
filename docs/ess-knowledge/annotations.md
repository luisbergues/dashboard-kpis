# Anotaciones ESS — qué significa cada dato

Este archivo es el canal por el que Luis le explica al parser qué significan los
datos que hoy no entiende. **Vos escribís en lenguaje natural acá; Claude
convierte cada anotación en regla de código + test.** No hace falta que uses
ningún formato especial: alcanza con que quede claro qué texto aparece en el PDF
real y qué significa.

## Cómo usarlo

1. Cuando el ESS te muestre un warning que no debería estar, buscá su sección
   acá abajo y escribí debajo lo que sepas.
2. Si podés, pegá **el renglón exacto tal como sale del PDF**. Es lo más útil de
   todo: con el texto literal se escribe una regla que no falla, sin adivinar.
3. Decime la anotación que agregaste y yo la implemento.

Estado de cada anotación:
- `PENDIENTE` — escrito por Luis, todavía sin implementar.
- `IMPLEMENTADO` — ya hay regla y test que lo cubren.
- `DUDA` — Claude necesita que aclares algo antes de poder implementarlo.

---

## `NO_AREAS_FOUND`

**Qué hace hoy el código:** considera "área" a cualquier renglón entero en
mayúsculas (`^[A-Z][A-Z '&-]{2,40}$`).

**Estado: IMPLEMENTADO** (2026-08-14) — el parser ahora usa la etiqueta `Area:`
como señal primaria, igual que `detectQuoteArea`, y deja la regla de mayúsculas
sólo como respaldo cuando no hay etiqueta. Evidencia: los tres fixtures reales
en `src/utils/essParsers/__tests__/fixtures/quotes/`.

### Anotaciones tuyas

<!-- Si un Quote real usa otra etiqueta distinta de "Area:" para nombrar el
     ambiente, escribila acá con el renglón literal. -->

---

## `COLOR_NOT_FOUND`

**Qué hace hoy el código:** busca un renglón `Color: X`, `Finish: X` o
`Material: X`. Si no lo encuentra, busca un renglón que sea exactamente un color
ya listado en `COLOR_MAP` (`src/utils/essRules`).

**Por qué falla:** en los Quotes reales no existe ninguna etiqueta `Color:`. El
color vive dentro de la fila de datos de la tabla **Area Price**, en la columna
`color`, y suele ser compuesto:

```
Description color 2nd color where Fronts Selection Amt.
85T x 14D, no backing dune elm (white tossini elm) n/a n/a Included 1722.00
```

```
Description color 2nd color where Fronts Selection Amt.
Uppers, Lowers, 1 set of drawers, ... White Silver Drift (Ctop) Flat Included 10900.00
```

**Estado: PENDIENTE** — no está claro dónde termina la descripción y dónde
empieza el color, porque el texto viene todo en un renglón sin separadores.

### Anotaciones tuyas

<!-- Lo que más ayuda acá:
     1. ¿Existe una lista cerrada de colores que JL Closets vende? Si me la
        pasás, el parser puede buscar cualquiera de ellos dentro del renglón y
        el problema queda resuelto de raíz.
     2. En "White Silver Drift (Ctop) Flat": ¿el color es "White", el 2do color
        es "Silver Drift (Ctop)" y "Flat" es el tipo de frente?
     3. En "dune elm (white tossini elm)": ¿el color comercial es "dune elm" y
        lo del paréntesis es el equivalente de fábrica? -->

---

## `DEPOSIT_NOT_FOUND`

**Qué hace hoy el código:** busca el patrón `DEPOSIT` seguido de dos puntos o
espacios, y después un número con `%`. O sea que sólo matchea algo como
`Deposit: 50%` o `DEPOSIT 50 %`.

**Por qué falla:** si el Contract escribe el depósito con puntos de relleno
(`Deposit Required ......... 50%`), con la palabra en otro orden
(`50% deposit due at signing`), o como monto en dólares en vez de porcentaje
(`Deposit $5,344.00`), la regla no lo ve.

**Estado: PARCIALMENTE IMPLEMENTADO** (2026-08-14) — apareció evidencia real en
`fixtures/quotes/summary.txt`, que dice:

```
Deposit of 50% required to Secure price and set installation date.
```

O sea que **el depósito puede venir en el Quote, no sólo en el Contract**, y que
entre la palabra y el número hay texto ("of"). La regla ahora acepta hasta 40
caracteres de relleno entre `DEPOSIT` y el `%`, sin cruzar de renglón (para no
confundirlo con el `Discount 5.00%` que traen los Quotes). Cubre también
`Deposit Required ......... 50%`.

Falta: nadie llama a `parseContractText` sobre el texto del Quote, así que ese
50% del Summary todavía no se aprovecha.

### Anotaciones tuyas

<!-- Sigue faltando un Contract real. Pegá el renglón exacto del depósito tal
     como aparece en tu Contract, y decime:
     - ¿El depósito del Contract y el del Quote son siempre el mismo número?
     - ¿A veces viene en dólares en vez de porcentaje? Eso cambia el tipo de
       dato que hay que guardar. -->

---

## `BASEBOARDS_NOT_FOUND`

**Qué hace hoy el código:** busca `BASEBOARD`/`BASEBOARDS` y, dentro de los 40
caracteres siguientes, una de estas palabras: `INCLUDED`, `YES`, `NOT INCLUDED`,
`NO`.

**Por qué falla:** cualquier otra redacción no matchea — por ejemplo
`Baseboard removal by others`, `Baseboards: N/A`, o si la respuesta está a más
de 40 caracteres de la palabra (típico cuando es una tabla con dos columnas
separadas).

**Nota importante:** en los Quotes reales aparece `no backing, no tearout`
dentro de la descripción del área. Puede que el alcance (tearout / baseboards)
esté en el Quote y no en el Contract, al revés de lo que asume el diseño.

**Estado: PENDIENTE**

### Anotaciones tuyas

<!-- Pegá el renglón exacto de baseboards y, si sabés, decime en qué documento
     vive de verdad: Contract o Quote. -->

---

## `TEAROUT_NOT_FOUND`

**Qué hace hoy el código:** igual que baseboards, buscando la palabra `TEAROUT`.

**Estado: PENDIENTE** — mismo caso que baseboards. En `area-mwic.txt` aparece
como `no tearout` dentro de la descripción del área del **Quote**.

### Anotaciones tuyas

<!-- -->

---

## `UNCLASSIFIED_NUMBERS_<AREA>`

**Qué hace hoy el código:** en el PDF de planos, toma cada número y lo asigna a
una medida sólo si hay una etiqueta `OPENING`, `HEIGHT` o `DEPTH` a menos de 60
puntos de distancia. Todo número que quede sin etiqueta cerca se reporta acá,
en vez de adivinarlo.

**Por qué falla:** el plano tiene muchos números que no son medidas, y el
parser no tiene forma de distinguirlos. En la corrida real aparecieron
mezclados dos tipos muy distintos de número:

| Ejemplo del warning | Qué parece ser | Qué habría que hacer |
|---|---|---|
| `412`, `561` | Teléfono de JL Closets (5619129881) partido, o número de plano | Ignorar |
| `1, 2, 3, 4, 5, 6, 7, 9, 10, 11...` | Numeritos de globo / referencia de ítem del plano | Ignorar |
| `23 1/4`, `85 3/16`, `49 3/4`, `133 1/4` | Medidas de verdad, en pulgadas | Asignar a una dimensión |
| `14`, `27`, `42`, `82` | Ambiguo: `14` y `85` coinciden con `85T x 14D` del Quote | Hay que definirlo |

**Estado: PENDIENTE**

### Anotaciones tuyas

<!-- Lo más valioso que podés decirme acá:
     1. ¿Cómo distinguís VOS, mirando el plano, un número de globo de una
        medida? ¿Los de globo están dentro de un círculo, tienen otro tamaño de
        letra, están en un margen?
     2. ¿Las medidas fraccionarias (23 1/4) son SIEMPRE medidas? Si es así,
        alcanza con una regla: "si tiene fracción, es medida".
     3. ¿Hay un rango válido? Ej: "ninguna medida pasa de 150 pulgadas" haría
        que 412 y 561 se descarten solos. -->

---

## `TOP SHELF IS REMOVABLE TO` detectado como nombre de área

**Qué hace hoy el código:** `findAreaName` toma el renglón en mayúsculas que
esté más arriba en la página y lo usa como nombre del área.

**Por qué falla:** las notas del plano también están en mayúsculas, así que una
nota como `TOP SHELF IS REMOVABLE TO` gana y se convierte en un área falsa.

**Estado: PENDIENTE**

### Anotaciones tuyas

<!-- Ayudaría muchísimo:
     1. ¿El nombre del área en el plano está siempre en un lugar fijo (rótulo,
        esquina inferior derecha, cajetín)?
     2. ¿Podemos asumir que el nombre del área del plano SIEMPRE coincide con el
        del Quote (MWIC, RIC, Garage)? Si es así, el parser puede buscar sólo
        esos nombres en vez de adivinar. Esto también arreglaría el "MWIC
        (0 openings)" duplicado.
     3. ¿Hay una lista cerrada de nombres de ambiente que usan? (MWIC, RIC,
        Garage, Pantry, Laundry...) -->

---

## `ITEM_WITHOUT_AREA` / ítems que no se detectan

**Qué hace hoy el código:** espera renglones con la forma
`Descripción - CÓDIGO-123 - Qty: 4`.

**Por qué falla:** ningún Quote real tiene esa forma. Los reales son así:

```
Quantity / Sq. FT. Product Description Product Code Amt. Selection Total
10.00 Garage Feet(4"/Black) 4501090 35.00 Included 350
```

y el orden de las columnas **cambia entre documentos** (ver
`fixtures/quotes/README.md`). Además el código de producto es numérico
(`801.42.641`, `4501090`), no letras-guión-números.

**Estado: PENDIENTE**

### Anotaciones tuyas

<!-- 1. ¿Los códigos de producto tienen algún formato fijo? Vi `801.42.641`
        (con puntos) y `4501090` (sin puntos) — ¿son dos catálogos distintos?
     2. ¿La cantidad es siempre el primer número del renglón?
     3. ¿Tenés una exportación del catálogo de productos? Con la lista de
        códigos válidos el parser deja de adivinar por completo. -->

---

## Anotaciones nuevas

<!-- Si ves algo mal que no encaja en ninguna sección de arriba, escribilo acá
     abajo con un título y yo le armo su sección. -->
