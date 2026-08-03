import { db, ref, set, get, isConfigured } from './firebase';
import { sanitizeFirebaseKey } from './firebaseKeys.js';
import { normalizeNotes, noteStorageKey, stripInternalFields } from './projectNotes';

const CACHE_PREFIX = 'project_notes_';

/**
 * Adds a project note from the chatbot or other external components
 * @param {string} so - Project SO number
 * @param {string} text - Note content
 * @param {string} userName - Author name
 * @param {string} imageUrl - Optional image URL
 * @returns {Promise<Array>} The updated notes array
 */
export const addProjectNote = async (so, text, userName, imageUrl = null) => {
  const newNote = {
    id: Date.now().toString(),
    text: text.trim(),
    priority: false,
    createdAt: new Date().toISOString(),
    createdBy: userName || 'Asistente Chat'
  };

  if (imageUrl) {
    newNote.imageUrl = imageUrl;
  }

  // Derive the RTDB path segment once. An SO with an illegal character would
  // otherwise make ref() throw and the note would be silently dropped by the
  // catch below, after the UI already showed it as saved.
  const soKey = sanitizeFirebaseKey(so);
  if (!soKey) throw new Error('addProjectNote: missing or invalid SO');

  // Un JSON corrupto en el cache local no debe impedir agregar una nota nueva:
  // se descarta el cache y se arranca de cero, en vez de lanzar y perder la
  // nota que el usuario acaba de escribir.
  const readLocalNotes = () => {
    const local = localStorage.getItem(`${CACHE_PREFIX}${soKey}`);
    if (!local) return [];
    try {
      const parsed = JSON.parse(local);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`⚠️ Corrupt local notes cache for ${soKey}, ignoring it:`, error);
      return [];
    }
  };

  let currentNotes = [];

  // Try loading current notes from Firebase. normalizeNotes cubre las dos
  // formas de almacenamiento (array indexado viejo y mapa por nota nuevo) —
  // sin esto, un snapshot en formato nuevo es un objeto y unshift explota.
  if (isConfigured && db) {
    try {
      const notesRef = ref(db, `project_notes/${soKey}`);
      const snapshot = await get(notesRef);
      if (snapshot.exists()) {
        currentNotes = normalizeNotes(snapshot.val());
      }
    } catch (error) {
      console.error('Failed to fetch notes from Firebase for adding:', error);
      // Fallback to local
      currentNotes = readLocalNotes();
    }
  } else {
    currentNotes = readLocalNotes();
  }

  // Prepend new note
  currentNotes.unshift(newNote);

  // Save to local storage
  localStorage.setItem(`${CACHE_PREFIX}${soKey}`, JSON.stringify(currentNotes));

  // Save to Firebase: solo la nota nueva, bajo su propia clave, para que la
  // regla de RTDB pueda evaluarla individualmente (ver projectNotes.js).
  if (isConfigured && db) {
    try {
      const noteRef = ref(db, `project_notes/${soKey}/${noteStorageKey(newNote)}`);
      await set(noteRef, stripInternalFields(newNote));
    } catch (error) {
      console.error('Failed to save notes to Firebase:', error);
    }
  }

  return currentNotes;
};
