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
vi.mock('../firebase', () => ({ db: {} }));

import {
  archiveCurrentlyCompletedProjects,
  archiveMissingCompletedProjects,
  manuallyArchiveProject,
  fetchArchivedCompletedProjects,
  purgeExpiredArchives,
} from '../completedProjectsArchive';

const recentISO = () => new Date().toISOString();
const oldISO = () => new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString(); // ~13 months — past the 1-year retention cutoff
const withinYearISO = () => new Date(Date.now() - 240 * 24 * 3600 * 1000).toISOString(); // ~8 months — within the 1-year retention window

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

  it('stamps the archived record with the RTDB-sourced designer name', async () => {
    await archiveCurrentlyCompletedProjects(
      { priorityAnalysis: [{ so: '400', name: 'Has designer', status: 'Completed' }] },
      { '400': 'Russell Reiner' }
    );

    expect(store.get(ARCHIVE_PATHS.completed)['400'].designer).toBe('Russell Reiner');
  });

  it('does not manufacture a designer field when none is known (no dirty-check perturbation)', async () => {
    store.set(ARCHIVE_PATHS.completed, { '200': { so: '200', name: 'v1', status: 'Completed', archivedAt: oldISO() } });

    await archiveCurrentlyCompletedProjects({
      priorityAnalysis: [{ so: '200', name: 'v1', status: 'Completed' }],
    }); // no projectDesigners arg at all

    expect(writeArchiveMap).not.toHaveBeenCalled();
    expect(store.get(ARCHIVE_PATHS.completed)['200'].designer).toBeUndefined();
  });

  it('keeps a previously-known designer on re-archive even without a fresh projectDesigners entry', async () => {
    store.set(ARCHIVE_PATHS.completed, { '500': { so: '500', name: 'v1', status: 'Completed', designer: 'Monica Gabriel', archivedAt: oldISO() } });

    await archiveCurrentlyCompletedProjects({
      priorityAnalysis: [{ so: '500', name: 'v1-refreshed', status: 'Completed' }],
    });

    expect(store.get(ARCHIVE_PATHS.completed)['500'].designer).toBe('Monica Gabriel');
  });

  // Cancelled is a terminal state too (see isCompletedOrCancelled in App.jsx)
  // — a Cancelled project shouldn't have to wait for its row to be deleted
  // from the sheet before it's recoverable from Completed Projects.
  it('proactively archives Cancelled projects too, not just Completed', async () => {
    await archiveCurrentlyCompletedProjects({
      priorityAnalysis: [
        { so: '800', name: 'Dropped deal', status: 'Cancelled' },
        { so: '801', name: 'Still active', status: 'Nesting' }, // must be ignored
      ],
    });

    const map = store.get(ARCHIVE_PATHS.completed);
    expect(Object.keys(map)).toEqual(['800']);
    expect(map['800'].status).toBe('Cancelled'); // real status preserved, unlike the disappearance path
  });
});

