import { useMemo, useState } from 'react';
import { X, Calendar, Search, StickyNote } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { formatDisplayDate } from '../utils/dateFormat';

// `archivedAt` is stored as a plain ISO string (see completedProjectsArchive.js),
// but this also tolerates a Firestore-Timestamp-shaped value in case any
// legacy entry from the format's brief detour through Firestore/Storage
// still lingers (see archiveStore.js's history comment). Returns `null` when
// there's genuinely no archive date (the project is still only in the live
// sheet, not yet archived).
export function parseArchivedAt(archivedAt) {
  if (!archivedAt) return null;
  if (typeof archivedAt.toDate === 'function') return archivedAt.toDate();
  if (typeof archivedAt.seconds === 'number') return new Date(archivedAt.seconds * 1000);
  const d = new Date(archivedAt);
  return isNaN(d.getTime()) ? null : d;
}

export default function CompletedProjectsModal({ projects, onClose, activeProjectSos, projectNotes = {} }) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [searchTerm, setSearchTerm] = useState('');
  // background is var(--bg-surface) (real theme background), so hardcoded
  // near-white text below it was invisible in light theme.
  const C = {
    title: isLight ? '#0f172a' : '#fff',
    body: isLight ? '#475569' : '#94A3B8',
    name: isLight ? '#1e293b' : '#E2E8F0',
    faint: isLight ? '#64748b' : '#64748B',
  };

  const visibleProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = !term
      ? (projects || [])
      : (projects || []).filter(p =>
          String(p.so || '').toLowerCase().includes(term) ||
          String(p.name || '').toLowerCase().includes(term) ||
          String(p.designer || '').toLowerCase().includes(term)
        );

    // Most recently archived first. A project still sitting in the live
    // sheet (no archivedAt yet) has no real archive date — treat it as "now"
    // so it surfaces at the top, alongside the projects that just finished.
    return [...filtered].sort((a, b) => {
      const dateA = parseArchivedAt(a.archivedAt)?.getTime() ?? Date.now();
      const dateB = parseArchivedAt(b.archivedAt)?.getTime() ?? Date.now();
      return dateB - dateA;
    });
  }, [projects, searchTerm]);

  return (
    <div className="modal-overlay animate-fade-in" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
      zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="modal-content glass-card" style={{
        width: '90%', maxWidth: '800px', maxHeight: '85vh',
        background: 'var(--bg-surface)', border: '1px solid var(--card-border)',
        borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }}>
        <div className="modal-header" style={{
          padding: '20px 24px', borderBottom: '1px solid var(--card-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: C.title }}>
              {language === 'es' ? 'Proyectos Completados' : 'Completed Projects'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: C.body }}>
              {language === 'es'
                ? 'Todos los proyectos finalizados: en la hoja activa o ya archivados (hasta 1 año tras ser removidos).'
                : 'All finished projects: still in the active sheet, or already archived (kept up to 1 year after removal).'}
            </p>
          </div>
          <button onClick={onClose} aria-label={language === 'es' ? 'Cerrar' : 'Close'} style={{ background: 'transparent', border: 'none', color: C.body, cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {projects && projects.length > 0 && (
          <div style={{ padding: '16px 24px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 14px', borderRadius: '100px',
              background: 'var(--overlay-05)', border: '1px solid var(--card-border)',
            }}>
              <Search size={16} color={C.body} />
              <input
                type="text"
                name="completedProjectsSearch"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={language === 'es' ? 'Buscar por SO#, nombre o diseñador…' : 'Search by SO#, name or designer…'}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: C.name, fontSize: '0.9rem',
                }}
              />
            </div>
          </div>
        )}

        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {projects && projects.length > 0 ? (
            visibleProjects.length > 0 ? (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>SO #</th>
                      <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>{language === 'es' ? 'Nombre' : 'Name'}</th>
                      <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>{language === 'es' ? 'Diseñador' : 'Designer'}</th>
                      <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>{language === 'es' ? 'Fecha de Instalación' : 'Install Date'}</th>
                      <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>{language === 'es' ? 'Archivado' : 'Archived'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProjects.map(p => {
                      const archivedDate = parseArchivedAt(p.archivedAt);
                      const isInPipeline = activeProjectSos && activeProjectSos.has(String(p.so));
                      const noteCount = (projectNotes[p.so] || []).length;

                      return (
                        <tr
                          key={p.so}
                          title={!isInPipeline
                            ? (language === 'es' ? 'Proyecto archivado: ya no está en Pipeline' : 'Archived project: no longer in Pipeline')
                            : undefined}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            opacity: isInPipeline ? 1 : 0.75,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 8px', color: C.title, fontWeight: '500' }}>
                            <a
                              href={`${window.location.origin}${window.location.pathname}?project=${p.so}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#09D1C7', textDecoration: 'none', cursor: 'pointer' }}
                            >
                              {p.so}
                            </a>
                          </td>
                          <td style={{ padding: '12px 8px', color: C.name }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{p.name}</span>
                              {noteCount > 0 && (
                                <span
                                  title={language === 'es' ? `${noteCount} nota(s) guardada(s)` : `${noteCount} saved note(s)`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: C.faint, fontSize: '0.78rem' }}
                                >
                                  <StickyNote size={12} />
                                  {noteCount}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', color: C.body }}>{p.designer || '—'}</td>
                          <td style={{ padding: '12px 8px', color: C.body }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={14} />
                              {p.install || 'TBD'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', color: C.faint, fontSize: '0.85rem' }}>
                            {archivedDate
                              ? formatDisplayDate(archivedDate, language)
                              : (language === 'es' ? 'Aún en la hoja' : 'Still in sheet')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: C.faint }}>
                <p>{language === 'es' ? 'Ningún proyecto coincide con la búsqueda.' : 'No project matches the search.'}</p>
              </div>
            )
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: C.faint }}>
              <p>{language === 'es' ? 'No hay proyectos archivados aún.' : 'No archived projects yet.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
