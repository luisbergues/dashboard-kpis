import { db } from './firebase';
import { ref, get, remove } from 'firebase/database';
import { readArchiveMap, writeArchiveMap, ARCHIVE_PATHS } from './archiveStore';

// Per-SO "working data" nodes that exist while a project is active. None of
// these are copied into the archive today — a project that vanishes from the
// sheet loses its notes, materials, checks, etc. forever, while the live
// nodes linger orphaned in the RTDB with no link back to the (now archived)
// project. `stages` is legacy and unused for writes anymore (see
// MyProjectsView.jsx) — kept here defensively in case any old data lingers,
// but the real per-stage dates come from the sheet's own statusHistory (see
// snapshotAuxData below).
const AUX_NODE_PATHS = {
  notes: 'project_notes',
  stages: 'project_stages',
  history: 'project_history',
  materials: 'project_materials',
  engineeringChecks: 'engineering_checks',
  nestingChecks: 'nesting_checks',
  collaborators: 'project_collaborators',
};

// Reads every working-data node for a project before it's archived, so none
// of it is lost once the live nodes are cleared. `statusHistory` doesn't live
// in the RTDB — it's the relevant slice of the sheet's own "Status History"
// section, which is what calculateAutomaticStages() uses for real per-stage
// dates (project_stages in the RTDB hasn't been written to in a long time).
async function snapshotAuxData(so, statusHistory) {
  const entries = Object.entries(AUX_NODE_PATHS);
  const snapshots = await Promise.all(
    entries.map(([, node]) => get(ref(db, `${node}/${so}`)))
  );
  const snapshot = {};
  entries.forEach(([key], i) => {
    const val = snapshots[i].val();
    if (val !== null && val !== undefined) snapshot[key] = val;
  });
  if (statusHistory && statusHistory.length > 0) {
    snapshot.statusHistory = statusHistory;
  }
  return snapshot;
}

// Clears the live working-data nodes once their contents are safely in the
// archive. Best-effort per node: losing one node's cleanup just leaves it
// orphaned (same as today's behavior), which is far preferable to aborting
// and leaving the rest uncleaned too.
async function clearAuxData(so) {
  const nodes = Object.values(AUX_NODE_PATHS);
  const results = await Promise.allSettled(
    nodes.map((node) => remove(ref(db, `${node}/${so}`)))
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`❌ Failed to clear ${nodes[i]}/${so} after archiving:`, result.reason);
    }
  });
}

// Cutoff date for keeping archived projects: 1 calendar year ago.
function retentionCutoff() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

// Proactively back up every currently-Completed (or Cancelled) project the
// moment we see it, instead of only reacting when a row disappears from the
// sheet between two fetches (archiveMissingCompletedProjects below). That
// disappearance-based approach has a gap: if the row gets deleted from the
// sheet in between the exact snapshots being diffed, the project is never
// archived and its data is effectively lost. This function makes that
// impossible by upserting a backup as soon as a project reaches either
// finished state, whether or not it's ever later removed from the sheet.
// Cancelled is included alongside Completed because both are terminal
// states this app treats as "done" everywhere else (see isCompletedOrCancelled
// in App.jsx); a Cancelled project can otherwise sit in the sheet
// indefinitely before its row is ever deleted, and shouldn't have to wait
// for that to be recoverable from Completed Projects.
//
// `projectDesigners` (RTDB project_designers/{so} -> name) is passed in
// separately because the sheet itself has no Designer column — without it,
// an archived project could never show who designed it.
export async function archiveCurrentlyCompletedProjects(newData, projectDesigners = {}) {
  if (!db || !newData) return;

  try {
    const completed = (newData.priorityAnalysis || []).filter(p => {
      const status = (p.status || '').toLowerCase();
      return status === 'completed' || status === 'cancelled';
    });
    if (completed.length === 0) return;

    const map = await readArchiveMap(ARCHIVE_PATHS.completed);
    const before = JSON.stringify(map);
    completed.forEach((project) => {
      const key = project.so.toString();
      // Only add a `designer` key when there's an actual value to store —
      // manufacturing `designer: null` on every unrelated re-archive would
      // perturb the dirty-check below into always seeing a "change" and
      // rewriting every completed project on every poll forever.
      const designer = projectDesigners[key] || map[key]?.designer;
      map[key] = {
        ...map[key],
        ...project,
        ...(designer ? { designer } : {}),
        // Refresh the data but keep the original archive timestamp.
        archivedAt: map[key]?.archivedAt || new Date().toISOString(),
      };
    });
    // Skip the write (and its race window) when nothing actually changed.
    if (JSON.stringify(map) !== before) {
      await writeArchiveMap(ARCHIVE_PATHS.completed, map);
    }
  } catch (error) {
    console.error('❌ Error proactively archiving completed projects:', error);
  }
}

// sheetParser.js has no sanity check of its own: if a CSV read gets caught
// mid-write, or a section header gets renamed, it can silently come back
// with a priorityAnalysis that's empty or drastically truncated. Widening
// the disappearance check above to catch ANY vanished row (not just ones
// already marked Completed) means such a glitch would otherwise get
// mistaken for a wave of real completions and mass-archive every active
// project as "Completed". A real drop this sharp between two ~30s polls is
// far more likely to be a parsing failure than genuine attrition, so bail
// out instead of archiving anything. MIN_PROJECTS_FOR_GUARD keeps this from
// firing on small sheets (or test fixtures) where a big *relative* swing is
// normal and expected.
const MIN_PROJECTS_FOR_GUARD = 10;
const MAX_DROP_RATIO = 0.5;

