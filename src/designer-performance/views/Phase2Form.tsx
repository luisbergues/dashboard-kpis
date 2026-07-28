import React, { useState, useMemo } from 'react';
import { useKpi } from '../context/KpiContext';
import { calculatePhase2FromNotes } from '../utils/redFlags';
import toast from 'react-hot-toast';
import { Flag, Send, Hash, User, Layers } from 'lucide-react';
import { T } from '../utils/theme';

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background: T.cardBg, border: `1px solid ${T.cardBorder}`,
    borderRadius: T.radiusLg, padding: '24px 28px', ...style,
  }}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </span>
      <h3 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '1.0rem', color: T.textPrimary, margin: 0 }}>
        {title}
      </h3>
    </div>
    {subtitle && <p style={{ color: T.textMuted, fontSize: '0.78rem', marginTop: 6, paddingLeft: 40 }}>{subtitle}</p>}
    <div style={{ height: 1, background: T.cardBorder, marginTop: 12 }} />
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; half?: boolean }> = ({ label, children, half }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(half ? { flex: '1 1 45%', minWidth: 130 } : {}) }}>
    <label style={{ color: T.textSecondary, fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
  borderRadius: T.radiusPill, color: T.textPrimary,
  padding: '10px 16px', fontSize: '0.88rem', outline: 'none',
  width: '100%', fontFamily: "'Inter',sans-serif",
};

const MetricChip: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color?: string }> = ({ icon, label, value, color = T.blue }) => (
  <div style={{
    flex: 1, padding: '14px 16px', borderRadius: T.radiusMd,
    background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: `${color}18`, border: `1px solid ${color}35`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ color: T.textMuted, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ color: typeof value === 'string' ? color : T.textPrimary, fontWeight: 700, fontSize: '1.1rem' }}>
        {value}
      </div>
    </div>
  </div>
);

