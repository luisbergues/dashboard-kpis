import { db } from './firebase';
import { ref, set } from 'firebase/database';

export async function saveEngineeringCheck(projectId, checkData) {
  if (!db) {
    console.warn('⚠️ Firebase not initialized, saving to localStorage fallback');
    localStorage.setItem(`engineering_check_${projectId}`, JSON.stringify(checkData));
    return;
  }
  
  try {
    const checkRef = ref(db, `engineering_checks/${projectId}`);
    await set(checkRef, checkData);
    console.log(`✅ Engineering check saved for project ${projectId}`);
  } catch (error) {
    console.error('❌ Failed to save engineering check:', error);
    // fallback
    localStorage.setItem(`engineering_check_${projectId}`, JSON.stringify(checkData));
  }
}
