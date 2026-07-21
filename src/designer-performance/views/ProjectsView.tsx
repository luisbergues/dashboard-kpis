import React, { useState, useMemo } from 'react';
import { useKpi } from '../context/KpiContext';
import { ProjectDetailsModal } from '../components/ProjectDetailsModal';
import type { Project, ProjectStatus } from '../types';
import { Search, User, Hash, LayoutList, Star } from 'lucide-react';
import { useTheme } from '../../utils/ThemeContext';
import { useLanguage } from '../../utils/LanguageContext';

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  Pending:    { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)', dot: '#64748b' },
  'To review':{ bg: 'rgba(234,179,8,0.10)',   color: '#facc15', border: 'rgba(234,179,8,0.25)',   dot: '#eab308' },
  Approved:   { bg: 'rgba(59,130,246,0.10)',  color: '#60a5fa', border: 'rgba(59,130,246,0.25)',  dot: '#3b82f6' },
  Rejected:   { bg: 'rgba(239,68,68,0.10)',   color: '#f87171', border: 'rgba(239,68,68,0.25)',   dot: '#ef4444' },
  Completed:  { bg: 'rgba(16,185,129,0.10)',  color: '#34d399', border: 'rgba(16,185,129,0.25)',  dot: '#10b981' },
};

const ScorePill: React.FC<{ score: number | null; label: string; isLight: boolean }> = ({ score, label, isLight }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ color: isLight ? '#64748b' : '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
      {label}
    </div>
    <div style={{
      fontWeight: 700, fontSize: '0.9rem',
      color: score === null ? (isLight ? '#94a3b8' : '#334155') : score >= 80 ? '#059669' : score >= 60 ? '#b45309' : '#dc2626',
    }}>
      {score === null ? '—' : score}
    </div>
  </div>
);

const FILTER_OPTIONS: Array<ProjectStatus | 'All'> = ['All', 'Pending', 'To review', 'Approved', 'Rejected', 'Completed'];

