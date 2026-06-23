import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Calendar, StickyNote, Flag, Clock, CheckCircle2, Users, Plus, Circle, Image as ImageIcon, Loader2, X, FileText, Paperclip } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { db, ref, onValue, set } from '../utils/firebase';
import { saveEngineeringCheck } from '../utils/engineeringCheck';
import { compressImage, uploadNoteAttachment } from '../services/imageService';
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


export default function PipelineView({ data, currentUser, userProfile, focusedProjectSo, clearFocusedProjectSo }) {
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
  const [noteImages, setNoteImages] = useState({});
  const [isUploadingImage, setIsUploadingImage] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  const toggleCollapse = (so) => {
    setExpandedProjects(prev => ({ ...prev, [so]: !prev[so] }));
  };

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

  // Expand and scroll to focused project if redirected from a notification
  useEffect(() => {
    if (focusedProjectSo) {
      setExpandedProjects(prev => ({ ...prev, [focusedProjectSo]: true }));
      
      const timer = setTimeout(() => {
        const element = document.getElementById(`project-card-${focusedProjectSo}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('focused-glow');
          setTimeout(() => {
            element.classList.remove('focused-glow');
          }, 3000);
        }
        if (clearFocusedProjectSo) {
          clearFocusedProjectSo();
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [focusedProjectSo, clearFocusedProjectSo]);

  const handleAddNote = async (so, engName, isPriority = false) => {
    const text = newNoteTexts[so];
    const files = noteImages[so] || [];
    
    if ((!text || !text.trim()) && files.length === 0) return;

    setIsUploadingImage(prev => ({ ...prev, [so]: true }));

    let attachments = [];
    if (files.length > 0) {
      try {
        const uploadPromises = files.map(async (file) => {
          if (!file.type.startsWith('image/') && file.size > 1024 * 1024) {
            throw new Error('FILE_TOO_LARGE');
          }
          const fileToUpload = file.type.startsWith('image/') ? await compressImage(file) : file;
          const url = await uploadNoteAttachment(fileToUpload, so);
          return {
            url: url,
            type: file.type.startsWith('image/') ? 'image' : 'document',
            name: file.name
          };
        });
        attachments = await Promise.all(uploadPromises);
      } catch (error) {
        if (error.message === 'FILE_TOO_LARGE') {
          alert(language === 'es' ? 'Uno de los archivos es demasiado grande (Máx 1MB)' : 'One of the files is too large (Max 1MB)');
        } else {
          console.error('Error uploading files:', error);
          alert(language === 'es' ? 'Error al subir los archivos' : 'Error uploading files');
        }
        setIsUploadingImage(prev => ({ ...prev, [so]: false }));
        return; // Halt if upload fails
      }
    }

    const userName = userProfile?.designerName || currentUser?.displayName || currentUser?.email || 'Unknown User';

    const newNote = {
      id: Date.now().toString(),
      text: text?.trim() || '',
      priority: isPriority,
      createdAt: new Date().toISOString(),
      createdBy: userName
    };

    if (attachments.length > 0) {
      newNote.attachments = attachments;
    }

    const currentNotes = projectNotes[so] ? [...projectNotes[so]] : [];
    currentNotes.unshift(newNote);

    if (db) {
      try {
        await set(ref(db, `project_notes/${so}`), currentNotes);
        setNewNoteTexts(prev => ({ ...prev, [so]: '' }));
        setCommentPriorities(prev => ({ ...prev, [so]: false }));
        setNoteImages(prev => ({ ...prev, [so]: null }));
        setIsUploadingImage(prev => ({ ...prev, [so]: false }));
      } catch (err) {
        console.error('Failed to save note to Firebase:', err);
        setIsUploadingImage(prev => ({ ...prev, [so]: false }));
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

            const isCollapsed = !expandedProjects[project.so];

            return (
              <div 
                id={`project-card-${project.so}`} 
                key={idx} 
                className={`project-card glass-card ${isCollapsed ? 'collapsed' : 'expanded'}`}
              >
                <div className="project-header-row" onClick={() => toggleCollapse(project.so)}>
                  <div className="project-main">
                    <div className="project-title-container">
                      <div className="project-id">#{project.so}</div>
                      <h3 className="project-name">{project.name}</h3>
                    </div>
                    <div className="project-meta">
                      <span className="meta-item">
                        <Calendar size={14} />
                        {project.install}
                      </span>
                      <span className="meta-item eng-badge">
                        ENG: {project.eng}
                      </span>
                      {projectCollaborators[project.so] && projectCollaborators[project.so].length > 0 && (
                        <span className="meta-item collabs-badge">
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
                    <span className="chevron-icon">▼</span>
                  </div>
                </div>

                {!isCollapsed && (
                  <>
                    {onHoldNote && (
                      <div className="on-hold-alert">
                        <AlertCircle size={16} />
                        <p>{onHoldNote}</p>
                      </div>
                    )}

                    {/* Check, Nesting & Comment Isolated Sections */}
                    <div className="pipeline-row-grid">
                      {/* Card 1: Engineering Check Controls */}
                      <div className="pipeline-eng-check-controls card-eng">
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

                      {/* Card 2: Nesting Controls */}
                      <div className="pipeline-eng-check-controls card-nesting">
                        <div className="pipeline-eng-check-header">
                          <span className="pipeline-eng-check-title">Nesting Time</span>
                        </div>
                        <div className="pipeline-eng-check-buttons">
                          <button 
                            onClick={() => handleNestingStart(project.so)}
                            className={`btn-sm ${nestingChecks[project.so]?.started ? 'btn-secondary active-check nesting-started' : 'btn-primary nesting-start-btn'}`}
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
                            <span className="eng-check-user">
                              ({nestingChecks[project.so].user})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card 3: Note Controls */}
                      <div className="pipeline-eng-check-controls card-notes-input">
                        <div className="pipeline-notes-input-header">
                          <span className="pipeline-notes-input-title">
                            {language === 'es' ? 'Agregar Nota' : 'Add Note'}
                          </span>
                          <button 
                            onClick={() => setCommentPriorities(prev => ({ ...prev, [project.so]: !prev[project.so] }))}
                            className={`pipeline-priority-toggle ${commentPriorities[project.so] ? 'is-priority' : 'not-priority'}`}
                          >
                            <Flag size={10} />
                            {commentPriorities[project.so] 
                              ? (language === 'es' ? 'Prioritario' : 'Priority')
                              : (language === 'es' ? 'Normal' : 'Normal')
                            }
                          </button>
                        </div>
                        <div className="pipeline-note-input-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {noteImages[project.so] && noteImages[project.so].length > 0 && (
                            <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {noteImages[project.so].map((file, idx) => (
                                <div key={idx} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px', border: '1px solid var(--card-border)', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                                  {file.type.startsWith('image/') ? (
                                    <img 
                                      src={URL.createObjectURL(file)} 
                                      alt="Preview" 
                                      style={{ height: '40px', borderRadius: '4px', objectFit: 'cover' }} 
                                    />
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px', color: '#94A3B8' }}>
                                      <FileText size={18} />
                                      <span style={{ fontSize: '0.75rem', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.name}
                                      </span>
                                    </div>
                                  )}
                                  <button 
                                    type="button"
                                    onClick={() => setNoteImages(prev => ({ ...prev, [project.so]: prev[project.so].filter((_, i) => i !== idx) }))}
                                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#EF4444', color: '#fff', borderRadius: '50%', border: 'none', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <input 
                              type="text"
                              placeholder={language === 'es' ? 'Escribe una nota...' : 'Write a note...'}
                              value={newNoteTexts[project.so] || ''}
                              onChange={(e) => setNewNoteTexts(prev => ({ ...prev, [project.so]: e.target.value }))}
                              className="pipeline-note-input-field"
                              disabled={isUploadingImage[project.so]}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddNote(project.so, project.eng, commentPriorities[project.so]);
                                }
                              }}
                            />
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', padding: '0 10px', borderRadius: '8px', color: '#94A3B8' }} title={language === 'es' ? 'Adjuntar Imagen o Documento (Máx 1MB)' : 'Attach Image or Document (Max 1MB)'}>
                              <Paperclip size={14} />
                              <input 
                                type="file" 
                                multiple
                                accept="image/*,.pdf,.doc,.docx" 
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files) {
                                    const newFiles = Array.from(e.target.files);
                                    setNoteImages(prev => {
                                      const current = prev[project.so] || [];
                                      const combined = [...current, ...newFiles];
                                      if (combined.length > 4) {
                                        alert(language === 'es' ? 'Puedes adjuntar hasta 4 archivos' : 'You can attach up to 4 files');
                                      }
                                      return { ...prev, [project.so]: combined.slice(0, 4) };
                                    });
                                  }
                                }}
                                disabled={isUploadingImage[project.so] || (noteImages[project.so] && noteImages[project.so].length >= 4)}
                              />
                            </label>
                            <button 
                              onClick={() => handleAddNote(project.so, project.eng, commentPriorities[project.so])}
                              disabled={(!(newNoteTexts[project.so] || '').trim() && (!noteImages[project.so] || noteImages[project.so].length === 0)) || isUploadingImage[project.so]}
                              className="btn-sm btn-primary pipeline-add-note-btn"
                              style={{ opacity: isUploadingImage[project.so] ? 0.7 : 1 }}
                            >
                              {isUploadingImage[project.so] ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                              {language === 'es' ? 'Agregar' : 'Add'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Project Notes Section */}
                    <div className="pipeline-notes-section">
                      <div className="pipeline-notes-header">
                        <div className="notes-header-left">
                          <StickyNote size={13} />
                          <span>{language === 'es' ? 'Notas' : 'Notes'}</span>
                        </div>
                        {(projectNotes[project.so] || []).length > 0 && (
                          <span className="pipeline-notes-panel-count">
                            {(projectNotes[project.so] || []).length}
                          </span>
                        )}
                      </div>
                      
                      {/* Notes List */}
                      {(projectNotes[project.so] || []).length > 0 && (
                        <div className="pipeline-notes-list-wrapper">
                          {(projectNotes[project.so] || []).map(note => (
                            <div key={note.id} className={`pipeline-note-item-card ${note.priority ? 'priority' : 'normal'}`}>
                              <div className="pipeline-note-item-header">
                                <div className="note-tags-left">
                                  <span className={`pipeline-note-priority-badge ${note.priority ? 'priority' : 'normal'}`}>
                                    {note.priority
                                      ? (language === 'es' ? '⚑ Prioritaria' : '⚑ Priority')
                                      : (language === 'es' ? 'Normal' : 'Normal')}
                                  </span>
                                  {note.createdBy && project.eng && note.createdBy.toLowerCase() !== project.eng.toLowerCase() && (
                                    <span className="pipeline-note-author">
                                      | By {note.createdBy}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="pipeline-note-card-text">
                                <div className="pipeline-note-text">{note.text}</div>
                                {(() => {
                                  const atts = note.attachments ? [...note.attachments] : [];
                                  if (note.imageUrl) {
                                    atts.push({ url: note.imageUrl, type: note.attachmentType || 'image', name: note.attachmentName });
                                  }
                                  if (atts.length === 0) return null;
                                  return (
                                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {atts.map((att, i) => (
                                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                          {att.type === 'document' ? (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: '#09D1C7', border: '1px solid rgba(9,209,199,0.2)' }}>
                                              <FileText size={14} />
                                              <span style={{ fontSize: '0.75rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {att.name || 'Document'}
                                              </span>
                                            </div>
                                          ) : (
                                            <img src={att.url} alt="Note attachment" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '6px', border: '1px solid var(--card-border)', objectFit: 'cover' }} />
                                          )}
                                        </a>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="pipeline-note-card-date">
                                {new Date(note.createdAt).toLocaleString(language === 'es' ? 'es-AR' : 'en-US', {
                                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
