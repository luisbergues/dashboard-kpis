// Forma de almacenamiento de project_tags/{so}/{tagId} y las proyecciones que
// consumen las vistas.
//
// Todo lo de aca es puro a proposito: es LA definicion de "sin leer" para
// Pipeline, My Projects, Calendar y el timeline de notas. Si cada vista la
// derivara por su cuenta, las cuatro se irian separando con el tiempo — que es
// exactamente lo que este feature tiene que evitar.

import { noteStorageKey } from './projectNotes';

/**
 * Clave compuesta proyecto+nota.
 *
 * El id de una nota es un Date.now() en string, asi que dos proyectos pueden
 * tener notas con el mismo id. Agrupar solo por noteId mezclaria los tags de
 * proyectos distintos.
 */
export function noteTagKey(so, noteId) {
  return `${so}::${noteId}`;
}

/**
 * Aplana el nodo (mapa SO -> mapa tagId -> tag) a un array.
 *
 * `id` y `so` salen de las CLAVES, no de los campos del cuerpo: la clave es la
 * ubicacion real del dato y el campo es una copia que podria haber quedado
 * desincronizada.
 */
export function normalizeTags(raw) {
  if (!raw) return [];
  const out = [];
  Object.entries(raw).forEach(([so, tagsForSo]) => {
    if (!tagsForSo || typeof tagsForSo !== 'object') return;
    Object.entries(tagsForSo).forEach(([tagId, tag]) => {
      if (!tag || typeof tag !== 'object') return;
      out.push({ ...tag, id: tagId, so: String(so) });
    });
  });
  return out;
}

/** Conjunto de notas que realmente existen, para detectar tags huerfanos. */
export function buildNoteIndex(projectNotesBySo) {
  const index = new Set();
  Object.entries(projectNotesBySo || {}).forEach(([so, notes]) => {
    (notes || []).forEach(note => {
      const key = noteStorageKey(note);
      if (key) index.add(noteTagKey(so, key));
    });
  });
  return index;
}

/**
 * Descarta los tags cuya nota ya no esta.
 *
 * Borrar una nota borra sus tags en la misma escritura (ver noteTags.js), asi
 * que en teoria no deberia haber huerfanos. Este filtro cubre los que puedan
 * haber quedado de antes de ese cambio: sin el, contarian como "sin leer" para
 * siempre y no habria forma de llegar a ellos desde la UI.
 */
export function liveTags(tags, noteIndex) {
  if (!noteIndex) return tags;
  return tags.filter(t => noteIndex.has(noteTagKey(t.so, t.noteId)));
}

const isUnread = (tag) => !tag.readAt;

/** { [so]: cantidad de tags sin leer }, de cualquier usuario. */
export function unreadByProject(liveTagList) {
  const out = {};
  liveTagList.filter(isUnread).forEach(t => {
    out[t.so] = (out[t.so] || 0) + 1;
  });
  return out;
}

/** Tags sin leer dirigidos a `uid`, del mas nuevo al mas viejo. */
export function unreadForMe(liveTagList, uid) {
  if (!uid) return [];
  return liveTagList
    .filter(t => isUnread(t) && t.taggedUid === uid)
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt);
      const tb = Date.parse(b.createdAt);
      // Un createdAt sin parsear no debe reordenar el resto: se lo trata como
      // el mas viejo. Mismo criterio que normalizeNotes en projectNotes.js.
      if (isNaN(ta) && isNaN(tb)) return 0;
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });
}

/** { [noteTagKey]: Tag[] } — incluye leidos y no leidos, para el timeline. */
export function tagsByNote(liveTagList) {
  const out = {};
  liveTagList.forEach(t => {
    const key = noteTagKey(t.so, t.noteId);
    if (!out[key]) out[key] = [];
    out[key].push(t);
  });
  return out;
}