function looksLikeParsingFailure(prevCount, newCount) {
  return prevCount >= MIN_PROJECTS_FOR_GUARD && newCount < prevCount * (1 - MAX_DROP_RATIO);
}

export async function archiveMissingCompletedProjects(previousData, newData, projectDesigners = {}) {
  if (!db || !previousData || !newData) return;

  try {
    const prevProjects = previousData.priorityAnalysis || [];
    const newProjects = newData.priorityAnalysis || [];

    if (looksLikeParsingFailure(prevProjects.length, newProjects.length)) {
      console.error(
        `⚠️ Skipping disappearance-based archiving: project count dropped from ${prevProjects.length} to ${newProjects.length}. Likely a sheet parsing glitch, not real completions — nothing archived this cycle.`
      );
      return;
    }

    const newSoMap = new Set(newProjects.map(p => p.so));

    // Any project that was in the sheet on the previous poll but is gone now
    // is treated as done, regardless of what status it last had. Gating this
    // on "was it already marked Completed" left every row that gets deleted
    // directly (a common real workflow: finish or drop a project and just
    // remove its row, without ever flipping a status field first)
    // permanently orphaned — recoverable only via the manual Orphaned
    // Projects panel. Disappearing from the sheet IS the completion signal.
    const vanished = prevProjects.filter(p => !newSoMap.has(p.so));

    if (vanished.length === 0) return;

    console.log(`📦 Archiving ${vanished.length} project(s) removed from the sheet...`);
    const map = await readArchiveMap(ARCHIVE_PATHS.completed);
    const prevStatusHistory = previousData.statusHistory || [];

    // Snapshot each project's working data (notes, materials, checks, etc.)
    // BEFORE anything is written or cleared — a failed read here just skips
    // that project's snapshot, it never risks the live nodes.
    const entries = await Promise.all(vanished.map(async (project) => {
      const key = project.so.toString();
      const statusHistory = prevStatusHistory.filter(h => String(h.so) === key);
      const snapshot = await snapshotAuxData(key, statusHistory);
      return { key, project, snapshot };
    }));

    entries.forEach(({ key, project, snapshot }) => {
      const designer = projectDesigners[key] || map[key]?.designer;
      map[key] = {
        ...map[key],
        ...project,
        // Whatever its last status was (still Nesting, On Hold, etc.), it's
        // no longer tracked anywhere live — same convention manuallyArchiveProject
        // uses for orphan recovery.
        status: 'Completed',
        ...(designer ? { designer } : {}),
        ...(Object.keys(snapshot).length > 0 ? { snapshot } : {}),
        archivedAt: map[key]?.archivedAt || new Date().toISOString(),
      };
    });
    await writeArchiveMap(ARCHIVE_PATHS.completed, map);
    console.log('✅ Completed projects successfully archived.');

    // Only clear the live working nodes once their data is safely in the
    // archive — if the write above had thrown, we'd never reach this line,
    // so a failed archive write can never cause data loss.
    await Promise.all(entries.map(({ key }) => clearAuxData(key)));
  } catch (error) {
    console.error('❌ Error archiving completed projects:', error);
  }
}

// Manually create/update an archive entry for a project reconstructed from
// leftover Realtime Database data (project_history, project_designers, etc.)
// that's no longer in the live sheet nor already archived — see OrphanedProjectsPanel.
export async function manuallyArchiveProject(project) {
  if (!db || !project?.so) return;
  // `fresh` a proposito: este es el unico read-modify-write del archivo que
  // corre FUERA de withArchiveLease (lo dispara el admin a mano desde el panel
  // de huerfanos), asi que no tiene la garantia de escritor unico que hace
  // seguro reusar la copia en memoria de archiveStore.
  const map = await readArchiveMap(ARCHIVE_PATHS.completed, { fresh: true });
  const key = project.so.toString();
  map[key] = {
    ...map[key],
    ...project,
    status: 'Completed',
    archivedAt: map[key]?.archivedAt || new Date().toISOString(),
  };
  await writeArchiveMap(ARCHIVE_PATHS.completed, map);
}

export async function fetchArchivedCompletedProjects() {
  if (!db) return [];

  try {
    // NOTE: purging (a destructive write) is NOT triggered here anymore — it runs
    // under the single-writer archive lease in App.jsx to avoid concurrent writes.
    const map = await readArchiveMap(ARCHIVE_PATHS.completed);
    const cutoff = retentionCutoff();

    // Keep entries with no archivedAt or within the last year.
    return Object.values(map).filter((data) => {
      const archivedAt = data.archivedAt ? new Date(data.archivedAt) : null;
      return !archivedAt || archivedAt >= cutoff;
    });
  } catch (error) {
    console.error('❌ Error fetching archived projects:', error);
    return [];
  }
}

export async function purgeExpiredArchives() {
  if (!db) return;

  try {
    const map = await readArchiveMap(ARCHIVE_PATHS.completed);
    const cutoff = retentionCutoff();

    let changed = false;
    for (const [key, data] of Object.entries(map)) {
      const archivedAt = data.archivedAt ? new Date(data.archivedAt) : null;
      if (archivedAt && archivedAt < cutoff) {
        console.log(`🗑️ Purging expired project: ${data.so}`);
        delete map[key];
        changed = true;
      }
    }

    if (changed) {
      await writeArchiveMap(ARCHIVE_PATHS.completed, map);
      console.log('✅ Successfully purged expired projects.');
    }
  } catch (error) {
    console.error('❌ Error purging expired archives:', error);
  }
}
