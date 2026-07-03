import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in for the Storage-backed archive blobs.
const store = new Map(); // path -> object

const ARCHIVE_PATHS = {
  completed: 'archive/completed_projects.json',
  weekly: 'archive/weekly_history.json',
  deleted: 'archive/deleted_projects.json',
};

const readArchiveMap = vi.fn(async (path) => {
  const v = store.get(path);
  // Deep copy so callers mutate their own copy, like a real fresh read.
  return v ? JSON.parse(JSON.stringify(v)) : {};
});
const writeArchiveMap = vi.fn(async (path, map) => {
  store.set(path, JSON.parse(JSON.stringify(map)));
});

vi.mock('../storageArchive', () => ({
  // Inlined (not the outer const) because vi.mock is hoisted above it.
  ARCHIVE_PATHS: {
    completed: 'archive/completed_projects.json',
    weekly: 'archive/weekly_history.json',
    deleted: 'archive/deleted_projects.json',
  },
  readArchiveMap: (...a) => readArchiveMap(...a),
  writeArchiveMap: (...a) => writeArchiveMap(...a),
}));
vi.mock('../firebase', () => ({ storage: {} }));

import {
  archiveCurrentlyCompletedProjects,
  archiveMissingCompletedProjects,
  manuallyArchiveProject,
  fetchArchivedCompletedProjects,
  purgeExpiredArchives,
} from '../completedProjectsArchive';

const recentISO = () => new Date().toISOString();
const oldISO = () => new Date(Date.now() - 220 * 24 * 3600 * 1000).toISOString(); // ~7 months

beforeEach(() => {
  store.clear();
  readArchiveMap.mockClear();
  writeArchiveMap.mockClear();
});

describe('archiveCurrentlyCompletedProjects', () => {
  it('adds newly-completed projects WITHOUT dropping already-archived ones', async () => {
    store.set(ARCHIVE_PATHS.completed, { '100': { so: '100', name: 'Old', archivedAt: oldISO() } });

    await archiveCurrentlyCompletedProjects({
      priorityAnalysis: [
        { so: '200', name: 'New', status: 'Completed' },
        { so: '300', name: 'Active one', status: 'Active' }, // must be ignored
      ],
    });

    const map = store.get(ARCHIVE_PATHS.completed);
    expect(Object.keys(map).sort()).toEqual(['100', '200']); // 100 preserved, 300 excluded
    expect(map['200'].status).toBe('Completed');
  });

  it('preserves the original archivedAt when a project is re-archived', async () => {
    const original = oldISO();
    store.set(ARCHIVE_PATHS.completed, { '200': { so: '200', name: 'v1', archivedAt: original } });

    await archiveCurrentlyCompletedProjects({
      priorityAnalysis: [{ so: '200', name: 'v2-updated', status: 'Completed' }],
    });

    const entry = store.get(ARCHIVE_PATHS.completed)['200'];
    expect(entry.archivedAt).toBe(original); // timestamp not reset
    expect(entry.name).toBe('v2-updated');   // data refreshed
  });

  it('does NOT overwrite the archive when the read fails (no data loss)', async () => {
    const good = { '100': { so: '100', name: 'Keep me', archivedAt: recentISO() } };
    store.set(ARCHIVE_PATHS.completed, good);
    readArchiveMap.mockRejectedValueOnce(new Error('transient network error'));

    await archiveCurrentlyCompletedProjects({
      priorityAnalysis: [{ so: '999', status: 'Completed' }],
    });

    expect(writeArchiveMap).not.toHaveBeenCalled();
    expect(store.get(ARCHIVE_PATHS.completed)).toEqual(good); // untouched
  });

  it('is a no-op when there are no completed projects', async () => {
    await archiveCurrentlyCompletedProjects({ priorityAnalysis: [{ so: '1', status: 'Active' }] });
    expect(writeArchiveMap).not.toHaveBeenCalled();
  });

  it('does not write when re-archiving identical data (dirty-check)', async () => {
    const at = oldISO();
    store.set(ARCHIVE_PATHS.completed, { '200': { so: '200', name: 'v1', status: 'Completed', archivedAt: at } });

    await archiveCurrentlyCompletedProjects({
      priorityAnalysis: [{ so: '200', name: 'v1', status: 'Completed' }],
    });

    expect(writeArchiveMap).not.toHaveBeenCalled(); // nothing changed → no write, no race
  });
});