describe('archiveMissingCompletedProjects', () => {
  it('archives a project that vanished from the sheet while marked Completed, leaving others intact', async () => {
    store.set(ARCHIVE_PATHS.completed, { '100': { so: '100', name: 'Existing', archivedAt: oldISO() } });

    const previousData = { priorityAnalysis: [{ so: '500', name: 'Gone', status: 'Completed' }] };
    const newData = { priorityAnalysis: [] }; // 500 disappeared

    await archiveMissingCompletedProjects(previousData, newData);

    const map = store.get(ARCHIVE_PATHS.completed);
    expect(Object.keys(map).sort()).toEqual(['100', '500']);
    expect(map['500'].name).toBe('Gone');
  });

  // A project can leave the sheet without ever being marked "Completed"
  // first — someone just deletes the row once it's done or dropped, without
  // bothering to flip a status field. Disappearing from the sheet at all is
  // what signals "no longer active" here, not the specific status text it
  // last carried — otherwise these rows would sit as permanent orphans,
  // recoverable only via the manual Orphaned Projects panel.
  it('archives ANY project that disappears from the sheet, regardless of its last status', async () => {
    const previousData = { priorityAnalysis: [{ so: '600', name: 'Dropped mid-nesting', status: 'Nesting' }] };
    const newData = { priorityAnalysis: [] };

    await archiveMissingCompletedProjects(previousData, newData);

    const entry = store.get(ARCHIVE_PATHS.completed)['600'];
    expect(entry).toBeDefined();
    expect(entry.name).toBe('Dropped mid-nesting');
    // Forced to Completed for the archive record — same convention
    // manuallyArchiveProject uses for orphan recovery — since the modal
    // doesn't otherwise distinguish "how" a project stopped being tracked.
    expect(entry.status).toBe('Completed');
  });

  it('is a no-op when nothing disappeared', async () => {
    const previousData = { priorityAnalysis: [{ so: '650', status: 'Active' }] };
    const newData = { priorityAnalysis: [{ so: '650', status: 'Active' }] };
    await archiveMissingCompletedProjects(previousData, newData);
    expect(writeArchiveMap).not.toHaveBeenCalled();
  });

  it('stamps the designer name on a project archived via the disappearance path too', async () => {
    const previousData = { priorityAnalysis: [{ so: '700', name: 'Gone', status: 'Completed' }] };
    const newData = { priorityAnalysis: [] };

    await archiveMissingCompletedProjects(previousData, newData, { '700': 'Kat Baumgartner' });

    expect(store.get(ARCHIVE_PATHS.completed)['700'].designer).toBe('Kat Baumgartner');
  });

  // A sheet-parsing glitch (mid-write CSV read, renamed section header, etc.)
  // can silently return a suspiciously truncated priorityAnalysis. Since this
  // function now archives ANY vanished row regardless of prior status, such a
  // glitch would otherwise mass-archive every real active project as
  // "Completed". Guard against that specific shape: a sharp drop from a
  // reasonably sized sheet.
  it('skips archiving entirely when the project count drops sharply (likely a parsing glitch, not real completions)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const previousData = {
      priorityAnalysis: Array.from({ length: 20 }, (_, i) => ({ so: `${i}`, status: 'Active' })),
    };
    const newData = { priorityAnalysis: [{ so: '0', status: 'Active' }] }; // 20 -> 1, a parsing failure, not attrition

    await archiveMissingCompletedProjects(previousData, newData);

    expect(writeArchiveMap).not.toHaveBeenCalled();
    expect(store.get(ARCHIVE_PATHS.completed)).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('still archives normally when the drop is small, even on a larger sheet', async () => {
    const previousData = {
      priorityAnalysis: Array.from({ length: 20 }, (_, i) => ({ so: `${i}`, status: 'Active' })),
    };
    // Only project '0' vanished — 19 of 20 remain, nowhere near the >50% drop guard.
    const newData = {
      priorityAnalysis: Array.from({ length: 19 }, (_, i) => ({ so: `${i + 1}`, status: 'Active' })),
    };

    await archiveMissingCompletedProjects(previousData, newData);

    expect(store.get(ARCHIVE_PATHS.completed)['0']).toBeDefined();
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
  it('returns recent and undated entries, hides ones older than 1 year', async () => {
    store.set(ARCHIVE_PATHS.completed, {
      a: { so: 'a', archivedAt: recentISO() },
      b: { so: 'b', archivedAt: oldISO() },   // expired (~13 months)
      c: { so: 'c' },                          // no timestamp → kept
    });

    const result = await fetchArchivedCompletedProjects();
    const sos = result.map(p => p.so).sort();
    expect(sos).toEqual(['a', 'c']);
  });

  // Retention was widened from 6 months to 1 year specifically so completed
  // projects stick around longer — pin the boundary explicitly rather than
  // just trusting the "old"/"recent" cases above.
  it('keeps an entry archived ~8 months ago (past the old 6-month cutoff, within the new 1-year one)', async () => {
    store.set(ARCHIVE_PATHS.completed, { d: { so: 'd', archivedAt: withinYearISO() } });

    const result = await fetchArchivedCompletedProjects();
    expect(result.map(p => p.so)).toEqual(['d']);
  });

  it('returns [] gracefully when the read fails', async () => {
    readArchiveMap.mockRejectedValueOnce(new Error('read blew up'));
    await expect(fetchArchivedCompletedProjects()).resolves.toEqual([]);
  });
});

describe('purgeExpiredArchives', () => {
  it('removes only entries older than 1 year', async () => {
    store.set(ARCHIVE_PATHS.completed, {
      a: { so: 'a', archivedAt: recentISO() },
      b: { so: 'b', archivedAt: oldISO() },
      c: { so: 'c' }, // no timestamp → kept
    });

    await purgeExpiredArchives();

    const map = store.get(ARCHIVE_PATHS.completed);
    expect(Object.keys(map).sort()).toEqual(['a', 'c']);
  });

  it('does not purge an entry archived ~8 months ago', async () => {
    store.set(ARCHIVE_PATHS.completed, { d: { so: 'd', archivedAt: withinYearISO() } });

    await purgeExpiredArchives();

    expect(writeArchiveMap).not.toHaveBeenCalled();
    expect(store.get(ARCHIVE_PATHS.completed)['d']).toBeDefined();
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
