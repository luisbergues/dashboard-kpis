import React, { useState, useEffect } from 'react';
import { db, ref, set, onValue, get, child } from '../utils/firebase';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../utils/LanguageContext';
import { 
  Briefcase, Calendar, CheckCircle2, Circle, Clock, 
  AlertCircle, Download, ToggleLeft, ToggleRight, X, Info
} from 'lucide-react';
import './MyProjectsView.css';

const STAGES = [
  { id: 'ingenieria', label: 'Ingeniería' },
  { id: 'check1', label: 'Check' },
  { id: 'paperwork', label: 'Paperwork' },
  { id: 'check2', label: 'Check' },
  { id: 'nesting', label: 'Nesting' },
  { id: 'install', label: 'Install' }
];

const getStageLabel = (stageId, language) => {
  if (language === 'es') {
    switch (stageId) {
      case 'ingenieria': return 'Ingeniería';
      case 'check1': return 'Check';
      case 'paperwork': return 'Paperwork';
      case 'check2': return 'Check';
      case 'nesting': return 'Nesting';
      case 'install': return 'Install';
      default: return stageId;
    }
  } else {
    switch (stageId) {
      case 'ingenieria': return 'Engineering';
      case 'check1': return 'Check';
      case 'paperwork': return 'Paperwork';
      case 'check2': return 'Check';
      case 'nesting': return 'Nesting';
      case 'install': return 'Install';
      default: return stageId;
    }
  }
};


