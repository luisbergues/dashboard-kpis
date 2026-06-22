import { db, ref, set, get, remove, isConfigured } from './firebase';

const CACHE_PREFIX = 'ip_data_';

/**
 * Saves IP data to LocalStorage and Firebase (if configured)
 * @param {string} so - Project SO number
 * @param {Array} pages - Array of IP pages data
 */
export const saveIPData = async (so, pages) => {
  // 1. Save locally
  localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(pages));

  // 2. Save to Firebase if available
  if (isConfigured && db) {
    try {
      const ipRef = ref(db, `ipData/${so}`);
      await set(ipRef, pages);
    } catch (error) {
      console.error('Failed to save IP data to Firebase:', error);
    }
  }
};

/**
 * Loads IP data from Firebase (primary) or LocalStorage (fallback)
 * @param {string} so - Project SO number
 * @returns {Array|null} Array of pages or null if not found
 */
export const loadIPData = async (so) => {
  // Try Firebase first
  if (isConfigured && db) {
    try {
      const ipRef = ref(db, `ipData/${so}`);
      const snapshot = await get(ipRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Sync to local
        localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.error('Failed to load IP data from Firebase:', error);
    }
  }

  // Fallback to local storage
  const localData = localStorage.getItem(`${CACHE_PREFIX}${so}`);
  return localData ? JSON.parse(localData) : null;
};

/**
 * Deletes IP data for projects that are no longer active
 * @param {Array<string>} activeSOs - Array of active project SO numbers
 */
export const cleanupIPData = async (activeSOs) => {
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
      const ipRootRef = ref(db, 'ipData');
      const snapshot = await get(ipRootRef);
      if (snapshot.exists()) {
        const allData = snapshot.val();
        for (const so of Object.keys(allData)) {
          if (!activeSOs.includes(so)) {
            const ipProjectRef = ref(db, `ipData/${so}`);
            await remove(ipProjectRef);
            console.log(`Cleaned up IP data for completed project: ${so}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup IP data in Firebase:', error);
    }
  }
};
