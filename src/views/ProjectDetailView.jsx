import { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Calendar, User, AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { calculateAutomaticStages, STAGES } from '../utils/stageUtils';
import { useDesignerContacts } from '../utils/useDesignerContacts';
import { shortProjectName } from '../utils/projectName';
import { normalizeNotes, noteStorageKey } from '../utils/projectNotes';
import { noteTagKey } from '../utils/projectTags';
import NoteTagChips from '../components/NoteTagChips';

// Resolves what this view should show for notes/stages/materials/checks,
// preferring the archive's `snapshot` (captured before the live nodes were
// cleared — see completedProjectsArchive.js) once a project is archived.
// Legacy archive records (written before snapshots existed) have no
// `snapshot` key at all — everything here falls back gracefully instead of
// throwing, so those 3 old records still render fine.
export function resolveArchivedView(project, isArchived, liveNotes = []) {
  const snapshot = isArchived ? (project?.snapshot || null) : null;
  return {
    // El snapshot guarda project_notes tal como estaba en RTDB, que puede ser
    // un array indexado (formato viejo) o un mapa por nota (formato nuevo).
    // normalizeNotes deja ambos como array; sin esto, un snapshot en formato
    // nuevo llegaba como objeto y la seccion de notas desaparecia en silencio
    // (`.length` de un objeto es undefined).
    notes: snapshot?.notes ? normalizeNotes(snapshot.notes) : (liveNotes || []),
    // project_stages (RTDB) hasn't been written to in a long time — real
    // per-stage dates come from the sheet's statusHistory, which is what
    // calculateAutomaticStages() actually reads.
    stagesSource: snapshot?.statusHistory
      ? { ...project, statusHistory: snapshot.statusHistory }
      : project,
    materials: snapshot?.materials || null,
    engineeringChecks: snapshot?.engineeringChecks || null,
    nestingChecks: snapshot?.nestingChecks || null,
    collaborators: snapshot?.collaborators || null,
  };
}

// Renders an opaque, freeform object (materials/checks can hold whatever
// shape the feature that wrote them used) as a simple label/value list —
// generic on purpose, so it never breaks on an unexpected shape.
function KeyValueList({ data }) {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={styles.kvRow}>
          <span style={styles.kvKey}>{key}</span>
          <span style={styles.kvValue}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
        </div>
      ))}
    </div>
  );
}

// Verde = activo/hecho, ámbar = en pausa (alerta), gris = cancelado/sin dato.
// Texto sobre fondo soft siempre en su -ink (ver getStatusInk).
function getStatusColor(status) {
  switch (status) {
    case 'ENGINEERING':
    case 'CHECK ENG.':
    case 'PAPERWORK':
    case 'CHECK':
    case 'NESTING':
    case 'INSTALL': return 'var(--accent-soft)';
    case 'COMPLETED': return 'var(--accent)';
    case 'ON HOLD': return 'var(--warn-soft)';
    default: return 'var(--surface-2)';
  }
}

function getStatusInk(status) {
  switch (status) {
    case 'ENGINEERING':
    case 'CHECK ENG.':
    case 'PAPERWORK':
    case 'CHECK':
    case 'NESTING':
    case 'INSTALL': return 'var(--accent-ink)';
    case 'COMPLETED': return 'var(--on-primary)';
    case 'ON HOLD': return 'var(--warn-ink)';
    default: return 'var(--text-muted)';
  }
}

