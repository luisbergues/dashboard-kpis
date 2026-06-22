import { db, ref, set, get, remove, isConfigured } from './firebase';

const CACHE_PREFIX = 'ess_data_';

/**
 * Saves ESS data to LocalStorage and Firebase (if configured)
 * @param {string} so - Project SO number
 * @param {Array} pages - Array of ESS pages data
 */
export const saveESSData = async (so, pages) => {
  // 1. Save locally
  localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(pages));

  // 2. Save to Firebase if available
  if (isConfigured && db) {
    try {
      const essRef = ref(db, `essData/${so}`);
      await set(essRef, pages);
    } catch (error) {
      console.error('Failed to save ESS data to Firebase:', error);
    }
  }
};

/**
 * Loads ESS data from Firebase (primary) or LocalStorage (fallback)
 * @param {string} so - Project SO number
 * @returns {Array|null} Array of pages or null if not found
 */
export const loadESSData = async (so) => {
  // Try Firebase first
  if (isConfigured && db) {
    try {
      const essRef = ref(db, `essData/${so}`);
      const snapshot = await get(essRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Sync to local
        localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.error('Failed to load ESS data from Firebase:', error);
    }
  }

  // Fallback to local storage
  const localData = localStorage.getItem(`${CACHE_PREFIX}${so}`);
  return localData ? JSON.parse(localData) : null;
};

/**
 * Deletes ESS data for projects that are no longer active
 * @param {Array<string>} activeSOs - Array of active project SO numbers
 */
export const cleanupESSData = async (activeSOs) => {
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
      const essRootRef = ref(db, 'essData');
      const snapshot = await get(essRootRef);
      if (snapshot.exists()) {
        const allData = snapshot.val();
        for (const so of Object.keys(allData)) {
          if (!activeSOs.includes(so)) {
            const essProjectRef = ref(db, `essData/${so}`);
            await remove(essProjectRef);
            console.log(`Cleaned up ESS data for completed project: ${so}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup ESS data in Firebase:', error);
    }
  }
};
