import { db } from './firebase';
import { backupDb } from './firebaseBackup';
import { ref, get, remove } from 'firebase/database';
import { collection, doc, setDoc } from 'firebase/firestore';

// 1 GB limit
const DB_SIZE_LIMIT_BYTES = 1073741824; 

let hasWarnedNotInitialized = false;

export async function checkDbSizeAndArchive() {
  if (!db || !backupDb) {
    if (!hasWarnedNotInitialized) {
      console.warn('⚠️ Archiving skipped: Primary or Backup DB not initialized.');
      hasWarnedNotInitialized = true;
    }
    return;
  }

  try {
    // Note: In a pure client-side setup, getting the exact whole DB size is an approximation.
    // We will estimate by fetching the nodes that grow over time.
    const weeklyRef = ref(db, 'weekly_history');
    const deletedRef = ref(db, 'deleted_projects');
    
    const [weeklySnap, deletedSnap] = await Promise.all([
      get(weeklyRef),
      get(deletedRef)
    ]);

    const weeklyData = weeklySnap.val() || {};
    const deletedData = deletedSnap.val() || {};

    const sizeInBytes = new Blob([JSON.stringify({ weeklyData, deletedData })]).size;
    
    // For testing purposes, you could temporarily change this to `sizeInBytes > 0`
    if (sizeInBytes > DB_SIZE_LIMIT_BYTES) {
      console.log(`📦 DB size limit exceeded (${sizeInBytes} bytes). Starting archival to Firestore...`);

      // Archive Weekly History
      if (Object.keys(weeklyData).length > 0) {
        const batchPromises = Object.entries(weeklyData).map(([key, value]) => {
          const docRef = doc(collection(backupDb, 'weekly_history_archive'), key);
          return setDoc(docRef, value);
        });
        await Promise.all(batchPromises);
        await remove(weeklyRef);
        console.log('✅ Weekly history archived to Firestore and removed from Realtime DB.');
      }

      // Archive Deleted Projects
      if (Object.keys(deletedData).length > 0) {
        const batchPromises = Object.entries(deletedData).map(([key, value]) => {
          const docRef = doc(collection(backupDb, 'deleted_projects_archive'), key);
          return setDoc(docRef, value);
        });
        await Promise.all(batchPromises);
        await remove(deletedRef);
        console.log('✅ Deleted projects archived to Firestore and removed from Realtime DB.');
      }
      
    } else {
      console.log(`📊 DB size (${sizeInBytes} bytes) is below the limit. No archiving needed.`);
    }

  } catch (error) {
    console.error('❌ Error during archiving process:', error);
  }
}
