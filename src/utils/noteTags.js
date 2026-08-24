import { db, ref, update, set } from './firebase';
import { stripInternalFields, noteStorageKey } from './projectNotes';
import { nameForUid } from './engineerDirectory';

// El id no puede salir del noteId ni del uid: una misma nota puede taggear a
// varias personas y una misma persona puede ser tageada en varias notas.
// Mismo criterio que newQuoteId en essFiles.js.
let tagSeq = 0;
function newTagId() {
  tagSeq += 1;
  return `tg_${Date.now()}_${tagSeq}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Arma los tags de una nota.
 *
 * Filtra en tres pasos, todos deliberados:
 *  - dedupe, porque el selector podria devolver repetidos;
 *  - fuera el propio autor, porque auto-notificarse no tiene sentido y
 *    ensuciaria el contador de la campana;
 *  - fuera los uids que no estan en el directorio, porque un tag a un uid que
 *    no existe no se lo puede leer nadie y quedaria sin leer para siempre.
 */
export function buildTags({ so, noteKey, taggedUids, directory, authorUid, authorName }) {
  const unique = [...new Set(taggedUids || [])];
  const createdAt = new Date().toISOString();
  return unique
    .filter(uid => uid && uid !== authorUid)
    .map(uid => ({ uid, name: nameForUid(directory, uid) }))
    .filter(({ name }) => Boolean(name))
    .map(({ uid, name }) => ({
      id: newTagId(),
      noteId: String(noteKey),
      so: String(so),
      taggedUid: uid,
      taggedName: name,
      taggedByUid: authorUid,
      taggedByName: authorName,
      createdAt,
      readAt: null,
    }));
}

/**
 * Escribe la nota y sus tags en una sola operacion atomica.
 *
 * Multi-path desde la raiz, mismo contrato que essFiles.saveEssFile usa para el
 * par archivo/indice: asi no puede existir un tag apuntando a una nota que no
 * se guardo, ni una nota que dice tener destinatarios sin tags que la
 * respalden.
 *
 * Propaga el error a proposito: el llamador tiene que poder avisar en pantalla
 * en vez de dar por hecho que guardo.
 */
export async function createNoteWithTags({ so, note, tags }) {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');
  // Usa noteStorageKey porque una nota de formato viejo puede tener un _key
  // diferente de su id, y buildNoteIndex también usa noteStorageKey para su
  // chequeo de orfandad: si usaramos note.id aqui, los tags quedarian marcados
  // como orfanos inmediatamente.
  const noteKey = noteStorageKey(note);
  const patch = {
    [`project_notes/${so}/${noteKey}`]: stripInternalFields(note),
  };
  (tags || []).forEach(tag => {
    patch[`project_tags/${so}/${tag.id}`] = tag;
  });
  await update(ref(db), patch);
}

/**
 * Borra una nota y sus tags juntos.
 *
 * Sin la cascada, los tags quedarian apuntando a una nota que ya no esta:
 * contarian como "sin leer" para siempre y no habria forma de llegar a ellos
 * desde la UI para marcarlos.
 */
export async function deleteNoteWithTags({ so, noteKey, tagIds }) {
  if (!db) throw new Error('FIREBASE_NOT_CONFIGURED');
  const patch = { [`project_notes/${so}/${noteKey}`]: null };
  (tagIds || []).forEach(tagId => {
    patch[`project_tags/${so}/${tagId}`] = null;
  });
  await update(ref(db), patch);
}

/**
 * Marca un tag como leido.
 *
 * Escribe la hoja `readAt` directamente y no el nodo entero: la regla habilita
 * ese campo puntual al destinatario, mientras que el resto del tag es inmutable
 * una vez creado. Un update sobre el padre seria rechazado.
 *
 * No propaga: marcar leido es un efecto secundario de navegar a la nota, y un
 * fallo no debe abortar la navegacion.
 */
export async function markTagRead({ so, tagId }) {
  if (!db || !so || !tagId) return;
  try {
    await set(ref(db, `project_tags/${so}/${tagId}/readAt`), new Date().toISOString());
  } catch (error) {
    console.warn('⚠️ No se pudo marcar el tag como leido:', error?.message || error);
  }
}
