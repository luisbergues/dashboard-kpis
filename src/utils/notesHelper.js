import { db, ref, set, get, isConfigured } from './firebase';

const CACHE_PREFIX = 'project_notes_';

/**
 * Adds a project note from the chatbot or other external components
 * @param {string} so - Project SO number
 * @param {string} text - Note content
 * @param {string} userName - Author name
 * @returns {Promise<Array>} The updated notes array
 */
export const addProjectNote = async (so, text, userName) => {
  const newNote = {
    id: Date.now().toString(),
    text: text.trim(),
    priority: false,
    createdAt: new Date().toISOString(),
    createdBy: userName || 'Asistente Chat'
  };

  let currentNotes = [];

  // Try loading current notes from Firebase
  if (isConfigured && db) {
    try {
      const notesRef = ref(db, `project_notes/${so}`);
      const snapshot = await get(notesRef);
      if (snapshot.exists()) {
        currentNotes = snapshot.val() || [];
      }
    } catch (error) {
      console.error('Failed to fetch notes from Firebase for adding:', error);
      // Fallback to local
      const local = localStorage.getItem(`${CACHE_PREFIX}${so}`);
      currentNotes = local ? JSON.parse(local) : [];
    }
  } else {
    const local = localStorage.getItem(`${CACHE_PREFIX}${so}`);
    currentNotes = local ? JSON.parse(local) : [];
  }

  // Prepend new note
  currentNotes.unshift(newNote);

  // Save to local storage
  localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(currentNotes));

  // Save to Firebase
  if (isConfigured && db) {
    try {
      const notesRef = ref(db, `project_notes/${so}`);
      await set(notesRef, currentNotes);
    } catch (error) {
      console.error('Failed to save notes to Firebase:', error);
    }
  }

  return currentNotes;
};
