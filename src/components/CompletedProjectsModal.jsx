import { X, Calendar } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { formatDisplayDate } from '../utils/dateFormat';

export default function CompletedProjectsModal({ projects, onClose, activeProjectSos }) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  // background is var(--bg-surface) (real theme background), so hardcoded
  // near-white text below it was invisible in light theme.
  const C = {
    title: isLight ? '#0f172a' : '#fff',
    body: isLight ? '#475569' : '#94A3B8',
    name: isLight ? '#1e293b' : '#E2E8F0',
    faint: isLight ? '#64748b' : '#64748B',
  };

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
                ? 'Todos los proyectos finalizados: en la hoja activa o ya archivados (hasta 6 meses tras ser removidos).'
                : 'All finished projects: still in the active sheet, or already archived (kept up to 6 months after removal).'}
            </p>
          </div>
          <button onClick={onClose} aria-label={language === 'es' ? 'Cerrar' : 'Close'} style={{ background: 'transparent', border: 'none', color: C.body, cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {projects && projects.length > 0 ? (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>SO #</th>
                    <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>{language === 'es' ? 'Nombre' : 'Name'}</th>
                    <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>{language === 'es' ? 'Fecha de Instalación' : 'Install Date'}</th>
                    <th style={{ padding: '12px 8px', color: C.body, fontSize: '0.85rem' }}>{language === 'es' ? 'Archivado' : 'Archived'}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => {
                    // Try to parse archivedAt if it's a Firestore timestamp
                    let archivedDate = language === 'es' ? 'Aún en la hoja' : 'Still in sheet';
                    if (p.archivedAt && typeof p.archivedAt.toDate === 'function') {
                      archivedDate = formatDisplayDate(p.archivedAt.toDate(), language);
                    } else if (p.archivedAt && p.archivedAt.seconds) {
                      archivedDate = formatDisplayDate(new Date(p.archivedAt.seconds * 1000), language);
                    }

                    const isInPipeline = activeProjectSos && activeProjectSos.has(String(p.so));

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
                        <td style={{ padding: '12px 8px', color: C.name }}>{p.name}</td>
                        <td style={{ padding: '12px 8px', color: C.body }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} />
                            {p.install || 'TBD'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: C.faint, fontSize: '0.85rem' }}>{archivedDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
