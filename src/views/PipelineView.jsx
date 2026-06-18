import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Calendar, StickyNote, Flag } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { db, ref, onValue } from '../utils/firebase';
import './PipelineView.css';

export default function PipelineView({ data }) {
  const { t, language } = useLanguage();
  if (!data) return null;

  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectNotes, setProjectNotes] = useState({});

  // Listen for project notes from Firebase in real-time
  useEffect(() => {
    if (!db) return;
    const notesRef = ref(db, 'project_notes');
    const unsubscribe = onValue(notesRef, (snapshot) => {
      setProjectNotes(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

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

