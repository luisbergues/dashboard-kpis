import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Backing stores for the mocks.
const storageStore = new Map(); // Storage archive blobs: path -> object
let rtdb = {};                  // Realtime DB: node name -> value

const ARCHIVE_PATHS = {
  completed: 'archive/completed_projects.json',
  weekly: 'archive/weekly_history.json',
  deleted: 'archive/deleted_projects.json',
};

const readArchiveMap = vi.fn(async (path) => {
  const v = storageStore.get(path);
  return v ? JSON.parse(JSON.stringify(v)) : {};
});
const writeArchiveMap = vi.fn(async (path, map) => {
  storageStore.set(path, JSON.parse(JSON.stringify(map)));
});
vi.mock('../archiveStore', () => ({
  // Inlined (not the outer const) because vi.mock is hoisted above it.
  ARCHIVE_PATHS: {
    completed: 'archive/completed_projects.json',
    weekly: 'archive/weekly_history.json',
    deleted: 'archive/deleted_projects.json',
  },
  readArchiveMap: (...a) => readArchiveMap(...a),
  writeArchiveMap: (...a) => writeArchiveMap(...a),
}));

vi.mock('../firebase', () => ({ db: {}, storage: {} }));

// Minimal firebase/database mock backed by the `rtdb` object.
const removedNodes = [];
vi.mock('firebase/database', () => ({
  ref: (_db, path) => ({ path }),
  get: vi.fn(async (r) => ({ val: () => (r.path in rtdb ? rtdb[r.path] : null) })),
  remove: vi.fn(async (r) => { removedNodes.push(r.path); delete rtdb[r.path]; }),
}));

import { checkDbSizeAndArchive } from '../archiveHelpers';

// The function decides to archive based on `new Blob([...]).size`. Rather than
// allocating a real >1 GB payload, stub Blob to report a chosen size.
function stubBlobSize(size) {
  vi.stubGlobal('Blob', class { constructor() { this.size = size; } });
}
const OVER_LIMIT = 1024 * 1024 * 1024 + 10;

beforeEach(() => {
  storageStore.clear();
  rtdb = {};
  removedNodes.length = 0;
  readArchiveMap.mockClear();
  writeArchiveMap.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('checkDbSizeAndArchive', () => {
  it('does nothing when under the size limit', async () => {
    stubBlobSize(1000); // well under 1 GB
    rtdb['weekly_history'] = { w1: { label: 'W1' } };
    rtdb['deleted_projects'] = {};

    await checkDbSizeAndArchive();

    expect(writeArchiveMap).not.toHaveBeenCalled();
    expect(removedNodes).toEqual([]);
    expect(rtdb['weekly_history']).toBeDefined(); // still in RTDB
  });

  it('archives to Storage then clears RTDB when over the limit', async () => {
    stubBlobSize(OVER_LIMIT);
    rtdb['weekly_history'] = { w1: { label: 'W1' } };
    rtdb['deleted_projects'] = { d1: { name: 'gone' } };

    await checkDbSizeAndArchive();

    // Both archives written…
    expect(storageStore.get(ARCHIVE_PATHS.weekly)).toHaveProperty('w1');
    expect(storageStore.get(ARCHIVE_PATHS.deleted)).toHaveProperty('d1');
    // …and only then removed from RTDB.
    expect(removedNodes.sort()).toEqual(['deleted_projects', 'weekly_history']);
    expect(rtdb['weekly_history']).toBeUndefined();
    expect(rtdb['deleted_projects']).toBeUndefined();
  });

  it('MERGES into an existing archive instead of overwriting it', async () => {
    stubBlobSize(OVER_LIMIT);
    storageStore.set(ARCHIVE_PATHS.weekly, { wOld: { label: 'previously archived' } });
    rtdb['weekly_history'] = { wNew: { label: 'W-new' } };
    rtdb['deleted_projects'] = {};

    await checkDbSizeAndArchive();

    const archived = storageStore.get(ARCHIVE_PATHS.weekly);
    expect(Object.keys(archived).sort()).toEqual(['wNew', 'wOld']); // old kept
  });

  it('does NOT remove from RTDB if the archive write fails (no data loss)', async () => {
    stubBlobSize(OVER_LIMIT);
    rtdb['weekly_history'] = { w1: { label: 'W1' } };
    rtdb['deleted_projects'] = {};
    writeArchiveMap.mockRejectedValueOnce(new Error('storage upload failed'));

    await checkDbSizeAndArchive();

    expect(removedNodes).toEqual([]);             // nothing purged
    expect(rtdb['weekly_history']).toBeDefined(); // data still safe in RTDB
  });

  it('does NOT remove from RTDB if reading the existing archive fails', async () => {
    stubBlobSize(OVER_LIMIT);
    rtdb['weekly_history'] = { w1: { label: 'W1' } };
    rtdb['deleted_projects'] = {};
    readArchiveMap.mockRejectedValueOnce(new Error('archive read failed'));

    await checkDbSizeAndArchive();

    expect(removedNodes).toEqual([]);
    expect(rtdb['weekly_history']).toBeDefined();
  });
});
