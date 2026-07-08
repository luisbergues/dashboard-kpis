import React from 'react';
import { X, Calendar } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';

export default function CompletedProjectsModal({ projects, onClose, activeProjectSos, onOpenProject }) {
  const { language } = useLanguage();

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
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
              {language === 'es' ? 'Proyectos Completados' : 'Completed Projects'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
              {language === 'es'
                ? 'Todos los proyectos finalizados: en la hoja activa o ya archivados (hasta 6 meses tras ser removidos).'
                : 'All finished projects: still in the active sheet, or already archived (kept up to 6 months after removal).'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {projects && projects.length > 0 ? (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ padding: '12px 8px', color: '#94A3B8', fontSize: '0.85rem' }}>SO #</th>
                    <th style={{ padding: '12px 8px', color: '#94A3B8', fontSize: '0.85rem' }}>{language === 'es' ? 'Nombre' : 'Name'}</th>
                    <th style={{ padding: '12px 8px', color: '#94A3B8', fontSize: '0.85rem' }}>{language === 'es' ? 'Fecha de Instalación' : 'Install Date'}</th>
                    <th style={{ padding: '12px 8px', color: '#94A3B8', fontSize: '0.85rem' }}>{language === 'es' ? 'Archivado' : 'Archived'}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(p => {
                    // Try to parse archivedAt if it's a Firestore timestamp
                    let archivedDate = language === 'es' ? 'Aún en la hoja' : 'Still in sheet';
                    if (p.archivedAt && typeof p.archivedAt.toDate === 'function') {
                      archivedDate = p.archivedAt.toDate().toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US');
                    } else if (p.archivedAt && p.archivedAt.seconds) {
                      archivedDate = new Date(p.archivedAt.seconds * 1000).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US');
                    }

                    const isOpenable = activeProjectSos && activeProjectSos.has(String(p.so)) && onOpenProject;

                    return (
                      <tr
                        key={p.so}
                        onClick={isOpenable ? () => onOpenProject(p.so) : undefined}
                        title={isOpenable
                          ? (language === 'es' ? 'Abrir en Pipeline' : 'Open in Pipeline')
                          : (language === 'es' ? 'Proyecto archivado: ya no está en Pipeline' : 'Archived project: no longer in Pipeline')}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          cursor: isOpenable ? 'pointer' : 'default',
                          opacity: isOpenable ? 1 : 0.6,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={isOpenable ? (e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' : undefined}
                        onMouseLeave={isOpenable ? (e) => e.currentTarget.style.backgroundColor = 'transparent' : undefined}
                      >
                        <td style={{ padding: '12px 8px', color: '#fff', fontWeight: '500' }}>{p.so}</td>
                        <td style={{ padding: '12px 8px', color: '#E2E8F0' }}>{p.name}</td>
                        <td style={{ padding: '12px 8px', color: '#94A3B8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} />
                            {p.install || 'TBD'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', color: '#64748B', fontSize: '0.85rem' }}>{archivedDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
              <p>{language === 'es' ? 'No hay proyectos archivados aún.' : 'No archived projects yet.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
