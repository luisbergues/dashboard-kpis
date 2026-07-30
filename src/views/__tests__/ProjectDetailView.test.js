import { describe, it, expect } from 'vitest';
import { resolveArchivedView } from '../ProjectDetailView';

// Regression coverage: before completedProjectsArchive.js started snapshotting
// a project's working data (notes, materials, checks, statusHistory) at
// archive time, ProjectDetailView had no way to show any of it for an
// archived project — it only ever read live RTDB state, which either never
// existed for archived-then-deleted nodes, or (for the 3 pre-existing legacy
// archive records) happened to still be live because the old archiver never
// cleaned anything up. resolveArchivedView() is the single place that decides
// what to show, so both cases (rich snapshot vs. legacy/no snapshot) are
// pinned here.
describe('resolveArchivedView', () => {
  it('prefers the archive snapshot over live data once a project is archived', () => {
    const project = {
      so: '900',
      snapshot: {
        notes: [{ id: 'n1', text: 'from snapshot' }],
        materials: { thermofoil: true },
        engineeringChecks: { started: '2026-01-01', user: 'Bob' },
        nestingChecks: { started: '2026-01-02', user: 'Cal' },
        collaborators: ['Dee', 'Eve'],
        statusHistory: [{ so: '900', status: 'INSTALL', statusDate: '2026-01-05' }],
      },
    };
    const liveNotes = [{ id: 'live', text: 'stale live note' }];

    const result = resolveArchivedView(project, true, liveNotes);

    expect(result.notes).toEqual(project.snapshot.notes);
    expect(result.materials).toEqual({ thermofoil: true });
    expect(result.engineeringChecks).toEqual({ started: '2026-01-01', user: 'Bob' });
    expect(result.nestingChecks).toEqual({ started: '2026-01-02', user: 'Cal' });
    expect(result.collaborators).toEqual(['Dee', 'Eve']);
    expect(result.stagesSource.statusHistory).toEqual(project.snapshot.statusHistory);
  });

  it('falls back to live notes and the project itself when there is no snapshot (legacy archive record)', () => {
    const legacyProject = { so: '12308', name: 'Old manual entry', status: 'Completed', archivedAt: '2026-01-01T00:00:00.000Z' };
    const liveNotes = [{ id: 'n1', text: 'still live, never cleaned up' }];

    const result = resolveArchivedView(legacyProject, true, liveNotes);

    expect(result.notes).toEqual(liveNotes);
    expect(result.materials).toBeNull();
    expect(result.engineeringChecks).toBeNull();
    expect(result.nestingChecks).toBeNull();
    expect(result.collaborators).toBeNull();
    expect(result.stagesSource).toBe(legacyProject);
  });

  it('ignores any snapshot data for a project that is still live (not archived)', () => {
    // A project could in theory carry a stale `snapshot` key if it somehow
    // re-appeared in the sheet after being archived — live data must win.
    const project = { so: '900', status: 'Nesting', snapshot: { notes: [{ id: 'stale' }] } };
    const liveNotes = [{ id: 'fresh', text: 'current live note' }];

    const result = resolveArchivedView(project, false, liveNotes);

    expect(result.notes).toEqual(liveNotes);
    expect(result.materials).toBeNull();
    expect(result.stagesSource).toBe(project);
  });

  it('returns an empty notes array, not undefined, when there is neither a snapshot nor live notes', () => {
    const result = resolveArchivedView({ so: '1' }, true, undefined);
    expect(result.notes).toEqual([]);
  });
});
