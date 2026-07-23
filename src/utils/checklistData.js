import { db, ref, set, get, remove, isConfigured } from './firebase';

const CACHE_PREFIX = 'checklist_data_';

/**
 * Saves Engineering Checklist state to LocalStorage and Firebase (if configured)
 * @param {string} so - Project SO number
 * @param {Object} checkedMap - { [itemId]: boolean }
 */
export const saveChecklistState = async (so, checkedMap) => {
  // 1. Save locally
  localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(checkedMap));

  // 2. Save to Firebase if available
  if (isConfigured && db) {
    try {
      const checklistRef = ref(db, `checklistData/${so}`);
      await set(checklistRef, checkedMap);
    } catch (error) {
      console.error('Failed to save Checklist data to Firebase:', error);
    }
  }
};

/**
 * Loads Engineering Checklist state from Firebase (primary) or LocalStorage (fallback)
 * @param {string} so - Project SO number
 * @returns {Object|null} { [itemId]: boolean } or null if not found
 */
export const loadChecklistState = async (so) => {
  // Try Firebase first
  if (isConfigured && db) {
    try {
      const checklistRef = ref(db, `checklistData/${so}`);
      const snapshot = await get(checklistRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Sync to local
        localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.error('Failed to load Checklist data from Firebase:', error);
    }
  }

  // Fallback to local storage
  const localData = localStorage.getItem(`${CACHE_PREFIX}${so}`);
  return localData ? JSON.parse(localData) : null;
};

/**
 * Deletes Checklist data for projects that are no longer active
 * @param {Array<string>} activeSOs - Array of active project SO numbers
 */
export const cleanupChecklistData = async (activeSOs) => {
  // 1. Cleanup LocalStorage
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      const so = key.replace(CACHE_PREFIX, '');
      if (!activeSOs.includes(so)) {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // 2. Cleanup Firebase
  if (isConfigured && db) {
    try {
      const checklistRootRef = ref(db, 'checklistData');
      const snapshot = await get(checklistRootRef);
      if (snapshot.exists()) {
        const allData = snapshot.val();
        for (const so of Object.keys(allData)) {
          if (!activeSOs.includes(so)) {
            const checklistProjectRef = ref(db, `checklistData/${so}`);
            await remove(checklistProjectRef);
            console.log(`Cleaned up Checklist data for completed project: ${so}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup Checklist data in Firebase:', error);
    }
  }
};
