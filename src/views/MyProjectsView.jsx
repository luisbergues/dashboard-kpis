import React, { useState, useEffect } from 'react';
import { db, ref, set, onValue, get, child } from '../utils/firebase';
import { saveEngineeringCheck } from '../utils/engineeringCheck';
import { sendOnHoldEvent, sendReleaseHoldEvent, sendQAChecklistEvent, sendNoteEvent, sendStageStatusOnlyEvent } from '../utils/sheetSync';
import { saveMaterialOverride } from '../utils/materialOverrides';
import { jsPDF } from 'jspdf';
import { useLanguage } from '../utils/LanguageContext';
import {
  Briefcase, Calendar, Check, Clock,
  AlertCircle, Download, ToggleLeft, ToggleRight, X, Info, StickyNote, Plus, Trash2, Flag, Users, User,
  ChevronDown, ChevronUp, ArrowUpDown, TrendingUp, CheckCircle2, Image as ImageIcon, Loader2, FileText, Paperclip,
  LayoutGrid, NotebookPen
} from 'lucide-react';
import { compressImage, uploadNoteAttachment } from '../services/imageService';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip as ChartTooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { calculateWeeklyCompletions, getUpcomingDeadlines } from '../services/kpiCalculator';
import SectionErrorBoundary from '../components/SectionErrorBoundary';
import PDFGeneratorModal from '../components/PDFGeneratorModal';
import IPGeneratorModal from '../components/IPGeneratorModal';
import CompletedProjectsModal from '../components/CompletedProjectsModal';
import { cleanupESSData } from '../utils/essData';
import { cleanupIPData } from '../utils/ipData';
import { cleanupLogbookData } from '../utils/logbookData';
import { calculateAutomaticStages, STAGES } from '../utils/stageUtils';
import { useTheme } from '../utils/ThemeContext';
import './MyProjectsView.css';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, ChartTooltip, Legend, Filler);

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


