import { db, ref, set, get, remove, isConfigured } from './firebase';

const CACHE_PREFIX = 'logbook_data_';

/**
 * Saves Logbook data to LocalStorage and Firebase (if configured)
 * @param {string} so - Project SO number
 * @param {Object} data - Logbook form data
 */
export const saveLogbookData = async (so, data) => {
  // 1. Save locally
  localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(data));

  // 2. Save to Firebase if available
  if (isConfigured && db) {
    try {
      const logbookRef = ref(db, `logbookData/${so}`);
      await set(logbookRef, data);
    } catch (error) {
      console.error('Failed to save Logbook data to Firebase:', error);
    }
  }
};

/**
 * Loads Logbook data from Firebase (primary) or LocalStorage (fallback)
 * @param {string} so - Project SO number
 * @returns {Object|null} Logbook data or null if not found
 */
export const loadLogbookData = async (so) => {
  // Try Firebase first
  if (isConfigured && db) {
    try {
      const logbookRef = ref(db, `logbookData/${so}`);
      const snapshot = await get(logbookRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Sync to local
        localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.error('Failed to load Logbook data from Firebase:', error);
    }
  }

  // Fallback to local storage
  const localData = localStorage.getItem(`${CACHE_PREFIX}${so}`);
  return localData ? JSON.parse(localData) : null;
};

/**
 * Deletes Logbook data for projects that are no longer active
 * @param {Array<string>} activeSOs - Array of active project SO numbers
 */
export const cleanupLogbookData = async (activeSOs) => {
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
      const logbookRootRef = ref(db, 'logbookData');
      const snapshot = await get(logbookRootRef);
      if (snapshot.exists()) {
        const allData = snapshot.val();
        for (const so of Object.keys(allData)) {
          if (!activeSOs.includes(so)) {
            const logbookProjectRef = ref(db, `logbookData/${so}`);
            await remove(logbookProjectRef);
            console.log(`Cleaned up Logbook data for completed project: ${so}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup Logbook data in Firebase:', error);
    }
  }
};