export default function ProjectDetailView({ data, projectNotes = {}, projectDesigners = {}, overrides = {}, tagsByNote = {} }) {
  const { language, t } = useLanguage();
  const { phoneLookup } = useDesignerContacts();
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const so = params.get('project');

  // Look in the active sheet first; fall back to the archive so completed
  // projects that were later removed from the sheet still resolve (their
  // data is preserved there — see completedProjectsArchive.js).
  const liveProject = data?.priorityAnalysis?.find(p => String(p.so) === String(so));
  const project = liveProject || data?.archivedProjects?.find(p => String(p.so) === String(so));
  const isArchived = !liveProject && !!project;
  const override = overrides[so];
  const status = override?.status || project?.status || 'N/A';
  const onHoldReason = override?.onHoldReason || null;
  const designer = projectDesigners[so];
  const designerPhone = designer ? (phoneLookup[designer] || 'N/A') : null;
  const { notes, stagesSource, materials, engineeringChecks, nestingChecks, collaborators } =
    resolveArchivedView(project, isArchived, projectNotes[so]);
  const stages = project ? calculateAutomaticStages(stagesSource) : [];

  const pageUrl = window.location.href;

  const handleCopy = () => {
    navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!project) {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <AlertTriangle size={32} style={{ marginBottom: 12, color: 'var(--danger)' }} />
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>{language === 'es' ? 'Proyecto no encontrado' : 'Project not found'}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{language === 'es' ? `No se pudo encontrar la SO #${so} en los datos actuales.` : `SO #${so} could not be found in the current data.`}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.soLabel}>SO #{project.so}</div>
          <h1 style={styles.title}>{shortProjectName(project.name)}</h1>
          {String(project.name || '').includes(':') && (
            <p style={styles.subtitle}>{String(project.name).split(':').slice(1).join(':').trim()}</p>
          )}
        </div>
        <div style={styles.headerActions}>
          <button onClick={handleCopy} style={styles.copyBtn}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <span style={{ ...styles.statusBadge, background: getStatusColor(status), color: getStatusInk(status) }}>
          {status}
        </span>
        {onHoldReason && (
          <span style={styles.holdReason}>
            <AlertTriangle size={14} />
            {onHoldReason}
          </span>
        )}
      </div>

      {/* Info Grid */}
      <div style={styles.grid}>
        {/* Install Date */}
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}><Calendar size={18} style={{ color: 'var(--text-muted)' }} /></div>
          <div>
            <div style={styles.infoLabel}>Install Date</div>
            <div style={styles.infoValue}>{project.install || 'N/A'}</div>
          </div>
        </div>

        {/* Engineer */}
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}><User size={18} style={{ color: 'var(--text-muted)' }} /></div>
          <div>
            <div style={styles.infoLabel}>Engineer</div>
            <div style={styles.infoValue}>{project.eng || 'N/A'}</div>
          </div>
        </div>

        {/* Designer */}
        {designer && (
          <div style={styles.infoCard}>
            <div style={styles.infoIcon}><User size={18} style={{ color: 'var(--text-muted)' }} /></div>
            <div>
              <div style={styles.infoLabel}>Designer</div>
              <div style={styles.infoValue}>{designer}</div>
              {designerPhone && <div style={styles.infoSub}>{designerPhone}</div>}
            </div>
          </div>
        )}

        {/* Due Week */}
        {project.dueWeek && (
          <div style={styles.infoCard}>
            <div style={styles.infoIcon}><Clock size={18} style={{ color: 'var(--text-muted)' }} /></div>
            <div>
              <div style={styles.infoLabel}>Due Week</div>
              <div style={styles.infoValue}>{project.dueWeek}</div>
            </div>
          </div>
        )}
      </div>

      {/* Stage Progress */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Process Timeline</h3>
        <div style={styles.stagesRow}>
          {STAGES.map((stage, idx) => {
            const isCompleted = stages[idx]?.completed;
            const isNextCompleted = stages[idx + 1]?.completed;
            return (
              <div key={stage.id} style={styles.stageItem}>
                {idx < STAGES.length - 1 && (
                  <div style={{
                    ...styles.stageConnectorLine,
                    background: isCompleted && isNextCompleted ? 'var(--accent)' : 'var(--border)',
                  }} />
                )}
                <div style={{
                  ...styles.stageDot,
                  background: isCompleted ? 'var(--accent)' : 'var(--surface-2)',
                  border: isCompleted ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                }}>
                  {isCompleted && <Check size={14} strokeWidth={3} style={{ color: 'var(--on-primary)' }} />}
                </div>
                <span style={{ ...styles.stageLabel, color: isCompleted ? 'var(--accent-ink)' : 'var(--text-muted)' }}>
                  {t(stage.labelKey)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Notes ({notes.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map((note, i) => (
              <div key={note.id || i} style={styles.noteCard}>
                <div style={styles.noteMeta}>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.8rem' }}>
                    {note.createdBy || 'Unknown'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                  </span>
                </div>
                {note.parentNoteId && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', margin: '0 0 4px 0' }}>
                    ↩ {language === 'es' ? 'En respuesta a una nota anterior' : 'In reply to an earlier note'}
                  </p>
                )}
                <p style={styles.noteText}>{note.text}</p>
                <NoteTagChips tags={tagsByNote[noteTagKey(so, noteStorageKey(note))] || []} language={language} />
                {note.attachments && note.attachments.map((att, ai) => (
                  att.type === 'image' ? (
                    <img key={ai} src={att.url} alt="attachment" style={styles.noteImg} />
                  ) : null
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materials — only preserved for archived projects (see completedProjectsArchive.js) */}
      {isArchived && materials && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{language === 'es' ? 'Materiales' : 'Materials'}</h3>
          <KeyValueList data={materials} />
        </div>
      )}

      {/* Checks — engineering + nesting, only preserved for archived projects */}
      {isArchived && (engineeringChecks || nestingChecks) && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Checks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {engineeringChecks && (
              <div>
                <div style={styles.checkLabel}>{language === 'es' ? 'Ingeniería' : 'Engineering'}</div>
                <KeyValueList data={engineeringChecks} />
              </div>
            )}
            {nestingChecks && (
              <div>
                <div style={styles.checkLabel}>Nesting</div>
                <KeyValueList data={nestingChecks} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collaborators — only preserved for archived projects */}
      {isArchived && collaborators && collaborators.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{language === 'es' ? 'Colaboradores' : 'Collaborators'}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {collaborators.map((name, i) => (
              <span key={i} style={styles.collabBadge}>{name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <span style={{ color: 'var(--text)', fontSize: '0.8rem' }}>JL Closets · Project Detail</span>
        <a href={window.location.origin} style={{ color: 'var(--text)', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ExternalLink size={12} /> Open Dashboard
        </a>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface) 50%, var(--surface) 100%)',
    padding: '40px 20px',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 800,
    margin: '0 auto',
  },
  card: {
    background: 'var(--overlay-05)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 40,
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
    flexWrap: 'wrap',
  },
  soLabel: {
    color: 'var(--text)',
    fontSize: '0.9rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '1.6rem',
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    margin: '6px 0 0',
  },
  headerActions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexShrink: 0,
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  statusBadge: {
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '0.05em',
  },
  holdReason: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--danger)',
    fontSize: '0.85rem',
    background: 'var(--danger-soft)',
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid var(--danger-line)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 28,
  },
  infoCard: {
    background: 'var(--overlay-04)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    backdropFilter: 'blur(8px)',
  },
  infoIcon: {
    marginTop: 2,
    flexShrink: 0,
  },
  infoLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  infoValue: {
    color: 'var(--text)',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  infoSub: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    marginTop: 3,
  },
  section: {
    background: 'var(--overlay-03)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '20px 24px',
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'var(--text)',
    fontSize: '0.85rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 18,
    margin: '0 0 18px',
  },
  stagesRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  stageItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    flex: '1 1 0',
    minWidth: 70,
  },
  stageConnectorLine: {
    position: 'absolute',
    top: 14, /* Center of the 28px dot */
    left: '50%',
    width: '100%',
    height: 2,
    zIndex: 0,
    transition: 'background 0.3s ease',
  },
  stageDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginBottom: 8,
    transition: 'all 0.3s',
  },
  stageLabel: {
    fontSize: '0.7rem',
    textAlign: 'center',
    lineHeight: 1.2,
    fontWeight: 500,
  },
  kvRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  kvKey: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    textTransform: 'capitalize',
  },
  kvValue: {
    color: 'var(--text)',
    fontSize: '0.85rem',
    fontWeight: 500,
    textAlign: 'right',
    wordBreak: 'break-word',
  },
  checkLabel: {
    color: 'var(--text)',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
  },
  collabBadge: {
    background: 'var(--overlay-05)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: '0.82rem',
    color: 'var(--text)',
  },
  noteCard: {
    background: 'var(--overlay-04)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 16px',
  },
  noteMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  noteText: {
    color: 'var(--text)',
    fontSize: '0.9rem',
    margin: 0,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  noteImg: {
    maxWidth: '100%',
    borderRadius: 8,
    marginTop: 10,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
  },
};
