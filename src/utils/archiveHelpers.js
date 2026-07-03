import { db, storage } from './firebase';
import { ref, get, remove } from 'firebase/database';
import { readArchiveMap, writeArchiveMap, ARCHIVE_PATHS } from './storageArchive';

// 1 GB limit
const DB_SIZE_LIMIT_BYTES = 1073741824;

let hasWarnedNotInitialized = false;

export async function checkDbSizeAndArchive() {
  if (!db || !storage) {
    if (!hasWarnedNotInitialized) {
      console.warn('⚠️ Archiving skipped: Realtime DB or Storage not initialized.');
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
      console.log(`📦 DB size limit exceeded (${sizeInBytes} bytes). Starting archival to Storage...`);

      // Archive Weekly History (merge into the existing archive blob, then clear RTDB)
      if (Object.keys(weeklyData).length > 0) {
        const archive = await readArchiveMap(ARCHIVE_PATHS.weekly);
        Object.assign(archive, weeklyData);
        await writeArchiveMap(ARCHIVE_PATHS.weekly, archive);
        await remove(weeklyRef);
        console.log('✅ Weekly history archived to Storage and removed from Realtime DB.');
      }

      // Archive Deleted Projects
      if (Object.keys(deletedData).length > 0) {
        const archive = await readArchiveMap(ARCHIVE_PATHS.deleted);
        Object.assign(archive, deletedData);
        await writeArchiveMap(ARCHIVE_PATHS.deleted, archive);
        await remove(deletedRef);
        console.log('✅ Deleted projects archived to Storage and removed from Realtime DB.');
      }

    } else {
      console.log(`📊 DB size (${sizeInBytes} bytes) is below the limit. No archiving needed.`);
    }

  } catch (error) {
    console.error('❌ Error during archiving process:', error);
  }
}
