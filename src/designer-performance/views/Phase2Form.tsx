import React, { useState, useMemo } from 'react';
import { useKpi } from '../context/KpiContext';
import { calculatePhase2Score } from '../utils/scoreCalculator';
import toast from 'react-hot-toast';
import { Flag, BarChart2, Send, Hash, User, Layers } from 'lucide-react';

/* ── design tokens (same as Phase1Form) ─────────────────────────────── */
const T = {
  cardBg:     '#1C1C22',
  cardBorder: '#26272C',
  cardHover:  '#202128',
  bgDeep:     '#0A0A0C',
  bgSurface:  '#0F0F12',
  textPrimary:   '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted:     '#64748B',
  blue:    '#3B82F6',
  blueDeep:'#1D4ED8',
  green:   '#10B981',
  yellow:  '#EAB308',
  red:     '#EF4444',
  radiusLg: 28,
  radiusMd: 20,
  radiusPill: 100,
};

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
  const { projects, updateProject } = useKpi();

  const [selectedProjectId, setSelectedProjectId]   = useState('');
  const [totalRedFlags, setTotalRedFlags]           = useState<number | ''>('');
  const [redFlagsOver4Days, setRedFlagsOver4Days]   = useState<number | ''>('');

  const approvedProjects = projects.filter(p => p.status === 'Approved');
  const selectedProject  = projects.find(p => p.id === selectedProjectId);

  /* live IFR preview */
  const previewScore = useMemo(() => {
    if (!selectedProject || totalRedFlags === '' || redFlagsOver4Days === '') return null;
    if (Number(redFlagsOver4Days) > Number(totalRedFlags)) return null;
    return calculatePhase2Score(Number(totalRedFlags), Number(redFlagsOver4Days), selectedProject.icp);
  }, [selectedProject, totalRedFlags, redFlagsOver4Days]);

  const scoreColor = previewScore === null ? T.textMuted
    : previewScore >= 80 ? T.green
    : previewScore >= 60 ? T.yellow
    : T.red;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) { toast.error('Please select an approved project.'); return; }
    if (totalRedFlags === '' || redFlagsOver4Days === '') { toast.error('Please fill in all red flag fields.'); return; }
    if (Number(redFlagsOver4Days) > Number(totalRedFlags)) { toast.error('Red flags > 4 days cannot exceed total red flags.'); return; }

    const phase2Score = calculatePhase2Score(Number(totalRedFlags), Number(redFlagsOver4Days), selectedProject.icp);
    updateProject({
      ...selectedProject,
      status: 'Completed',
      phase2Score,
      phase2Data: { totalRedFlags: Number(totalRedFlags), redFlagsOver4Days: Number(redFlagsOver4Days) },
    });
    toast.success(`Project Closed! IFR Score: ${phase2Score}`);
    setSelectedProjectId(''); setTotalRedFlags(''); setRedFlagsOver4Days('');
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
              <MetricChip icon={<Layers size={16} color={T.blue} />}    label="Total Rooms"  value={selectedProject.totalRooms} color={T.blue} />
              <MetricChip icon={<BarChart2 size={16} color="#8b5cf6" />} label="ICP Score"    value={selectedProject.icp}        color="#8b5cf6" />
              <MetricChip icon={<User size={16} color={T.green} />}      label="Designer"     value={selectedProject.designerName} color={T.green} />
            </div>
          )}
        </Card>

        {/* ── Friction Metrics ────────────────────────────────────── */}
        {selectedProject && (
          <Card>
            <SectionTitle
              icon={<Flag size={15} color={T.red} />}
              title="Friction Metrics"
              subtitle="Red flags are delays or issues encountered during production."
            />

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Total Red Flags" half>
                <input
                  type="number" min="0" value={totalRedFlags}
                  onChange={e => setTotalRedFlags(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  style={inputStyle}
                />
              </Field>
              <Field label="Red Flags > 4 Days" half>
                <input
                  type="number" min="0" value={redFlagsOver4Days}
                  onChange={e => setRedFlagsOver4Days(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  style={inputStyle}
                />
              </Field>
            </div>

            {/* Formula explanation */}
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: T.radiusMd,
              background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ color: T.textMuted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  IFR Formula
                </div>
                <code style={{ color: T.textSecondary, fontSize: '0.78rem' }}>
                  100 – (RedFlags / ICP × 40) – (RedFlags&gt;4d × 5)
                </code>
              </div>
              {/* Live preview */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: T.textMuted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Preview IFR
                </div>
                <div style={{
                  fontSize: '1.6rem', fontWeight: 800, color: scoreColor,
                  textShadow: previewScore !== null ? `0 0 20px ${scoreColor}60` : 'none',
                  transition: 'color 0.3s',
                }}>
                  {previewScore !== null ? previewScore : '—'}
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
