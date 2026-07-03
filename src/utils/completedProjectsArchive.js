import { db } from './firebase';
import { readArchiveMap, writeArchiveMap, ARCHIVE_PATHS } from './archiveStore';

// Cutoff date for keeping archived projects: 6 calendar months ago.
function sixMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d;
}

// Proactively back up every currently-Completed project the moment we see it,
// instead of only reacting when a row disappears from the sheet between two
// fetches (archiveMissingCompletedProjects below). That disappearance-based
// approach has a gap: if the row gets deleted from the sheet in between the
// exact snapshots being diffed, the project is never archived and its data
// is effectively lost. This function makes that impossible by upserting a
// backup as soon as a project is marked Completed, whether or not it's ever
// later removed from the sheet.
export async function archiveCurrentlyCompletedProjects(newData) {
  if (!db || !newData) return;

  try {
    const completed = (newData.priorityAnalysis || []).filter(p =>
      p.status && p.status.toLowerCase() === 'completed'
    );
    if (completed.length === 0) return;

    const map = await readArchiveMap(ARCHIVE_PATHS.completed);
    const before = JSON.stringify(map);
    completed.forEach((project) => {
      const key = project.so.toString();
      map[key] = {
        ...map[key],
        ...project,
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

export async function archiveMissingCompletedProjects(previousData, newData) {
  if (!db || !previousData || !newData) return;

  try {
    const prevProjects = previousData.priorityAnalysis || [];
    const newProjects = newData.priorityAnalysis || [];

    const newSoMap = new Set(newProjects.map(p => p.so));

    // Find projects that were in previousData, had status Completed, and are missing from newData
    const completedAndDeleted = prevProjects.filter(p =>
      p.status && p.status.toLowerCase() === 'completed' && !newSoMap.has(p.so)
    );

    if (completedAndDeleted.length === 0) return;

    console.log(`📦 Archiving ${completedAndDeleted.length} completed projects...`);
    const map = await readArchiveMap(ARCHIVE_PATHS.completed);
    completedAndDeleted.forEach((project) => {
      const key = project.so.toString();
      map[key] = {
        ...map[key],
        ...project,
        archivedAt: map[key]?.archivedAt || new Date().toISOString(),
      };
    });
    await writeArchiveMap(ARCHIVE_PATHS.completed, map);
    console.log('✅ Completed projects successfully archived.');
  } catch (error) {
    console.error('❌ Error archiving completed projects:', error);
  }
}

// Manually create/update an archive entry for a project reconstructed from
// leftover Realtime Database data (project_history, project_designers, etc.)
// that's no longer in the live sheet nor already archived — see OrphanedProjectsPanel.
export async function manuallyArchiveProject(project) {
  if (!db || !project?.so) return;
  const map = await readArchiveMap(ARCHIVE_PATHS.completed);
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
    const cutoff = sixMonthsAgo();

    // Keep entries with no archivedAt or within the last 6 months.
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
    const cutoff = sixMonthsAgo();

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
