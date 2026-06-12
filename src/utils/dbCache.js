import { db, ref, get, set } from './firebase';

const CACHE_KEY = 'dashboard_parsed_data';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache validity

/**
 * Checks if the cached data is fresh (less than 5 minutes old)
 * @param {string} timestampStr - ISO string of when cache was saved
 * @returns {boolean}
 */
export function isCacheFresh(timestampStr) {
  if (!timestampStr) return false;
  const elapsed = Date.now() - new Date(timestampStr).getTime();
  return elapsed < CACHE_TTL_MS;
}

/**
 * Gets cached dashboard data from Firebase or LocalStorage
 * @returns {Promise<{parsedData: Object, timestamp: string} | null>}
 */
export async function getCachedData() {
  // 1. Try Firebase if configured
  if (db) {
    try {
      const cacheRef = ref(db, 'firebase_cache/data');
      const snapshot = await get(cacheRef);
      if (snapshot.exists()) {
        const cached = snapshot.val();
        if (cached && cached.parsedData) {
          console.log('⚡ Retrieved cached data from Firebase');
          return cached;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error reading cache from Firebase:', error);
    }
  }

  // 2. LocalStorage Fallback
  try {
    const localVal = localStorage.getItem(CACHE_KEY);
    if (localVal) {
      const cached = JSON.parse(localVal);
      if (cached && cached.parsedData) {
        console.log('⚡ Retrieved cached data from localStorage');
        return cached;
      }
    }
  } catch (error) {
    console.warn('⚠️ Error reading cache from localStorage:', error);
  }

  return null;
}

/**
 * Saves dashboard data to both Firebase and LocalStorage
 * @param {Object} parsedData 
 * @returns {Promise<void>}
 */
export async function setCachedData(parsedData) {
  if (!parsedData) return;

  const cachePayload = {
    timestamp: new Date().toISOString(),
    parsedData
  };

  // 1. Write to LocalStorage (instant)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
  } catch (error) {
    console.warn('⚠️ Error writing cache to localStorage:', error);
  }

  // 2. Write to Firebase RTDB in background
  if (db) {
    try {
      const cacheRef = ref(db, 'firebase_cache/data');
      await set(cacheRef, cachePayload);
      console.log('🔥 Cached dashboard data to Firebase successfully!');
    } catch (error) {
      console.warn('⚠️ Failed to write cache to Firebase:', error);
    }
  }
}
