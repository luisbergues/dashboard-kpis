import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Calendar, StickyNote, Flag, Clock, CheckCircle2, Users, Plus, Circle } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { db, ref, onValue, set } from '../utils/firebase';
import { saveEngineeringCheck } from '../utils/engineeringCheck';
import './PipelineView.css';

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
      case 'check1': return 'Check 1';
      case 'paperwork': return 'Paperwork';
      case 'check2': return 'Check 2';
      case 'nesting': return 'Nesting';
      case 'install': return 'Install';
      default: return stageId;
    }
  }
};


export default function PipelineView({ data, currentUser, userProfile }) {
  const { t, language } = useLanguage();
  if (!data) return null;

  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectNotes, setProjectNotes] = useState({});
  const [engineeringChecks, setEngineeringChecks] = useState({});
  const [projectCollaborators, setProjectCollaborators] = useState({});
  const [projectStages, setProjectStages] = useState({});
  const [newNoteTexts, setNewNoteTexts] = useState({});
  const [nestingChecks, setNestingChecks] = useState({});
  const [commentPriorities, setCommentPriorities] = useState({});

  // Listen for project notes, engineering checks, collaborators, stages, and nesting checks from Firebase in real-time
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

    const collabsRef = ref(db, 'project_collaborators');
    const unsubscribeCollabs = onValue(collabsRef, (snapshot) => {
      setProjectCollaborators(snapshot.val() || {});
    });

    const stagesRef = ref(db, 'project_stages');
    const unsubscribeStages = onValue(stagesRef, (snapshot) => {
      setProjectStages(snapshot.val() || {});
    });

    const nestingRef = ref(db, 'nesting_checks');
    const unsubscribeNesting = onValue(nestingRef, (snapshot) => {
      setNestingChecks(snapshot.val() || {});
    });

    return () => {
      unsubscribeNotes();
      unsubscribeEngChecks();
      unsubscribeCollabs();
      unsubscribeStages();
      unsubscribeNesting();
    };
  }, []);

  const handleAddNote = async (so, engName, isPriority = false) => {
    const text = newNoteTexts[so];
    if (!text || !text.trim()) return;

    const userName = userProfile?.designerName || currentUser?.displayName || currentUser?.email || 'Unknown User';

    const newNote = {
      id: Date.now().toString(),
      text: text.trim(),
      priority: isPriority,
      createdAt: new Date().toISOString(),
      createdBy: userName
    };

    const currentNotes = projectNotes[so] ? [...projectNotes[so]] : [];
    currentNotes.unshift(newNote);

    if (db) {
      try {
        await set(ref(db, `project_notes/${so}`), currentNotes);
        setNewNoteTexts(prev => ({ ...prev, [so]: '' }));
        setCommentPriorities(prev => ({ ...prev, [so]: false }));
      } catch (err) {
        console.error('Failed to save note to Firebase:', err);
      }
    }
  };

  const handleNestingStart = async (so) => {
    const currentCheck = nestingChecks[so] || {};
    const userName = userProfile?.designerName || currentUser?.email || 'Unknown User';
    const updatedCheck = { 
      ...currentCheck, 
      started: new Date().toISOString(),
      user: userName
    };
    setNestingChecks(prev => ({ ...prev, [so]: updatedCheck }));
    if (db) {
      await set(ref(db, `nesting_checks/${so}`), updatedCheck);
    }
  };

  const handleNestingFinish = async (so) => {
    const currentCheck = nestingChecks[so] || {};
    const userName = userProfile?.designerName || currentUser?.email || 'Unknown User';
    const updatedCheck = { 
      ...currentCheck, 
      finished: new Date().toISOString(),
      user: userName
    };
    setNestingChecks(prev => ({ ...prev, [so]: updatedCheck }));
    if (db) {
      await set(ref(db, `nesting_checks/${so}`), updatedCheck);
    }
  };

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
            
            const progress = projectStages[project.so] || Array(STAGES.length).fill(false);
            const percent = Math.round((progress.filter(s => s && s.completed).length / STAGES.length) * 100);

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
                    {projectCollaborators[project.so] && projectCollaborators[project.so].length > 0 && (
                      <span className="meta-item collabs-badge" style={{ backgroundColor: 'rgba(9, 209, 199, 0.08)', border: '1px solid rgba(9, 209, 199, 0.15)', color: '#09D1C7', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={14} />
                        {language === 'es' ? 'Colab: ' : 'Collabs: '}
                        {projectCollaborators[project.so].join(', ')}
                      </span>
                    )}
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

                {/* Check, Nesting & Comment Isolated Sections */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch', flexWrap: 'wrap', width: '100%', marginTop: '12px' }}>
                  {/* Card 1: Engineering Check Controls */}
                  <div className="pipeline-eng-check-controls" style={{ flex: '1 0 auto', margin: 0 }}>
                    <div className="pipeline-eng-check-header">
                      <span className="pipeline-eng-check-title">{t('myProjects.engineeringCheck', 'Engineering Time')}</span>
                    </div>
                    <div className="pipeline-eng-check-buttons" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        <span className="eng-check-user" style={{ fontSize: '0.7rem' }}>
                          ({engineeringChecks[project.so].user})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Nesting Controls */}
                  <div className="pipeline-eng-check-controls" style={{ flex: '1 0 auto', margin: 0, borderColor: 'rgba(138, 43, 226, 0.15)' }}>
                    <div className="pipeline-eng-check-header">
                      <span className="pipeline-eng-check-title" style={{ color: '#8A2BE2' }}>Nesting Time</span>
                    </div>
                    <div className="pipeline-eng-check-buttons" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleNestingStart(project.so)}
                        className={`btn-sm ${nestingChecks[project.so]?.started ? 'btn-secondary active-check' : 'btn-primary'}`}
                        style={{ background: nestingChecks[project.so]?.started ? 'rgba(255,255,255,0.05)' : '#8A2BE2', borderColor: '#8A2BE2' }}
                      >
                        <Clock size={14} />
                        {nestingChecks[project.so]?.started ? new Date(nestingChecks[project.so].started).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Start'}
                      </button>
                      <button 
                        onClick={() => handleNestingFinish(project.so)}
                        className={`btn-sm ${nestingChecks[project.so]?.finished ? 'btn-secondary active-check' : 'btn-secondary'}`}
                        disabled={!nestingChecks[project.so]?.started}
                      >
                        <CheckCircle2 size={14} />
                        {nestingChecks[project.so]?.finished ? new Date(nestingChecks[project.so].finished).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Finish'}
                      </button>
                      {nestingChecks[project.so]?.user && (
                        <span className="eng-check-user" style={{ fontSize: '0.7rem' }}>
                          ({nestingChecks[project.so].user})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Comment Controls (Isolated window) */}
                  <div className="pipeline-eng-check-controls" style={{ flex: 1.5, minWidth: '320px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="pipeline-eng-check-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="pipeline-eng-check-title" style={{ color: '#09D1C7' }}>
                        {language === 'es' ? 'Agregar Comentario' : 'Add Comment'}
                      </span>
                      {/* Priority selector tag */}
                      <button 
                        onClick={() => setCommentPriorities(prev => ({ ...prev, [project.so]: !prev[project.so] }))}
                        style={{
                          background: commentPriorities[project.so] ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255,255,255,0.05)',
                          border: commentPriorities[project.so] ? '1px solid #FF3B30' : '1px solid rgba(255,255,255,0.1)',
                          color: commentPriorities[project.so] ? '#FF3B30' : '#94A3B8',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Flag size={10} />
                        {commentPriorities[project.so] 
                          ? (language === 'es' ? 'Prioritario' : 'Priority')
                          : (language === 'es' ? 'Normal' : 'Normal')
                        }
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', height: '32px', alignItems: 'center' }}>
                      <input 
                        type="text"
                        placeholder={language === 'es' ? 'Escribe un comentario...' : 'Write a comment...'}
                        value={newNoteTexts[project.so] || ''}
                        onChange={(e) => setNewNoteTexts(prev => ({ ...prev, [project.so]: e.target.value }))}
                        style={{ flex: 2.2, padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.8rem', height: '100%' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddNote(project.so, project.eng, commentPriorities[project.so]);
                          }
                        }}
                      />
                      <button 
                        onClick={() => handleAddNote(project.so, project.eng, commentPriorities[project.so])}
                        disabled={!(newNoteTexts[project.so] || '').trim()}
                        className="btn-sm btn-primary"
                        style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.8rem', padding: '0' }}
                      >
                        <Plus size={12} />
                        {language === 'es' ? 'Comentar' : 'Comment'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Project Notes Section */}
                <div className="pipeline-notes-section">
                  <div className="pipeline-notes-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <StickyNote size={13} />
                      <span>{language === 'es' ? 'Notas' : 'Notes'}</span>
                    </div>
                    {(projectNotes[project.so] || []).length > 0 && (
                      <span className="notes-panel-count" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', backgroundColor: 'rgba(9, 209, 199, 0.15)', color: '#09D1C7', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {(projectNotes[project.so] || []).length}
                      </span>
                    )}
                  </div>
                  
                  {/* Notes List */}
                  {(projectNotes[project.so] || []).length > 0 && (
                    <div className="pipeline-notes-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                      {(projectNotes[project.so] || []).map(note => (
                        <div key={note.id} className="note-item" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '10px 12px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: note.priority ? '3px solid #FF3B30' : '3px solid #09D1C7' }}>
                          <div className="note-item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="note-priority-tag" style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '8px', background: note.priority ? 'rgba(255, 59, 48, 0.14)' : 'rgba(9, 209, 199, 0.15)', color: note.priority ? '#FF3B30' : '#09D1C7' }}>
                                {note.priority
                                  ? (language === 'es' ? '⚑ Prioritaria' : '⚑ Priority')
                                  : (language === 'es' ? 'Normal' : 'Normal')}
                              </span>
                              {note.createdBy && note.createdBy.toLowerCase() !== project.eng.toLowerCase() && (
                                <span className="note-author" style={{ fontSize: '0.72rem', color: '#09D1C7', fontWeight: 'bold' }}>
                                  | By {note.createdBy}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="note-item-text" style={{ fontSize: '0.82rem', color: '#fff', lineHeight: '1.4', wordBreak: 'break-word' }}>
                            {note.text}
                          </div>
                          <div className="note-item-date" style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>
                            {new Date(note.createdAt).toLocaleString(language === 'es' ? 'es-AR' : 'en-US', {
                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

