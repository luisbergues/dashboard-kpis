import React from 'react';
import { useKpi } from '../context/KpiContext';
import { Badge } from '../components/Badge';
import { Users, FolderOpen, CheckCircle } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { designers, projects } = useKpi();

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
        <h2 style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Leaderboard</h2>
        <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: '0.9rem' }}>Designer performance overview and KPIs.</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
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
              <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ color: '#f1f5f9', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                    color: '#475569',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
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
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 20px', color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>
                      {idx + 1 <= 3 ? ['🥇','🥈','🥉'][idx] : `#${idx + 1}`}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                      {designer.name}
                    </td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>{designer.totalProjects}</td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>{designer.avgPhase1Score || '—'}</td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>{designer.avgPhase2Score || '—'}</td>
                    <td style={{ padding: '12px 20px', color: '#f1f5f9', fontSize: '0.95rem', fontWeight: 700 }}>
                      {designer.globalKpi || '—'}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      {designer.totalProjects > 0 ? (
                        <Badge score={designer.globalKpi} />
                      ) : (
                        <span style={{ color: '#334155', fontSize: '0.78rem', fontStyle: 'italic' }}>No data yet</span>
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
