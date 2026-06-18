import React, { useState, useEffect } from 'react';
import { db, ref, set, onValue, get, child } from '../utils/firebase';
import { saveEngineeringCheck } from '../utils/engineeringCheck';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../utils/LanguageContext';
import { 
  Briefcase, Calendar, CheckCircle2, Circle, Clock, 
  AlertCircle, Download, ToggleLeft, ToggleRight, X, Info, StickyNote, Plus, Trash2, Flag,
  ChevronDown, ChevronUp, ArrowUpDown, TrendingUp
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip as ChartTooltip, Legend, Filler } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { calculatePersonalStageAverages, calculateMonthlyCompletions, getUpcomingDeadlines } from '../services/kpiCalculator';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import './MyProjectsView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, ChartTooltip, Legend, Filler);

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
  const [engineeringChecks, setEngineeringChecks] = useState({});
  const [loading, setLoading] = useState(true);

  // Project Notes State
  const [projectNotes, setProjectNotes] = useState({});
  const [noteInputs, setNoteInputs] = useState({}); // { [so]: { text: '', priority: false } }

  // Hold Modal State
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [activeProjectSo, setActiveProjectSo] = useState(null);
  const [holdReason, setHoldReason] = useState('');

  // Analytics & Sorting State
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [sortBy, setSortBy] = useState(null); // 'date' | 'so'
  const [sortDesc, setSortDesc] = useState(true);

  const getOnHoldNote = (projectName) => {
    if (!onHoldNotes) return null;
    const note = onHoldNotes.find(n => projectName.includes(n.project) || n.project.includes(projectName));
    return note ? note.notes : null;
  };

  // Filter projects where eng matches the logged in designer
  const myProjectsRaw = priorityAnalysis.filter(p => {
    return userProfile && p.eng && p.eng.trim().toLowerCase() === userProfile.designerName.trim().toLowerCase();
  });

  const myProjects = [...myProjectsRaw].sort((a, b) => {
    if (!sortBy) return 0;
    if (sortBy === 'so') {
      return sortDesc ? b.so - a.so : a.so - b.so;
    }
    if (sortBy === 'date') {
      const dateA = new Date(a.install).getTime() || 0;
      const dateB = new Date(b.install).getTime() || 0;
      return sortDesc ? dateB - dateA : dateA - dateB;
    }
    return 0;
  });

  // Calculate analytics
  const stageAverages = calculatePersonalStageAverages(projectStages, myProjectsRaw, projectHistory);
  const monthlyData = calculateMonthlyCompletions(projectStages, myProjectsRaw);
  const upcomingDeadlines = getUpcomingDeadlines(myProjectsRaw);

  const stageAveragesChartData = {
    labels: stageAverages.map(s => s.label),
    datasets: [{
      label: 'Avg Hours',
      data: stageAverages.map(s => s.averageHours),
      backgroundColor: stageAverages.map(s => s.isExternal ? 'rgba(255, 255, 255, 0.2)' : '#09D1C7'),
      borderRadius: 4
    }]
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { color: '#94A3B8' } } },
    scales: {
      x: { ticks: { color: '#94A3B8' }, grid: { display: false } },
      y: { ticks: { color: '#94A3B8', precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.raw} Hours` } }
    },
    scales: {
      x: { ticks: { color: '#94A3B8', font: {size: 10} }, grid: { display: false } },
      y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };

  // Listen to stage progress, overrides, and history in Realtime Database
  useEffect(() => {
    if (!db || !currentUser) {
      // Local storage fallback initialization
      const localStages = {};
      const localOverrides = {};
      const localHistory = {};
      const localEngineeringChecks = {};
      const localNotes = {};
      
      myProjects.forEach(p => {
        try {
          const savedStages = localStorage.getItem(`project_stages_${p.so}`);
          localStages[p.so] = savedStages ? JSON.parse(savedStages) : Array(STAGES.length).fill(false);
          
          const savedOverride = localStorage.getItem(`project_override_${p.so}`);
          localOverrides[p.so] = savedOverride ? JSON.parse(savedOverride) : null;
          
          const savedHistory = localStorage.getItem(`project_history_${p.so}`);
          localHistory[p.so] = savedHistory ? JSON.parse(savedHistory) : [];

          const savedEngCheck = localStorage.getItem(`engineering_check_${p.so}`);
          localEngineeringChecks[p.so] = savedEngCheck ? JSON.parse(savedEngCheck) : {};

          const savedNotes = localStorage.getItem(`project_notes_${p.so}`);
          localNotes[p.so] = savedNotes ? JSON.parse(savedNotes) : [];
        } catch (e) {
          localStages[p.so] = Array(STAGES.length).fill(false);
          localOverrides[p.so] = null;
          localHistory[p.so] = [];
          localEngineeringChecks[p.so] = {};
          localNotes[p.so] = [];
        }
      });
      setProjectStages(localStages);
      setProjectOverrides(localOverrides);
      setProjectHistory(localHistory);
      setEngineeringChecks(localEngineeringChecks);
      setProjectNotes(localNotes);
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

    // Load Engineering Checks
    const engChecksRef = ref(db, 'engineering_checks');
    const unsubscribeEngChecks = onValue(engChecksRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setEngineeringChecks(dbData);
    });

    // Load Project Notes
    const notesRef = ref(db, 'project_notes');
    const unsubscribeNotes = onValue(notesRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setProjectNotes(dbData);
    });

    return () => {
      unsubscribeStages();
      unsubscribeOverrides();
      unsubscribeHistory();
      unsubscribeEngChecks();
      unsubscribeNotes();
    };
  }, [currentUser, userProfile]);

  const handleEngineeringStart = async (so) => {
    const currentCheck = engineeringChecks[so] || {};
    const updatedCheck = { ...currentCheck, started: new Date().toISOString() };
    setEngineeringChecks(prev => ({ ...prev, [so]: updatedCheck }));
    await saveEngineeringCheck(so, updatedCheck);
  };

  const handleEngineeringFinish = async (so) => {
    const currentCheck = engineeringChecks[so] || {};
    const updatedCheck = { ...currentCheck, finished: new Date().toISOString() };
    setEngineeringChecks(prev => ({ ...prev, [so]: updatedCheck }));
    await saveEngineeringCheck(so, updatedCheck);
  };

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

  const handleAddNote = async (so) => {
    const input = noteInputs[so];
    if (!input || !input.text?.trim()) return;

    const newNote = {
      id: Date.now().toString(),
      text: input.text.trim(),
      priority: input.priority || false,
      createdAt: new Date().toISOString()
    };

    const currentNotes = projectNotes[so] ? [...projectNotes[so]] : [];
    currentNotes.unshift(newNote);

    if (db && currentUser) {
      try {
        await set(ref(db, `project_notes/${so}`), currentNotes);
      } catch (err) {
        console.error('Failed to save note to Firebase:', err);
      }
    } else {
      localStorage.setItem(`project_notes_${so}`, JSON.stringify(currentNotes));
      setProjectNotes(prev => ({ ...prev, [so]: currentNotes }));
    }

    setNoteInputs(prev => ({ ...prev, [so]: { text: '', priority: false } }));
  };

  const handleDeleteNote = async (so, noteId) => {
    const currentNotes = (projectNotes[so] || []).filter(n => n.id !== noteId);

    if (db && currentUser) {
      try {
        await set(ref(db, `project_notes/${so}`), currentNotes.length > 0 ? currentNotes : null);
      } catch (err) {
        console.error('Failed to delete note from Firebase:', err);
      }
    } else {
      localStorage.setItem(`project_notes_${so}`, JSON.stringify(currentNotes));
      setProjectNotes(prev => ({ ...prev, [so]: currentNotes }));
    }
  };

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

  const generatePDF = (project) => {
    const doc = new jsPDF();
    const history = projectHistory[project.so] || [];
    const stages = projectStages[project.so] || Array(STAGES.length).fill(false);

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

    // Add Engineering Checks to PDF
    const engCheck = engineeringChecks[project.so];
    if (engCheck && (engCheck.started || engCheck.finished)) {
      currentY += 5;
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(18, 33, 48);
      doc.setFontSize(12);
      doc.text(language === 'es' ? 'Tiempos de Ingeniería' : 'Engineering Times', 15, currentY);
      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      if (engCheck.started) {
        doc.text(`Start: ${new Date(engCheck.started).toLocaleString()}`, 15, currentY);
        currentY += 5;
      }
      if (engCheck.finished) {
        doc.text(`Finish: ${new Date(engCheck.finished).toLocaleString()}`, 15, currentY);
        currentY += 5;
      }
    }

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

      {/* Analytics Section */}
      {!loading && myProjectsRaw.length > 0 && (
        <section className="personal-analytics-section glass-card mb-xl">
          <div className="analytics-header" onClick={() => setShowAnalytics(!showAnalytics)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showAnalytics ? '16px' : '0' }}>
            <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} className="text-neon-cyan" />
              My Analytics Dashboard
            </h2>
            {showAnalytics ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
          </div>
          
          {showAnalytics && (
            <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: '24px' }}>
              <SectionErrorBoundary title="Stage Averages Error">
                <div className="analytics-card">
                  <h4 className="chart-subtitle" style={{ fontSize: '0.9rem', color: '#94A3B8', marginBottom: '12px' }}>Avg Time per Stage (Weighted by Size)</h4>
                  <div style={{ height: '220px' }}>
                    <Bar data={stageAveragesChartData} options={barOptions} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '8px', textAlign: 'center' }}>* Gray bars indicate external stages</p>
                </div>
              </SectionErrorBoundary>

              <SectionErrorBoundary title="Monthly Output Error">
                <div className="analytics-card">
                  <h4 className="chart-subtitle" style={{ fontSize: '0.9rem', color: '#94A3B8', marginBottom: '12px' }}>Projects Completed (Monthly)</h4>
                  <div style={{ height: '220px' }}>
                    {monthlyData.labels.length > 0 ? (
                      <Line data={monthlyData} options={lineOptions} />
                    ) : (
                      <div className="text-muted" style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>No completed projects yet</div>
                    )}
                  </div>
                </div>
              </SectionErrorBoundary>

              <SectionErrorBoundary title="Deadlines Error">
                <div className="analytics-card deadlines-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', overflowY: 'auto', maxHeight: '260px' }}>
                  <h4 className="chart-subtitle" style={{ fontSize: '0.9rem', color: '#94A3B8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} className="text-yellow" />
                    Upcoming Install Deadlines
                  </h4>
                  {upcomingDeadlines.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>No critical deadlines in the next 14 days.</p>
                  ) : (
                    <div className="deadlines-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {upcomingDeadlines.map(d => (
                        <div key={d.so} className="deadline-item" style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', borderLeft: d.daysLeft <= 3 ? '3px solid var(--color-pink)' : '3px solid #FFE600' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>#{d.so} {d.name.split(':')[0]}</div>
                          <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{d.date}</span>
                            <span className={d.daysLeft <= 3 ? 'text-danger' : 'text-yellow'}>{d.daysLeft} days left</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionErrorBoundary>
            </div>
          )}
        </section>
      )}

      <div className="projects-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Active Projects</h2>
        <div className="sort-controls" style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn-sm ${sortBy === 'so' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSortBy('so'); setSortDesc(!sortDesc); }}
            title="Sort by SO Number"
          >
            <ArrowUpDown size={14} /> SO#
          </button>
          <button 
            className={`btn-sm ${sortBy === 'date' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSortBy('date'); setSortDesc(!sortDesc); }}
            title="Sort by Install Date"
          >
            <Calendar size={14} /> Date
          </button>
        </div>
      </div>

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
                <div className="project-card-layout">
                  <div className="project-card-main">
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

                    <div className="engineering-checks-controls">
                      <div className="eng-check-header">
                        <span className="eng-check-title">{t('myProjects.engineeringCheck', 'Engineering Time')}</span>
                      </div>
                      <div className="eng-check-buttons">
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
                      </div>
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

                  {/* ─── Notes Panel ───────────────────────────── */}
                  <div className="project-notes-panel">
                    <div className="notes-panel-header">
                      <span className="notes-panel-title">
                        <StickyNote size={14} />
                        {language === 'es' ? 'Notas' : 'Notes'}
                      </span>
                      {(projectNotes[project.so] || []).length > 0 && (
                        <span className="notes-panel-count">{(projectNotes[project.so] || []).length}</span>
                      )}
                    </div>

                    <div className="add-note-form">
                      <textarea
                        className="note-input"
                        placeholder={language === 'es' ? 'Agregar nota...' : 'Add note...'}
                        value={noteInputs[project.so]?.text || ''}
                        onChange={(e) => setNoteInputs(prev => ({
                          ...prev,
                          [project.so]: { ...prev[project.so], text: e.target.value }
                        }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddNote(project.so);
                          }
                        }}
                        rows={2}
                      />
                      <div className="note-actions-row">
                        <button
                          type="button"
                          className={`priority-toggle ${noteInputs[project.so]?.priority ? 'is-priority' : 'not-priority'}`}
                          onClick={() => setNoteInputs(prev => ({
                            ...prev,
                            [project.so]: { ...prev[project.so], priority: !prev[project.so]?.priority }
                          }))}
                        >
                          <Flag size={12} />
                          {noteInputs[project.so]?.priority 
                            ? (language === 'es' ? 'Prioritaria' : 'Priority')
                            : (language === 'es' ? 'Normal' : 'Normal')}
                        </button>
                        <button
                          className="btn-add-note"
                          onClick={() => handleAddNote(project.so)}
                          disabled={!noteInputs[project.so]?.text?.trim()}
                        >
                          <Plus size={14} />
                          {language === 'es' ? 'Agregar' : 'Add'}
                        </button>
                      </div>
                    </div>

                    {(projectNotes[project.so] || []).length === 0 ? (
                      <div className="notes-empty">
                        {language === 'es' ? 'Sin notas aún' : 'No notes yet'}
                      </div>
                    ) : (
                      <div className="notes-list">
                        {(projectNotes[project.so] || []).map(note => (
                          <div key={note.id} className="note-item">
                            <div className="note-item-header">
                              <span className={`note-priority-tag ${note.priority ? 'priority' : 'normal'}`}>
                                {note.priority 
                                  ? (language === 'es' ? '⚑ Prioritaria' : '⚑ Priority')
                                  : (language === 'es' ? 'Normal' : 'Normal')}
                              </span>
                              <button
                                className="note-delete-btn"
                                onClick={() => handleDeleteNote(project.so, note.id)}
                                title={language === 'es' ? 'Eliminar nota' : 'Delete note'}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="note-item-text">{note.text}</div>
                            <div className="note-item-date">
                              {new Date(note.createdAt).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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