export const ProjectsView: React.FC = () => {
  const { projects } = useKpi();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isLight = theme === 'light';

  // Local palette: this view was written with dark-only literals (near-white
  // text, white-tinted rgba surfaces) that vanish on the light theme's white
  // background. Resolve the ones that sit directly on the page/card
  // background per theme; status-tinted pills (STATUS_STYLES) are left as-is
  // since their bg/color pairs are self-contained and already legible.
  const C = {
    title: isLight ? '#0f172a' : '#f1f5f9',
    subtitle: isLight ? '#64748b' : '#475569',
    name: isLight ? '#1e293b' : '#e2e8f0',
    body: isLight ? '#475569' : '#94a3b8',
    muted: isLight ? '#94a3b8' : '#64748b',
    faint: isLight ? '#94a3b8' : '#334155',
    inactiveTab: isLight ? '#64748b' : '#475569',
    surface: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.025)',
    surfaceBorder: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',
    headBg: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.2)',
    rowBorder: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)',
    rowAlt: isLight ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.01)',
    rowHover: isLight ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.06)',
    inputBg: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
    inputBorder: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.09)',
    tabBorder: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)',
    tabBg: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)',
  };

  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const matchStatus = filterStatus === 'All' || p.status === filterStatus;
      const term = searchTerm.toLowerCase();
      const matchSearch = !term ||
        String(p.id).includes(term) ||
        p.projectName.toLowerCase().includes(term) ||
        p.designerName.toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });
  }, [projects, filterStatus, searchTerm]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: projects.length };
    FILTER_OPTIONS.slice(1).forEach(s => { c[s] = projects.filter(p => p.status === s).length; });
    return c;
  }, [projects]);

  const STATUS_LABEL_KEYS: Record<string, string> = {
    All: 'statusAll', Pending: 'statusPending', 'To review': 'statusToReview',
    Approved: 'statusApproved', Rejected: 'statusRejected', Completed: 'statusCompleted',
  };
  const statusLabel = (s: string) => t(`designerPerf.projects.${STATUS_LABEL_KEYS[s] || 'statusAll'}`);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: C.title, fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('designerPerf.projects.title')}</h2>
          <p style={{ color: C.subtitle, margin: '4px 0 0', fontSize: '0.85rem' }}>
            {filtered.length} {t('designerPerf.projects.of')} {projects.length} {t('designerPerf.projects.projectsWord')} · {t('designerPerf.projects.statusNote')}
          </p>
        </div>

        {/* Search — marginRight leaves room for the fixed notification bell
            widget (top:24px/right:24px, ~56px wide) so the input never sits
            underneath it on narrower viewports. */}
        <div style={{ position: 'relative', minWidth: 220, marginRight: 90 }}>
          <Search size={14} color={C.subtitle} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('designerPerf.projects.searchPlaceholder')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              paddingLeft: 32,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              background: C.inputBg,
              border: `1px solid ${C.inputBorder}`,
              borderRadius: 10,
              color: C.name,
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTER_OPTIONS.map(status => {
          const isActive = filterStatus === status;
          const st = status !== 'All' ? STATUS_STYLES[status] : null;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: isActive
                  ? `1px solid ${st?.border || 'rgba(59,130,246,0.4)'}`
                  : `1px solid ${C.tabBorder}`,
                background: isActive
                  ? (st?.bg || 'rgba(59,130,246,0.12)')
                  : C.tabBg,
                color: isActive ? (st?.color || '#60a5fa') : C.inactiveTab,
                fontSize: '0.78rem',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {status !== 'All' && st && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? st.dot : C.faint, display: 'inline-block' }} />
              )}
              {statusLabel(status)}
              <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>({counts[status] || 0})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        background: C.surface,
        border: `1px solid ${C.surfaceBorder}`,
        borderRadius: 14,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Horizontal scroll wrapper: the grid below has a real minimum
            width (SO + Name + Designer + Rooms + scores + Status all need
            room to breathe), so on narrow viewports this scrolls instead of
            squashing every column down to unreadable slivers. */}
        <div className="h-scroll-shadow" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ minWidth: 720, display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px minmax(180px, 1fr) 160px 80px 90px 90px 130px',
              padding: '10px 16px',
              borderBottom: `1px solid ${C.rowBorder}`,
              background: C.headBg,
            }}>
              {[
                { icon: Hash, label: t('designerPerf.projects.so') },
                { icon: LayoutList, label: t('designerPerf.projects.name') },
                { icon: User, label: t('designerPerf.projects.designer') },
                { icon: null, label: t('designerPerf.projects.rooms') },
                { icon: Star, label: t('designerPerf.projects.phase1') },
                { icon: Star, label: t('designerPerf.projects.phase2') },
                { icon: null, label: t('designerPerf.projects.designReview') },
              ].map(({ label }) => (
                <div key={label} style={{ color: C.faint, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', paddingRight: 8 }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: C.faint, fontSize: '0.85rem' }}>
                  {t('designerPerf.projects.empty')}
                </div>
              ) : (
                filtered.map((project, idx) => {
                  const st = STATUS_STYLES[project.status] || STATUS_STYLES['Pending'];
                  return (
                    <div
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px minmax(180px, 1fr) 160px 80px 90px 90px 130px',
                        padding: '11px 16px',
                        borderBottom: `1px solid ${C.rowBorder}`,
                        cursor: 'pointer',
                        alignItems: 'center',
                        background: idx % 2 === 0 ? 'transparent' : C.rowAlt,
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : C.rowAlt)}
                    >
                      {/* SO */}
                      <div style={{
                        fontFamily: "'Outfit', sans-serif", fontSize: '0.85rem', fontWeight: 600,
                        color: '#09D1C7', background: 'rgba(9, 209, 199, 0.1)',
                        borderRadius: 100,
                        padding: '4px 10px', display: 'inline-block', width: 'fit-content',
                      }}>
                        #{project.id}
                      </div>

                      {/* Name */}
                      <div title={project.projectName} style={{ color: C.name, fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                        {project.projectName}
                      </div>

                      {/* Designer */}
                      <div title={project.designerName} style={{
                        color: project.designerName === 'Unassigned' ? C.faint : C.body,
                        fontStyle: project.designerName === 'Unassigned' ? 'italic' : 'normal',
                        fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8,
                      }}>
                        {project.designerName === 'Unassigned' ? t('designerPerf.projects.unassigned') : project.designerName}
                      </div>

                      {/* Rooms */}
                      <div style={{ color: C.muted, fontSize: '0.82rem', textAlign: 'center' }}>
                        {project.totalRooms}
                      </div>

                      {/* P1 Score */}
                      <ScorePill score={project.phase1Score} label="" isLight={isLight} />

                      {/* P2 Score */}
                      <ScorePill score={project.phase2Score} label="" isLight={isLight} />

                      {/* Design Review status — a Phase 1 document-checklist
                          outcome (contract/KCD/measurements signed off), NOT
                          the manufacturing/engineering pipeline stage. Title
                          attribute + label above avoid it being confused
                          with Pipeline's ON HOLD/CHECK/etc. */}
                      <div title={t('designerPerf.projects.statusTooltip')}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 20,
                          background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                          fontSize: '0.73rem', fontWeight: 600,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                          {statusLabel(project.status)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <ProjectDetailsModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};
