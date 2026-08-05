import React from 'react';
import { LayoutDashboard, FileText, CheckSquare, FolderOpen, Activity } from 'lucide-react';
import { useLanguage } from '../../utils/LanguageContext';
import { useKpi } from '../context/KpiContext';
import { T } from '../utils/theme';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const { t } = useLanguage();
  const { canEditIntake } = useKpi();

  const navGroups = [
    {
      label: t('designerPerf.sidebar.overview'),
      items: [
        { id: 'dashboard', label: t('designerPerf.sidebar.leaderboard'), icon: LayoutDashboard },
        { id: 'projects',  label: t('designerPerf.sidebar.projects'),    icon: FolderOpen },
      ],
    },
    // Fase 1 y 2 escriben en designer_performance_projects, que para un
    // designer es solo-lectura por regla de RTDB. Ocultar el grupo entero en
    // vez de dejar que el formulario falle recien al guardar.
    ...(canEditIntake ? [{
      label: t('designerPerf.sidebar.workflow'),
      items: [
        { id: 'phase1', label: t('designerPerf.sidebar.phase1'), icon: FileText },
        { id: 'phase2', label: t('designerPerf.sidebar.phase2'), icon: CheckSquare },
      ],
    }] : []),
  ];

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        // Solid dark surface + real border + large radius, matching the main
        // app sidebar (Navbar.css .navbar) instead of this panel's previous
        // one-off translucent/blurred look.
        background: T.bgDeep,
        border: `1px solid ${T.cardBorder}`,
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100% - 16px)',
        margin: '8px 0 8px 8px',
        borderRadius: T.radiusLg,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Activity size={18} color={T.blue} />
          <span style={{ color: T.textPrimary, fontWeight: 700, fontSize: '0.95rem' }}>{t('designerPerf.sidebar.title')}</span>
        </div>
        <span style={{ color: T.textMuted, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {t('designerPerf.sidebar.subtitle')}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {navGroups.map((group, groupIdx) => (
          <div
            key={group.label}
            style={{
              paddingTop: groupIdx === 0 ? 0 : 12,
              marginTop: groupIdx === 0 ? 0 : 12,
              borderTop: groupIdx === 0 ? 'none' : `1px solid ${T.cardBorder}`,
            }}
          >
            <div
              style={{
                padding: '0 14px 6px',
                color: T.textMuted,
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 20px',
                    // Fully rounded pill + solid active fill + glow, matching
                    // Navbar.css .nav-btn / .nav-btn.active exactly (that
                    // sidebar's active state is a solid color with a glow
                    // shadow, not a tinted/bordered rectangle).
                    borderRadius: T.radiusPill,
                    border: 'none',
                    background: isActive ? T.neonGreen : 'transparent',
                    boxShadow: isActive ? '0 4px 15px rgba(0, 122, 255, 0.4)' : 'none',
                    color: isActive ? '#FFFFFF' : T.textMuted,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--overlay-05)';
                      (e.currentTarget as HTMLButtonElement).style.color = T.textPrimary;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = T.textMuted;
                    }
                  }}
                >
                  <Icon size={16} color="currentColor" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.cardBorder}`, color: T.textMuted, fontSize: '0.72rem', textAlign: 'center' }}>
        JL Closets · KPI v2.0
      </div>
    </div>
  );
};
