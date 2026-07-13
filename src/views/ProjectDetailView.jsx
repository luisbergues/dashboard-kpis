import { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Calendar, User, AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { calculateAutomaticStages, STAGES } from '../utils/stageUtils';
import { useDesignerContacts } from '../utils/useDesignerContacts';

function getStatusColor(status) {
  switch (status) {
    case 'ENGINEERING': return '#3b82f6';
    case 'CHECK ENG.': return '#8b5cf6';
    case 'PAPERWORK': return '#f59e0b';
    case 'CHECK': return '#ec4899';
    case 'NESTING': return '#10b981';
    case 'INSTALL': return '#06b6d4';
    case 'ON HOLD': return '#ef4444';
    case 'COMPLETED': return '#22c55e';
    case 'CANCELLED': return '#6b7280';
    default: return '#94a3b8';
  }
}

export default function ProjectDetailView({ data, projectNotes = {}, projectDesigners = {}, overrides = {} }) {
  const { language } = useLanguage();
  const { phoneLookup } = useDesignerContacts();
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const so = params.get('project');

  // Look in the active sheet first; fall back to the Firestore archive so
  // completed projects that were later removed from the sheet still resolve
  // (their data is preserved there — see completedProjectsArchive.js).
  const project = data?.priorityAnalysis?.find(p => String(p.so) === String(so))
    || data?.archivedProjects?.find(p => String(p.so) === String(so));
  const override = overrides[so];
  const status = override?.status || project?.status || 'N/A';
  const onHoldReason = override?.onHoldReason || null;
  const designer = projectDesigners[so];
  const designerPhone = designer ? (phoneLookup[designer] || 'N/A') : null;
  const notes = projectNotes[so] || [];
  const stages = project ? calculateAutomaticStages(project) : [];

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
          <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: 12 }} />
          <h2 style={{ color: '#f1f5f9', marginBottom: 8 }}>Project not found</h2>
          <p style={{ color: '#94a3b8' }}>SO #{so} could not be found in the current data.</p>
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
          <h1 style={styles.title}>{project.name.split(':')[0].trim()}</h1>
          {project.name.includes(':') && (
            <p style={styles.subtitle}>{project.name.split(':').slice(1).join(':').trim()}</p>
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
        <span style={{ ...styles.statusBadge, background: getStatusColor(status) }}>
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
          <div style={styles.infoIcon}><Calendar size={18} color="#3b82f6" /></div>
          <div>
            <div style={styles.infoLabel}>Install Date</div>
            <div style={styles.infoValue}>{project.install || 'N/A'}</div>
          </div>
        </div>

        {/* Engineer */}
        <div style={styles.infoCard}>
          <div style={styles.infoIcon}><User size={18} color="#8b5cf6" /></div>
          <div>
            <div style={styles.infoLabel}>Engineer</div>
            <div style={styles.infoValue}>{project.eng || 'N/A'}</div>
          </div>
        </div>

        {/* Designer */}
        {designer && (
          <div style={styles.infoCard}>
            <div style={styles.infoIcon}><User size={18} color="#f59e0b" /></div>
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
            <div style={styles.infoIcon}><Clock size={18} color="#10b981" /></div>
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
                    background: isCompleted && isNextCompleted ? '#10b981' : 'rgba(255,255,255,0.1)',
                  }} />
                )}
                <div style={{
                  ...styles.stageDot,
                  background: isCompleted ? '#10b981' : '#0b1320',
                  border: isCompleted ? '2px solid #10b981' : '2px solid rgba(255,255,255,0.15)',
                }}>
                  {isCompleted && <Check size={14} color="#fff" strokeWidth={3} />}
                </div>
                <span style={{ ...styles.stageLabel, color: isCompleted ? '#10b981' : '#94a3b8' }}>
                  {stage.label}
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
                  <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.8rem' }}>
                    {note.author || 'Unknown'}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {note.timestamp ? new Date(note.timestamp).toLocaleString() : ''}
                  </span>
                </div>
                <p style={styles.noteText}>{note.text}</p>
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

      {/* Footer */}
      <div style={styles.footer}>
        <span style={{ color: '#475569', fontSize: '0.8rem' }}>JL Closets · Project Detail</span>
        <a href={window.location.origin} style={{ color: '#3b82f6', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ExternalLink size={12} /> Open Dashboard
        </a>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    padding: '40px 20px',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 800,
    margin: '0 auto',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
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
    color: '#3b82f6',
    fontSize: '0.9rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  title: {
    color: '#f1f5f9',
    fontSize: '1.6rem',
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    color: '#94a3b8',
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
    background: 'rgba(59,130,246,0.15)',
    border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 8,
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  statusBadge: {
    padding: '6px 14px',
    borderRadius: 20,
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.05em',
  },
  holdReason: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#fca5a5',
    fontSize: '0.85rem',
    background: 'rgba(239,68,68,0.1)',
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.2)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 12,
    marginBottom: 28,
  },
  infoCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
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
    color: '#64748b',
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 4,
  },
  infoValue: {
    color: '#e2e8f0',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  infoSub: {
    color: '#64748b',
    fontSize: '0.78rem',
    marginTop: 3,
  },
  section: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '20px 24px',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#cbd5e1',
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
  noteCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
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
    color: '#cbd5e1',
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
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
};
