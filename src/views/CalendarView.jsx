import React, { useState, useEffect } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parse 
} from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { useLanguage } from '../utils/LanguageContext';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Plus, Trash2, X, FileText, ClipboardList 
} from 'lucide-react';
import './CalendarView.css';
import { db, ref, set, remove, onValue } from '../utils/firebase';
import { sendCalendarNoteEvent } from '../utils/sheetSync';

export default function CalendarView({ data, currentUser, userProfile }) {
  const { t, language } = useLanguage();
  if (!data) return null;


  const { priorityAnalysis } = data;
  
  // State for user notes
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(`dashboard_calendar_notes_${currentUser?.uid || 'guest'}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load notes from localStorage:', e);
      return [];
    }
  });

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 'list' = show the day's events (installs + notes) with a + to add;
  // 'form' = the add/edit-note form.
  const [dayModalView, setDayModalView] = useState('list');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [linkedSo, setLinkedSo] = useState('');
  
  // Filtering state
  const isDesigner = userProfile?.role === 'designer';
  const [showMyProjectsOnly, setShowMyProjectsOnly] = useState(() => {
    // Designers always see only their projects; others default based on role
    if (isDesigner) return true;
    if (userProfile?.role === 'engineer_nester' || userProfile?.role === 'administrative' || userProfile?.role === 'admin') {
      return false;
    }
    return true;
  });

  // Sidebar tab state: 'installs' or 'notes'
  const [sidebarTab, setSidebarTab] = useState('installs');
  const [projectDesigners, setProjectDesigners] = useState({});

  // Notes are visible to everyone, but only their author (or an admin) can edit/delete them
  const canManageNote = (note) => {
    if (!note) return true; // creating a brand-new note
    if (userProfile?.role === 'administrative' || userProfile?.role === 'admin') return true;
    return note.authorUid && currentUser && note.authorUid === currentUser.uid;
  };

  // Real-Time Database listener hook — notes are shared across all users
  useEffect(() => {
    if (!db || !currentUser) return;

    const notesRef = ref(db, 'calendar_notes');
    const unsubscribe = onValue(notesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert the notes object from RTDB into an array
        const notesList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setNotes(notesList);
      } else {
        setNotes([]);
      }
    }, (error) => {
      console.error('Firebase Realtime Database read error:', error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Load project designers from Firebase
  useEffect(() => {
    if (!db) return;
    const designersRef = ref(db, 'project_designers');
    const unsubscribe = onValue(designersRef, (snapshot) => {
      setProjectDesigners(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  // Parse projects to get valid dates
  const projectsWithDates = priorityAnalysis
    .filter(p => p.install && p.install.trim() !== '')
    .filter(p => {
      if (isDesigner && userProfile?.designerName) {
        // Designers see only projects assigned to them
        return projectDesigners[p.so] &&
          projectDesigners[p.so].trim().toLowerCase() === userProfile.designerName.trim().toLowerCase();
      }
      return !showMyProjectsOnly || (userProfile && p.eng && p.eng.trim() === userProfile.designerName);
    })
    .map(p => {
      let dateObj;
      try {
        dateObj = parse(p.install, 'M/d/yyyy', new Date());
        if (isNaN(dateObj)) dateObj = new Date(p.install); // fallback
      } catch (e) {
        dateObj = new Date(p.install);
      }
      return { ...p, dateObj };
    })
    .filter(p => !isNaN(p.dateObj))
    .sort((a, b) => a.dateObj - b.dateObj);

  // Extract unique active projects for the linking selector
  const allProjects = Array.from(
    new Map(
      priorityAnalysis
        .filter(p => p.so)
        .map(p => [
          p.so,
          {
            so: p.so,
            name: String(p.name || '').split(':')[0].trim(),
            status: p.status
          }
        ])
    ).values()
  ).sort((a, b) => String(a.so).localeCompare(String(b.so)));

  // Calendar month state navigation
  const initialDate = projectsWithDates.length > 0 ? projectsWithDates[0].dateObj : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getStatusColor = (status) => {
    // Same guard as PipelineView: a blank Status cell in the sheet arrives here
    // as undefined. Note this copy returns 'cal-'-prefixed classes — only the
    // guard is shared, the class names deliberately differ.
    const s = (status || '').toUpperCase();
    if (s.includes('HOLD')) return 'cal-status-hold';
    if (s.includes('CHECK')) return 'cal-status-check';
    if (s.includes('REVIEW')) return 'cal-status-review';
    if (s.includes('ENG')) return 'cal-status-eng';
    if (s.includes('NEST')) return 'cal-status-nesting';
    return 'cal-status-default';
  };

  // A note's `date` isn't enforced by any rule on the calendar_notes
  // collection, so one written by an older build — or whose write partially
  // failed — can lack it. Building the string by concatenation turned that
  // into "undefinedT00:00:00" -> Invalid Date, and format() throws
  // RangeError on those, taking the whole Calendar down.
  const formatNoteDate = (rawDate) => {
    if (!rawDate) return '';
    const d = new Date(`${rawDate}T00:00:00`);
    if (isNaN(d.getTime())) return '';
    return format(d, 'MMM dd, yyyy', { locale: language === 'es' ? es : enUS });
  };

  // LocalStorage Helper
  const saveNotesToLocalStorage = (updatedNotes) => {
    setNotes(updatedNotes);
    try {
      localStorage.setItem(`dashboard_calendar_notes_${currentUser?.uid || 'guest'}`, JSON.stringify(updatedNotes));
    } catch (e) {
      console.error('Failed to save notes to localStorage:', e);
    }
  };

  // Note Handlers
  const handleAddNoteClick = () => {
    setSelectedNote(null);
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    setNoteText('');
    setLinkedSo('');
    setDayModalView('form');
    setIsModalOpen(true);
  };

  // Clicking a calendar cell opens the day view: a list of that date's events
  // (installs + notes) with a + button to add a new note.
  const handleCellClick = (date) => {
    setSelectedNote(null);
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setNoteText('');
    setLinkedSo('');
    setDayModalView('list');
    setIsModalOpen(true);
  };

  // The + inside the day view: switch to the add-note form, keeping the date.
  const handleAddNoteForDay = () => {
    setSelectedNote(null);
    setNoteText('');
    setLinkedSo('');
    setDayModalView('form');
  };

  const handleEditNote = (note) => {
    setSelectedNote(note);
    setSelectedDate(note.date);
    setNoteText(note.text);
    setDayModalView('form');
    setLinkedSo(note.so || '');
    setIsModalOpen(true);
  };

  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const noteId = selectedNote ? selectedNote.id : `note-${Date.now()}-${currentUser?.uid || 'guest'}`;
    const noteData = {
      date: selectedDate,
      text: noteText,
      so: linkedSo || null,
      authorUid: selectedNote ? selectedNote.authorUid : currentUser?.uid || null,
      authorName: selectedNote ? selectedNote.authorName : (userProfile?.designerName || currentUser?.email || 'Unknown'),
    };

    if (db && currentUser) {
      try {
        set(ref(db, `calendar_notes/${noteId}`), noteData);
        // 📡 Notificar a n8n → Google Sheets
        sendCalendarNoteEvent(
          { ...noteData, authorName: noteData.authorName },
          !!selectedNote   // true = edición, false = nueva nota
        );
        // Back to the day's event list so the change is visible.
        setDayModalView('list');
      } catch (err) {
        console.error('Failed to save note to Firebase:', err);
      }
    } else {
      // Local Storage Fallback
      let updatedNotes;
      if (selectedNote) {
        updatedNotes = notes.map(n => n.id === noteId ? { id: noteId, ...noteData } : n);
      } else {
        updatedNotes = [...notes, { id: noteId, ...noteData }];
      }
      saveNotesToLocalStorage(updatedNotes);
      setDayModalView('list');
    }
    setSelectedNote(null);
  };

  const handleDeleteNote = (noteId) => {
    if (db && currentUser) {
      try {
        remove(ref(db, `calendar_notes/${noteId}`));
        setDayModalView('list');
      } catch (err) {
        console.error('Failed to delete note from Firebase:', err);
      }
    } else {
      // Local Storage Fallback
      const updatedNotes = notes.filter(n => n.id !== noteId);
      saveNotesToLocalStorage(updatedNotes);
      setDayModalView('list');
    }
    setSelectedNote(null);
  };

  const renderHeader = () => (
    <div className="calendar-header">
      <button onClick={prevMonth} className="cal-nav-btn" aria-label={language === 'es' ? 'Mes anterior' : 'Previous month'}><ChevronLeft /></button>
      <h2 className="cal-month-title" style={{ textTransform: 'capitalize' }}>
        {format(currentMonth, 'MMMM yyyy', { locale: language === 'es' ? es : enUS })}
      </h2>
      <button onClick={nextMonth} className="cal-nav-btn" aria-label={language === 'es' ? 'Mes siguiente' : 'Next month'}><ChevronRight /></button>
    </div>
  );

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth);
    for (let i = 0; i < 7; i++) {
      days.push(
        <div className="cal-day-name" key={i} style={{ textTransform: 'capitalize' }}>
          {format(addDays(startDate, i), 'EEE', { locale: language === 'es' ? es : enUS })}
        </div>
      );
    }
    return <div className="cal-days-row">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        const dayStr = format(cloneDay, 'yyyy-MM-dd');
        
        // Find projects and notes for this day
        const dayProjects = projectsWithDates.filter(p => isSameDay(p.dateObj, cloneDay));
        const dayNotes = notes.filter(n => n.date === dayStr);

        days.push(
          <div
            className={`cal-cell ${!isSameMonth(day, monthStart) ? 'disabled' : ''}`}
            key={day}
            onClick={() => handleCellClick(cloneDay)}
          >
            <span className="cal-date-num">{formattedDate}</span>
            <div className="cal-events">
              {dayProjects.map((p, idx) => (
                <div key={idx} className={`cal-event ${getStatusColor(p.status)}`} title={`${p.name} - ${p.status}`}>
                  <span className="cal-event-title">#{p.so}</span>
                </div>
              ))}
              {dayNotes.map((n, idx) => {
                const linkedProj = priorityAnalysis.find(p => p.so === n.so);
                return (
                  <div 
                    key={idx} 
                    className="cal-event cal-note-event" 
                    title={`${n.authorName ? `${n.authorName}: ` : ''}${n.text}${linkedProj ? ` (Linked: ${linkedProj.name})` : ''}`}
                    onClick={(e) => {
                      e.stopPropagation(); // prevent opening add modal
                      handleEditNote(n);
                    }}
                  >
                    <FileText size={10} className="cal-note-icon" />
                    <span className="cal-event-title">{n.text}</span>
                    {n.so && <span className="cal-event-so">#{n.so}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="cal-row" key={day}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="cal-body">{rows}</div>;
  };

  return (
    <div className="calendar-view animate-fade-in">
      <header className="view-header">
        <div className="view-header-title">
          <h1 className="page-title">{t('calendar.title')}</h1>
          <p className="text-muted">{t('calendar.subtitle')}</p>
        </div>
        <div className="view-header-actions">
          {userProfile?.role !== 'administrative' && userProfile?.role !== 'admin' && !isDesigner && (
            <label className="toggle-switch-container">
              <input
                type="checkbox"
                name="showMyProjectsOnly"
                checked={showMyProjectsOnly}
                onChange={(e) => setShowMyProjectsOnly(e.target.checked)}
                className="toggle-checkbox"
              />
              <div className="toggle-switch"></div>
              <span className="toggle-label">{t('calendar.myProjectsOnly')}</span>
            </label>
          )}
          <button className="btn-primary" onClick={handleAddNoteClick}>
            <Plus size={16} />
            <span>{t('calendar.addNote')}</span>
          </button>
        </div>
      </header>

      <div className="calendar-layout">
        <div className="calendar-container glass-card">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>

        <div className="calendar-sidebar glass-card">
          <div className="sidebar-tabs">
            <button 
              className={`sidebar-tab-btn ${sidebarTab === 'installs' ? 'active' : ''}`}
              onClick={() => setSidebarTab('installs')}
            >
              <CalendarIcon size={14} />
              <span>{t('calendar.installsTab')}</span>
            </button>
            <button 
              className={`sidebar-tab-btn ${sidebarTab === 'notes' ? 'active' : ''}`}
              onClick={() => setSidebarTab('notes')}
            >
              <FileText size={14} />
              <span>{t('calendar.notesTab')} ({notes.length})</span>
            </button>
          </div>

          <div className="db-status-bar">
            {db ? (
              <span className="status-badge connected">
                <span className="status-dot green"></span>
                {language === 'es' ? 'Sincronizado' : 'Realtime Synced'}
              </span>
            ) : (
              <span className="status-badge local">
                <span className="status-dot blue"></span>
                {language === 'es' ? 'Modo Local' : 'Local Mode'}
              </span>
            )}
          </div>

          {sidebarTab === 'installs' ? (
            <div className="upcoming-list">
              {projectsWithDates.map((p, idx) => (
                <div key={idx} className="upcoming-item">
                  <div className="upcoming-date">
                    <span className="u-month" style={{ textTransform: 'capitalize' }}>
                      {format(p.dateObj, 'MMM', { locale: language === 'es' ? es : enUS })}
                    </span>
                    <span className="u-day">{format(p.dateObj, 'dd')}</span>
                  </div>
                  <div className="upcoming-info">
                    <div className="u-name">{String(p.name || '').split(':')[0]}</div>
                    <div className="u-meta">#{p.so} • {p.eng}</div>
                  </div>
                  <div className={`u-status ${getStatusColor(p.status)}`}></div>
                </div>
              ))}
              {projectsWithDates.length === 0 && (
                <p className="text-muted text-center mt-lg">
                  {language === 'es' ? 'Sin instalaciones próximas.' : 'No upcoming installations.'}
                </p>
              )}
            </div>
          ) : (
            <div className="sidebar-notes-list">
              {notes
                .slice()
                .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
                .map((n, idx) => {
                  const linkedProj = priorityAnalysis.find(p => p.so === n.so);
                  return (
                    <button
                      type="button"
                      key={idx}
                      className="sidebar-note-item"
                      onClick={() => handleEditNote(n)}
                      aria-label={language === 'es' ? `Editar nota: ${n.text}` : `Edit note: ${n.text}`}
                    >
                      <div className="sidebar-note-header">
                        <span className="sidebar-note-date">
                          {formatNoteDate(n.date)}
                        </span>
                        {n.so && (
                          <span className="sidebar-note-badge" title={linkedProj?.name}>
                            #{n.so}
                          </span>
                        )}
                      </div>
                      <div className="sidebar-note-text">{n.text}</div>
                      {n.authorName && (
                        <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                          {language === 'es' ? 'Por' : 'By'} {n.authorName}
                        </div>
                      )}
                    </button>
                  );
                })}
              {notes.length === 0 && (
                <div className="empty-notes-state">
                  <ClipboardList size={32} className="text-muted" />
                  <p className="text-muted">{t('calendar.noNotes')}</p>
                  <button className="btn-secondary btn-sm mt-md" onClick={() => handleCellClick(new Date())}>
                    {language === 'es' ? 'Crear Primera Nota' : 'Create First Note'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modern Dialog Modal: 'list' = the day's events, 'form' = add/edit note */}
      {isModalOpen && (() => {
        const readOnlyNote = selectedNote && !canManageNote(selectedNote);

        // Events for the selected date (installs are read-only, notes editable).
        const dayInstalls = projectsWithDates.filter(p => format(p.dateObj, 'yyyy-MM-dd') === selectedDate);
        const dayNotesForDate = notes.filter(n => n.date === selectedDate);
        const prettyDate = selectedDate
          ? format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d, yyyy', { locale: language === 'es' ? es : enUS })
          : '';

        if (dayModalView === 'list') {
          return (
            <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 className="modal-title" style={{ textTransform: 'capitalize' }}>{prettyDate}</h3>
                  <button className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label={language === 'es' ? 'Cerrar' : 'Close'}>
                    <X size={18} />
                  </button>
                </div>

                <div className="day-events-list">
                  {dayInstalls.length === 0 && dayNotesForDate.length === 0 && (
                    <p className="text-muted day-events-empty">
                      {language === 'es' ? 'No hay eventos para este día.' : 'No events for this day.'}
                    </p>
                  )}

                  {dayInstalls.map((p, idx) => (
                    <a
                      key={`inst-${idx}`}
                      href={`${window.location.origin}${window.location.pathname}?project=${p.so}`}
                      target="_blank"
                      rel="noreferrer"
                      className="day-event-item day-event-install"
                      title={language === 'es' ? 'Abrir proyecto' : 'Open project'}
                    >
                      <span className={`day-event-dot ${getStatusColor(p.status)}`} />
                      <span className="day-event-so">#{p.so}</span>
                      <span className="day-event-name">{String(p.name || '').split(':')[0].trim()}</span>
                      <span className="day-event-status">{p.status}</span>
                    </a>
                  ))}

                  {dayNotesForDate.map((n, idx) => {
                    const linkedProj = priorityAnalysis.find(p => p.so === n.so);
                    return (
                      <div
                        key={`note-${idx}`}
                        className="day-event-item day-event-note"
                        onClick={() => handleEditNote(n)}
                        title={canManageNote(n) ? (language === 'es' ? 'Editar nota' : 'Edit note') : (language === 'es' ? 'Ver nota' : 'View note')}
                      >
                        <FileText size={14} className="day-event-note-icon" />
                        <span className="day-event-note-text">{n.text}</span>
                        {n.so && <span className="day-event-so">#{n.so}</span>}
                        {n.authorName && <span className="day-event-author">{n.authorName}</span>}
                      </div>
                    );
                  })}
                </div>

                <div className="day-events-footer">
                  <button className="btn-primary day-events-add-btn" onClick={handleAddNoteForDay}>
                    <Plus size={18} />
                    <span>{language === 'es' ? 'Agregar nota' : 'Add note'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        }

        return (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {selectedNote ? t('calendar.editNote') : t('calendar.addNote')}
              </h3>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </div>
            {selectedNote?.authorName && (
              <p className="text-muted" style={{ padding: '0 20px', marginTop: -8 }}>
                {language === 'es' ? 'Nota de' : 'Note by'} {selectedNote.authorName}
              </p>
            )}
            <form onSubmit={handleSaveNote} className="modal-form">
              <div className="form-group">
                <label className="form-label">{language === 'es' ? 'Fecha' : 'Date'}</label>
                <input
                  type="date"
                  name="selectedDate"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input"
                  disabled={readOnlyNote}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('calendar.linkProject')}</label>
                <select
                  name="linkedSo"
                  value={linkedSo}
                  onChange={(e) => setLinkedSo(e.target.value)}
                  className="form-select"
                  disabled={readOnlyNote}
                >
                  <option value="">{t('calendar.selectProject')}</option>
                  {allProjects.map(proj => (
                    <option key={proj.so} value={proj.so}>
                      #{proj.so} - {proj.name} ({proj.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('calendar.noteLabel')}</label>
                <textarea
                  name="noteText"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t('calendar.notePlaceholder')}
                  className="form-textarea"
                  rows={4}
                  disabled={readOnlyNote}
                  required
                />
              </div>

              <div className="form-actions">
                {selectedNote && canManageNote(selectedNote) && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => handleDeleteNote(selectedNote.id)}
                  >
                    <Trash2 size={16} />
                    <span>{t('calendar.deleteBtn')}</span>
                  </button>
                )}
                <div className="form-actions-right">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setSelectedNote(null); setDayModalView('list'); }}
                  >
                    {language === 'es' ? 'Volver' : 'Back'}
                  </button>
                  {!readOnlyNote && (
                    <button type="submit" className="btn-primary">
                      {t('common.save')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

