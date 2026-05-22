import React, { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parse 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import './CalendarView.css';

export default function CalendarView({ data }) {
  if (!data) return null;

  const { priorityAnalysis } = data;
  
  // Parse projects to get valid dates
  const projectsWithDates = priorityAnalysis
    .filter(p => p.install && p.install.trim() !== '')
    .map(p => {
      // Assuming dates are 'M/D/YYYY' or similar. We parse them manually or using date-fns
      // Example: '5/27/2026'
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

  // We start viewing the month of the first upcoming project or current date. 
  // Let's default to May 2026 since the data is from there, or just today.
  // We'll set the initial date to the first project's date if available, otherwise new Date()
  const initialDate = projectsWithDates.length > 0 ? projectsWithDates[0].dateObj : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const getStatusColor = (status) => {
    const s = status.toUpperCase();
    if (s.includes('HOLD')) return 'cal-status-hold';
    if (s.includes('CHECK')) return 'cal-status-check';
    if (s.includes('REVIEW')) return 'cal-status-review';
    if (s.includes('ENG')) return 'cal-status-eng';
    return 'cal-status-default';
  };

  const renderHeader = () => (
    <div className="calendar-header">
      <button onClick={prevMonth} className="cal-nav-btn"><ChevronLeft /></button>
      <h2 className="cal-month-title">{format(currentMonth, 'MMMM yyyy')}</h2>
      <button onClick={nextMonth} className="cal-nav-btn"><ChevronRight /></button>
    </div>
  );

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentMonth);
    for (let i = 0; i < 7; i++) {
      days.push(
        <div className="cal-day-name" key={i}>
          {format(addDays(startDate, i), 'EEE')}
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
        
        // Find projects for this day
        const dayProjects = projectsWithDates.filter(p => isSameDay(p.dateObj, cloneDay));

        days.push(
          <div
            className={`cal-cell ${!isSameMonth(day, monthStart) ? 'disabled' : ''}`}
            key={day}
          >
            <span className="cal-date-num">{formattedDate}</span>
            <div className="cal-events">
              {dayProjects.map((p, idx) => (
                <div key={idx} className={`cal-event ${getStatusColor(p.status)}`} title={`${p.name} - ${p.status}`}>
                  <span className="cal-event-time">{p.so}</span>
                  <span className="cal-event-title">{p.name.split(':')[0]}</span>
                </div>
              ))}
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
        <h1 className="page-title">Installation Calendar</h1>
        <p className="text-muted">Upcoming project installations</p>
      </header>

      <div className="calendar-layout">
        <div className="calendar-container glass-card">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>

        <div className="calendar-sidebar glass-card">
          <h3 className="sidebar-title">
            <CalendarIcon size={18} className="text-cyan" />
            Upcoming Installs
          </h3>
          <div className="upcoming-list">
            {projectsWithDates.map((p, idx) => (
              <div key={idx} className="upcoming-item">
                <div className="upcoming-date">
                  <span className="u-month">{format(p.dateObj, 'MMM')}</span>
                  <span className="u-day">{format(p.dateObj, 'dd')}</span>
                </div>
                <div className="upcoming-info">
                  <div className="u-name">{p.name.split(':')[0]}</div>
                  <div className="u-meta">#{p.so} • {p.eng}</div>
                </div>
                <div className={`u-status ${getStatusColor(p.status)}`}></div>
              </div>
            ))}
            {projectsWithDates.length === 0 && (
              <p className="text-muted text-center mt-lg">No upcoming installations.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
