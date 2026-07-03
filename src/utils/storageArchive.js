import { storage, storageRef, getDownloadURL } from './firebase';
import { uploadString } from 'firebase/storage';

// Cold archive of project data. Previously this lived in a SEPARATE, entirely
// UNAUTHENTICATED Firebase project (back-up-de-kpi), which meant anyone with the
// public bundle config could read/write it. It now lives as JSON blobs in the
// PRIMARY project's Firebase Storage, which is authenticated — so Storage rules
// can require a signed-in user (see storage.rules).
//
// Each "collection" is a single JSON file holding a map keyed by id (SO number
// or week key). The app already fetches the whole archive and filters in memory,
// so a blob store (no queries) is a natural fit.
export const ARCHIVE_PATHS = {
  completed: 'archive/completed_projects.json',
  weekly: 'archive/weekly_history.json',
  deleted: 'archive/deleted_projects.json',
};

// Reads a JSON archive file into a plain object. Returns {} if it doesn't exist
// yet (first write) or on any read error, so archiving degrades gracefully.
export async function readArchiveMap(path) {
  if (!storage) return {};
  try {
    // getDownloadURL + fetch is the CORS-safe way to download from the browser.
    const url = await getDownloadURL(storageRef(storage, path));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Archive fetch failed for "${path}" (HTTP ${res.status})`);
    const parsed = await res.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    // Genuine "the file doesn't exist yet" → an empty archive is correct and safe.
    if (error?.code === 'storage/object-not-found') return {};
    // Any OTHER failure (network, HTTP, parse) must NOT be reported as empty:
    // callers do read-modify-write over the whole blob, so returning {} here
    // would let them overwrite a non-empty archive and lose everything. Re-throw
    // so the caller aborts its write and the data stays put for the next attempt.
    console.error(`❌ Error reading archive "${path}" — aborting write to avoid data loss:`, error);
    throw error;
  }
}

// Overwrites a JSON archive file with the given map (read-modify-write).
// Archiving is infrequent and low-concurrency, so full-blob rewrites are fine.
export async function writeArchiveMap(path, map) {
  if (!storage) return;
  await uploadString(storageRef(storage, path), JSON.stringify(map), 'raw', {
    contentType: 'application/json',
  });
}
