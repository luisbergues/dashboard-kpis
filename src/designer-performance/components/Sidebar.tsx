import React from 'react';
import { LayoutDashboard, FileText, CheckSquare, FolderOpen, Activity } from 'lucide-react';
import { useLanguage } from '../../utils/LanguageContext';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const { t } = useLanguage();
  const navGroups = [
    {
      label: t('designerPerf.sidebar.overview'),
      items: [
        { id: 'dashboard', label: t('designerPerf.sidebar.leaderboard'), icon: LayoutDashboard },
        { id: 'projects',  label: t('designerPerf.sidebar.projects'),    icon: FolderOpen },
      ],
    },
    {
      label: t('designerPerf.sidebar.workflow'),
      items: [
        { id: 'phase1', label: t('designerPerf.sidebar.phase1'), icon: FileText },
        { id: 'phase2', label: t('designerPerf.sidebar.phase2'), icon: CheckSquare },
      ],
    },
  ];

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100% - 16px)',
        margin: '8px 0 8px 8px',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Activity size={18} color="#3b82f6" />
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>{t('designerPerf.sidebar.title')}</span>
        </div>
        <span style={{ color: '#475569', fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
              borderTop: groupIdx === 0 ? 'none' : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div
              style={{
                padding: '0 14px 6px',
                color: '#475569',
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
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                    background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                    color: isActive ? '#60a5fa' : '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
                    }
                  }}
                >
                  <Icon size={16} color={isActive ? '#3b82f6' : '#64748b'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', color: '#64748b', fontSize: '0.72rem', textAlign: 'center' }}>
        JL Closets · KPI v2.0
      </div>
    </div>
  );
};
