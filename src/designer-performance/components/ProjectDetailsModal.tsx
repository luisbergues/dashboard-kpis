import React from 'react';
import { X, Calendar, CheckCircle2, User, Layers, CheckSquare, Zap, Target } from 'lucide-react';
import type { Project } from '../types';
import { T } from '../utils/theme';

interface ModalProps {
  project: Project | null;
  onClose: () => void;
}

const MetricPill: React.FC<{ icon?: React.ReactNode; label: string; color: string; bgColor: string }> = ({ icon, label, color, bgColor }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    background: bgColor, border: `1px solid ${color}30`,
    color: color, padding: '6px 12px', borderRadius: T.radiusPill,
    fontSize: '0.8rem', fontWeight: 600,
  }}>
    {icon}
    {label}
  </div>
);

const ChecklistItem: React.FC<{ checked: boolean; label: string; date?: number | false }> = ({ checked, label, date }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
    borderRadius: 12,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        background: checked ? T.green : 'transparent',
        border: `2px solid ${checked ? T.green : T.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <CheckCircle2 size={12} color="#fff" />}
      </div>
      <span style={{ color: checked ? T.textPrimary : T.textSecondary, fontSize: '0.85rem' }}>
        {label}
      </span>
    </div>
    {checked && date && (
      <span style={{ fontSize: '0.75rem', color: T.textMuted }}>
        {new Date(date).toLocaleDateString()}
      </span>
    )}
  </div>
);

export const ProjectDetailsModal: React.FC<ModalProps> = ({ project, onClose }) => {
  if (!project) return null;

  // Calculate checklist progress
  const checklistItems = [
    { key: 'kcdFile', label: 'KCD File' },
    { key: 'jlContract', label: 'JL Contract' },
    { key: 'quoteComplete', label: 'Quote Complete' },
    { key: 'drawingsSigned', label: 'Drawings Signed' },
  ] as const;
  
  let checkedCount = checklistItems.filter(i => project.checklist[i.key] !== false).length;
  let totalItems = checklistItems.length;
  if (project.checklist.finalMeasurementsApplies !== false) {
    totalItems++;
    if (project.checklist.finalMeasurementsDelivered !== false) checkedCount++;
  }
  const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return T.green;
      case 'Approved': return T.blue;
      case 'To review': return T.yellow;
      case 'Rejected': return T.red;
      default: return T.textSecondary;
    }
  };
  const statusColor = getStatusColor(project.status);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: T.cardBg, border: `1px solid ${T.cardBorder}`,
        borderRadius: T.radiusLg, width: '100%', maxWidth: 800,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 50px rgba(0,0,0,0.5)', overflow: 'hidden'
      }}>
        
        {/* Header content with scrollable area below */}
        <div style={{ padding: '28px 32px 20px', borderBottom: `1px solid ${T.cardBorder}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Top pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              background: 'rgba(9, 209, 199, 0.1)', color: '#09D1C7',
              padding: '4px 14px', borderRadius: T.radiusPill, fontSize: '0.85rem', fontWeight: 600,
            }}>
              SO #{project.id}
            </div>
            
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <MetricPill label={project.status} color={statusColor} bgColor={`${statusColor}15`} />
              <MetricPill icon={<Layers size={14} />} label={`${project.totalRooms} Rooms`} color={T.textSecondary} bgColor="rgba(255,255,255,0.05)" />
              <MetricPill icon={<User size={14} />} label={project.designerName} color={T.textSecondary} bgColor="rgba(255,255,255,0.05)" />
              <button onClick={onClose} style={{
                background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer',
                display: 'flex', alignItems: 'center', padding: '4px', marginLeft: 8
              }}>
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Title & Date */}
          <div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.8rem', fontWeight: 700, color: T.textPrimary, margin: '0 0 8px 0', lineHeight: 1.2 }}>
              {project.projectName}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.textMuted, fontSize: '0.85rem' }}>
              <Calendar size={14} />
              Registered: {new Date(project.createdAt).toLocaleDateString()}
              {project.approvedAt && (
                <>
                  <span style={{ margin: '0 4px' }}>•</span>
                  <span style={{ color: T.blue }}>Approved: {new Date(project.approvedAt).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: T.textSecondary, fontSize: '0.8rem', fontWeight: 600 }}>Checklist Progress</span>
              <span style={{ color: T.green, fontSize: '0.8rem', fontWeight: 700 }}>{progressPercent}%</span>
            </div>
            <div style={{ height: 6, background: T.bgSurface, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPercent}%`,
                background: `linear-gradient(90deg, ${T.blue}, ${T.green})`,
                borderRadius: 10, transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            
            {/* Left Column: Checklist & Complexity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div>
                <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckSquare size={16} color={T.blue} /> Checklist
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {checklistItems.map(item => (
                    <ChecklistItem key={item.key} label={item.label} checked={project.checklist[item.key] !== false} date={project.checklist[item.key]} />
                  ))}
                  {project.checklist.finalMeasurementsApplies !== false && (
                    <ChecklistItem 
                      label="Final Measurements Delivered" 
                      checked={project.checklist.finalMeasurementsDelivered !== false} 
                      date={project.checklist.finalMeasurementsDelivered} 
                    />
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Zap size={16} color={T.yellow} /> Project Elements
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {([
                    { key: 'colorsDefined', label: 'Colors Defined' },
                    { key: 'thermofoilDoors', label: 'Thermofoil' },
                    { key: 'customBoreHoles', label: 'Custom Holes' },
                    { key: 'routingRequired', label: 'Routing / Dovetail' },
                    { key: 'customPanels', label: 'Custom Panels' },
                  ] as const).map(item => {
                    const active = project.complexity[item.key];
                    return (
                      <div key={item.key} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: T.radiusPill,
                        background: active ? 'rgba(16,185,129,0.1)' : T.bgSurface,
                        border: `1px solid ${active ? 'rgba(16,185,129,0.3)' : T.cardBorder}`,
                        color: active ? T.green : T.textSecondary, fontSize: '0.8rem',
                      }}>
                        {active && <CheckCircle2 size={12} />}
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Right Column: Scores & Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div>
                <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Target size={16} color={T.blue} /> Performance Scores
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Phase 1 Score */}
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: '16px' }}>
                    <div style={{ color: T.textSecondary, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Phase 1 (ICE)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: project.phase1Score !== null ? T.textPrimary : T.textMuted }}>
                      {project.phase1Score ?? '—'}
                    </div>
                  </div>
                  
                  {/* Phase 2 Score */}
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: '16px' }}>
                    <div style={{ color: T.textSecondary, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Phase 2 (IFR)</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: project.phase2Score !== null ? T.textPrimary : T.textMuted }}>
                      {project.phase2Score ?? '—'}
                    </div>
                  </div>
                  
                  {/* ICP */}
                  <div style={{ gridColumn: '1 / -1', background: 'rgba(59,130,246,0.05)', border: `1px solid rgba(59,130,246,0.2)`, borderRadius: 16, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: T.blue, fontSize: '0.85rem', fontWeight: 600 }}>Index of Complexity (ICP)</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: T.blue }}>{project.icp}</div>
                  </div>
                </div>
              </div>

              {project.phase2Data && (
                <div>
                  <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Friction Metrics</h3>
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem' }}>Total Red Flags</span>
                      <span style={{ color: T.red, fontWeight: 600 }}>{project.phase2Data.totalRedFlags}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem' }}>Red Flags &gt; 4 Days</span>
                      <span style={{ color: T.red, fontWeight: 600 }}>{project.phase2Data.redFlagsOver4Days}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', borderTop: `1px solid ${T.cardBorder}`, background: T.cardBg, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.1)`,
            color: T.textPrimary, padding: '8px 20px', borderRadius: T.radiusPill,
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};
