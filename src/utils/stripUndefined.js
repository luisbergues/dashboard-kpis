// Firebase rechaza `undefined` con "set failed: value argument contains
// undefined in property X", y el error llega como excepcion, no como valor de
// retorno. Alcanza con que un solo campo opcional venga sin definir para que
// falle el guardado entero.
//
// Pasa facil: los objetos que se guardan se arman con spread (`{...existing}`),
// y un spread SI copia las claves cuyo valor es undefined. Un campo opcional
// que todavia no tiene valor viaja como clave presente con valor undefined.
//
// Por eso se limpia en el borde, justo antes de escribir, y no en cada lugar
// que arma un objeto: es un solo punto por el que pasa todo.

/**
 * Copia el valor sin las claves cuyo valor es `undefined`, recursivamente.
 * Los arrays se conservan como arrays y `null` se respeta — Firebase lo acepta
 * y significa algo distinto de "ausente".
 */
export function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value === null || typeof value !== 'object') return value;
  // Date y demas objetos no planos se dejan intactos.
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out;
}
