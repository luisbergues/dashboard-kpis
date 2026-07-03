import { db, ref, get, set } from './firebase';

// Cold archive of project data, stored in the PRIMARY project's Realtime
// Database. It previously lived in a separate, unauthenticated Firebase project
// (insecure), and then briefly in Firebase Storage (which was never provisioned
// for this project and required CORS/gcloud access the org blocks). RTDB is what
// the app already uses, needs no CORS, is authenticated, and is secured by the
// same rules as everything else (see database.rules.json).
//
// Each "collection" is one RTDB node holding a map keyed by id (SO number or
// week key). The app fetches the whole archive and filters in memory, so a
// single-node read is a natural fit. NOTE: RTDB keys can't contain '.', '#',
// '$', '[' or ']', so paths are plain (no ".json").
export const ARCHIVE_PATHS = {
  completed: 'archive/completed_projects',
  weekly: 'archive/weekly_history',
  deleted: 'archive/deleted_projects',
};

// Rejects if `promise` doesn't settle within `ms`, so a slow/offline DB read can
// never block the app's load path for long.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Reads an archive node into a plain object. Returns {} when the node simply
// doesn't exist yet. IMPORTANT: on a real error (permission denied, network) it
// THROWS, because callers do read-modify-write over the whole node — returning
// {} on a transient failure would let them overwrite a non-empty archive and
// lose data. A thrown error makes the caller abort its write.
export async function readArchiveMap(path) {
  if (!db) return {};
  const snapshot = await withTimeout(get(ref(db, path)), 8000, `read "${path}"`);
  return snapshot.exists() ? (snapshot.val() || {}) : {};
}

// Overwrites an archive node with the given map (read-modify-write). Concurrent
// writers are serialized by the archive lease (see archiveCoordinator.js).
export async function writeArchiveMap(path, map) {
  if (!db) return;
  await withTimeout(set(ref(db, path), map), 8000, `write "${path}"`);
}