export default function MyProjectsView({ data, currentUser, userProfile, setActiveTab, setFocusedProjectSo }) {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  if (!data) return null;

  const { priorityAnalysis, onHoldNotes } = data;

  const DEFAULT_DESIGNERS = ['Joaquin', 'Jose', 'Luis', 'Santiago', 'Julieta', 'Andres', 'Delfina', 'Josema'];
  const [allowedDesigners, setAllowedDesigners] = useState(DEFAULT_DESIGNERS);
  const [designersList, setDesignersList] = useState([]);

  // Fetch allowed designers from Firebase
  useEffect(() => {
    if (!db) return;
    const designersRef = ref(db, 'allowed_designers');
    const unsubscribe = onValue(designersRef, (snapshot) => {
      const dbVal = snapshot.val();
      if (dbVal) {
        let namesArray = [];
        if (Array.isArray(dbVal)) {
          namesArray = dbVal.filter(Boolean);
        } else if (typeof dbVal === 'object') {
          namesArray = Object.values(dbVal).filter(Boolean);
        }
        setAllowedDesigners(namesArray);
      }
    });
    return () => unsubscribe();
  }, []);

  // Merge spreadsheet designers and allowed/Firebase designers
  useEffect(() => {
    const uniqueEngs = new Set();
    allowedDesigners.forEach(name => {
      if (name && name.trim() !== '') uniqueEngs.add(name.trim());
    });
    if (priorityAnalysis) {
      priorityAnalysis.forEach(p => {
        if (p.eng && p.eng.trim() !== '') {
          uniqueEngs.add(p.eng.trim());
        }
      });
    }
    setDesignersList(Array.from(uniqueEngs).sort());
  }, [priorityAnalysis, allowedDesigners]);

  const [projectStages, setProjectStages] = useState({});
  const [projectOverrides, setProjectOverrides] = useState({});
  const [projectHistory, setProjectHistory] = useState({});
  const [engineeringChecks, setEngineeringChecks] = useState({});
  const [nestingChecks, setNestingChecks] = useState({});
  const [materialOverrides, setMaterialOverrides] = useState({});
  const [kanbanState, setKanbanState] = useState({});
  // Manual within-column order set by nesters dragging cards in the Pipeline
  // Kanban board: { [columnId]: [so, so, ...] }. See PipelineView.jsx.
  const [kanbanOrder, setKanbanOrder] = useState({});
  const [projectDesigners, setProjectDesigners] = useState({});
  const [loading, setLoading] = useState(true);

  // Project Notes State
  const [projectNotes, setProjectNotes] = useState({});
  const [noteInputs, setNoteInputs] = useState({}); // { [so]: { text: '', noteType: 'normal' } }
  const [noteImages, setNoteImages] = useState({}); // { [so]: File }
  const [isUploadingImage, setIsUploadingImage] = useState({}); // { [so]: boolean }

  // Hold Modal State
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [activeProjectSo, setActiveProjectSo] = useState(null);
  const [holdReason, setHoldReason] = useState('');

  // Collaborators State
  const [projectCollaborators, setProjectCollaborators] = useState({});
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [activeCollabProjectSo, setActiveCollabProjectSo] = useState(null);
  const [collabSearchTerm, setCollabSearchTerm] = useState('');

  // Designer Modal State
  const [isDesignerModalOpen, setIsDesignerModalOpen] = useState(false);
  const [activeDesignerProjectSo, setActiveDesignerProjectSo] = useState(null);
  const [designerSearchTerm, setDesignerSearchTerm] = useState('');

  // ESS Modal State
  const [isESSModalOpen, setIsESSModalOpen] = useState(false);
  const [activeESSProject, setActiveESSProject] = useState(null);

  // IP Modal State
  const [isIPModalOpen, setIsIPModalOpen] = useState(false);
  const [activeIPProject, setActiveIPProject] = useState(null);

  // Completed Projects Modal State
  const [isCompletedProjectsModalOpen, setIsCompletedProjectsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // Analytics & Sorting State
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [sortBy, setSortBy] = useState('date');
  const [sortDesc, setSortDesc] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState({});

  const toggleCollapse = (so) => {
    setExpandedProjects(prev => ({ ...prev, [so]: !prev[so] }));
  };

  const getOnHoldNote = (projectName) => {
    if (!onHoldNotes) return null;
    const note = onHoldNotes.find(n => projectName.includes(n.project) || n.project.includes(projectName));
    return note ? note.notes : null;
  };

  // Filter projects where eng matches the logged in designer (bypass if role is administrative, admin, or engineer_nester)
  const myProjectsRaw = priorityAnalysis.filter(p => {
    if (!userProfile) return false;
    if (userProfile.role === 'administrative' || userProfile.role === 'admin' || userProfile.role === 'engineer_nester') {
      return true;
    }
    return p.eng && p.eng.trim().toLowerCase() === userProfile.designerName.trim().toLowerCase();
  });

  const myArchivedProjects = (data.archivedProjects || []).filter(p => {
    if (!userProfile) return false;
    if (userProfile.role === 'administrative' || userProfile.role === 'admin' || userProfile.role === 'engineer_nester') {
      return true;
    }
    return p.eng && p.eng.trim().toLowerCase() === userProfile.designerName.trim().toLowerCase();
  });

  // Some Priority Analysis rows carry a placeholder like "SO #12480" in the
  // Name column instead of the real project name (e.g. a test/incomplete
  // sheet row). Cross-reference other sheet sections keyed by the same SO —
  // Material Requirements and Status History — which independently carry
  // their own Name column and are more likely to have the real value.
  const isPlaceholderName = (so, name) => {
    if (!name || !name.trim()) return true;
    return name.trim().toLowerCase() === `so #${so}`.toLowerCase();
  };

  const resolveProjectName = (p) => {
    if (!isPlaceholderName(p.so, p.name)) return p.name;
    const fromMaterials = (data.materialRequirements || [])
      .find(m => String(m.so) === String(p.so) && !isPlaceholderName(m.so, m.name));
    if (fromMaterials) return fromMaterials.name;
    const fromHistory = (data.statusHistory || [])
      .find(h => String(h.so) === String(p.so) && !isPlaceholderName(h.so, h.name));
    if (fromHistory) return fromHistory.name;
    return p.name;
  };

  // "Completed Projects" should show every finished project: ones already removed
  // from the sheet (myArchivedProjects, from Firestore) AND ones still sitting in
  // the sheet with status Completed (myProjectsRaw) that haven't been removed yet.
  const myCompletedProjects = [
    ...myProjectsRaw.filter(p => p.status && p.status.toLowerCase() === 'completed'),
    ...myArchivedProjects,
  ]
    .filter((p, idx, arr) => arr.findIndex(x => x.so === p.so) === idx)
    .map(p => ({ ...p, name: resolveProjectName(p) }));

  // Only projects still present in the active sheet (priorityAnalysis) exist in
  // Pipeline's data — archived ones were already removed from the sheet, so
  // there's nothing to open/highlight there.
  const activeProjectSos = new Set(priorityAnalysis.map(p => String(p.so)));

  const isAdmin = userProfile && (userProfile.role === 'administrative' || userProfile.role === 'admin');

  // Kanban priority order: must mirror Pipeline's KANBAN_COLUMNS order exactly
  // (Procurement → Material → Nesting → Projects) so this sort reproduces the
  // same left-to-right column order as the Kanban board in Pipeline.
  const KANBAN_ORDER = { procurement: 0, material: 1, nesting: 2, projects: 3 };

  const myProjects = [...myProjectsRaw]
    .sort((a, b) => {
      const dateA = a.install ? new Date(a.install).getTime() : null;
      const dateB = b.install ? new Date(b.install).getTime() : null;

      if (sortBy === 'kanban') {
        const columnA = kanbanState[a.so] || 'projects';
        const columnB = kanbanState[b.so] || 'projects';
        const kanbanA = KANBAN_ORDER[columnA] ?? 2;
        const kanbanB = KANBAN_ORDER[columnB] ?? 2;
        if (kanbanA !== kanbanB) return kanbanA - kanbanB;

        // Same column: respect the nester's manual drag order from Pipeline
        // (project_kanban_order) — this is the single source of truth for
        // "Kanban order", not a locally re-derived date sort. Projects not
        // yet in the saved order fall back to install date, same as Pipeline.
        if (columnA === columnB) {
          const savedOrder = kanbanOrder[columnA];
          if (savedOrder && savedOrder.length > 0) {
            const savedIndex = new Map(savedOrder.map((so, i) => [String(so), i]));
            const idxA = savedIndex.has(String(a.so)) ? savedIndex.get(String(a.so)) : Infinity;
            const idxB = savedIndex.has(String(b.so)) ? savedIndex.get(String(b.so)) : Infinity;
            if (idxA !== idxB) return idxA - idxB;
          }
        }
      }

      // Tie-break (or default "Date" mode): install date ascending, no-date last
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return sortBy === 'date' && sortDesc ? dateB - dateA : dateA - dateB;
    });

  // Calculate analytics
  // We no longer need to track projectStages manually, we derive it.
  const derivedProjectStages = React.useMemo(() => {
    const obj = {};
    const allProj = [...myProjectsRaw, ...myArchivedProjects];
    allProj.forEach(p => {
      obj[p.so] = calculateAutomaticStages(p);
    });
    return obj;
  }, [myProjectsRaw, myArchivedProjects]);

  const weeklyData = calculateWeeklyCompletions(derivedProjectStages, [...myProjectsRaw, ...myArchivedProjects]);
  const upcomingDeadlines = getUpcomingDeadlines(myProjectsRaw);

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: theme === 'light' ? '#374151' : '#94A3B8' } },
      tooltip: {
        backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(11, 21, 32, 0.95)',
        titleColor: theme === 'light' ? '#10B981' : '#80EE98',
        bodyColor: theme === 'light' ? '#111827' : '#fff',
        borderColor: theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: { ticks: { color: theme === 'light' ? '#374151' : '#94A3B8' }, grid: { display: false } },
      y: {
        ticks: { color: theme === 'light' ? '#374151' : '#94A3B8', precision: 0 },
        grid: { color: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(148,163,184,0.2)' }
      }
    }
  };

  // Cleanup ESS & IP data for completed projects
  useEffect(() => {
    if (data && data.activeProjects) {
      const activeSOs = data.activeProjects.map(p => p.so);
      cleanupESSData(activeSOs);
      cleanupIPData(activeSOs);
      cleanupLogbookData(activeSOs);
    }
  }, [data]);

  // Listen to stage progress, overrides, and history in Realtime Database
  useEffect(() => {
    if (!db || !currentUser) {
      // Local storage fallback initialization
      const localStages = {};
      const localOverrides = {};
      const localHistory = {};
      const localEngineeringChecks = {};
      const localNotes = {};
      const localCollabs = {};
      const localNestingChecks = {};
      const localMaterialOverrides = {};
      
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

          const savedCollabs = localStorage.getItem(`project_collabs_${p.so}`);
          localCollabs[p.so] = savedCollabs ? JSON.parse(savedCollabs) : [];

          const savedNestingCheck = localStorage.getItem(`nesting_check_${p.so}`);
          localNestingChecks[p.so] = savedNestingCheck ? JSON.parse(savedNestingCheck) : {};

          const savedMatOverride = localStorage.getItem(`project_materials_${p.so}`);
          localMaterialOverrides[p.so] = savedMatOverride ? JSON.parse(savedMatOverride) : {};
        } catch (e) {
          localStages[p.so] = Array(STAGES.length).fill(false);
          localOverrides[p.so] = null;
          localHistory[p.so] = [];
          localEngineeringChecks[p.so] = {};
          localNotes[p.so] = [];
          localCollabs[p.so] = [];
          localNestingChecks[p.so] = {};
          localMaterialOverrides[p.so] = {};
        }
      });
      setProjectStages(localStages);
      setProjectOverrides(localOverrides);
      setProjectHistory(localHistory);
      setEngineeringChecks(localEngineeringChecks);
      setNestingChecks(localNestingChecks);
      setProjectNotes(localNotes);
      setProjectCollaborators(localCollabs);
      setMaterialOverrides(localMaterialOverrides);
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

    // Load Nesting Checks
    const nestingChecksRef = ref(db, 'nesting_checks');
    const unsubscribeNestingChecks = onValue(nestingChecksRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setNestingChecks(dbData);
    });

    // Load Project Notes
    const notesRef = ref(db, 'project_notes');
    const unsubscribeNotes = onValue(notesRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setProjectNotes(dbData);
    });

    // Load Project Collaborators
    const collabsRef = ref(db, 'project_collaborators');
    const unsubscribeCollabs = onValue(collabsRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setProjectCollaborators(dbData);
    });

    // Load Project Designers
    const designersRef = ref(db, 'project_designers');
    const unsubscribeDesigners = onValue(designersRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setProjectDesigners(dbData);
    });

    // Load Project Materials Overrides
    const matOverridesRef = ref(db, 'project_materials');
    const unsubscribeMatOverrides = onValue(matOverridesRef, (snapshot) => {
      const dbData = snapshot.val() || {};
      setMaterialOverrides(dbData);
    });

    // Load Kanban state
    const kanbanRef = ref(db, 'project_kanban_state');
    const unsubscribeKanban = onValue(kanbanRef, (snapshot) => {
      setKanbanState(snapshot.val() || {});
    });

    // Load Kanban manual within-column order (set by nesters in Pipeline)
    const kanbanOrderRef = ref(db, 'project_kanban_order');
    const unsubscribeKanbanOrder = onValue(kanbanOrderRef, (snapshot) => {
      setKanbanOrder(snapshot.val() || {});
    });

    return () => {
      unsubscribeStages();
      unsubscribeOverrides();
      unsubscribeHistory();
      unsubscribeEngChecks();
      unsubscribeNestingChecks();
      unsubscribeNotes();
      unsubscribeCollabs();
      unsubscribeDesigners();
      unsubscribeMatOverrides();
      unsubscribeKanban();
      unsubscribeKanbanOrder();
    };
  }, [currentUser, userProfile]);

  // Removed: handleEngineeringStart and handleEngineeringFinish moved to PipelineView

  // QA CNC Checklist Modal State
  const [isQAModalOpen, setIsQAModalOpen] = useState(false);
  const [qaPendingAction, setQAPendingAction] = useState(null); // { so, stageIndex }
  const [qaType, setQAType] = useState(''); // 'engineering', 'ess_ip', 'final'
  const [qaChecks, setQAChecks] = useState({});

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  // toggleStage removed as timeline is now automatic

  const handleScroll = (e) => {
    const target = e.target;
    // Check if user scrolled to the bottom (within 10 pixels margin of error)
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
      setHasScrolledToBottom(true);
    }
  };

  const handleQASubmit = async (e) => {
    e.preventDefault();

    if (!hasScrolledToBottom) {
      alert(language === 'es' ? 'Debes leer el checklist hasta el final para poder habilitar la aprobación.' : 'You must read the checklist to the bottom to enable approval.');
      return;
    }

    if (qaPendingAction) {
      const { so, stageIndex } = qaPendingAction;
      const timestamp = new Date().toISOString();
      const userName = userProfile?.designerName || currentUser?.email || 'Unknown User';

      const qaLog = {
        checkedBy: userName,
        timestamp,
        type: qaType,
        checks: qaChecks
      };

      if (db && currentUser) {
        try {
          await set(ref(db, `project_qa_checklist/${so}/${STAGES[stageIndex].id}`), qaLog);
        } catch (err) {
          console.error('Failed to save QA log to Firebase:', err);
        }
      } else {
        localStorage.setItem(`project_qa_${so}_${STAGES[stageIndex].id}`, JSON.stringify(qaLog));
      }

      // 📡 Notificar a n8n → Google Sheets
      sendQAChecklistEvent(so, STAGES[stageIndex].id, qaType, qaLog.checkedBy);
    }

    setIsQAModalOpen(false);
    setQAPendingAction(null);
    setQAType('');
    setHasScrolledToBottom(false);
  };

  const getProjectMaterials = (so) => {
    const override = materialOverrides[so];
    const sheetItem = data.materialRequirements?.find(m => String(m.so) === String(so));
    
    return {
      thermofoil: (override?.thermofoil !== undefined) ? override.thermofoil : (sheetItem?.thermofoil || 'No'),
      noHoles: (override?.noHoles !== undefined) ? override.noHoles : (sheetItem?.noHoles || 'No'),
      dovetail: (override?.dovetail !== undefined) ? override.dovetail : (sheetItem?.dovetail || 'No'),
      element: (override?.element !== undefined) ? override.element : (sheetItem?.element || 'No'),
      ordered: (override?.ordered !== undefined) ? override.ordered : (sheetItem?.ordered || 'No'),
      procurement: (override?.procurement !== undefined) ? override.procurement : (sheetItem?.procurement || 'No')
    };
  };

  // Clicking any step in the My Projects stages timeline changes ONLY the
  // STATUS column (N) in the 'copy testing' Google Sheet tab. Date columns
  // (J/K/L/M) are exclusively written by Pipeline's Start Check buttons
  // (sendStageEvent, still in PipelineView.jsx) — the two views intentionally
  // own different columns for the same underlying stage.
  const handleStageStepClick = (so, stageId) => {
    const stageLabelEs = {
      ingenieria: 'Ingeniería', check1: 'Eng. Check', paperwork: 'Paperwork',
      check2: 'PW Check', nesting: 'Nesting',
    }[stageId];
    const stageLabelEn = {
      ingenieria: 'Engineering', check1: 'Eng. Check', paperwork: 'Paperwork',
      check2: 'PW Check', nesting: 'Nesting',
    }[stageId];
    if (!stageLabelEs) return;
    const confirmMsg = language === 'es'
      ? `¿Marcar este proyecto como "${stageLabelEs}"?`
      : `Mark this project as "${stageLabelEn}"?`;
    if (!window.confirm(confirmMsg)) return;
    sendStageStatusOnlyEvent(so, stageId);
  };

  const handleToggleMaterial = async (so, key) => {
    const current = getProjectMaterials(so);
    const updated = {
      ...current,
      [key]: current[key] === 'Yes' ? 'No' : 'Yes',
      updatedBy: userProfile?.designerName || currentUser?.email || 'Engineer',
      updatedAt: new Date().toISOString()
    };
    
    await saveMaterialOverride(so, updated);
    
    setMaterialOverrides(prev => ({
      ...prev,
      [so]: updated
    }));

    // Auto-move Kanban card from Procurement to Material if procurement is marked done
    if (key === 'procurement' && updated.procurement === 'Yes' && kanbanState[so] === 'procurement') {
      if (db) {
        try {
          await set(ref(db, `project_kanban_state/${so}`), 'material');
        } catch (error) {
          console.error("Error moving Kanban card to material:", error);
        }
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

    // 📡 Notificar a n8n → Google Sheets
    const projectData = priorityAnalysis?.find(p => String(p.so) === String(activeProjectSo));
    const changedBy = userProfile?.designerName || currentUser?.email || 'Unknown';
    sendOnHoldEvent(projectData || { so: activeProjectSo }, holdReason, changedBy);
    // Además enviar como observación (obs) para que se sume a la columna OBS / ACCESSORIES / NOTES
    sendNoteEvent(activeProjectSo, `ON HOLD: ${holdReason}`, changedBy, projectData || { so: activeProjectSo }, 'obs');

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

    // 📡 Notificar a n8n → Google Sheets
    const projectData = priorityAnalysis?.find(p => String(p.so) === String(so));
    const changedBy = userProfile?.designerName || currentUser?.email || 'Unknown';
    sendReleaseHoldEvent(projectData || { so }, changedBy);
    // Además enviar como observación (obs) para que quede registro
    sendNoteEvent(so, `HOLD RELEASED`, changedBy, projectData || { so }, 'obs');
  };

  const handleAddNote = async (so) => {
    if (userProfile && (userProfile.role === 'administrative' || userProfile.role === 'admin')) {
      return;
    }
    const input = noteInputs[so];
    const files = noteImages[so] || [];
    
    if ((!input || !input.text?.trim()) && files.length === 0) return;

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
      text: input?.text?.trim() || '',
      noteType: input?.noteType || 'normal',
      priority: input?.noteType === 'priority', // Backward compatibility para UI
      createdAt: new Date().toISOString(),
      createdBy: userName
    };

    if (attachments.length > 0) {
      newNote.attachments = attachments;
    }

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

    // 📡 Notificar a n8n → Google Sheets (columna Obs/Notes) solo si es 'obs'
    if (newNote.noteType === 'obs') {
      const project = priorityAnalysis?.find(p => String(p.so) === String(so));
      sendNoteEvent(so, newNote.text, newNote.createdBy, project || {}, 'obs');
    }

    setNoteInputs(prev => ({ ...prev, [so]: { text: '', noteType: 'normal' } }));
    setNoteImages(prev => ({ ...prev, [so]: null }));
    setIsUploadingImage(prev => ({ ...prev, [so]: false }));
  };

  const handleDeleteNote = async (so, noteId) => {
    if (userProfile && (userProfile.role === 'administrative' || userProfile.role === 'admin')) {
      return;
    }
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

  const handleOpenCollabModal = (so) => {
    setActiveCollabProjectSo(so);
    setCollabSearchTerm('');
    setIsCollabModalOpen(true);
  };

  const handleOpenDesignerModal = (so) => {
    setActiveDesignerProjectSo(so);
    setDesignerSearchTerm(projectDesigners[so] || '');
    setIsDesignerModalOpen(true);
  };

  const handleSaveDesigner = async (e) => {
    e.preventDefault();
    if (!designerSearchTerm || !activeDesignerProjectSo) return;
    
    try {
      await set(ref(db, `project_designers/${activeDesignerProjectSo}`), designerSearchTerm);
      setIsDesignerModalOpen(false);
      setDesignerSearchTerm('');
      setActiveDesignerProjectSo(null);
    } catch (err) {
      console.error('Error saving designer:', err);
    }
  };

  const handleAddCollab = async (e) => {
    e.preventDefault();
    if (!collabSearchTerm.trim() || !activeCollabProjectSo) return;
    
    const newName = collabSearchTerm.trim();
    const current = projectCollaborators[activeCollabProjectSo] ? [...projectCollaborators[activeCollabProjectSo]] : [];
    if (current.includes(newName)) {
      setCollabSearchTerm('');
      return; // Prevent duplicates
    }
    
    current.push(newName);
    
    if (db && currentUser) {
      try {
        await set(ref(db, `project_collaborators/${activeCollabProjectSo}`), current);
      } catch (err) {
        console.error('Failed to add collab to Firebase:', err);
      }
    } else {
      localStorage.setItem(`project_collabs_${activeCollabProjectSo}`, JSON.stringify(current));
      setProjectCollaborators(prev => ({ ...prev, [activeCollabProjectSo]: current }));
    }
    
    setCollabSearchTerm('');
  };

  const handleRemoveCollab = async (so, nameToRemove) => {
    const current = projectCollaborators[so] ? [...projectCollaborators[so]] : [];
    const updated = current.filter(n => n !== nameToRemove);
    
    if (db && currentUser) {
      try {
        await set(ref(db, `project_collaborators/${so}`), updated.length > 0 ? updated : null);
      } catch (err) {
        console.error('Failed to remove collab from Firebase:', err);
      }
    } else {
      localStorage.setItem(`project_collabs_${so}`, JSON.stringify(updated));
      setProjectCollaborators(prev => ({ ...prev, [so]: updated }));
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
    const stages = calculateAutomaticStages(project);

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
    const currentStatus = project.status;
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
      
      if (engCheck.user) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`(${language === 'es' ? 'Por' : 'By'}: ${engCheck.user})`, 75, currentY);
      }

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

    // Add Nesting Checks to PDF
    const nestingCheck = nestingChecks[project.so];
    if (nestingCheck && (nestingCheck.started || nestingCheck.finished)) {
      currentY += 5;
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(18, 33, 48);
      doc.setFontSize(12);
      doc.text(language === 'es' ? 'Tiempos de Nesting' : 'Nesting Times', 15, currentY);
      
      if (nestingCheck.user) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`(${language === 'es' ? 'Por' : 'By'}: ${nestingCheck.user})`, 75, currentY);
      }

      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      if (nestingCheck.started) {
        doc.text(`Start: ${new Date(nestingCheck.started).toLocaleString()}`, 15, currentY);
        currentY += 5;
      }
      if (nestingCheck.finished) {
        doc.text(`Finish: ${new Date(nestingCheck.finished).toLocaleString()}`, 15, currentY);
        currentY += 5;
      }
    }

    // --- Section 2: Historial de Pausas (Holds Log) ---
    currentY += 10;
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
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

    // --- Section 3: Notas del Proyecto (Project Notes) ---
    const notes = projectNotes[project.so] || [];
    if (notes.length > 0) {
      currentY += 15;
      
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setTextColor(18, 33, 48);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(language === 'es' ? '3. Notas del Proyecto' : '3. Project Notes', 15, currentY);

      // Line separator
      currentY += 3;
      doc.setDrawColor(9, 209, 199); // Cyan
      doc.line(15, currentY, 195, currentY);
      currentY += 10;

      notes.forEach((note, index) => {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        const dateStr = new Date(note.createdAt).toLocaleString(language === 'es' ? 'es-AR' : 'en-US');
        const authorStr = note.createdBy ? ` | By: ${note.createdBy}` : '';
        const priorityTag = note.priority ? (language === 'es' ? ' [PRIORITARIA]' : ' [PRIORITY]') : '';

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(18, 33, 48);
        doc.text(`${dateStr}${authorStr}${priorityTag}`, 15, currentY);

        currentY += 5;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        const wrappedText = doc.splitTextToSize(note.text, 180);
        doc.text(wrappedText, 15, currentY);

        currentY += (wrappedText.length * 5) + 5;
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
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="view-header-title">
          <h1 className="page-title">{t('myProjects.title')}</h1>
          <p className="text-muted">
            {t('myProjects.subtitle')}
          </p>
        </div>
        <button
          className="btn-primary btn-sm"
          onClick={() => setIsCompletedProjectsModalOpen(true)}
          style={{ background: 'var(--color-cyan)', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginRight: '90px' }}
        >
          <CheckCircle2 size={14} />
          <span>Completed Projects</span>
        </button>
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
            <div className="projects-analytics-grid">
              <SectionErrorBoundary title="Weekly Output Error">
                <div className="analytics-card">
                  <h4 className="chart-subtitle" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>Projects Completed (Weekly)</h4>
                  <div style={{ height: '220px' }}>
                    {weeklyData.labels.length > 0 ? (
                      <Line data={weeklyData} options={lineOptions} />
                    ) : (
                      <div className="text-muted" style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>No completed projects yet</div>
                    )}
                  </div>
                </div>
              </SectionErrorBoundary>

              <SectionErrorBoundary title="Deadlines Error">
                <div className="analytics-card deadlines-card" style={{ background: 'var(--bg-deep)', padding: '16px', borderRadius: '8px', overflowY: 'auto', maxHeight: '260px', border: '1px solid var(--card-border)' }}>
                  <h4 className="chart-subtitle" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} className="text-yellow" />
                    Upcoming Install Deadlines
                  </h4>
                  {upcomingDeadlines.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>No critical deadlines in the next 14 days.</p>
                  ) : (
                    <div className="deadlines-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {upcomingDeadlines.map(d => (
                        <div key={d.so} className="deadline-item" style={{ background: 'var(--card-bg)', padding: '10px', borderRadius: '6px', borderLeft: d.daysLeft <= 3 ? '3px solid var(--color-pink)' : '3px solid #FFE600' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>#{d.so} {d.name.split(':')[0]}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
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

      <div className="projects-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Active Projects</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn-sm ${sortBy === 'date' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSortBy('date'); setSortDesc(prev => sortBy === 'date' ? !prev : false); }}
            title="Sort by Install Date"
          >
            <Calendar size={14} /> Date {sortBy === 'date' ? (sortDesc ? '↓' : '↑') : ''}
          </button>
          <button
            className={`btn-sm ${sortBy === 'kanban' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSortBy('kanban')}
            title={language === 'es' ? 'Ordenar por prioridad: Procurement → Material → Projects' : 'Sort by priority: Procurement → Material → Projects'}
          >
            <LayoutGrid size={14} /> Kanban
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
            const progress = calculateAutomaticStages(project);
            const percent = calculateProgress(progress);
            // project.status/onHoldReason already reflect project_overrides —
            // App.jsx's getMergedData() merges them in before this view ever
            // sees the data, so Pipeline/Dashboard/My Projects all agree.
            const currentStatus = project.status;
            const currentReason = project.onHoldReason || getOnHoldNote(project.name);
            const isCollapsed = !expandedProjects[project.so];

            return (
              <div key={project.so} className={`project-card glass-card ${isCollapsed ? '' : 'is-expanded'}`} style={{ paddingBottom: isCollapsed ? '12px' : '24px' }}>
                <div className="project-card-layout">
                  <div className="project-card-main">
                    <div className="card-header-main" onClick={() => toggleCollapse(project.so)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <a
                          href={`${window.location.origin}${window.location.pathname}?project=${project.so}`}
                          target="_blank"
                          rel="noreferrer"
                          className="project-so"
                          onClick={e => e.stopPropagation()}
                          style={{ textDecoration: 'none', cursor: 'pointer' }}
                        >SO #{project.so}</a>
                        <h3 className="project-name-title" style={{ margin: 0 }}>{project.name.split(':')[0].trim()}</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="header-status-controls" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`status-badge-inline ${currentStatus.toLowerCase().replace(' ', '-')}`}>
                            {getStatusLabelPdf(currentStatus)}
                          </span>
                          {userProfile && (userProfile.role === 'engineer_nester' || userProfile.role === 'admin' || userProfile.role === 'administrative') && (
                            <button 
                              onClick={() => handleToggleMaterial(project.so, 'ordered')}
                              className={`btn-hold-toggle ${getProjectMaterials(project.so).ordered === 'Yes' ? 'active-material' : ''}`}
                              title={getProjectMaterials(project.so).ordered === 'Yes' ? 'Material Ordered' : 'Material Not Ordered'}
                            >
                              {getProjectMaterials(project.so).ordered === 'Yes' ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                              <span>Material</span>
                            </button>
                          )}
                          {/* Nester-only: procurement is a nester responsibility, not part of
                              the super admin's role, so it's hidden there too even though
                              engineer-admin technically has write access via Firebase rules. */}
                          {userProfile && userProfile.role === 'engineer_nester' && (
                            <button
                              onClick={() => handleToggleMaterial(project.so, 'procurement')}
                              className={`btn-hold-toggle ${getProjectMaterials(project.so).procurement === 'Yes' ? 'active-procurement' : ''}`}
                              title={getProjectMaterials(project.so).procurement === 'Yes' ? 'Procurement Done' : 'Procurement Pending'}
                            >
                              {getProjectMaterials(project.so).procurement === 'Yes' ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                              <span>Procurement</span>
                            </button>
                          )}
                          <button 
                            onClick={() => handleHoldToggle(project.so, currentStatus)}
                            className={`btn-hold-toggle ${currentStatus === 'ON HOLD' ? 'active-hold' : ''}`}
                            title={currentStatus === 'ON HOLD' ? t('myProjects.releaseHold') : t('myProjects.pauseProject')}
                          >
                            {currentStatus === 'ON HOLD' ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                            <span>On Hold</span>
                          </button>
                          <button
                            onClick={() => handleOpenCollabModal(project.so)}
                            className="btn-hold-toggle collab-btn"
                            title={language === 'es' ? 'Colaboradores' : 'Collaborators'}
                          >
                            <Users size={16} />
                            <span>{(projectCollaborators[project.so] || []).length}</span>
                          </button>
                          <button
                            onClick={() => handleOpenDesignerModal(project.so)}
                            className="btn-hold-toggle collab-btn"
                            title={language === 'es' ? 'Diseñador a Cargo' : 'Designer in Charge'}
                          >
                            <User size={16} />
                            <span style={{ maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {projectDesigners[project.so] || (language === 'es' ? 'Ninguno' : 'None')}
                            </span>
                          </button>
                        </div>
                        <span style={{ color: '#64748B', marginLeft: '8px', fontSize: '0.85rem' }}>{isCollapsed ? '▼' : '▲'}</span>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <>
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
                            const isClickable = stage.id !== 'install';
                            const nextStageData = progress[idx + 1];
                            const isNextCompleted = nextStageData && nextStageData.completed;
                            return (
                              <div
                                key={stage.id}
                                className={`stage-step ${isCompleted ? 'completed' : ''} ${isClickable ? 'clickable' : ''}`}
                                onClick={isClickable ? () => handleStageStepClick(project.so, stage.id) : undefined}
                                role={isClickable ? 'button' : undefined}
                                title={isClickable ? (language === 'es' ? 'Click para marcar este stage' : 'Click to mark this stage') : undefined}
                                style={isClickable ? { cursor: 'pointer' } : undefined}
                              >
                                {idx < STAGES.length - 1 && (
                                  <div className={`stage-connector-line ${isCompleted && isNextCompleted ? 'filled' : ''}`}></div>
                                )}
                                <div className="stage-icon-container">
                                  {isCompleted ? (
                                    <Check size={16} className="icon-completed" />
                                  ) : (
                                    <span className="stage-number">{idx + 1}</span>
                                  )}
                                </div>
                                <span className="stage-step-label">{getStageLabel(stage.id, language)}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="project-materials-section">
                          <h4 className="project-section-title">
                            {language === 'es' ? 'Elementos de Proyecto' : 'Project Elements'}
                          </h4>
                          <div className="materials-grid">
                            {['thermofoil', 'dovetail', 'element'].map((key) => {
                              const materials = getProjectMaterials(project.so);
                              const isChecked = materials[key] === 'Yes';
                              const label = t(`materials.headers.${key}`);
                              return (
                                <button
                                  key={key}
                                  className={`material-toggle-btn ${isChecked ? 'active' : ''}`}
                                  onClick={() => handleToggleMaterial(project.so, key)}
                                  type="button"
                                >
                                  <div className="checkbox-indicator">
                                    {isChecked && <Check size={12} />}
                                  </div>
                                  <span>{label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {data.projectSpecificMaterials && data.projectSpecificMaterials[project.so] && data.projectSpecificMaterials[project.so].length > 0 && (
                          <div className="project-materials-section" style={{ marginTop: '4px' }}>
                            <h4 className="project-section-title">
                              {language === 'es' ? 'Materiales' : 'Materials'}
                            </h4>
                            <div className="materials-grid">
                              {data.projectSpecificMaterials[project.so].flatMap((mat, idx) => {
                                const parts = mat.material ? mat.material.split(',').map(s => s.trim()).filter(Boolean) : [];
                                return parts.map((part, partIdx) => (
                                  <span key={`${idx}-${partIdx}`} className="material-toggle-btn material-pill-static">
                                    {part}
                                    {mat.quantity && <span style={{ opacity: 0.6 }}>({mat.quantity})</span>}
                                    {mat.urgency === '⚠️' && <span title="Urgent">⚠️</span>}
                                  </span>
                                ));
                              })}
                            </div>
                          </div>
                        )}

                        <div className="card-footer-actions" style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => generatePDF(project)}
                            className="btn-secondary btn-sm btn-download-pdf"
                          >
                            <Download size={14} />
                            <span>{t('myProjects.downloadPdf')}</span>
                          </button>
                          <button 
                            onClick={() => { setActiveESSProject(project); setIsESSModalOpen(true); }}
                            className="btn-primary btn-sm btn-download-pdf"
                            style={{ background: 'var(--color-cyan)', color: '#fff', fontWeight: 'bold' }}
                          >
                            <StickyNote size={14} />
                            <span>{t('myProjects.completarESS')}</span>
                          </button>
                          <button
                            onClick={() => { setActiveIPProject(project); setIsIPModalOpen(true); }}
                            className="btn-primary btn-sm btn-download-pdf"
                            style={{ background: '#80EE98', color: '#fff', fontWeight: 'bold' }}
                          >
                            <StickyNote size={14} />
                            <span>{t('myProjects.completarIP')}</span>
                          </button>
                          <a
                            href={`${window.location.origin}${window.location.pathname}?logbook=${project.so}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="btn-primary btn-sm btn-download-pdf"
                            style={{ background: '#F5A623', color: '#fff', fontWeight: 'bold', textDecoration: 'none' }}
                          >
                            <NotebookPen size={14} />
                            <span>{t('myProjects.logbook')}</span>
                          </a>
                        </div>
                      </>
                    )}
                  </div>

                  {!isCollapsed && (
                    /* ─── Notes Panel ───────────────────────────── */
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

                      {!isAdmin && (
                        <div className="add-note-form">
                          {noteImages[project.so] && noteImages[project.so].length > 0 && (
                            <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {noteImages[project.so].map((file, idx) => (
                                <div key={idx} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px', border: '1px solid var(--card-border)', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                                  {file.type.startsWith('image/') ? (
                                    <img 
                                      src={URL.createObjectURL(file)} 
                                      alt="Preview" 
                                      style={{ height: '60px', borderRadius: '4px', objectFit: 'cover' }} 
                                    />
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px', color: '#94A3B8' }}>
                                      <FileText size={24} />
                                      <span style={{ fontSize: '0.8rem', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.name}
                                      </span>
                                    </div>
                                  )}
                                  <button 
                                    type="button"
                                    onClick={() => setNoteImages(prev => ({ ...prev, [project.so]: prev[project.so].filter((_, i) => i !== idx) }))}
                                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#EF4444', color: '#fff', borderRadius: '50%', border: 'none', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <textarea
                            className="note-input"
                            name={`myProjectsNote-${project.so}`}
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
                            disabled={isUploadingImage[project.so]}
                          />
                          <div className="note-actions-row">
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className={`priority-toggle ${noteInputs[project.so]?.noteType === 'priority' ? 'is-priority' : noteInputs[project.so]?.noteType === 'obs' ? 'is-obs' : 'not-priority'}`}
                                onClick={() => setNoteInputs(prev => {
                                  const currentType = prev[project.so]?.noteType || 'normal';
                                  const nextType = currentType === 'normal' ? 'priority' : currentType === 'priority' ? 'obs' : 'normal';
                                  return {
                                    ...prev,
                                    [project.so]: { ...prev[project.so], noteType: nextType }
                                  };
                                })}
                                disabled={isUploadingImage[project.so]}
                              >
                                <Flag size={12} />
                                {noteInputs[project.so]?.noteType === 'priority' 
                                  ? (language === 'es' ? 'Prioritaria' : 'Priority')
                                  : noteInputs[project.so]?.noteType === 'obs'
                                    ? (language === 'es' ? 'Observación' : 'Obs')
                                    : (language === 'es' ? 'Normal' : 'Normal')}
                              </button>
                              
                              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', color: '#94A3B8' }} title={language === 'es' ? 'Adjuntar Imagen o Documento (Máx 1MB)' : 'Attach Image or Document (Max 1MB)'}>
                                <Paperclip size={14} />
                                <input
                                  type="file"
                                  name={`myProjectsAttachments-${project.so}`}
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
                            </div>

                            <button
                              className="btn-add-note"
                              onClick={() => handleAddNote(project.so)}
                              disabled={(!noteInputs[project.so]?.text?.trim() && (!noteImages[project.so] || noteImages[project.so].length === 0)) || isUploadingImage[project.so]}
                              style={{ opacity: isUploadingImage[project.so] ? 0.7 : 1 }}
                            >
                              {isUploadingImage[project.so] ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                              {language === 'es' ? 'Agregar' : 'Add'}
                            </button>
                          </div>
                        </div>
                      )}

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
                                {note.createdBy && project.eng && note.createdBy.toLowerCase() !== project.eng.toLowerCase() && (
                                  <span className="note-author" style={{ fontSize: '0.72rem', color: '#09D1C7', marginLeft: '6px', fontWeight: 'bold' }}>
                                    | By {note.createdBy}
                                  </span>
                                )}
                                {!isAdmin && (
                                  <button
                                    className="note-delete-btn"
                                    onClick={() => handleDeleteNote(project.so, note.id)}
                                    title={language === 'es' ? 'Eliminar nota' : 'Delete note'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                              <div className="note-item-text">{note.text}</div>
                              {(() => {
                                const atts = note.attachments ? [...note.attachments] : [];
                                if (note.imageUrl) {
                                  atts.push({ url: note.imageUrl, type: note.attachmentType || 'image', name: note.attachmentName });
                                }
                                if (atts.length === 0) return null;
                                return (
                                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {atts.map((att, i) => (
                                      <div key={i} style={{ textDecoration: 'none' }}>
                                        {att.type === 'document' ? (
                                          <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: '#09D1C7', border: '1px solid rgba(9,209,199,0.2)' }}>
                                              <FileText size={16} />
                                              <span style={{ fontSize: '0.85rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {att.name || 'Document'}
                                              </span>
                                            </div>
                                          </a>
                                        ) : (
                                          <div onClick={() => setSelectedImage(att.url)} style={{ cursor: 'pointer' }}>
                                            <img src={att.url} alt="Note attachment" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--card-border)', objectFit: 'cover' }} />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              <div className="note-item-date">
                                {note.createdBy && <span style={{ marginRight: '8px', fontWeight: 'bold' }}>{note.createdBy} &bull;</span>}
                                {new Date(note.createdAt).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
                                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                  name="holdReason"
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

      {/* Designer Modal */}
      {isDesignerModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDesignerModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{language === 'es' ? 'Diseñador a Cargo' : 'Designer in Charge'}</h3>
              <button className="modal-close-btn" onClick={() => setIsDesignerModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <form onSubmit={handleSaveDesigner} className="collab-add-form" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <select
                  name="designerSearchTerm"
                  value={designerSearchTerm}
                  onChange={(e) => setDesignerSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="" disabled>{language === 'es' ? 'Seleccionar diseñador...' : 'Select designer...'}</option>
                  {[
                    "Monica Gabriel", "Natalie Ball", "Marsha Diquez", "Iris Lopes", 
                    "Kat Baumgartner", "Melissa Barker", "Nicole Dugan", "Tricia Hatton", 
                    "Blerta Veseli", "Lana Kravtchenko", "Krisztina Vizi", "Luana Tamagnone", 
                    "Russell Reiner", "Mauricio Dasso", "Sarah Manev", "Caryn Henslovitz", 
                    "Michael Kaboskey", "Malanie Dalfrey"
                  ].sort().map(name => (
                    <option key={name} value={name} style={{ color: '#000' }}>{name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-primary" disabled={!designerSearchTerm.trim()} style={{ padding: '0 16px' }}>
                  <Plus size={16} /> {language === 'es' ? 'Guardar' : 'Save'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Collaborators Modal */}
      {isCollabModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCollabModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{language === 'es' ? 'Colaboradores del Proyecto' : 'Project Collaborators'}</h3>
              <button className="modal-close-btn" onClick={() => setIsCollabModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <form onSubmit={handleAddCollab} className="collab-add-form" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <select
                  name="collabSearchTerm"
                  value={collabSearchTerm}
                  onChange={(e) => setCollabSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="" disabled>{language === 'es' ? 'Seleccionar ingeniero...' : 'Select engineer...'}</option>
                  {designersList.map(name => (
                    <option key={name} value={name} style={{ color: '#000' }}>{name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-primary" disabled={!collabSearchTerm.trim()} style={{ padding: '0 16px' }}>
                  <Plus size={16} /> {language === 'es' ? 'Añadir' : 'Add'}
                </button>
              </form>
              
              <div className="collabs-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {(projectCollaborators[activeCollabProjectSo] || []).length === 0 ? (
                  <p className="text-muted text-center" style={{ fontStyle: 'italic', padding: '20px 0' }}>
                    {language === 'es' ? 'No hay colaboradores aún.' : 'No collaborators yet.'}
                  </p>
                ) : (
                  <ul className="collab-items" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(projectCollaborators[activeCollabProjectSo] || []).map((collab, idx) => (
                      <li key={idx} className="collab-item glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderRadius: '8px' }}>
                        <div className="collab-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(9, 209, 199, 0.15)', color: 'var(--color-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={16} />
                          </div>
                          <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{collab}</span>
                        </div>
                        <button 
                          onClick={() => handleRemoveCollab(activeCollabProjectSo, collab)}
                          title={language === 'es' ? 'Eliminar' : 'Remove'}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'all 0.2s' }}
                          onMouseOver={(e) => { e.currentTarget.style.color = '#FF3B30'; e.currentTarget.style.background = 'rgba(255,59,48,0.1)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* QA Checklist Modal for Nesting/Install */}
      {isQAModalOpen && qaType && (
        <div className="modal-overlay" onClick={() => { setIsQAModalOpen(false); setQAPendingAction(null); setQAType(''); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px' }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#80EE98' }}>
                <CheckCircle2 size={20} />
                {qaType === 'engineering' && (language === 'es' ? '🛠️ 1. Checklist de Ingeniería' : '🛠️ 1. Engineering Checklist')}
                {qaType === 'ess_ip' && (language === 'es' ? '📄 2. Checklist Eng Shop Sheet (ESS) / Installer Packet (IP)' : '📄 2. Eng Shop Sheet (ESS) / Installer Packet (IP)')}
                {qaType === 'final' && (language === 'es' ? '🏁 3. Final Checklist' : '🏁 3. Final Checklist')}
              </h3>
              <button className="modal-close-btn" onClick={() => { setIsQAModalOpen(false); setQAPendingAction(null); setQAType(''); }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleQASubmit} className="modal-form" style={{ paddingTop: '20px' }}>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
                {language === 'es' 
                  ? 'Completa todas las validaciones obligatorias antes de avanzar la etapa del proyecto.' 
                  : 'Complete all mandatory validations before moving this project stage forward.'}
              </p>

              <div 
                onScroll={handleScroll}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '12px', background: 'rgba(0,0,0,0.1)' }}
              >
                {(t(`myProjects.checklists.${qaType}`) || []).map((item, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', color: '#fff', fontSize: '0.92rem', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                         onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                         onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}>
                    <input
                      type="checkbox"
                      name={`qaCheck-${qaType}-${idx}`}
                      checked={!!qaChecks[idx]}
                      onChange={(e) => setQAChecks(prev => ({ ...prev, [idx]: e.target.checked }))}
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer', accentColor: '#09D1C7', flexShrink: 0 }}
                    />
                    <span style={{ lineHeight: '1.4' }}>{item}</span>
                  </label>
                ))}
              </div>

              <div className="form-actions" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                <div className="form-actions-right" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span className="text-muted" style={{ fontSize: '0.82rem', marginRight: 'auto' }}>
                    {!hasScrolledToBottom 
                      ? (language === 'es' ? '⬇️ Desplázate al final para habilitar' : '⬇️ Scroll to bottom to enable')
                      : (language === 'es' ? '✅ Leído. Puedes aprobar' : '✅ Read. Ready to approve')}
                  </span>
                  <button 
                    type="button" 
                    className="btn-secondary"
                    onClick={() => { setIsQAModalOpen(false); setQAPendingAction(null); setQAType(''); }}
                    style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={!hasScrolledToBottom}
                    style={{ 
                      padding: '10px 16px', 
                      borderRadius: '8px', 
                      background: hasScrolledToBottom ? 'var(--color-cyan)' : 'rgba(255,255,255,0.05)', 
                      color: hasScrolledToBottom ? '#0B1520' : '#64748B',
                      border: 'none',
                      fontWeight: 'bold',
                      cursor: hasScrolledToBottom ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {language === 'es' ? 'Aprobar Pase' : 'Approve Release'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESS PDF Generator Modal */}
      {isESSModalOpen && activeESSProject && (
        <PDFGeneratorModal 
          project={activeESSProject}
          materials={getProjectMaterials(activeESSProject.so)}
          onClose={() => { setIsESSModalOpen(false); setActiveESSProject(null); }} 
        />
      )}

      {/* IP PDF Generator Modal */}
      {isIPModalOpen && activeIPProject && (
        <IPGeneratorModal 
          project={{ ...activeIPProject, designer: projectDesigners[activeIPProject.so] || '' }} 
          onClose={() => { setIsIPModalOpen(false); setActiveIPProject(null); }} 
        />
      )}

      {/* Completed Projects Modal */}
      {isCompletedProjectsModalOpen && (
        <CompletedProjectsModal
          projects={myCompletedProjects}
          activeProjectSos={activeProjectSos}
          onClose={() => setIsCompletedProjectsModalOpen(false)}
        />
      )}

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
    </div>
  );
}

