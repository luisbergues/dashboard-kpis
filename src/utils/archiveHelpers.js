import { db } from './firebase';
import { ref, get, remove } from 'firebase/database';
import { readArchiveMap, writeArchiveMap, ARCHIVE_PATHS } from './archiveStore';

// 1 GB limit
const DB_SIZE_LIMIT_BYTES = 1073741824;

// Tope de ejecuciones por sesion del navegador.
//
// Este chequeo descarga weekly_history y deleted_projects ENTEROS para
// serializarlos y medirlos. Corria dentro del ciclo de archivado de App.jsx, o
// sea cada ~5 minutos mientras hubiera una pestaña abierta: ~288 descargas de
// los dos nodos por dia, para calcular un numero que en la practica siempre da
// "por debajo del limite" (en Spark la base entera corta en 1 GB, asi que estos
// dos nodos solos no pueden alcanzarlo).
//
// Tres corridas por sesion conservan la red de seguridad — sigue disparando si
// alguna vez la base crece de verdad — a una fraccion del costo.
const MAX_RUNS_PER_SESSION = 3;
let runsThisSession = 0;

// Sólo para tests: devuelve el contador a cero entre casos.
export function resetDbSizeCheckCountForTests() {
  runsThisSession = 0;
}

let hasWarnedNotInitialized = false;

export async function checkDbSizeAndArchive() {
  if (!db) {
    if (!hasWarnedNotInitialized) {
      console.warn('⚠️ Archiving skipped: Realtime DB not initialized.');
      hasWarnedNotInitialized = true;
    }
    return;
  }

  // Se cuenta ANTES de correr, no despues: una corrida que falla igual gastó su
  // descarga, y contarla sólo al terminar bien dejaría reintentando cada 5
  // minutos justo en el caso en que el chequeo esta roto.
  if (runsThisSession >= MAX_RUNS_PER_SESSION) return;
  runsThisSession += 1;

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
      console.log(`📦 DB size limit exceeded (${sizeInBytes} bytes). Starting archival...`);

      // Archive Weekly History (merge into the existing archive node, then clear the live one)
      if (Object.keys(weeklyData).length > 0) {
        const archive = await readArchiveMap(ARCHIVE_PATHS.weekly);
        Object.assign(archive, weeklyData);
        await writeArchiveMap(ARCHIVE_PATHS.weekly, archive);
        await remove(weeklyRef);
        console.log('✅ Weekly history archived and removed from live Realtime DB.');
      }

      // Archive Deleted Projects
      if (Object.keys(deletedData).length > 0) {
        const archive = await readArchiveMap(ARCHIVE_PATHS.deleted);
        Object.assign(archive, deletedData);
        await writeArchiveMap(ARCHIVE_PATHS.deleted, archive);
        await remove(deletedRef);
        console.log('✅ Deleted projects archived and removed from live Realtime DB.');
      }

    } else {
      console.log(`📊 DB size (${sizeInBytes} bytes) is below the limit. No archiving needed.`);
    }

  } catch (error) {
    console.error('❌ Error during archiving process:', error);
  }
}
