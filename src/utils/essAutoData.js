import { db, ref, set, get, push, isConfigured } from './firebase';

const CACHE_PREFIX = 'ess_auto_data_';

// Deliberately separate from essData.js/`essData/{so}` — this is the
// auto-generated draft, gated to super admin only, and must never be
// confused with (or overwrite) the existing manually-completed ESS.
export const saveEssAutoData = async (so, pages) => {
  localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(pages));
  if (isConfigured && db) {
    try {
      await set(ref(db, `essAutoData/${so}`), pages);
    } catch (error) {
      console.error('Failed to save auto-generated ESS data to Firebase:', error);
    }
  }
};

export const loadEssAutoData = async (so) => {
  if (isConfigured && db) {
    try {
      const snapshot = await get(ref(db, `essAutoData/${so}`));
      if (snapshot.exists()) {
        const data = snapshot.val();
        localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.error('Failed to load auto-generated ESS data from Firebase:', error);
    }
  }
  const localData = localStorage.getItem(`${CACHE_PREFIX}${so}`);
  if (!localData) return null;
  try {
    return JSON.parse(localData);
  } catch (error) {
    console.warn(`Corrupt local auto-ESS cache for ${so}, ignoring it:`, error);
    return null;
  }
};

export const hasEssAutoData = async (so) => {
  const data = await loadEssAutoData(so);
  return Array.isArray(data) && data.length > 0;
};

// Coarse-grained error report: one note per generation, not per-field —
// enough to hand the super admin's feedback back as a concrete case to fix
// in essRules.js/essMatcher.js/the parsers. See design doc "Corrección de
// errores".
export const saveEssCorrection = async (so, note) => {
  if (!isConfigured || !db) return;
  try {
    await push(ref(db, `ess_corrections/${so}`), {
      note,
      reportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to save ESS correction report:', error);
  }
};
