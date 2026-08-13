import { useState, useEffect, useMemo } from 'react';
import { Search, FileStack } from 'lucide-react';
import { db, ref, onValue } from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import EssProjectDetail from './EssProjectDetail';
import { planRetention, daysUntilPurge } from '../utils/essRetention';
import { markForPurge, clearPurgeMark, purgeEssFiles } from '../utils/essFiles';
import { shortProjectName } from '../utils/projectName';

function statusFor(so, filesBySo, autoDataBySo) {
  const files = filesBySo?.[so];
  const hasFiles = Boolean(files && (files.contract || files.quote || files.drawings));
  // The countdown outranks 'generated': it is the only state that is about to
  // change on its own, so it is the one worth surfacing.
  if (hasFiles && files.purgeMarkedAt) return 'purging';
  if (autoDataBySo?.[so]) return 'generated';
  if (hasFiles) return 'uploaded';
  return 'none';
}

export default function EssView({ data }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedSo, setSelectedSo] = useState(null);
  const [filesBySo, setFilesBySo] = useState({});
  const [autoDataBySo, setAutoDataBySo] = useState({});
  const [sweepSummary, setSweepSummary] = useState(null);
  // Captured once instead of read during render: the countdown is day-granular,
  // and calling Date.now() on every render makes the render impure for a label
  // that cannot meaningfully change within a single sitting.
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!db) return;
    // ess_file_index, not ess_files: this list only needs to know *whether* a
    // file exists per SO/docType, and ess_files carries the full Base64 PDF of
    // every file of every project — subscribing to that here would pull tens of
    // megabytes on every tab open.
    const unsubFiles = onValue(
      ref(db, 'ess_file_index'),
      snap => setFilesBySo(snap.val() || {}),
      (error) => console.error('Failed to subscribe to ESS data:', error)
    );
    const unsubAuto = onValue(
      ref(db, 'essAutoData'),
      snap => setAutoDataBySo(snap.val() || {}),
      (error) => console.error('Failed to subscribe to ESS data:', error)
    );
    return () => { unsubFiles(); unsubAuto(); };
  }, []);

  // Retention sweep. Runs only here, because only a super admin can open this
  // tab — which is also the only role the RTDB rules let delete these nodes.
  //
  // This effect re-runs often: `data` gets a fresh identity on many App renders,
  // and writing a mark changes filesBySo through the subscription above. That is
  // safe because every transition is idempotent and self-terminating — after a
  // mark the project reads as already marked and within grace, after an unmark it
  // no longer qualifies, after a purge the entry is gone. Do not memoise this to
  // "fix" the re-runs; a stale memo would be the actual bug.
  useEffect(() => {
    const projectRows = data?.priorityAnalysis || [];
    // An empty side means a subscription hasn't landed yet. Acting on that
    // would read as "every project is an orphan" or "there is nothing to do".
    if (projectRows.length === 0 || Object.keys(filesBySo).length === 0) return;

    let cancelled = false;
    (async () => {
      const { toMark, toUnmark, toPurge, orphans } = planRetention({
        projects: projectRows,
        fileIndex: filesBySo,
        now: Date.now(),
      });

      const markedAt = new Date().toISOString();
      const purged = [];

      // Each project is independent: one failure must not abort the sweep or
      // leave another half-deleted.
      for (const so of toMark) {
        try { await markForPurge(so, markedAt); }
        catch (error) { console.error(`Failed to mark ${so} for purge:`, error); }
      }
      for (const so of toUnmark) {
        try { await clearPurgeMark(so); }
        catch (error) { console.error(`Failed to clear purge mark on ${so}:`, error); }
      }
      for (const so of toPurge) {
        try { await purgeEssFiles(so); purged.push(so); }
        catch (error) { console.error(`Failed to purge ESS files for ${so}:`, error); }
      }

      if (!cancelled && (purged.length > 0 || orphans.length > 0)) {
        setSweepSummary({ purged, orphans });
      }
    })();
    return () => { cancelled = true; };
  }, [data, filesBySo]);

  const projects = useMemo(() => {
    const all = data?.priorityAnalysis || [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? all.filter(p => String(p.so).includes(term) || (p.name || '').toLowerCase().includes(term))
      : all;
    return [...filtered].sort((a, b) => String(a.so).localeCompare(String(b.so)));
  }, [data, search]);

  const selectedProject = selectedSo ? projects.find(p => String(p.so) === String(selectedSo)) || (data?.priorityAnalysis || []).find(p => String(p.so) === String(selectedSo)) : null;

  if (selectedProject) {
    // Box/front type are not in any of the three PDFs — they come from the
    // materials matrix, already merged with its manual overrides upstream in
    // App.jsx, exactly as My Projects feeds the hand-entered ESS modal.
    const materials = (data?.materialRequirements || []).find(m => String(m.so) === String(selectedProject.so));
    return <EssProjectDetail project={selectedProject} materials={materials} onBack={() => setSelectedSo(null)} />;
  }

  const statusLabel = (status, so) => {
    if (status === 'purging') {
      const days = daysUntilPurge(filesBySo[so], nowMs);
      if (days === 0) return language === 'es' ? 'Se borra en breve' : 'Deleting shortly';
      return language === 'es' ? `Se borra en ${days} días` : `Deletes in ${days} days`;
    }
    if (status === 'generated') return language === 'es' ? 'ESS generada' : 'ESS generated';
    if (status === 'uploaded') return language === 'es' ? 'PDFs cargados' : 'PDFs uploaded';
    return language === 'es' ? 'Sin PDFs' : 'No PDFs';
  };

  const searchPlaceholder = language === 'es' ? 'Buscar por SO o nombre...' : 'Search by SO or name...';

  const openProject = (so) => setSelectedSo(so);
  const openOnKey = (event, so) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Space would otherwise scroll the page out from under the row.
    event.preventDefault();
    openProject(so);
  };

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileStack size={20} /> {language === 'es' ? 'Generador de ESS' : 'ESS Generator'}
      </h2>
      {/* Same structure Pipeline uses: the app only styles inputs by class or
          under .light-theme, so a bare input falls through to the browser's own
          white-on-black default and takes the icon down with it. */}
      <div className="search-bar glass-card" style={{ margin: '16px 0', maxWidth: '360px' }}>
        <Search size={16} className="text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
        />
      </div>
      {/* Project names run long ("Leslie Fenton - Garage - Wall Storage"); the
          table scrolls inside this box rather than pushing the page sideways. */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '420px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px' }}>SO</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'es' ? 'Proyecto' : 'Project'}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'es' ? 'Estado' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(project => {
              const status = statusFor(project.so, filesBySo, autoDataBySo);
              return (
                <tr
                  key={project.so}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProject(project.so)}
                  onKeyDown={e => openOnKey(e, project.so)}
                  style={{ cursor: 'pointer', borderTop: '1px solid var(--card-border, #333)' }}
                >
                  <td style={{ padding: '8px' }}>{project.so}</td>
                  <td style={{ padding: '8px' }}>{shortProjectName(project.name)}</td>
                  <td style={{ padding: '8px' }}>{statusLabel(status, project.so)}</td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '16px', textAlign: 'center' }} className="text-muted">
                  {search.trim()
                    ? (language === 'es' ? `Ningún proyecto coincide con "${search.trim()}"` : `No projects match "${search.trim()}"`)
                    : (language === 'es' ? 'Todavía no hay proyectos para mostrar' : 'No projects to show yet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sweepSummary && (
        <div className="glass-card" style={{ padding: '12px', marginTop: '16px' }}>
          {sweepSummary.purged.length > 0 && (
            <p>
              {language === 'es'
                ? `Se liberaron los PDFs de ${sweepSummary.purged.length} proyecto(s) ya en nesteo: ${sweepSummary.purged.join(', ')}`
                : `Freed the source PDFs of ${sweepSummary.purged.length} project(s) already in nesting: ${sweepSummary.purged.join(', ')}`}
            </p>
          )}
          {sweepSummary.orphans.length > 0 && (
            <p>
              {language === 'es'
                ? `Estos SO tienen PDFs pero no figuran en el sheet, así que no se tocaron: ${sweepSummary.orphans.join(', ')}`
                : `These SOs have PDFs but are absent from the sheet, so they were left alone: ${sweepSummary.orphans.join(', ')}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
