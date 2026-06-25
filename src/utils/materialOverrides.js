import { db } from './firebase';
import { ref, set } from 'firebase/database';

export async function saveMaterialOverride(projectId, materialData) {
  if (!db) {
    console.warn('⚠️ Firebase not initialized, saving to localStorage fallback');
    localStorage.setItem(`project_materials_${projectId}`, JSON.stringify(materialData));
    return;
  }
  
  try {
    const matRef = ref(db, `project_materials/${projectId}`);
    await set(matRef, materialData);
    console.log(`✅ Material override saved for project ${projectId}`);
  } catch (error) {
    console.error('❌ Failed to save material override:', error);
    // fallback
    localStorage.setItem(`project_materials_${projectId}`, JSON.stringify(materialData));
  }
}