describe('archiveMissingCompletedProjects', () => {
  it('archives completed projects that vanished from the sheet, leaving others intact', async () => {
    store.set(ARCHIVE_PATHS.completed, { '100': { so: '100', name: 'Existing', archivedAt: oldISO() } });

    const previousData = { priorityAnalysis: [{ so: '500', name: 'Gone', status: 'Completed' }] };
    const newData = { priorityAnalysis: [] }; // 500 disappeared

    await archiveMissingCompletedProjects(previousData, newData);

    const map = store.get(ARCHIVE_PATHS.completed);
    expect(Object.keys(map).sort()).toEqual(['100', '500']);
    expect(map['500'].name).toBe('Gone');
  });

  it('ignores non-completed projects that disappear', async () => {
    const previousData = { priorityAnalysis: [{ so: '600', status: 'Active' }] };
    const newData = { priorityAnalysis: [] };
    await archiveMissingCompletedProjects(previousData, newData);
    expect(writeArchiveMap).not.toHaveBeenCalled();
  });
});

describe('manuallyArchiveProject', () => {
  it('adds a reconstructed orphan as Completed without touching existing entries', async () => {
    store.set(ARCHIVE_PATHS.completed, { '100': { so: '100', name: 'Existing' } });
    await manuallyArchiveProject({ so: '700', name: 'Orphan' });

    const map = store.get(ARCHIVE_PATHS.completed);
    expect(map['100']).toBeDefined();
    expect(map['700'].status).toBe('Completed');
    expect(map['700'].archivedAt).toBeDefined();
  });
});

describe('fetchArchivedCompletedProjects', () => {
  it('returns recent and undated entries, hides ones older than 6 months', async () => {
    store.set(ARCHIVE_PATHS.completed, {
      a: { so: 'a', archivedAt: recentISO() },
      b: { so: 'b', archivedAt: oldISO() },   // expired
      c: { so: 'c' },                          // no timestamp → kept
    });

    const result = await fetchArchivedCompletedProjects();
    const sos = result.map(p => p.so).sort();
    expect(sos).toEqual(['a', 'c']);
  });

  it('returns [] gracefully when the read fails', async () => {
    readArchiveMap.mockRejectedValueOnce(new Error('read blew up'));
    await expect(fetchArchivedCompletedProjects()).resolves.toEqual([]);
  });
});

describe('purgeExpiredArchives', () => {
  it('removes only entries older than 6 months', async () => {
    store.set(ARCHIVE_PATHS.completed, {
      a: { so: 'a', archivedAt: recentISO() },
      b: { so: 'b', archivedAt: oldISO() },
      c: { so: 'c' }, // no timestamp → kept
    });

    await purgeExpiredArchives();

    const map = store.get(ARCHIVE_PATHS.completed);
    expect(Object.keys(map).sort()).toEqual(['a', 'c']);
  });

  it('does not write when nothing is expired', async () => {
    store.set(ARCHIVE_PATHS.completed, { a: { so: 'a', archivedAt: recentISO() } });
    await purgeExpiredArchives();
    expect(writeArchiveMap).not.toHaveBeenCalled();
  });

  it('does not delete anything when the read fails (no data loss)', async () => {
    const good = { a: { so: 'a', archivedAt: oldISO() } };
    store.set(ARCHIVE_PATHS.completed, good);
    readArchiveMap.mockRejectedValueOnce(new Error('read failed'));

    await purgeExpiredArchives();

    expect(writeArchiveMap).not.toHaveBeenCalled();
    expect(store.get(ARCHIVE_PATHS.completed)).toEqual(good);
  });
});
