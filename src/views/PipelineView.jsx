import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Calendar, StickyNote, Flag, Clock, CheckCircle2, Users, Plus, Circle, Image as ImageIcon, Loader2, X, FileText, Paperclip, MessageSquare } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { db, ref, onValue, set } from '../utils/firebase';
import { saveEngineeringCheck } from '../utils/engineeringCheck';
import { compressImage, uploadNoteAttachment } from '../services/imageService';
import { calculateAutomaticStages, STAGES } from '../utils/stageUtils';
import { sendStageEvent, sendNoteEvent, sendEngineerAssignEvent } from '../utils/sheetSync';
import './PipelineView.css';

const getStageLabel = (stageId, language) => {
  if (language === 'es') {
    switch (stageId) {
      case 'ingenieria': return 'Ingeniería';
      case 'check1': return 'Eng. Check';
      case 'paperwork': return 'Paperwork';
      case 'check2': return 'PW Check';
      case 'nesting': return 'Nesting';
      case 'install': return 'Install';
      default: return stageId;
    }
  } else {
    switch (stageId) {
      case 'ingenieria': return 'Engineering';
      case 'check1': return 'Eng. Check';
      case 'paperwork': return 'Paperwork';
      case 'check2': return 'PW Check';
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
  const [showMyProjects, setShowMyProjects] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectNotes, setProjectNotes] = useState({});
  const [engineeringChecks, setEngineeringChecks] = useState({});
  const [projectCollaborators, setProjectCollaborators] = useState({});
  const [projectDesigners, setProjectDesigners] = useState({});
  const [newNoteTexts, setNewNoteTexts] = useState({});
  const [nestingChecks, setNestingChecks] = useState({});
  const [commentTypes, setCommentTypes] = useState({});
  const [assignedEngineers, setAssignedEngineers] = useState({}); // Optimistic UI for assigned engineers
  const [noteImages, setNoteImages] = useState({});
  const [isUploadingImage, setIsUploadingImage] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [materialOverrides, setMaterialOverrides] = useState({});
  const [kanbanState, setKanbanState] = useState({});
  // Manual within-column ordering: { [columnId]: [so, so, ...] }. Projects not
  // yet present in a column's array fall back to date-based ordering (see
  // kanbanOrderedProjects below) so existing boards don't jump around before
  // anyone has dragged a card within a column.
  const [kanbanOrder, setKanbanOrder] = useState({});
  const [draggedOverSo, setDraggedOverSo] = useState(null);

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

    const designersRef = ref(db, 'project_designers');
    const unsubscribeDesigners = onValue(designersRef, (snapshot) => {
      setProjectDesigners(snapshot.val() || {});
    });

    const nestingRef = ref(db, 'nesting_checks');
    const unsubscribeNesting = onValue(nestingRef, (snapshot) => {
      setNestingChecks(snapshot.val() || {});
    });

    const matOverridesRef = ref(db, 'project_materials');
    const unsubscribeMatOverrides = onValue(matOverridesRef, (snapshot) => {
      setMaterialOverrides(snapshot.val() || {});
    });

    const kanbanRef = ref(db, 'project_kanban_state');
    const unsubscribeKanban = onValue(kanbanRef, (snapshot) => {
      setKanbanState(snapshot.val() || {});
    });

    const kanbanOrderRef = ref(db, 'project_kanban_order');
    const unsubscribeKanbanOrder = onValue(kanbanOrderRef, (snapshot) => {
      setKanbanOrder(snapshot.val() || {});
    });

    return () => {
      unsubscribeNotes();
      unsubscribeEngChecks();
      unsubscribeCollabs();
      unsubscribeDesigners();
      unsubscribeNesting();
      unsubscribeMatOverrides();
      unsubscribeKanban();
      unsubscribeKanbanOrder();
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

  const handleAddNote = async (so, engName, noteType = 'normal') => {
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
      text: text.trim(),
      noteType: noteType,
      priority: noteType === 'priority', // Backward compat
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
        if (noteType === 'obs') {
          sendNoteEvent(so, newNote.text, newNote.createdBy, { name: '', eng: engName }, 'obs');
        }
        await set(ref(db, `project_notes/${so}`), currentNotes);
        setNewNoteTexts(prev => ({ ...prev, [so]: '' }));
        setCommentTypes(prev => ({ ...prev, [so]: 'normal' }));
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
    // 📡 Notificar a n8n → Google Sheets
    sendStageEvent(so, 'nesting', 'started', userName);
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
    // 📡 Notificar a n8n → Google Sheets
    sendStageEvent(so, 'nesting', 'finished', userName);
  };

  const handleEngineeringStart = async (so) => {
    const currentCheck = engineeringChecks[so] || {};
    const userName = userProfile?.designerName || currentUser?.email || 'Unknown User';
    
    // Check if it's a second person starting a check
    const isSecondCheck = currentCheck.started && currentCheck.user && currentCheck.user !== userName;

    const updatedCheck = { 
      ...currentCheck, 
    };

    if (isSecondCheck) {
      updatedCheck.started2 = new Date().toISOString();
      updatedCheck.user2 = userName;
    } else {
      updatedCheck.started = new Date().toISOString();
      updatedCheck.user = userName;
    }

    setEngineeringChecks(prev => ({ ...prev, [so]: updatedCheck }));
    await saveEngineeringCheck(so, updatedCheck);
    
    // 📡 Notificar a n8n → Google Sheets
    if (isSecondCheck) {
      sendStageEvent(so, 'check_eng2', 'started', userName);
    } else {
      sendStageEvent(so, 'check_eng', 'started', userName);
    }
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
    // 📡 Notificar a n8n → Google Sheets
    sendStageEvent(so, 'check_eng', 'finished', userName);
  };

  const { priorityAnalysis, onHoldNotes } = data;
  const isDesigner = userProfile?.role === 'designer';

  // Combine data or just use priorityAnalysis as the main source
  const projects = priorityAnalysis.filter(p => {
    const matchesFilter = filter === 'ALL' || filter === 'KANBAN' || p.status.toUpperCase() === filter.toUpperCase();
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.so.includes(searchTerm) ||
                          p.eng.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Designers only see projects assigned to them
    if (isDesigner && userProfile?.designerName) {
      return matchesFilter && matchesSearch &&
        projectDesigners[p.so] &&
        projectDesigners[p.so].trim().toLowerCase() === userProfile.designerName.trim().toLowerCase();
    }

    let matchesMyProjects = true;
    if (showMyProjects && userProfile?.designerName) {
      const isEng = p.eng && p.eng.trim().toLowerCase() === userProfile.designerName.trim().toLowerCase();
      const isCollab = projectCollaborators[p.so] && projectCollaborators[p.so].some(c => c.trim().toLowerCase() === userProfile.designerName.trim().toLowerCase());
      matchesMyProjects = isEng || isCollab;
    }

    return matchesFilter && matchesSearch && matchesMyProjects;
  });

  const getStatusColor = (status) => {
    const s = status.toUpperCase();
    if (s.includes('HOLD')) return 'status-hold';
    if (s.includes('CHECK')) return 'status-check';
    if (s.includes('REVIEW')) return 'status-review';
    if (s.includes('ENG')) return 'status-eng';
    if (s.includes('NEST')) return 'status-nesting';
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
        case 'KANBAN': return 'KANBAN';
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

  // Matches database.rules.json's write restriction on project_kanban_state /
  // project_kanban_order (nester or super admin only) — kept in sync so the
  // UI never offers drag-and-drop to a role whose write would be rejected.
  const canEditKanban = userProfile?.role === 'engineer_nester' || userProfile?.role === 'engineer-admin';

  const handleDragStart = (e, so) => {
    if (!canEditKanban) return;
    e.dataTransfer.setData('text/plain', String(so));
  };

  const handleDragOver = (e) => {
    if (!canEditKanban) return;
    e.preventDefault();
  };

  // Persists both the column assignment (project_kanban_state, unchanged) and
  // an explicit within-column position (project_kanban_order/{columnId} = [so, ...]),
  // so a manual drag order survives reloads and is what My Projects reads for
  // its 'Kanban' sort — instead of that view re-deriving an order on its own.
  const persistColumnOrder = async (columnId, columnSos) => {
    if (!db) return;
    await set(ref(db, `project_kanban_order/${columnId}`), columnSos);
  };

  // Dropping on empty column space (below the last card): append to the end
  // of that column's order, moving column if needed.
  const handleDrop = async (e, columnId) => {
    if (!canEditKanban) return;
    e.preventDefault();
    setDraggedOverSo(null);
    const so = e.dataTransfer.getData('text/plain');
    if (!so || !db) return;

    if (kanbanState[so] !== columnId) {
      await set(ref(db, `project_kanban_state/${so}`), columnId);
    }

    const currentColumnProjects = kanbanOrderedProjects.filter(
      p => (kanbanState[p.so] || 'projects') === columnId
    );
    const nextOrder = currentColumnProjects.map(p => String(p.so)).filter(s => s !== String(so));
    nextOrder.push(String(so));
    await persistColumnOrder(columnId, nextOrder);
  };

  // Dropping directly on a card: insert the dragged project right before it
  // (moving column too if the card was dragged in from elsewhere).
  const handleDropOnCard = async (e, columnId, targetSo) => {
    if (!canEditKanban) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverSo(null);
    const so = e.dataTransfer.getData('text/plain');
    if (!so || !db || String(so) === String(targetSo)) return;

    if (kanbanState[so] !== columnId) {
      await set(ref(db, `project_kanban_state/${so}`), columnId);
    }

    const currentColumnProjects = kanbanOrderedProjects.filter(
      p => (kanbanState[p.so] || 'projects') === columnId
    );
    const nextOrder = currentColumnProjects.map(p => String(p.so)).filter(s => s !== String(so));
    const targetIndex = nextOrder.indexOf(String(targetSo));
    nextOrder.splice(targetIndex === -1 ? nextOrder.length : targetIndex, 0, String(so));
    await persistColumnOrder(columnId, nextOrder);
  };

  const handleAssignEngineer = async (so, engineerName) => {
    if (!engineerName) return;
    try {
      const project = data?.priorityAnalysis?.find(p => String(p.so) === String(so));
      sendEngineerAssignEvent(so, engineerName, project || {});
      // Guardar optimísticamente en UI
      setAssignedEngineers(prev => ({ ...prev, [so]: engineerName }));
    } catch (error) {
      console.error('Failed to assign engineer:', error);
    }
  };

  // Default fallback order (soonest install date first, undated last) for
  // projects that don't yet have a manually-dragged position saved in
  // project_kanban_order for their column.
  const kanbanOrderedProjects = [...projects].sort((a, b) => {
    const dateA = a.install ? new Date(a.install).getTime() : null;
    const dateB = b.install ? new Date(b.install).getTime() : null;
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });

  // Applies each column's persisted manual order (project_kanban_order) on
  // top of the date-based fallback: projects with a saved position are placed
  // in that exact order; any project not yet in the saved array keeps its
  // fallback (date-based) relative position, appended after the saved ones.
  // This is what both the Kanban board and My Projects' 'Kanban' sort use, so
  // a nester's manual drag order is the single source of truth for both.
  const orderProjectsForColumn = (columnProjects, columnId) => {
    const savedOrder = kanbanOrder[columnId];
    if (!savedOrder || savedOrder.length === 0) return columnProjects;

    const savedIndex = new Map(savedOrder.map((so, i) => [String(so), i]));
    return [...columnProjects].sort((a, b) => {
      const idxA = savedIndex.has(String(a.so)) ? savedIndex.get(String(a.so)) : Infinity;
      const idxB = savedIndex.has(String(b.so)) ? savedIndex.get(String(b.so)) : Infinity;
      if (idxA !== idxB) return idxA - idxB;
      return 0; // both unsaved: keep existing (date-based) relative order
    });
  };

  const KANBAN_COLUMNS = [
    { id: 'procurement', label: 'PROCUREMENT' },
    { id: 'material', label: 'MATERIAL' },
    { id: 'nesting', label: 'NESTING' },
    { id: 'projects', label: 'PROJECTS' }
  ];

  return (
    <div className={`pipeline-view animate-fade-in ${filter === 'KANBAN' ? 'pipeline-view-kanban' : ''}`}>
      <header className="view-header">
        <h1 className="page-title">{t('pipeline.title')}</h1>
        <div className="controls">
          <div className="search-bar glass-card">
            <Search size={18} className="text-muted" />
            <input
              type="text"
              name="pipelineSearch"
              placeholder={t('pipeline.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-chips">
            {!isDesigner && (
              <>
                <label className="pipeline-my-projects-toggle">
                  <div
                    className={`pipeline-toggle-btn ${showMyProjects ? 'on' : 'off'}`}
                    onClick={() => setShowMyProjects(!showMyProjects)}
                    role="switch"
                    aria-checked={showMyProjects}
                  >
                    <span className="pipeline-toggle-knob" />
                  </div>
                  <span className="pipeline-toggle-label">
                    {language === 'es' ? 'Mostrar Solo Mis Proyectos' : 'Show My Projects Only'}
                  </span>
                </label>
                <div className="filter-chips-divider" />
              </>
            )}
            {['ALL', 'ON HOLD', 'CHECK', 'REVIEW', 'ENGINEERING', 'KANBAN'].map(f => (
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

      {/* Image Modal */}
      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100000, 
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(5px)'
          }}
        >
          <div 
            style={{ position: 'relative', maxWidth: '85vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedImage(null)}
              style={{ 
                position: 'absolute', top: '0', right: '-50px', 
                background: 'none', border: 'none', color: '#fff', 
                cursor: 'pointer', padding: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.1)', borderRadius: '50%'
              }}
            >
              <X size={24} />
            </button>
            <img 
              src={selectedImage} 
              alt="Enlarged Note attachment" 
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
            />
          </div>
        </div>
      )}

      {filter === 'KANBAN' ? (
        <div className="kanban-board">
          {KANBAN_COLUMNS.map(col => {
            const columnProjects = orderProjectsForColumn(
              kanbanOrderedProjects.filter(p => (kanbanState[p.so] || 'projects') === col.id),
              col.id
            );
            return (
              <div 
                key={col.id} 
                className={`kanban-column column-${col.id}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="kanban-column-header">
                  <h3>{col.label}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="kanban-count">({columnProjects.length})</span>
                    {!canEditKanban && (
                      <span title="Read-only" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>🔒</span>
                    )}
                  </div>
                </div>
                <div className="kanban-column-content">
                  {columnProjects.map(project => {
                    const matReq = data.materialRequirements?.find(m => String(m.so) === String(project.so));
                    const ov = materialOverrides[project.so] || {};
                    const thermofoil = ov.thermofoil !== undefined ? ov.thermofoil : (matReq?.thermofoil || 'No');
                    const dovetail   = ov.dovetail   !== undefined ? ov.dovetail   : (matReq?.dovetail   || 'No');
                    const element    = ov.element    !== undefined ? ov.element    : (matReq?.element    || 'No');
                    const needsProcurement = (thermofoil === 'Yes' || dovetail === 'Yes' || element === 'Yes') && ov.procurement !== 'Yes';
                    
                    const projectMaterials = data.projectSpecificMaterials?.[project.so] || [];
                    const hasNonSnowWhiteMaterial = projectMaterials.some(m => m.material && m.material.toLowerCase() !== 'snow white') && ov.ordered !== 'Yes';

                    return (
                    <div
                      key={project.so}
                      className={`kanban-card glass-card ${canEditKanban ? 'kanban-card-draggable' : ''} ${draggedOverSo === project.so ? 'kanban-card-drag-over' : ''}`}
                      draggable={canEditKanban}
                      onDragStart={canEditKanban ? (e) => handleDragStart(e, project.so) : undefined}
                      onDragOver={canEditKanban ? (e) => { e.preventDefault(); e.stopPropagation(); if (draggedOverSo !== project.so) setDraggedOverSo(project.so); } : undefined}
                      onDragLeave={canEditKanban ? () => setDraggedOverSo(prev => (prev === project.so ? null : prev)) : undefined}
                      onDrop={canEditKanban ? (e) => handleDropOnCard(e, col.id, project.so) : undefined}
                    >
                      <div className="kanban-card-top">
                        <a
                          href={`${window.location.origin}${window.location.pathname}?project=${project.so}`}
                          target="_blank"
                          rel="noreferrer"
                          className="kanban-project-id"
                          onClick={e => e.stopPropagation()}
                          style={{ textDecoration: 'none', cursor: 'pointer' }}
                        >#{project.so}</a>
                        <span className={`status-badge ${getStatusColor(project.status)}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                          {getStatusLabel(project.status)}
                        </span>
                      </div>
                      <h4 className="kanban-project-name">{project.name.split(':')[0].trim()}</h4>
                      <div className="kanban-card-meta">
                        <span className="meta-item" style={{ fontSize: '0.75rem' }}><Calendar size={12}/> {project.install}</span>
                        <span className="meta-item eng-badge" style={{ fontSize: '0.75rem' }}>ENG: {project.eng}</span>
                      </div>
                      <div className="kanban-card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {needsProcurement && (
                            <span className="meta-item procurement-badge" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>Proc.</span>
                          )}
                          {hasNonSnowWhiteMaterial && (
                            <span className="meta-item materials-badge-red" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>Mat.</span>
                          )}
                        </div>
                        <span className="pipeline-comments-bubble" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                          <MessageSquare size={12} />
                          <span>{(projectNotes[project.so] || []).length}</span>
                        </span>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="project-list">
          {projects.length === 0 ? (
            <div className="no-results text-muted">{t('pipeline.noProjects')}</div>
          ) : (
          projects.map((project, idx) => {
            const onHoldNote = project.status.toUpperCase() === 'ON HOLD' 
              ? (project.onHoldReason || getOnHoldNote(project.name)) 
              : null;
            
            const progress = calculateAutomaticStages(project);
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
                      <a
                        href={`${window.location.origin}${window.location.pathname}?project=${project.so}`}
                        target="_blank"
                        rel="noreferrer"
                        className="project-id"
                        onClick={e => e.stopPropagation()}
                        style={{ textDecoration: 'none', cursor: 'pointer' }}
                      >#{project.so}</a>
                      <h3 className="project-name">{project.name.split(':')[0].trim()}</h3>
                    </div>
                    <div className="project-meta">
                      <span className="meta-item">
                        <Calendar size={14} />
                        {project.install}
                      </span>
                      {(project.eng || assignedEngineers[project.so]) ? (
                        <span className="meta-item eng-badge">
                          ENG: {assignedEngineers[project.so] || project.eng}
                        </span>
                      ) : (
                        <select
                          className="meta-item eng-badge"
                          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', outline: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleAssignEngineer(project.so, e.target.value);
                          }}
                          value=""
                        >
                          <option value="" disabled>{language === 'es' ? 'Asignar ING' : 'Assign ENG'}</option>
                          {['Joaquin', 'Jose', 'Luis', 'Santiago', 'Julieta', 'Andres', 'Delfina', 'Josema'].map(d => (
                            <option key={d} value={d} style={{ color: '#000' }}>{d}</option>
                          ))}
                        </select>
                      )}
                      {projectDesigners[project.so] && (
                        <span className="meta-item eng-badge">
                          DES: {projectDesigners[project.so]}
                        </span>
                      )}
                      {projectCollaborators[project.so] && projectCollaborators[project.so].length > 0 && (
                        <span className="meta-item collabs-badge">
                          <Users size={14} />
                          {language === 'es' ? 'Colab: ' : 'Collabs: '}
                          {projectCollaborators[project.so].join(', ')}
                        </span>
                      )}
                      {(() => {
                        const matReq = data.materialRequirements?.find(m => String(m.so) === String(project.so));
                        const ov = materialOverrides[project.so] || {};
                        const thermofoil = ov.thermofoil !== undefined ? ov.thermofoil : (matReq?.thermofoil || 'No');
                        const dovetail   = ov.dovetail   !== undefined ? ov.dovetail   : (matReq?.dovetail   || 'No');
                        const element    = ov.element    !== undefined ? ov.element    : (matReq?.element    || 'No');
                        const needsProcurement = (thermofoil === 'Yes' || dovetail === 'Yes' || element === 'Yes') && ov.procurement !== 'Yes';
                        
                        const projectMaterials = data.projectSpecificMaterials?.[project.so] || [];
                        const hasNonSnowWhiteMaterial = projectMaterials.some(m => m.material && m.material.toLowerCase() !== 'snow white') && ov.ordered !== 'Yes';

                        return (
                          <>
                            {needsProcurement && (
                              <span className="meta-item procurement-badge">Procurement</span>
                            )}
                            {hasNonSnowWhiteMaterial && (
                              <span className="meta-item materials-badge-red">Materials</span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="project-side">
                    {(projectNotes[project.so] || []).length > 0 && (
                      <span className="pipeline-comments-bubble" title={language === 'es' ? 'Comentarios' : 'Comments'}>
                        <MessageSquare size={14} strokeWidth={2.5} />
                        <span>{(projectNotes[project.so] || []).length}</span>
                      </span>
                    )}
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
                      {/* Card 1: Engineering Check Controls - hidden for designers */}
                      {!isDesigner && (
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
                      )}

                      {/* Card 2: Nesting Controls - hidden for designers */}
                      {!isDesigner && (
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
                      )}

                      {/* Card 3: Note Controls */}
                      <div className="pipeline-eng-check-controls card-notes-input">
                        <div className="pipeline-notes-input-header">
                          <span className="pipeline-notes-input-title">
                            {language === 'es' ? 'Agregar Nota' : 'Add Note'}
                          </span>
                          <button
                            type="button"
                            className={`priority-toggle ${commentTypes[project.so] === 'priority' ? 'is-priority' : commentTypes[project.so] === 'obs' ? 'is-obs' : 'not-priority'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCommentTypes(prev => {
                                const current = prev[project.so] || 'normal';
                                const nextType = current === 'normal' ? 'priority' : current === 'priority' ? 'obs' : 'normal';
                                return { ...prev, [project.so]: nextType };
                              });
                            }}
                          >
                            <Flag size={12} />
                            {commentTypes[project.so] === 'priority'
                              ? (language === 'es' ? 'Prioritaria' : 'Priority')
                              : commentTypes[project.so] === 'obs'
                                ? (language === 'es' ? 'Observación' : 'Obs')
                                : (language === 'es' ? 'Normal' : 'Normal')}
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
                              name={`pipelineNote-${project.so}`}
                              placeholder={language === 'es' ? 'Escribe una nota...' : 'Write a note...'}
                              value={newNoteTexts[project.so] || ''}
                              onChange={(e) => setNewNoteTexts(prev => ({ ...prev, [project.so]: e.target.value }))}
                              className="pipeline-note-input-field"
                              disabled={isUploadingImage[project.so]}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddNote(project.so, project.eng, commentTypes[project.so]);
                                }
                              }}
                            />
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', padding: '0 10px', borderRadius: '8px', color: '#94A3B8' }} title={language === 'es' ? 'Adjuntar Imagen o Documento (Máx 1MB)' : 'Attach Image or Document (Max 1MB)'}>
                              <Paperclip size={14} />
                              <input
                                type="file"
                                name={`pipelineAttachments-${project.so}`}
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
                              onClick={() => handleAddNote(project.so, project.eng, commentTypes[project.so])}
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
                                        <div key={i} style={{ textDecoration: 'none' }}>
                                          {att.type === 'document' ? (
                                            <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: '#09D1C7', border: '1px solid rgba(9,209,199,0.2)' }}>
                                                <FileText size={14} />
                                                <span style={{ fontSize: '0.75rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {att.name || 'Document'}
                                                </span>
                                              </div>
                                            </a>
                                          ) : (
                                            <div onClick={() => setSelectedImage(att.url)} style={{ cursor: 'pointer' }}>
                                              <img src={att.url} alt="Note attachment" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '6px', border: '1px solid var(--card-border)', objectFit: 'cover' }} />
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                                <div className="pipeline-note-card-date">
                                  {note.createdBy && <span style={{ marginRight: '8px', fontWeight: 'bold' }}>{note.createdBy} &bull;</span>}
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
      )}
    </div>
  );
}
