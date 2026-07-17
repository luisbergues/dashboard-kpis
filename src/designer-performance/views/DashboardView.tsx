import React from 'react';
import { useKpi } from '../context/KpiContext';
import { Badge } from '../components/Badge';
import { Users, FolderOpen, CheckCircle } from 'lucide-react';
import { useTheme } from '../../utils/ThemeContext';

export const DashboardView: React.FC = () => {
  const { designers, projects } = useKpi();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Colors were hardcoded for a dark background, which left titles and designer
  // names nearly invisible in light theme. Resolve them per theme instead.
  const C = {
    title:     isLight ? '#0f172a' : '#f1f5f9',
    name:      isLight ? '#1e293b' : '#e2e8f0',
    value:     isLight ? '#0f172a' : '#f1f5f9',
    body:      isLight ? '#475569' : '#94a3b8',
    label:     isLight ? '#475569' : '#64748b',
    subtle:    isLight ? '#64748b' : '#475569',
    faint:     isLight ? '#94a3b8' : '#334155',
    cardBg:    isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)',
    cardBorder:isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)',
    panelBg:   isLight ? 'rgba(0,0,0,0.015)' : 'rgba(255,255,255,0.03)',
    panelBorder: isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)',
    headBg:    isLight ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.15)',
    rowBorder: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)',
    rowHover:  isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
  };

  const totalProjects   = projects.length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const activeDesigners   = designers.filter(d => d.totalProjects > 0).length;

  const statCards = [
    { label: 'Total Projects',    value: totalProjects,    icon: FolderOpen,   color: '#3b82f6' },
    { label: 'Completed',         value: completedProjects, icon: CheckCircle, color: '#10b981' },
    { label: 'Active Designers',  value: activeDesigners,  icon: Users,        color: '#8b5cf6' },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", maxWidth: 880, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ color: C.title, fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Leaderboard</h2>
        <p style={{ color: C.label, margin: '6px 0 0', fontSize: '0.9rem' }}>Designer performance overview and KPIs.</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: C.cardBg,
            border: `1px solid ${C.cardBorder}`,
            borderRadius: 14,
            padding: '20px 22px',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: `${color}20`,
              border: `1px solid ${color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ color: C.label, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ color: C.value, fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div style={{
        background: C.panelBg,
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 16,
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          padding: '14px 24px',
          borderBottom: `1px solid ${C.panelBorder}`,
          background: C.headBg,
        }}>
          <span style={{ color: C.body, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Designer Rankings
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Rank', 'Designer', 'Projects', 'Avg P1 (ICE)', 'Avg P2 (IFR)', 'Global KPI', 'Performance'].map(col => (
                  <th key={col} style={{
                    padding: '10px 20px',
                    textAlign: 'left',
                    color: C.label,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderBottom: `1px solid ${C.rowBorder}`,
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {designers
                .sort((a, b) => b.globalKpi - a.globalKpi)
                .map((designer, idx) => (
                  <tr
                    key={designer.name}
                    style={{ borderBottom: `1px solid ${C.rowBorder}`, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', color: C.subtle, fontSize: '0.8rem', fontWeight: 600 }}>
                      {idx + 1 <= 3 ? ['🥇','🥈','🥉'][idx] : `#${idx + 1}`}
                    </td>
                    <td style={{ padding: '12px 20px', color: C.name, fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                      {designer.name}
                    </td>
                    <td style={{ padding: '12px 20px', color: C.body, fontSize: '0.85rem' }}>{designer.totalProjects}</td>
                    <td style={{ padding: '12px 20px', color: C.body, fontSize: '0.85rem' }}>{designer.avgPhase1Score || '—'}</td>
                    <td style={{ padding: '12px 20px', color: C.body, fontSize: '0.85rem' }}>{designer.avgPhase2Score || '—'}</td>
                    <td style={{ padding: '12px 20px', color: C.value, fontSize: '0.95rem', fontWeight: 700 }}>
                      {designer.globalKpi || '—'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      {designer.totalProjects > 0 ? (
                        <Badge score={designer.globalKpi} />
                      ) : (
                        <span style={{ color: C.faint, fontSize: '0.78rem', fontStyle: 'italic' }}>No data yet</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
