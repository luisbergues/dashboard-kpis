import React, { useState, useEffect } from 'react';
import { useKpi } from '../context/KpiContext';
import { calculatePhase1ScoreAndStatus, calculateTechnicalPoints } from '../utils/scoreCalculator';
import toast from 'react-hot-toast';
import type { Project, ProjectStatus } from '../types';
import { Link2, FileText, CheckSquare, Zap, RefreshCw, Send } from 'lucide-react';
import { T } from '../utils/theme';

/* ── tiny primitives ─────────────────────────────────────────────────── */
const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background: T.cardBg, border: `1px solid ${T.cardBorder}`,
    borderRadius: T.radiusLg, padding: '24px 28px',
    ...style,
  }}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; badge?: React.ReactNode }> = ({ icon, title, subtitle, badge }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
      {badge}
    </div>
    {subtitle && <p style={{ color: T.textMuted, fontSize: '0.78rem', marginTop: 6, paddingLeft: 40 }}>{subtitle}</p>}
    <div style={{ height: 1, background: T.cardBorder, marginTop: 12 }} />
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; half?: boolean }> = ({ label, children, half }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(half ? { flex: '1 1 45%', minWidth: 140 } : {}) }}>
    <label style={{ color: T.textSecondary, fontSize: '0.76rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  background: T.bgSurface,
  border: `1px solid ${T.cardBorder}`,
  borderRadius: T.radiusPill,
  color: T.textPrimary,
  padding: '10px 16px',
  fontSize: '0.88rem',
  outline: 'none',
  width: '100%',
  fontFamily: "'Inter',sans-serif",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none' as const,
};

/* ── types ───────────────────────────────────────────────────────────── */
type ChecklistState = {
  kcdFile: number | false;
  jlContract: number | false;
  quoteComplete: number | false;
  drawingsSigned: number | false;
  finalMeasurementsApplies: number | false;
  finalMeasurementsDelivered: number | false;
};

const emptyChecklist: ChecklistState = {
  kcdFile: false, jlContract: false, quoteComplete: false,
  drawingsSigned: false, finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
};

const emptyComplexity = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};

