import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Calendar, StickyNote, Flag, Clock, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { db, ref, onValue, set } from '../utils/firebase';
import { saveEngineeringCheck } from '../utils/engineeringCheck';
import './PipelineView.css';

export default function PipelineView({ data, currentUser, userProfile }) {
  const { t, language } = useLanguage();
  if (!data) return null;

  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectNotes, setProjectNotes] = useState({});
  const [engineeringChecks, setEngineeringChecks] = useState({});

  // Listen for project notes and engineering checks from Firebase in real-time
  useEffect(() => {
    if (!db) return;
    const notesRef = ref(db, 'project_notes');
    const unsubscribeNotes = onValue(notesRef, (snapshot) => {
      setProjectNotes(snapshot.val() || {});
    });

    const engChecksRef = ref(db, 'engineering_checks');
    const unsubscribeEngChecks = onValue(engChecksRef, (snapshot) => {
      setEngineeringChecks(snapshot.val() || {});
    });

    return () => {
      unsubscribeNotes();
      unsubscribeEngChecks();
    };
  }, []);

  const handleEngineeringStart = async (so) => {
    const currentCheck = engineeringChecks[so] || {};
    const userName = userProfile?.designerName || currentUser?.email || 'Unknown User';
    const updatedCheck = { 
      ...currentCheck, 
      started: new Date().toISOString(),
      user: userName
    };
    setEngineeringChecks(prev => ({ ...prev, [so]: updatedCheck }));
    await saveEngineeringCheck(so, updatedCheck);
  };

  const handleEngineeringFinish = async (so) => {
    const currentCheck = engineeringChecks[so] || {};
    const userName = userProfile?.designerName || currentUser?.email || 'Unknown User';
    const updatedCheck = { 
      ...currentCheck, 
      finished: new Date().toISOString(),
      user: userName
    };
    setEngineeringChecks(prev => ({ ...prev, [so]: updatedCheck }));
    await saveEngineeringCheck(so, updatedCheck);
  };

  const { priorityAnalysis, onHoldNotes } = data;

  // Combine data or just use priorityAnalysis as the main source
  const projects = priorityAnalysis.filter(p => {
    const matchesFilter = filter === 'ALL' || p.status.toUpperCase() === filter.toUpperCase();
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.so.includes(searchTerm) ||
                          p.eng.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusColor = (status) => {
    const s = status.toUpperCase();
    if (s.includes('HOLD')) return 'status-hold';
    if (s.includes('CHECK')) return 'status-check';
    if (s.includes('REVIEW')) return 'status-review';
    if (s.includes('ENG')) return 'status-eng';
    return 'status-default';
  };

  const getStatusLabel = (status) => {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s.includes('HOLD')) return language === 'es' ? 'EN PAUSA' : 'ON HOLD';
    if (s.includes('CHECK')) return 'Check';
    if (s.includes('REVIEW')) return language === 'es' ? 'Revisión' : 'Review';
    if (s.includes('ENG')) return language === 'es' ? 'Ingeniería' : 'Engineering';
    if (s.includes('NEST')) return 'Nesting';
    return status;
  };

  const getFilterLabel = (filterVal) => {
    if (language === 'es') {
      switch (filterVal) {
        case 'ALL': return 'TODOS';
        case 'ON HOLD': return 'EN PAUSA';
        case 'CHECK': return 'CHECK';
        case 'REVIEW': return 'REVISIÓN';
        case 'ENGINEERING': return 'INGENIERÍA';
        default: return filterVal;
      }
    }
    return filterVal;
  };

  const getOnHoldNote = (projectName) => {
    // try to match part of the name
    const note = onHoldNotes.find(n => projectName.includes(n.project) || n.project.includes(projectName));
    return note ? note.notes : null;
  };

  return (
    <div className="pipeline-view animate-fade-in">
      <header className="view-header">
        <h1 className="page-title">{t('pipeline.title')}</h1>
        <div className="controls">
          <div className="search-bar glass-card">
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder={t('pipeline.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-chips">
            {['ALL', 'ON HOLD', 'CHECK', 'REVIEW', 'ENGINEERING'].map(f => (
              <button 
                key={f} 
                className={`chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {getFilterLabel(f)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="project-list">
        {projects.length === 0 ? (
          <div className="no-results text-muted">{t('pipeline.noProjects')}</div>
        ) : (
          projects.map((project, idx) => {
            const onHoldNote = project.status.toUpperCase() === 'ON HOLD' 
              ? (project.onHoldReason || getOnHoldNote(project.name)) 
              : null;
            
            return (
              <div key={idx} className="project-card glass-card">
                <div className="project-main">
                  <div className="project-id">#{project.so}</div>
                  <h3 className="project-name">{project.name}</h3>
                  <div className="project-meta">
                    <span className="meta-item">
                      <Calendar size={14} />
                      {project.install}
                    </span>
                    <span className="meta-item eng-badge">
                      ENG: {project.eng}
                    </span>
                  </div>
                </div>
                
                <div className="project-side">
                  <span className={`status-badge ${getStatusColor(project.status)}`}>
                    {getStatusLabel(project.status)}
                  </span>
                </div>

                {onHoldNote && (
                  <div className="on-hold-alert">
                    <AlertCircle size={16} />
                    <p>{onHoldNote}</p>
                  </div>
                )}

                {/* Engineering Check Controls */}
                <div className="pipeline-eng-check-controls">
                  <div className="pipeline-eng-check-header">
                    <span className="pipeline-eng-check-title">{t('myProjects.engineeringCheck', 'Engineering Time')}</span>
                  </div>
                  <div className="pipeline-eng-check-buttons">
                    <button 
                      onClick={() => handleEngineeringStart(project.so)}
                      className={`btn-sm ${engineeringChecks[project.so]?.started ? 'btn-secondary active-check' : 'btn-primary'}`}
                    >
                      <Clock size={14} />
                      {engineeringChecks[project.so]?.started ? new Date(engineeringChecks[project.so].started).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Start'}
                    </button>
                    <button 
                      onClick={() => handleEngineeringFinish(project.so)}
                      className={`btn-sm ${engineeringChecks[project.so]?.finished ? 'btn-secondary active-check' : 'btn-secondary'}`}
                      disabled={!engineeringChecks[project.so]?.started}
                    >
                      <CheckCircle2 size={14} />
                      {engineeringChecks[project.so]?.finished ? new Date(engineeringChecks[project.so].finished).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Finish'}
                    </button>
                    {engineeringChecks[project.so]?.user && (
                      <span className="eng-check-user">
                        ({engineeringChecks[project.so].user})
                      </span>
                    )}
                  </div>
                </div>

                {/* Project Notes (from My Projects) */}
                {(projectNotes[project.so] || []).length > 0 && (
                  <div className="pipeline-notes-section">
                    <div className="pipeline-notes-header">
                      <StickyNote size={13} />
                      <span>{language === 'es' ? 'Notas' : 'Notes'} ({(projectNotes[project.so] || []).length})</span>
                    </div>
                    <div className="pipeline-notes-list">
                      {(projectNotes[project.so] || []).map(note => (
                        <div key={note.id} className={`pipeline-note-item ${note.priority ? 'priority' : 'normal'}`}>
                          <div className="pipeline-note-top">
                            <span className={`pipeline-note-tag ${note.priority ? 'priority' : 'normal'}`}>
                              {note.priority
                                ? (language === 'es' ? '⚑ Prioritaria' : '⚑ Priority')
                                : (language === 'es' ? 'Normal' : 'Normal')}
                            </span>
                            <span className="pipeline-note-date">
                              {new Date(note.createdAt).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
                                day: 'numeric', month: 'short'
                              })}
                            </span>
                          </div>
                          <p className="pipeline-note-text">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

