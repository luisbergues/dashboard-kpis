import React from 'react';
import { X, Calendar, CheckCircle2, User, Layers, CheckSquare, Zap, Target, History } from 'lucide-react';
import { useKpi } from '../context/KpiContext';
import type { Project } from '../types';
import { T } from '../utils/theme';
import { formatDisplayDate } from '../../utils/dateFormat';
import { useLanguage } from '../../utils/LanguageContext';
import { isOverdue, overdueBusinessDays, overduePenalty } from '../utils/phase1Outcome';

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
        {formatDisplayDate(new Date(date))}
      </span>
    )}
  </div>
);

export const ProjectDetailsModal: React.FC<ModalProps> = ({ project, onClose }) => {
  const { t } = useLanguage();
  // Antes del early return: los hooks no pueden quedar detras de un condicional.
  const { getProjectHistory } = useKpi();
  if (!project) return null;

  const history = getProjectHistory(project.id);

  // Calculate checklist progress
  const checklistItems = [
    { key: 'kcdFile', label: t('designerPerf.modal.kcdFile') },
    { key: 'jlContract', label: t('designerPerf.modal.jlContract') },
    { key: 'quoteComplete', label: t('designerPerf.modal.quoteComplete') },
    { key: 'quoteBreakdown', label: t('designerPerf.modal.quoteBreakdown') },
    { key: 'creditCardForm', label: t('designerPerf.modal.creditCardForm') },
    { key: 'drawingsSigned', label: t('designerPerf.modal.drawingsSigned') },
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
      case 'Deferred': return '#f97316';
      case 'Deficient':
      case 'Rejected': return T.red;
      default: return T.textSecondary;
    }
  };
  const statusColor = getStatusColor(project.status);
  const overdue = isOverdue(project.outcome);

  // Items del checklist sin tildar. Es lo que el disenador abre el link a ver.
  const missingDocs = [
    ...checklistItems.filter(i => project.checklist[i.key] === false).map(i => i.label),
    ...(project.checklist.finalMeasurementsApplies !== false
      && project.checklist.finalMeasurementsDelivered === false
        ? [t('designerPerf.modal.finalMeasurements')] : []),
  ];

  const STATUS_LABEL_KEYS: Record<string, string> = {
    All: 'statusAll', Pending: 'statusPending', 'To review': 'statusToReview',
    Approved: 'statusApproved', Rejected: 'statusRejected', Completed: 'statusCompleted',
    Deficient: 'statusDeficient', Deferred: 'statusDeferred',
  };
  const statusLabel = (s: string) => t(`designerPerf.projects.${STATUS_LABEL_KEYS[s] || 'statusAll'}`);

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
              <MetricPill label={statusLabel(project.status)} color={statusColor} bgColor={`${statusColor}15`} />
              <MetricPill icon={<Layers size={14} />} label={`${project.totalRooms} ${t('designerPerf.modal.rooms')}`} color={T.textSecondary} bgColor="rgba(255,255,255,0.05)" />
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
              {t('designerPerf.modal.registered')}: {formatDisplayDate(new Date(project.createdAt))}
              {project.approvedAt && (
                <>
                  <span style={{ margin: '0 4px' }}>•</span>
                  <span style={{ color: T.blue }}>{t('designerPerf.modal.approved')}: {formatDisplayDate(new Date(project.approvedAt))}</span>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: T.textSecondary, fontSize: '0.8rem', fontWeight: 600 }}>{t('designerPerf.modal.checklistProgress')}</span>
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

          {/* Resultado de la revision manual. Deficient y Deferred llevan
              siempre el motivo escrito y la fecha limite para subsanarlo. */}
          {!!project.outcome?.reason && (
            <div style={{
              marginBottom: 24, padding: '14px 16px', borderRadius: T.radiusMd,
              background: overdue ? 'rgba(239,68,68,0.07)' : 'rgba(234,179,8,0.06)',
              border: `1px solid ${overdue ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.2)'}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, flexWrap: 'wrap', marginBottom: 8,
              }}>
                <span style={{ color: statusColor, fontSize: '0.8rem', fontWeight: 700 }}>
                  {project.outcome.result === 'Deficient' ? 'Written notice'
                    : project.outcome.result === 'Deferred' ? 'Deferral reason'
                    // Un Complete con plazo estuvo devuelto antes de aprobarse;
                    // sin plazo es simplemente una nota de cierre.
                    : project.outcome.deadline ? 'Resolved — was returned before being marked Complete'
                    : 'Note for the designer'}
                </span>
                {!!project.outcome.deadline && (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 700,
                    color: overdue ? T.red : T.textMuted,
                  }}>
                    {overdue
                      ? `${overdueBusinessDays(project.outcome)} business days overdue · -${overduePenalty(project.outcome)} pts`
                      : `Deadline: ${formatDisplayDate(new Date(project.outcome.deadline))}`}
                  </span>
                )}
              </div>
              <p style={{ color: T.textSecondary, fontSize: '0.84rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
                {project.outcome.reason}
              </p>

              {/* Lo accionable, aparte de la prosa: que hay que mandar. */}
              {missingDocs.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBorder}` }}>
                  <div style={{
                    color: T.textMuted, fontSize: '0.68rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
                  }}>
                    Missing documents
                  </div>
                  {missingDocs.map(label => (
                    <div key={label} style={{ color: T.red, fontSize: '0.82rem', padding: '2px 0' }}>• {label}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Secuencia completa de la revision. Append-only: cada cambio agrega
              una entrada, ninguna se pisa, asi que "quien lo aprobo" y "cambio
              antes" tienen respuesta. */}
          {history.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <History size={16} color={T.blue} /> Review history
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    {/* linea de tiempo */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, alignSelf: 'stretch' }}>
                      <span style={{
                        width: 9, height: 9, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                        background: getStatusColor(h.status),
                      }} />
                      {i < history.length - 1 && (
                        <span style={{ width: 1, flex: 1, minHeight: 18, background: T.cardBorder }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: 14, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <span style={{ color: getStatusColor(h.status), fontSize: '0.83rem', fontWeight: 700 }}>
                          {h.result || statusLabel(h.status)}
                        </span>
                        <span style={{ color: T.textMuted, fontSize: '0.75rem' }}>
                          {formatDisplayDate(new Date(h.at))} · {h.by?.name || 'Unknown User'}
                        </span>
                      </div>
                      {!!h.deadline && (
                        <div style={{ color: T.textMuted, fontSize: '0.73rem', marginTop: 2 }}>
                          Deadline: {formatDisplayDate(new Date(h.deadline))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            
            {/* Left Column: Checklist & Complexity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div>
                <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckSquare size={16} color={T.blue} /> {t('designerPerf.modal.checklist')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {checklistItems.map(item => (
                    <ChecklistItem key={item.key} label={item.label} checked={project.checklist[item.key] !== false} date={project.checklist[item.key]} />
                  ))}
                  {project.checklist.finalMeasurementsApplies !== false && (
                    <ChecklistItem
                      label={t('designerPerf.modal.finalMeasurements')}
                      checked={project.checklist.finalMeasurementsDelivered !== false}
                      date={project.checklist.finalMeasurementsDelivered}
                    />
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Zap size={16} color={T.yellow} /> {t('designerPerf.modal.projectElements')}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {([
                    { key: 'colorsDefined', label: t('designerPerf.modal.colorsDefined') },
                    { key: 'thermofoilDoors', label: t('designerPerf.modal.thermofoil') },
                    { key: 'customBoreHoles', label: t('designerPerf.modal.customHoles') },
                    { key: 'routingRequired', label: t('designerPerf.modal.routingDovetail') },
                    { key: 'customPanels', label: t('designerPerf.modal.customPanels') },
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
                  <Target size={16} color={T.blue} /> {t('designerPerf.modal.performanceScores')}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Phase 1 Score */}
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: '16px' }}>
                    <div style={{ color: T.textSecondary, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('designerPerf.modal.phase1Ice')}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: project.phase1Score !== null ? T.textPrimary : T.textMuted }}>
                      {project.phase1Score ?? '—'}
                    </div>
                  </div>

                  {/* Phase 2 Score */}
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: '16px' }}>
                    <div style={{ color: T.textSecondary, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{t('designerPerf.modal.phase2Ifr')}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: project.phase2Score !== null ? T.textPrimary : T.textMuted }}>
                      {project.phase2Score ?? '—'}
                    </div>
                  </div>

                  {/* ICP */}
                  <div style={{ gridColumn: '1 / -1', background: 'rgba(59,130,246,0.05)', border: `1px solid rgba(59,130,246,0.2)`, borderRadius: 16, padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: T.blue, fontSize: '0.85rem', fontWeight: 600 }}>{t('designerPerf.modal.indexComplexity')}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: T.blue }}>{project.icp}</div>
                  </div>
                </div>
              </div>

              {project.phase2Data?.breakdown && project.phase2Data.breakdown.length > 0 && (
                <div>
                  <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('designerPerf.modal.redFlagsBreakdown')}</h3>
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
                    {project.phase2Data.breakdown.map(line => {
                      const dot = line.urgency === 'red' ? T.red : line.urgency === 'yellow' ? T.yellow : T.green;
                      return (
                        <div key={line.noteId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textSecondary, fontSize: '0.85rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot }} />
                            {line.days} {t('designerPerf.modal.redFlagDays')}
                          </span>
                          <span style={{ color: T.red, fontWeight: 600 }}>&minus;{line.penalty}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem', fontWeight: 600 }}>{t('designerPerf.modal.totalPenalty')}</span>
                      <span style={{ color: T.red, fontWeight: 700 }}>&minus;{project.phase2Data.totalPenalty}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Formato viejo — proyectos cerrados antes del cambio a notas designer */}
              {project.phase2Data && !project.phase2Data.breakdown && project.phase2Data.totalRedFlags !== undefined && (
                <div>
                  <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('designerPerf.modal.frictionMetrics')}</h3>
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem' }}>{t('designerPerf.modal.totalRedFlags')}</span>
                      <span style={{ color: T.red, fontWeight: 600 }}>{project.phase2Data.totalRedFlags}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem' }}>{t('designerPerf.modal.redFlags4Days')}</span>
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
            {t('designerPerf.modal.closeDetails')}
          </button>
        </div>

      </div>
    </div>
  );
};