/* ── main component ──────────────────────────────────────────────────── */
export const Phase1Form: React.FC = () => {
  const { designerNames, projects, projectDesigners, addProject, updateProject, getProjectComplexity } = useKpi();

  const [mode, setMode] = useState<'New' | 'Update'>('New');
  const [soNumber, setSoNumber]       = useState('');
  const [projectName, setProjectName] = useState('');
  const [designerName, setDesignerName] = useState('');
  const [totalRooms, setTotalRooms]   = useState<number | ''>('');
  const [checklist, setChecklist]     = useState<ChecklistState>(emptyChecklist);
  const [complexity, setComplexity]   = useState(emptyComplexity);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  // Any project that has been evaluated (not Pending) can be updated to correct mistakes
  const updatableProjects = projects.filter(p => p.status !== 'Pending');
  // Active projects = Pending (not yet evaluated in Phase 1)
  const activeProjects = projects.filter(p => p.status === 'Pending');

  /* When selecting an active project in New mode, auto-fill name + designer */
  const handleNewProjectSelect = (selectedSo: string) => {
    setSoNumber(selectedSo);
    if (!selectedSo) { resetForm(); return; }
    const proj = projects.find(p => p.id === selectedSo);
    if (proj) {
      setProjectName(proj.projectName);
      // Pull the designer from My Projects/Pipeline (the source of truth), not
      // from whatever may already be stored on the Designer Perf. project record.
      const assignedDesigner = projectDesigners[selectedSo];
      if (assignedDesigner) setDesignerName(assignedDesigner);
      else if (proj.designerName && proj.designerName !== 'Unassigned') setDesignerName(proj.designerName);
      // Removed auto-fill for totalRooms per user request so it must be entered manually
      setTotalRooms('');
    }
    // auto-fill complexity from project elements
    const auto = getProjectComplexity(selectedSo);
    if (Object.keys(auto).length > 0) {
      const filled = new Set<string>();
      setComplexity(prev => {
        const updated = { ...prev };
        (Object.keys(auto) as Array<keyof typeof emptyComplexity>).forEach(k => {
          if (auto[k] !== undefined) { updated[k] = auto[k] as boolean; if (auto[k]) filled.add(k); }
        });
        return updated;
      });
      setAutoFilledFields(filled);
    }
  };

  /* auto-fill complexity from project elements when SO is typed (fallback for manual entry) */
  useEffect(() => {
    if (mode === 'New' && soNumber && soNumber.length > 3) {
      const auto = getProjectComplexity(soNumber);
      if (Object.keys(auto).length > 0) {
        const filled = new Set<string>();
        setComplexity(prev => {
          const updated = { ...prev };
          (Object.keys(auto) as Array<keyof typeof emptyComplexity>).forEach(k => {
            if (auto[k] !== undefined) { updated[k] = auto[k] as boolean; if (auto[k]) filled.add(k); }
          });
          return updated;
        });
        setAutoFilledFields(filled);
      }
    }
  }, [soNumber, mode]);

  useEffect(() => {
    if (mode === 'Update' && soNumber) {
      const existing = projects.find(p => p.id === soNumber);
      if (existing) {
        setProjectName(existing.projectName);
        setDesignerName(projectDesigners[soNumber] || existing.designerName);
        setTotalRooms(existing.totalRooms);
        setChecklist(existing.checklist);
        setComplexity(existing.complexity);
        const auto = getProjectComplexity(soNumber);
        const filled = new Set<string>();
        (Object.keys(auto) as Array<keyof typeof emptyComplexity>).forEach(k => { if (auto[k]) filled.add(k); });
        setAutoFilledFields(filled);
      }
    }
  }, [mode, soNumber, projects, projectDesigners]);

  useEffect(() => { if (mode === 'New') resetForm(); }, [mode]);

  const resetForm = () => {
    setSoNumber(''); setProjectName(''); setDesignerName('');
    setTotalRooms(''); setChecklist(emptyChecklist);
    setComplexity(emptyComplexity); setAutoFilledFields(new Set());
  };

  const handleChecklistToggle = (field: keyof ChecklistState) => {
    setChecklist(prev => ({ ...prev, [field]: prev[field] === false ? Date.now() : false }));
  };

  const handleComplexityChange = (field: keyof typeof complexity) => {
    setComplexity(prev => ({ ...prev, [field]: !prev[field] }));
    setAutoFilledFields(prev => { const n = new Set(prev); n.delete(field); return n; });
  };

  const handleSubmit = (e: React.FormEvent, forceReview = false) => {
    e.preventDefault();
    if (!soNumber || !projectName || !designerName || totalRooms === '') {
      toast.error('Please fill in all basic project details.'); return;
    }
    if (mode === 'New' && projects.some(p => p.id === soNumber && p.status !== 'Pending')) {
      toast.error('A project with this SO Number has already been processed.'); return;
    }
    let finalStatus: ProjectStatus, score: number | null;
    if (forceReview) { finalStatus = 'To review'; score = null; }
    else { const r = calculatePhase1ScoreAndStatus(checklist); finalStatus = r.status; score = r.score; }

    const icp = Number(totalRooms) + calculateTechnicalPoints(complexity);
    const now = Date.now();

    if (mode === 'New') {
      const existing = projects.find(p => p.id === soNumber);
      updateProject({ 
        ...(existing || {}),
        id: soNumber, 
        createdAt: existing?.createdAt || now, 
        approvedAt: finalStatus === 'Approved' ? now : null,
        projectName, designerName, status: finalStatus, totalRooms: Number(totalRooms), icp,
        phase1Score: score, phase2Score: existing?.phase2Score ?? null, checklist, complexity 
      });
      toast.success(finalStatus === 'Approved' ? 'Project Approved! ✓' : finalStatus === 'To review' ? 'Saved for review.' : 'Registered (missing docs).');
      resetForm();
    } else {
      const existing = projects.find(p => p.id === soNumber);
      if (!existing) return;
      updateProject({ ...existing, projectName, designerName, status: finalStatus,
        totalRooms: Number(totalRooms), icp, phase1Score: score, checklist, complexity,
        approvedAt: finalStatus === 'Approved' ? now : existing.approvedAt });
      toast.success(finalStatus === 'Approved' ? 'Updated & Approved! ✓' : 'Saved.');
      if (finalStatus === 'Approved') { resetForm(); setMode('New'); }
    }
  };

  const fmtDate = (ts: number | false) =>
    ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 700, margin: '0 auto', paddingBottom: 32 }}>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: '1.5rem', color: T.textPrimary, margin: 0 }}>
          Phase 1: Project Intake
        </h2>
        <p style={{ color: T.textMuted, fontSize: '0.85rem', marginTop: 4 }}>
          Register a new project or update documentation for a rejected one.
        </p>
      </div>

      {/* Mode toggle — pill style matching the main app tabs */}
      <div style={{
        display: 'inline-flex', background: T.bgDeep, border: `1px solid ${T.cardBorder}`,
        borderRadius: T.radiusPill, padding: 4, marginBottom: 22, gap: 4,
      }}>
        {(['New', 'Update'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 20px', borderRadius: T.radiusPill, border: 'none', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s',
            background: mode === m ? T.blue : 'transparent',
            color: mode === m ? '#fff' : T.textMuted,
          }}>
            {m === 'New' ? 'Register New' : 'Update Project'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Basic Info ──────────────────────────────────────────── */}
        <Card>
          <SectionTitle icon={<FileText size={15} color={T.blue} />} title="Basic Information" />

          {mode === 'Update' ? (
            <Field label="Select Project (SO Number)">
              <select name="soNumber" value={soNumber} onChange={e => setSoNumber(e.target.value)} style={selectStyle}>
                <option value="">Choose a project to update…</option>
                {updatableProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.id} — {p.projectName} ({p.status})</option>
                ))}
              </select>
            </Field>
          // NEW MODE: dropdown of active (Pending) projects
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="SO Number — Active Project">
                <select
                  name="soNumber"
                  value={soNumber}
                  onChange={e => handleNewProjectSelect(e.target.value)}
                  style={{ ...selectStyle, cursor: 'pointer', appearance: 'none' }}
                >
                  <option value="">Select an active project…</option>
                  {activeProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.id} — {p.projectName}{p.designerName && p.designerName !== 'Unassigned' ? ` (${p.designerName})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {activeProjects.length === 0 && (
                <div style={{
                  padding: '10px 16px', borderRadius: T.radiusMd,
                  background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
                  color: T.yellow, fontSize: '0.8rem',
                }}>
                  No pending active projects found. Projects appear here once loaded from the pipeline.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14 }}>
            <Field label="Project Name" half>
              <input name="projectName" value={projectName} onChange={e => setProjectName(e.target.value)}
                readOnly={mode === 'Update'} placeholder="e.g., Smith Residence"
                style={{ ...inputStyle, opacity: mode === 'Update' ? 0.5 : 1 }} />
            </Field>
            <Field label="Designer" half>
              <select name="designerName" value={designerName} onChange={e => setDesignerName(e.target.value)}
                style={selectStyle}>
                <option value="">Select a designer…</option>
                {designerNames.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            <Field label="Total Rooms" half>
              <input name="totalRooms" type="number" min="1" value={totalRooms}
                onChange={e => setTotalRooms(e.target.value === '' ? '' : Number(e.target.value))}
                style={inputStyle} />
            </Field>
          </div>
        </Card>

        {/* ── Checklist ───────────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon={<CheckSquare size={15} color={T.blue} />}
            title="Strict Go / No-Go Checklist"
            subtitle="Check each item when the documentation is received. Date is recorded automatically."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { id: 'kcdFile',                   label: 'KCD file (complete & latest)' },
              { id: 'jlContract',                label: 'JL Contract (complete & signed)' },
              { id: 'quoteComplete',             label: 'Quote (complete by room)' },
              { id: 'drawingsSigned',            label: 'Drawings (signed by client)' },
              { id: 'finalMeasurementsApplies',  label: 'Does "Final Measurements" apply here?' },
            ] as { id: keyof ChecklistState; label: string }[]).map(item => {
              const checked = checklist[item.id] !== false;
              return (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Real checkbox input, visually hidden: the <label> wrapper
                        already routes clicks to it, and it gives keyboard focus,
                        Enter/Space toggling, and screen-reader semantics that the
                        bare onClick div lacked. */}
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleChecklistToggle(item.id)}
                      style={{ position: 'absolute', opacity: 0, width: 20, height: 20, margin: 0, cursor: 'pointer' }}
                    />
                    {/* custom checkbox visual */}
                    <div aria-hidden="true" style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${checked ? T.blue : T.cardBorder}`,
                      background: checked ? T.blue : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ color: checked ? T.textPrimary : T.textSecondary, fontSize: '0.85rem', transition: 'color 0.2s' }}>
                      {item.label}
                    </span>
                  </div>
                  {checked && (
                    <span style={{
                      fontSize: '0.72rem', color: T.blue, background: 'rgba(59,130,246,0.1)',
                      border: '1px solid rgba(59,130,246,0.2)', borderRadius: T.radiusPill,
                      padding: '2px 10px', whiteSpace: 'nowrap',
                    }}>
                      ✓ {fmtDate(checklist[item.id])}
                    </span>
                  )}
                </label>
              );
            })}

            {/* sub-item for Final Measurements */}
            {checklist.finalMeasurementsApplies !== false && (
              <div style={{
                marginLeft: 30, padding: '12px 16px',
                background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
                borderRadius: T.radiusMd,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={checklist.finalMeasurementsDelivered !== false}
                      onChange={() => handleChecklistToggle('finalMeasurementsDelivered')}
                      style={{ position: 'absolute', opacity: 0, width: 20, height: 20, margin: 0, cursor: 'pointer' }}
                    />
                    <div aria-hidden="true" style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${checklist.finalMeasurementsDelivered !== false ? T.blue : T.cardBorder}`,
                      background: checklist.finalMeasurementsDelivered !== false ? T.blue : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      {checklist.finalMeasurementsDelivered !== false && (
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
                      )}
                    </div>
                    <span style={{ color: T.blue, fontSize: '0.85rem', fontWeight: 600 }}>
                      Final Measurements delivered?
                    </span>
                  </div>
                  {checklist.finalMeasurementsDelivered !== false && (
                    <span style={{
                      fontSize: '0.72rem', color: T.blue, background: 'rgba(59,130,246,0.1)',
                      border: '1px solid rgba(59,130,246,0.2)', borderRadius: T.radiusPill,
                      padding: '2px 10px', whiteSpace: 'nowrap',
                    }}>
                      ✓ {fmtDate(checklist.finalMeasurementsDelivered)}
                    </span>
                  )}
                </label>
              </div>
            )}
          </div>
        </Card>

        {/* ── Complexity ──────────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon={<Zap size={15} color={T.blue} />}
            title="Technical Complexity"
            subtitle="Pre-filled from Project Elements — editable if needed. Affects the ICP score."
            badge={autoFilledFields.size > 0 ? (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: '0.72rem', color: T.green,
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: T.radiusPill, padding: '3px 10px',
              }}>
                <Link2 size={11} color={T.green} />
                {autoFilledFields.size} synced
              </span>
            ) : undefined}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { id: 'colorsDefined',   label: 'Colors per room defined?',       pts: '+2', synced: false },
              { id: 'thermofoilDoors', label: 'Thermofoil / Element doors?',    pts: '+1', synced: true },
              { id: 'customBoreHoles', label: 'Custom bore holes / No Holes?',  pts: '+4', synced: true },
              { id: 'routingRequired', label: 'Routing / Dovetail required?',   pts: '+2', synced: true },
              { id: 'customPanels',    label: 'Custom panels / Elements?',      pts: '+1', synced: true },
            ] as { id: keyof typeof complexity; label: string; pts: string; synced: boolean }[]).map(item => {
              const checked = complexity[item.id];
              const isAutoSynced = item.synced && autoFilledFields.has(item.id);
              return (
                <label key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '10px 12px', borderRadius: T.radiusMd,
                  background: checked ? 'rgba(59,130,246,0.07)' : T.bgSurface,
                  border: `1px solid ${checked ? 'rgba(59,130,246,0.2)' : T.cardBorder}`,
                  transition: 'all 0.2s',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleComplexityChange(item.id)}
                    style={{ position: 'absolute', opacity: 0, width: 18, height: 18, margin: 0, cursor: 'pointer' }}
                  />
                  <div aria-hidden="true" style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${checked ? T.blue : T.textMuted}`,
                    background: checked ? T.blue : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    {checked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: '0.8rem', color: checked ? T.textPrimary : T.textSecondary }}>
                        {item.label}
                      </span>
                      {isAutoSynced && <Link2 size={10} color={T.green} />}
                    </div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700,
                      color: checked ? T.blue : T.textMuted,
                      background: checked ? 'rgba(59,130,246,0.12)' : 'transparent',
                      borderRadius: 4, padding: checked ? '1px 5px' : 0,
                    }}>
                      {item.pts}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={e => handleSubmit(e, true)}
            style={{
              flex: 1, padding: '13px 20px', borderRadius: T.radiusPill,
              border: `1px solid ${T.cardBorder}`, background: T.bgSurface,
              color: T.textSecondary, fontSize: '0.88rem', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.cardHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.bgSurface; }}
          >
            <RefreshCw size={15} />
            Save for Later Review
          </button>
          <button
            onClick={e => handleSubmit(e, false)}
            style={{
              flex: 1, padding: '13px 20px', borderRadius: T.radiusPill,
              border: 'none', background: T.blue,
              color: '#fff', fontSize: '0.88rem', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.blueDeep; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.blue; }}
          >
            <Send size={15} />
            {mode === 'New' ? 'Submit Project Intake' : 'Save & Validate'}
          </button>
        </div>
      </div>
    </div>
  );
};
