import React, { useState, useMemo } from 'react';
import { useKpi } from '../context/KpiContext';
import { ProjectDetailsModal } from '../components/ProjectDetailsModal';
import type { Project, ProjectStatus } from '../types';
import { Search, User, Hash, LayoutList, Star } from 'lucide-react';

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  Pending:    { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)', dot: '#64748b' },
  'To review':{ bg: 'rgba(234,179,8,0.10)',   color: '#facc15', border: 'rgba(234,179,8,0.25)',   dot: '#eab308' },
  Approved:   { bg: 'rgba(59,130,246,0.10)',  color: '#60a5fa', border: 'rgba(59,130,246,0.25)',  dot: '#3b82f6' },
  Rejected:   { bg: 'rgba(239,68,68,0.10)',   color: '#f87171', border: 'rgba(239,68,68,0.25)',   dot: '#ef4444' },
  Completed:  { bg: 'rgba(16,185,129,0.10)',  color: '#34d399', border: 'rgba(16,185,129,0.25)',  dot: '#10b981' },
};

const ScorePill: React.FC<{ score: number | null; label: string }> = ({ score, label }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
      {label}
    </div>
    <div style={{
      fontWeight: 700, fontSize: '0.9rem',
      color: score === null ? '#334155' : score >= 80 ? '#34d399' : score >= 60 ? '#facc15' : '#f87171',
    }}>
      {score === null ? '—' : score}
    </div>
  </div>
);

const FILTER_OPTIONS: Array<ProjectStatus | 'All'> = ['All', 'Pending', 'To review', 'Approved', 'Rejected', 'Completed'];

export const ProjectsView: React.FC = () => {
  const { projects } = useKpi();

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

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", height: '100%', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Projects Directory</h2>
          <p style={{ color: '#475569', margin: '4px 0 0', fontSize: '0.85rem' }}>
            {filtered.length} of {projects.length} projects
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 220 }}>
          <Search size={14} color="#475569" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search SO, name, designer…"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              paddingLeft: 32,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 10,
              color: '#e2e8f0',
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
                  : '1px solid rgba(255,255,255,0.07)',
                background: isActive
                  ? (st?.bg || 'rgba(59,130,246,0.12)')
                  : 'rgba(255,255,255,0.03)',
                color: isActive ? (st?.color || '#60a5fa') : '#475569',
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
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? st.dot : '#334155', display: 'inline-block' }} />
              )}
              {status}
              <span style={{ opacity: 0.6, fontSize: '0.72rem' }}>({counts[status] || 0})</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 160px 80px 90px 90px 110px',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {[
            { icon: Hash, label: 'SO #' },
            { icon: LayoutList, label: 'Project Name' },
            { icon: User, label: 'Designer' },
            { icon: null, label: 'Rooms' },
            { icon: Star, label: 'Phase 1' },
            { icon: Star, label: 'Phase 2' },
            { icon: null, label: 'Status' },
          ].map(({ label }) => (
            <div key={label} style={{ color: '#334155', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {label}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: '0.85rem' }}>
              No projects match the current filter.
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
                    gridTemplateColumns: '90px 1fr 160px 80px 90px 90px 110px',
                    padding: '11px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    alignItems: 'center',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                >
                  {/* SO */}
                  <div style={{
                    fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700,
                    color: '#3b82f6', background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
                    padding: '2px 7px', display: 'inline-block', width: 'fit-content',
                  }}>
                    #{project.id}
                  </div>

                  {/* Name */}
                  <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                    {project.projectName}
                  </div>

                  {/* Designer */}
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.designerName}
                  </div>

                  {/* Rooms */}
                  <div style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center' }}>
                    {project.totalRooms}
                  </div>

                  {/* P1 Score */}
                  <ScorePill score={project.phase1Score} label="" />

                  {/* P2 Score */}
                  <ScorePill score={project.phase2Score} label="" />

                  {/* Status */}
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20,
                      background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                      fontSize: '0.73rem', fontWeight: 600,
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                      {project.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ProjectDetailsModal project={selectedProject} onClose={() => setSelectedProject(null)} />
    </div>
  );
};
