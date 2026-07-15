import { db, ref, set, get, isConfigured } from './firebase';
import { sanitizeFirebaseKey } from './firebaseKeys.js';

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

  let currentNotes = [];

  // Try loading current notes from Firebase
  if (isConfigured && db) {
    try {
      const notesRef = ref(db, `project_notes/${soKey}`);
      const snapshot = await get(notesRef);
      if (snapshot.exists()) {
        currentNotes = snapshot.val() || [];
      }
    } catch (error) {
      console.error('Failed to fetch notes from Firebase for adding:', error);
      // Fallback to local
      const local = localStorage.getItem(`${CACHE_PREFIX}${soKey}`);
      currentNotes = local ? JSON.parse(local) : [];
    }
  } else {
    const local = localStorage.getItem(`${CACHE_PREFIX}${soKey}`);
    currentNotes = local ? JSON.parse(local) : [];
  }

  // Prepend new note
  currentNotes.unshift(newNote);

  // Save to local storage
  localStorage.setItem(`${CACHE_PREFIX}${soKey}`, JSON.stringify(currentNotes));

  // Save to Firebase
  if (isConfigured && db) {
    try {
      const notesRef = ref(db, `project_notes/${soKey}`);
      await set(notesRef, currentNotes);
    } catch (error) {
      console.error('Failed to save notes to Firebase:', error);
    }
  }

  return currentNotes;
};
