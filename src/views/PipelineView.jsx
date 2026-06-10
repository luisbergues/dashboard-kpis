import React, { useState } from 'react';
import { Search, AlertCircle, Calendar } from 'lucide-react';
import './PipelineView.css';

export default function PipelineView({ data }) {
  if (!data) return null;

  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

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

  const getOnHoldNote = (projectName) => {
    // try to match part of the name
    const note = onHoldNotes.find(n => projectName.includes(n.project) || n.project.includes(projectName));
    return note ? note.notes : null;
  };

  return (
    <div className="pipeline-view animate-fade-in">
      <header className="view-header">
        <h1 className="page-title">Project Pipeline</h1>
        <div className="controls">
          <div className="search-bar glass-card">
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder="Search by SO#, Name or ENG..." 
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
                {f}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="project-list">
        {projects.length === 0 ? (
          <div className="no-results text-muted">No projects found.</div>
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
                    {project.status}
                  </span>
                </div>

                {onHoldNote && (
                  <div className="on-hold-alert">
                    <AlertCircle size={16} />
                    <p>{onHoldNote}</p>
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