export const Phase2Form: React.FC = () => {
  const { projects, updateProject, getProjectNotes } = useKpi();

  const [selectedProjectId, setSelectedProjectId] = useState('');

  const approvedProjects = projects.filter(p => p.status === 'Approved');
  const selectedProject  = projects.find(p => p.id === selectedProjectId);

  // Las notas designer del proyecto son los red flags. El reloj de las que
  // sigan abiertas corre hasta hoy, asi que el preview sube solo.
  const notes = selectedProject ? getProjectNotes(selectedProject.id) : [];
  // notesKey captura lo unico que afecta el calculo; `notes` cambia de
  // identidad en cada render y volveria a calcular siempre.
  const notesKey = notes.map(n => `${n.id}:${n.urgency || 'green'}:${n.resolvedAt || ''}`).join('|');
  const result = useMemo(
    () => calculatePhase2FromNotes(notes, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notesKey],
  );

  const noteById = (id: string) => notes.find(n => n.id === id);

  const scoreColor = result.score >= 80 ? T.green
    : result.score >= 60 ? T.yellow
    : T.red;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) { toast.error('Please select an approved project.'); return; }

    const closedAt = Date.now();
    // Se recalcula con el timestamp de cierre para congelar el valor: las notas
    // abiertas dejan de acumular en este instante.
    const finalResult = calculatePhase2FromNotes(notes, closedAt);

    const updateResult = await updateProject({
      ...selectedProject,
      status: 'Completed',
      phase2Score: finalResult.score,
      phase2Data: {
        closedAt,
        totalNotes: finalResult.breakdown.length,
        totalPenalty: finalResult.totalPenalty,
        breakdown: finalResult.breakdown,
      },
    });
    if (updateResult.conflict) {
      toast.error(`Designer was just changed to "${updateResult.currentDesignerName}" by someone else. Reload and try again.`);
      return;
    }
    toast.success(`Project Closed! IFR Score: ${finalResult.score}`);
    setSelectedProjectId('');
  };

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 700, margin: '0 auto', paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '1.5rem', color: T.textPrimary, margin: 0 }}>
          Phase 2: Project Closure
        </h2>
        <p style={{ color: T.textMuted, fontSize: '0.85rem', marginTop: 4 }}>
          Calculate the Friction &amp; Response Index (IFR) for approved projects.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Select Project ──────────────────────────────────────── */}
        <Card>
          <SectionTitle icon={<Hash size={15} color={T.blue} />} title="Select Project" subtitle="Only Approved projects are available for Phase 2 closure." />

          <Field label="Approved Project">
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
            >
              <option value="">Choose a project to close…</option>
              {approvedProjects.map(p => (
                <option key={p.id} value={p.id}>#{p.id} — {p.projectName} ({p.designerName})</option>
              ))}
            </select>
          </Field>

          {approvedProjects.length === 0 && (
            <div style={{
              marginTop: 12, padding: '12px 16px', borderRadius: T.radiusMd,
              background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
              color: T.yellow, fontSize: '0.82rem',
            }}>
              No approved projects yet. Complete Phase 1 first to approve a project.
            </div>
          )}

          {/* Project metrics */}
          {selectedProject && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <MetricChip icon={<Layers size={16} color={T.blue} />} label="Total Rooms" value={selectedProject.totalRooms} color={T.blue} />
              <MetricChip icon={<User size={16} color={T.green} />}  label="Designer"    value={selectedProject.designerName} color={T.green} />
            </div>
          )}
        </Card>

        {/* ── Friction Metrics ────────────────────────────────────── */}
        {selectedProject && (
          <Card>
            <SectionTitle
              icon={<Flag size={15} color={T.red} />}
              title="Red Flags"
              subtitle="Notas de tipo Designer cargadas en My Projects. Verde −0.5/día, amarillo −1, rojo −2; se duplica a partir del día 5, con tope por nota."
            />

            {result.breakdown.length === 0 ? (
              <div style={{
                padding: '12px 16px', borderRadius: T.radiusMd,
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                color: T.green, fontSize: '0.82rem',
              }}>
                Sin red flags para este proyecto. IFR = 100.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.breakdown.map(line => {
                  const note = noteById(line.noteId);
                  const dot = line.urgency === 'red' ? T.red : line.urgency === 'yellow' ? T.yellow : T.green;
                  return (
                    <div key={line.noteId} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '10px 14px', borderRadius: T.radiusMd,
                      background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: T.textPrimary, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note?.text || '(sin texto)'}
                          </div>
                          <div style={{ color: T.textMuted, fontSize: '0.72rem' }}>
                            {line.days} {line.days === 1 ? 'día' : 'días'} · {note?.resolvedAt ? 'resuelta' : 'abierta'}
                          </div>
                        </div>
                      </div>
                      <span style={{ color: T.red, fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                        &minus;{line.penalty}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: T.radiusMd,
              background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ color: T.textMuted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Penalización total
                </div>
                <code style={{ color: T.textSecondary, fontSize: '0.78rem' }}>
                  100 &minus; {result.totalPenalty}
                </code>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: T.textMuted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  IFR
                </div>
                <div style={{
                  fontSize: '1.6rem', fontWeight: 800, color: scoreColor,
                  textShadow: `0 0 20px ${scoreColor}60`,
                  transition: 'color 0.3s',
                }}>
                  {result.score}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Submit ──────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={!selectedProject}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: T.radiusPill,
            border: 'none',
            background: !selectedProject ? T.cardBg : T.blue,
            color: !selectedProject ? T.textMuted : '#fff',
            fontSize: '0.92rem', fontWeight: 700,
            cursor: !selectedProject ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: !selectedProject ? 'none' : '0 4px 20px rgba(59,130,246,0.35)',
            transition: 'all 0.2s',
            fontFamily: "'Inter',sans-serif",
          }}
          onMouseEnter={e => { if (selectedProject) (e.currentTarget as HTMLElement).style.background = T.blueDeep; }}
          onMouseLeave={e => { if (selectedProject) (e.currentTarget as HTMLElement).style.background = T.blue; }}
        >
          <Send size={16} />
          Calculate Phase 2 &amp; Close Project
        </button>
      </div>
    </div>
  );
};