export default function MyProjectsView({ data, currentUser, userProfile }) {
  const { t, language } = useLanguage();
  if (!data) return null;

  const { priorityAnalysis, onHoldNotes } = data;
  const [projectStages, setProjectStages] = useState({});
  const [projectOverrides, setProjectOverrides] = useState({});
  const [projectHistory, setProjectHistory] = useState({});
  const [loading, setLoading] = useState(true);

  // Hold Modal State
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [activeProjectSo, setActiveProjectSo] = useState(null);
  const [holdReason, setHoldReason] = useState('');

  const getOnHoldNote = (projectName) => {
    if (!onHoldNotes) return null;
    const note = onHoldNotes.find(n => projectName.includes(n.project) || n.project.includes(projectName));
    return note ? note.notes : null;
  };

  // Filter projects where eng matches the logged in designer
  const myProjects = priorityAnalysis.filter(p => {
    return userProfile && p.eng && p.eng.trim().toLowerCase() === userProfile.designerName.trim().toLowerCase();
  });

  // Listen to stage progress, overrides, and history in Realtime Database
  useEffect(() => {
    if (!db || !currentUser) {
      // Local storage fallback initialization
      const localStages = {};
      const localOverrides = {};
      const localHistory = {};
      
      myProjects.forEach(p => {
        try {
          const savedStages = localStorage.getItem(`project_stages_${p.so}`);
          localStages[p.so] = savedStages ? JSON.parse(savedStages) : Array(STAGES.length).fill(false);
          
          const savedOverride = localStorage.getItem(`project_override_${p.so}`);
          localOverrides[p.so] = savedOverride ? JSON.parse(savedOverride) : null;
          
          const savedHistory = localStorage.getItem(`project_history_${p.so}`);
          localHistory[p.so] = savedHistory ? JSON.parse(savedHistory) : [];
        } catch (e) {
          localStages[p.so] = Array(STAGES.length).fill(false);
          localOverrides[p.so] = null;
          localHistory[p.so] = [];
        }
      });
      setProjectStages(localStages);
      setProjectOverrides(localOverrides);
      setProjectHistory(localHistory);
      setLoading(false);
      return;
    }

    // Load Stages
    const stagesRef = ref(db, 'project_stages');
    const unsubscribeStages = onValue(stagesRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      const updatedStages = {};
      myProjects.forEach(p => {
        updatedStages[p.so] = dbData[p.so] || Array(STAGES.length).fill(false);
      });
      setProjectStages(updatedStages);
    });

    // Load Overrides
    const overridesRef = ref(db, 'project_overrides');
    const unsubscribeOverrides = onValue(overridesRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setProjectOverrides(dbData);
    });

    // Load History
    const historyRef = ref(db, 'project_history');
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setProjectHistory(dbData);
      setLoading(false);
    });

    return () => {
      unsubscribeStages();
      unsubscribeOverrides();
      unsubscribeHistory();
    };
  }, [currentUser, userProfile]);

  const toggleStage = async (so, stageIndex) => {
    const currentProgress = projectStages[so] ? [...projectStages[so]] : Array(STAGES.length).fill(false);
    const wasCompleted = !!(currentProgress[stageIndex] && currentProgress[stageIndex].completed);
    
    const timestamp = new Date().toISOString();
    currentProgress[stageIndex] = {
      completed: !wasCompleted,
      timestamp: !wasCompleted ? timestamp : null
    };

    // Prepare history event
    const historyEvent = {
      type: 'stage_changed',
      stage: STAGES[stageIndex].label,
      completed: !wasCompleted,
      timestamp: timestamp
    };

    const updatedStages = {
      ...projectStages,
      [so]: currentProgress
    };
    setProjectStages(updatedStages);

    if (db && currentUser) {
      try {
        await set(ref(db, `project_stages/${so}`), currentProgress);
        
        // Push event to history array
        const currentHistory = projectHistory[so] ? [...projectHistory[so]] : [];
        currentHistory.push(historyEvent);
        await set(ref(db, `project_history/${so}`), currentHistory);
      } catch (err) {
        console.error('Failed to save stage progress to Firebase:', err);
      }
    } else {
      // Local storage fallback
      try {
        localStorage.setItem(`project_stages_${so}`, JSON.stringify(currentProgress));
        
        const currentHistory = projectHistory[so] ? [...projectHistory[so]] : [];
        currentHistory.push(historyEvent);
        localStorage.setItem(`project_history_${so}`, JSON.stringify(currentHistory));
        setProjectHistory({ ...projectHistory, [so]: currentHistory });
      } catch (err) {
        console.error('Failed to save stage progress to localStorage:', err);
      }
    }
  };

  const handleHoldToggle = (so, currentStatus) => {
    if (currentStatus === 'ON HOLD') {
      // Release Hold
      releaseHold(so);
    } else {
      // Open modal to enter reason
      setActiveProjectSo(so);
      setHoldReason('');
      setIsHoldModalOpen(true);
    }
  };

  const submitHold = async (e) => {
    e.preventDefault();
    if (!holdReason.trim() || !activeProjectSo) return;

    const timestamp = new Date().toISOString();
    const overrideData = {
      status: 'ON HOLD',
      onHoldReason: holdReason
    };

    const historyEvent = {
      type: 'status_change',
      status: 'ON HOLD',
      reason: holdReason,
      timestamp: timestamp
    };

    if (db && currentUser) {
      try {
        await set(ref(db, `project_overrides/${activeProjectSo}`), overrideData);
        
        const currentHistory = projectHistory[activeProjectSo] ? [...projectHistory[activeProjectSo]] : [];
        currentHistory.push(historyEvent);
        await set(ref(db, `project_history/${activeProjectSo}`), currentHistory);
      } catch (err) {
        console.error('Failed to save hold status to Firebase:', err);
      }
    } else {
      // Local storage fallback
      try {
        localStorage.setItem(`project_override_${activeProjectSo}`, JSON.stringify(overrideData));
        setProjectOverrides({ ...projectOverrides, [activeProjectSo]: overrideData });
        
        const currentHistory = projectHistory[activeProjectSo] ? [...projectHistory[activeProjectSo]] : [];
        currentHistory.push(historyEvent);
        localStorage.setItem(`project_history_${activeProjectSo}`, JSON.stringify(currentHistory));
        setProjectHistory({ ...projectHistory, [activeProjectSo]: currentHistory });
      } catch (err) {
        console.error('Failed to save hold status to localStorage:', err);
      }
    }

    setIsHoldModalOpen(false);
    setActiveProjectSo(null);
    setHoldReason('');
  };

  const releaseHold = async (so) => {
    const timestamp = new Date().toISOString();
    const historyEvent = {
      type: 'status_change',
      status: 'ACTIVE',
      timestamp: timestamp
    };

    if (db && currentUser) {
      try {
        // Delete override to return to normal sheet status
        await set(ref(db, `project_overrides/${so}`), null);
        
        const currentHistory = projectHistory[so] ? [...projectHistory[so]] : [];
        currentHistory.push(historyEvent);
        await set(ref(db, `project_history/${so}`), currentHistory);
      } catch (err) {
        console.error('Failed to release hold on Firebase:', err);
      }
    } else {
      // Local storage fallback
      try {
        localStorage.removeItem(`project_override_${so}`);
        const updatedOverrides = { ...projectOverrides };
        delete updatedOverrides[so];
        setProjectOverrides(updatedOverrides);
        
        const currentHistory = projectHistory[so] ? [...projectHistory[so]] : [];
        currentHistory.push(historyEvent);
        localStorage.setItem(`project_history_${so}`, JSON.stringify(currentHistory));
        setProjectHistory({ ...projectHistory, [so]: currentHistory });
      } catch (err) {
        console.error('Failed to release hold on localStorage:', err);
      }
    }
  };

  const generatePDF = (project) => {
    const doc = new jsPDF();
    const history = projectHistory[project.so] || [];
    const stages = projectStages[project.so] || Array(STAGES.length).fill(false);

    const getStatusLabelPdf = (status) => {
      if (!status) return '';
      const s = status.toUpperCase();
      if (s.includes('HOLD')) return language === 'es' ? 'EN PAUSA (HOLD)' : 'ON HOLD';
      if (s.includes('CHECK')) return 'Check';
      if (s.includes('REVIEW')) return language === 'es' ? 'Revisión' : 'Review';
      if (s.includes('ENG')) return language === 'es' ? 'Ingeniería' : 'Engineering';
      if (s.includes('NEST')) return 'Nesting';
      return status;
    };

    // Header styling
    doc.setFillColor(18, 33, 48); // Deep blue matching var(--bg-surface)
    doc.rect(0, 0, 210, 45, 'F');

    doc.setTextColor(70, 223, 177); // Mint color
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('JL Engineering Dashboard', 15, 20);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${t('myProjects.pdfTitle')} - SO #${project.so}`, 15, 30);
    doc.setFontSize(10);
    doc.setTextColor(170, 170, 170);
    doc.text(`${t('myProjects.pdfGenerated')}: ${new Date().toLocaleDateString()} ${t('myProjects.pdfAt')} ${new Date().toLocaleTimeString()}`, 15, 38);

    // Project metadata block
    doc.setFillColor(245, 247, 250);
    doc.rect(15, 53, 180, 28, 'F');
    doc.setDrawColor(218, 224, 233);
    doc.rect(15, 53, 180, 28);

    doc.setTextColor(18, 33, 48);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(t('myProjects.pdfProject'), 20, 60);
    doc.setFont('Helvetica', 'normal');
    doc.text(project.name, 45, 60);

    doc.setFont('Helvetica', 'bold');
    doc.text(t('myProjects.pdfEngineer'), 20, 67);
    doc.setFont('Helvetica', 'normal');
    doc.text(project.eng || (language === 'es' ? 'No asignado' : 'Unassigned'), 45, 67);

    doc.setFont('Helvetica', 'bold');
    doc.text(t('myProjects.pdfInstall'), 20, 74);
    doc.setFont('Helvetica', 'normal');
    doc.text(project.install || (language === 'es' ? 'No asignada' : 'Unassigned'), 45, 74);

    doc.setFont('Helvetica', 'bold');
    const currentStatus = projectOverrides[project.so]?.status || project.status;
    doc.text(t('myProjects.pdfStatus'), 110, 67);
    doc.setFont('Helvetica', 'normal');
    doc.text(getStatusLabelPdf(currentStatus), 140, 67);

    // --- Section 1: Progress of Stages ---
    doc.setTextColor(18, 33, 48);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(t('myProjects.pdfSecProgress'), 15, 95);

    // Line separator
    doc.setDrawColor(9, 209, 199); // Cyan
    doc.setLineWidth(0.8);
    doc.line(15, 98, 195, 98);

    let currentY = 108;
    STAGES.forEach((stage, idx) => {
      const stageData = stages[idx];
      const isCompleted = stageData && stageData.completed;
      const dateText = isCompleted && stageData.timestamp 
        ? new Date(stageData.timestamp).toLocaleString()
        : t('myProjects.pdfPending');

      // Draw bullets
      doc.setFillColor(isCompleted ? 70 : 200, isCompleted ? 223 : 200, isCompleted ? 177 : 200);
      doc.circle(20, currentY - 1.5, 3, 'F');

      // Draw stage label
      doc.setFont('Helvetica', isCompleted ? 'bold' : 'normal');
      doc.setTextColor(isCompleted ? 18 : 120, isCompleted ? 33 : 120, isCompleted ? 48 : 120);
      doc.setFontSize(11);
      doc.text(getStageLabel(stage.id, language), 30, currentY);

      // Draw timestamp
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.text(dateText, 110, currentY);

      currentY += 10;
    });

    // --- Section 2: Historial de Pausas (Holds Log) ---
    currentY += 10;
    doc.setTextColor(18, 33, 48);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(t('myProjects.pdfSecHolds'), 15, currentY);

    // Line separator
    currentY += 3;
    doc.setDrawColor(255, 46, 147); // Pink/Red
    doc.line(15, currentY, 195, currentY);
    currentY += 10;

    // Extract hold periods from history logs
    const holdPeriods = [];
    let activeHold = null;

    history.forEach(event => {
      if (event.type === 'status_change') {
        if (event.status === 'ON HOLD') {
          activeHold = {
            start: event.timestamp,
            reason: event.reason,
            end: null
          };
        } else if (activeHold && event.status === 'ACTIVE') {
          activeHold.end = event.timestamp;
          holdPeriods.push(activeHold);
          activeHold = null;
        }
      }
    });

    if (activeHold) {
      // If still currently on hold
      holdPeriods.push(activeHold);
    }

    if (holdPeriods.length === 0) {
      doc.setFont('Helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(10);
      doc.text(t('myProjects.pdfNoHolds'), 15, currentY);
    } else {
      holdPeriods.forEach((hold, index) => {
        const startStr = new Date(hold.start).toLocaleDateString();
        const startTime = new Date(hold.start).toLocaleTimeString();
        const endStr = hold.end ? new Date(hold.end).toLocaleDateString() : t('myProjects.pdfHoldActive');
        const endTime = hold.end ? new Date(hold.end).toLocaleTimeString() : '';
        
        let durationText = '';
        if (hold.end) {
          const diffTime = Math.abs(new Date(hold.end) - new Date(hold.start));
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          durationText = `(${t('myProjects.pdfHoldDuration')} ${diffDays} ${diffDays !== 1 ? t('myProjects.pdfHoldDays') : t('myProjects.pdfHoldDay')})`;
        } else {
          durationText = t('myProjects.pdfHoldInCourse');
        }

        // Draw a light red panel for each hold period
        doc.setFillColor(255, 240, 245);
        doc.rect(15, currentY - 5, 180, 22, 'F');
        doc.setDrawColor(255, 192, 203);
        doc.rect(15, currentY - 5, 180, 22);

        doc.setTextColor(255, 46, 147);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${t('myProjects.pdfHoldTitle')} #${index + 1} ${durationText}`, 20, currentY + 1);

        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(10);
        doc.text(`${t('myProjects.pdfHoldFrom')} ${startStr} ${startTime}   ${t('myProjects.pdfHoldTo')} ${endStr} ${endTime}`, 20, currentY + 7);
        
        const wrappedReason = doc.splitTextToSize(`${t('myProjects.pdfHoldReason')} ${hold.reason || (language === 'es' ? 'No especificado' : 'Unspecified')}`, 170);
        doc.text(wrappedReason, 20, currentY + 13);

        currentY += 28;

        // Add page break if needed
        if (currentY > 260 && index < holdPeriods.length - 1) {
          doc.addPage();
          currentY = 20;
        }
      });
    }

    doc.save(`Timeline_SO_${project.so}_${project.name.split(':')[0].trim()}.pdf`);
  };

  const calculateProgress = (stagesArray) => {
    if (!stagesArray) return 0;
    const completed = stagesArray.filter(s => s && s.completed).length;
    return Math.round((completed / STAGES.length) * 100);
  };

  return (
    <div className="my-projects-view animate-fade-in">
      <header className="view-header">
        <div className="view-header-title">
          <h1 className="page-title">{t('myProjects.title')}</h1>
          <p className="text-muted">
            {t('myProjects.subtitle')}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="loading-state">{t('myProjects.loading')}</div>
      ) : myProjects.length === 0 ? (
        <div className="empty-projects glass-card">
          <Briefcase size={48} className="text-muted" />
          <h3>{t('myProjects.emptyTitle')}</h3>
          <p className="text-muted">
            {t('myProjects.emptySubtitle')} ({userProfile?.designerName}).
          </p>
        </div>
      ) : (
        <div className="projects-grid">
          {myProjects.map((project) => {
            const progress = projectStages[project.so] || Array(STAGES.length).fill(false);
            const percent = calculateProgress(progress);
            const overridden = projectOverrides[project.so];
            const currentStatus = overridden ? overridden.status : project.status;
            const currentReason = overridden ? overridden.onHoldReason : getOnHoldNote(project.name);

            return (
              <div key={project.so} className="project-card glass-card">
                <div className="card-header-main">
                  <div>
                    <span className="project-so">SO #{project.so}</span>
                    <h3 className="project-name-title">{project.name}</h3>
                  </div>
                  <div className="header-status-controls">
                    <span className={`status-badge-inline ${currentStatus.toLowerCase().replace(' ', '-')}`}>
                      {getStatusLabelPdf(currentStatus)}
                    </span>
                    <button 
                      onClick={() => handleHoldToggle(project.so, currentStatus)}
                      className={`btn-hold-toggle ${currentStatus === 'ON HOLD' ? 'active-hold' : ''}`}
                      title={currentStatus === 'ON HOLD' ? t('myProjects.releaseHold') : t('myProjects.pauseProject')}
                    >
                      {currentStatus === 'ON HOLD' ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      <span>On Hold</span>
                    </button>
                  </div>
                </div>

                {currentStatus === 'ON HOLD' && currentReason && (
                  <div className="hold-reason-banner animate-fade-in">
                    <Info size={16} />
                    <p><strong>{t('myProjects.holdReasonLabel')}</strong> {currentReason}</p>
                  </div>
                )}

                <div className="project-dates">
                  <div className="date-item">
                    <Calendar size={14} className="text-muted" />
                    <span>{t('common.installDate')}: {project.install || (language === 'es' ? 'Sin fecha' : 'No date')}</span>
                  </div>
                </div>

                <div className="progress-section">
                  <div className="progress-meta">
                    <span className="progress-label">{t('myProjects.stagesProgress')}</span>
                    <span className="progress-percent">{percent}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>

                <div className="stages-timeline">
                  {STAGES.map((stage, idx) => {
                    const stageData = progress[idx];
                    const isCompleted = stageData && stageData.completed;
                    return (
                      <div 
                        key={stage.id} 
                        className={`stage-step ${isCompleted ? 'completed' : ''}`}
                        onClick={() => toggleStage(project.so, idx)}
                        title={language === 'es' ? `Clic para marcar como ${isCompleted ? 'pendiente' : 'completada'}` : `Click to mark as ${isCompleted ? 'pending' : 'completed'}`}
                      >
                        <div className="stage-connector-line"></div>
                        <div className="stage-icon-container">
                          {isCompleted ? (
                            <CheckCircle2 size={20} className="icon-completed" />
                          ) : (
                            <Circle size={20} className="icon-pending" />
                          )}
                        </div>
                        <span className="stage-step-label">{getStageLabel(stage.id, language)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="card-footer-actions">
                  <button 
                    onClick={() => generatePDF(project)}
                    className="btn-secondary btn-sm btn-download-pdf"
                  >
                    <Download size={14} />
                    <span>{t('myProjects.downloadPdf')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hold Reason Modal */}
      {isHoldModalOpen && (
        <div className="modal-overlay" onClick={() => setIsHoldModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('myProjects.modalHoldTitle')}</h3>
              <button className="modal-close-btn" onClick={() => setIsHoldModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitHold} className="modal-form">
              <div className="form-group">
                <label className="form-label">{t('myProjects.modalHoldReasonLabel')}</label>
                <textarea 
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder={t('myProjects.modalHoldPlaceholder')}
                  className="form-textarea"
                  rows={4}
                  required
                />
              </div>

              <div className="form-actions">
                <div className="form-actions-right">
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => setIsHoldModalOpen(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn-primary">
                    {t('myProjects.modalHoldSubmit')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

