// Forma de almacenamiento de project_notes/{so} en RTDB.
//
// Historicamente cada proyecto guardaba un ARRAY completo de notas, reescrito
// entero con set() en cada cambio. Eso hacia imposible expresar en las reglas
// de seguridad la unica restriccion que el negocio pide — solo ingenieria crea
// o resuelve notas tipo 'designer', porque descuentan KPI del disenador —: una
// regla no puede distinguir una nota recien creada de una preexistente que
// simplemente viaja de nuevo dentro del array reescrito.
//
// Ahora cada nota se guarda bajo su propia clave (project_notes/{so}/{noteId})
// y se escribe sola, asi la regla evalua exactamente la nota que cambia.
//
// Compatibilidad: RTDB ya serializaba los arrays viejos como objetos indexados
// ({0:…, 1:…}), asi que Object.entries() lee igual el formato viejo y el nuevo
// y NO hace falta migrar datos. Cada nota normalizada lleva su clave real de
// storage en `_key`, para que una nota vieja indexada se siga editando en su
// indice original en vez de duplicarse bajo una clave nueva.

// Campo interno que solo existe en memoria: nunca debe llegar a la base.
const INTERNAL_KEY_FIELD = '_key';

/**
 * Comparador por createdAt, del mas nuevo al mas viejo.
 *
 * Trata un createdAt sin parsear como la fecha mas vieja, para que no
 * reordene el resto. Es compartido entre el timeline de notas y la lista de
 * tags sin leer: si la regla de manejo de fechas invalidas cambia, tiene que
 * cambiar en los dos lugares a la vez, no copiar por separado.
 */
export function compareByCreatedAtDesc(a, b) {
  const ta = Date.parse(a.createdAt);
  const tb = Date.parse(b.createdAt);
  // Una nota sin createdAt parseable no debe reordenar el resto: se la
  // trata como la mas vieja en vez de producir NaN en la comparacion.
  if (isNaN(ta) && isNaN(tb)) return 0;
  if (isNaN(ta)) return 1;
  if (isNaN(tb)) return -1;
  return tb - ta;
}

// Convierte lo que devuelve RTDB (mapa por id, objeto indexado legacy, array,
// o null) en un array de notas ordenado de mas nueva a mas vieja.
export function normalizeNotes(raw) {
  if (!raw) return [];
  return Object.entries(raw)
    .filter(([, note]) => note && typeof note === 'object')
    .map(([key, note]) => ({ ...note, [INTERNAL_KEY_FIELD]: key }))
    .sort(compareByCreatedAtDesc);
}

// Aplica normalizeNotes a todo el nodo project_notes (mapa SO -> notas).
export function normalizeNotesBySo(raw) {
  if (!raw) return {};
  const out = {};
  Object.entries(raw).forEach(([so, notes]) => {
    out[so] = normalizeNotes(notes);
  });
  return out;
}

// Clave bajo la cual guardar una nota: la que ya tenia si venia de la base
// (incluido un indice numerico del formato viejo), o su id si es nueva.
export function noteStorageKey(note) {
  return String(note?.[INTERNAL_KEY_FIELD] ?? note?.id ?? '');
}

// Quita el campo interno antes de escribir. Sin esto, `_key` terminaria
// persistido dentro de la nota en cada edicion.
export function stripInternalFields(note) {
  // eslint-disable-next-line no-unused-vars
  const { [INTERNAL_KEY_FIELD]: _ignored, ...rest } = note;
  return rest;
}
