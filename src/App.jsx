import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchAndParseData, fetchAndParseProjectMaterials } from './utils/sheetParser'
import { fetchAndParseMasterSchedule } from './utils/masterSchedule'
import { getSharedProjectSo } from './utils/projectDeepLink'
import { getCachedData, setCachedData, isCacheFresh } from './utils/dbCache'
import { checkDbSizeAndArchive } from './utils/archiveHelpers'
import { archiveMissingCompletedProjects, archiveCurrentlyCompletedProjects, fetchArchivedCompletedProjects, purgeExpiredArchives } from './utils/completedProjectsArchive'
import { withArchiveLease } from './utils/archiveCoordinator'
import { invalidateArchiveCache } from './utils/archiveStore'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import ViewSkeleton from './components/ViewSkeleton'
import AssignDesignerGate from './components/AssignDesignerGate'
import IntroSplash from './components/IntroSplash'

/* Estaticas a proposito. Las tres primeras: son las unicas pantallas que
   pueden ser la primera (login, landing de ingenieria, landing de diseñador),
   asi que partirlas solo agregaria un round-trip antes del primer render util.
   CalendarView ademas es la que define, en su CSS, los primitivos compartidos
   de toda la app —.btn-primary/.btn-secondary, .form-input, .modal-overlay,
   .status-badge, .toggle-label—, que hoy llegan a las demas vistas solo porque
   este import es estatico. Mientras esas reglas no se muden a index.css, este
   archivo NO puede pasar a lazy sin dejar sin estilo al login, al Navbar y a
   todos los modales. */
import DashboardView from './views/DashboardView'
import PipelineView from './views/PipelineView'
import LoginView from './views/LoginView'
import CalendarView from './views/CalendarView'

/* El resto entra por code splitting: todo el bundle era un unico archivo de
   ~1.6 MB, asi que abrir el login descargaba tambien Designer Performance
   entera, el calendario y las tablas de admin. Cada una de estas vistas se
   pide recien cuando el usuario la abre; el <Suspense> de mas abajo muestra
   el skeleton mientras llega el chunk. */
const MaterialsView = lazy(() => import('./views/MaterialsView'))
const MyProjectsView = lazy(() => import('./views/MyProjectsView'))
const DesignQualityView = lazy(() => import('./views/DesignQualityView'))
const ProjectDetailView = lazy(() => import('./views/ProjectDetailView'))
const LogbookView = lazy(() => import('./views/LogbookView'))
const ChecklistView = lazy(() => import('./views/ChecklistView'))
const AdminUsersView = lazy(() => import('./views/AdminUsersView'))
const DesignerPerformanceApp = lazy(() => import('./designer-performance/App'))
import NotificationBubble from './components/NotificationBubble'
import ProjectChatbot from './components/ProjectChatbot'
import { useLanguage } from './utils/LanguageContext'
import { isSuperAdminRole } from './utils/adminConfig'
import { usePendingUsersCount } from './utils/usePendingUsersCount'
import { canManageDesignerNotes } from './utils/notePermissions'
import { noteDaysOpen } from './designer-performance/utils/redFlags'
import { auth, db, onAuthStateChanged, ref, onValue, set, get, child, signOut } from './utils/firebase'
import { shortProjectName } from './utils/projectName'
import { normalizeNotesBySo } from './utils/projectNotes'
import { recordStatusTransitions } from './utils/statusTransitions'
import { normalizeWeeklyHistory } from './utils/weeklyHistory'
import { pendingDesignerAssignments } from './utils/pendingDesignerAssignments'

// Lazy: the ESS tab pulls in pdfjs-dist (~1MB+) via essPdfExtract.js, and only
// super-admins can ever open it. A static import would put that in the main
// bundle every user downloads on first load.
const EssView = lazy(() => import('./views/EssView'));

function App() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState(() => {
    // Un link compartido (?so=12705) manda directo a Designer Perf., por encima
    // de la ultima pestana usada: el disenador lo abre para ver ese proyecto.
    if (getSharedProjectSo()) return 'designer-performance';
    return localStorage.getItem('active_tab') || 'dashboard';
  });
  const [projectNotes, setProjectNotes] = useState({});
  const [overrides, setOverrides] = useState({});
  const [materialOverrides, setMaterialOverrides] = useState(() => {
    const local = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('project_materials_')) {
        const so = key.replace('project_materials_', '');
        try {
          local[so] = JSON.parse(localStorage.getItem(key));
        } catch (e) {}
      }
    }
    return local;
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [weeklyHistory, setWeeklyHistory] = useState([]);
  const [focusedProjectSo, setFocusedProjectSo] = useState(null);
  const [projectDesigners, setProjectDesigners] = useState({});
  const [projectHistory, setProjectHistory] = useState({});
  const pendingUsersCount = usePendingUsersCount(userProfile?.role);

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const cached = await getCachedData();
      let dataToReturn = null;

      // A cache entry written before the `alerts` field existed on parsedData
      // lacks it entirely (not just empty) — serving that stale shape as-is
      // makes the Dashboard's action-required banners flicker in and out as
      // the 5-minute cache and 30s refetch interval alternate between this
      // stale cache and a live fetch. Treat a missing `alerts` key as stale
      // so it's re-fetched live instead of served as fresh.
      const cacheHasCurrentShape = cached?.parsedData && 'alerts' in cached.parsedData;

      if (cached && cacheHasCurrentShape && isCacheFresh(cached.timestamp)) {
        dataToReturn = cached.parsedData;
        // Fetch archived projects
        dataToReturn.archivedProjects = await fetchArchivedCompletedProjects();
      } else {
        try {
          // Unico punto donde el archivo se vuelve a leer de la red. El resto
          // del ciclo (y todos los ticks que pegan en el cache fresco) reusan
          // la copia en memoria de archiveStore, que se mantiene al dia sola
          // porque writeArchiveMap escribe de forma pasante. Ver el comentario
          // largo en archiveStore.js.
          invalidateArchiveCache();

          const [parsedData, projectMaterialsData] = await Promise.all([
            fetchAndParseData(),
            fetchAndParseProjectMaterials()
          ]);
          
          parsedData.projectSpecificMaterials = projectMaterialsData;

          // All archive writes go through a single-writer lease so concurrent
          // clients can't clobber each other's read-modify-write on the archive nodes.
          await withArchiveLease(async () => {
            if (cached && cached.parsedData) {
              await archiveMissingCompletedProjects(cached.parsedData, parsedData, projectDesigners);
            }
            await archiveCurrentlyCompletedProjects(parsedData, projectDesigners);
            // Dentro del lease a proposito: es el unico lock de escritura
            // compartido que hay, y sin el cada navegador abierto registraria
            // la misma transicion. Los designers no pueden escribir
            // project_history (ver database.rules.json), asi que se saltea.
            if (userProfile?.role !== 'designer') {
              await recordStatusTransitions(parsedData.priorityAnalysis || []);
            }
            await checkDbSizeAndArchive();
            await purgeExpiredArchives();
          }).catch(console.error);

          await setCachedData(parsedData);
          dataToReturn = parsedData;
          dataToReturn.archivedProjects = await fetchArchivedCompletedProjects();
        } catch (err) {
          if (cached) {
            console.warn('Fallback to expired cache due to fetch error', err);
            dataToReturn = cached.parsedData;
            dataToReturn.archivedProjects = await fetchArchivedCompletedProjects();
          } else {
            throw err;
          }
        }
      }
      return dataToReturn;
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Fuente de Designer Performance: la pestaña "Master Schedule Mirror", aguas
  // arriba del weekly KPI. Va en su propia query — no en el cache de
  // dashboardData — para no invalidar las entradas de cache ya guardadas.
  const { data: masterProjects } = useQuery({
    queryKey: ['masterSchedule'],
    queryFn: fetchAndParseMasterSchedule,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  // Save weekly snapshots to Firebase & load history
  // We save TWO snapshots per sheet update: one for 'previous week' and one for 'current week'
  //
  // Skip entirely for designers: database.rules.json denies designer writes
  // to weekly_history, so this used to fire a set() that always failed with
  // PERMISSION_DENIED for that role (silently swallowed by the catch below).
  useEffect(() => {
    if (!data || !db || userProfile?.role === 'designer') return;

    const saveAndLoadHistory = async () => {
      try {
        const prevLabel = data.weekLabels?.previous || 'Previous';
        const currLabel = data.weekLabels?.current || 'Current';

        // Helper: sanitize label for Firebase key (convert to lowercase for case-insensitivity)
        const toKey = (label) => label.toLowerCase().replace(/[.#$/\[\]]/g, '_').replace(/\s+/g, '_');

        // Save previous week snapshot (with 'previous' values)
        const prevKey = toKey(prevLabel);
        const prevRef = ref(db, `weekly_history/${prevKey}`);
        const prevSnap = await get(prevRef);
        if (!prevSnap.exists()) {
          const prevSnapshot = {
            label: prevLabel,
            savedAt: new Date().toISOString(),
            metrics: {}
          };
          data.weekOverWeek.forEach(m => {
            prevSnapshot.metrics[m.metric] = parseInt(m.previous, 10) || 0;
          });
          await set(prevRef, prevSnapshot);
          console.log(`📊 Saved weekly snapshot for: ${prevLabel}`);
        }

        // Save current week snapshot (with 'current' values)
        const currKey = toKey(currLabel);
        const currRef = ref(db, `weekly_history/${currKey}`);
        const currSnap = await get(currRef);
        if (!currSnap.exists()) {
          const currSnapshot = {
            label: currLabel,
            savedAt: new Date().toISOString(),
            metrics: {}
          };
          data.weekOverWeek.forEach(m => {
            currSnapshot.metrics[m.metric] = parseInt(m.current, 10) || 0;
          });
          await set(currRef, currSnapshot);
          console.log(`📊 Saved weekly snapshot for: ${currLabel}`);
        }

        // Load all historical snapshots
        const historyRef = ref(db, 'weekly_history');
        const historySnap = await get(historyRef);
        if (historySnap.exists()) {
          // Ordenar/deduplicar por la FECHA de la semana, no por el texto de la
          // etiqueta: eso colapsa "JULY 06, 2026" con "JULY 6, 2026" y descarta
          // los snapshots sin fecha ("Previous Week") que quedaron guardados de
          // una lectura fallida del sheet. Ver weeklyHistory.js.
          setWeeklyHistory(normalizeWeeklyHistory(historySnap.val(), 10));
        }
      } catch (err) {
        console.error('Error managing weekly history:', err);
      }
    };

    saveAndLoadHistory();
  }, [data, userProfile?.role]);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user && db) {
        const userRef = ref(db, `users/${user.uid}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.val());
          } else {
            setUserProfile(null);
          }
          setAuthLoading(false);
        });
      } else {
        setUserProfile(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!db) return;
    const overridesRef = ref(db, 'project_overrides');
    const unsubscribeOverrides = onValue(overridesRef, (snapshot) => {
      setOverrides(snapshot.val() || {});
    });

    // Normalizar aca deja a todos los consumidores viendo el mismo array de
    // siempre, sin importar si la nota se guardo con el formato viejo (array
    // indexado) o el nuevo (una clave por nota). Ver projectNotes.js.
    const notesRef = ref(db, 'project_notes');
    const unsubscribeNotes = onValue(notesRef, (snapshot) => {
      setProjectNotes(normalizeNotesBySo(snapshot.val()));
    });

    const matOverridesRef = ref(db, 'project_materials');
    const unsubscribeMatOverrides = onValue(matOverridesRef, (snapshot) => {
      setMaterialOverrides(snapshot.val() || {});
    });

    const designersRef = ref(db, 'project_designers');
    const unsubscribeDesigners = onValue(designersRef, (snapshot) => {
      setProjectDesigners(snapshot.val() || {});
    });

    // Transiciones de etapa realmente observadas por la app (ver
    // statusTransitions.js). El sheet solo trae UNA fecha por proyecto, la del
    // estado actual, asi que sin esto cualquier medicion entre dos etapas se
    // arma con fechas fabricadas. MyProjectsView ya lo leia para su timeline;
    // el Dashboard lo necesita para el promedio de CHECK -> NESTING.
    const historyRef = ref(db, 'project_history');
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      setProjectHistory(snapshot.val() || {});
    });

    return () => {
      unsubscribeOverrides();
      unsubscribeNotes();
      unsubscribeMatOverrides();
      unsubscribeDesigners();
      unsubscribeHistory();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab);
  }, [activeTab]);

  // Memoized so this only recomputes when one of its actual data sources
  // changes, instead of on every App render — an unmemoized version was
  // producing a new mergedData object (and therefore invalidating every
  // downstream useMemo/useEffect keyed on it, e.g. realAlerts below) on
  // renders unrelated to data at all (tab switches, modal toggles, etc).
  const mergedData = useMemo(() => {
    if (!data) return null;

    // The sheet parser keeps status history as a separate top-level array
    // (parsedData.statusHistory, { so, name, status, statusDate, history })
    // instead of nesting it onto each project — so project.statusHistory is
    // always undefined on active projects. calculateAutomaticStages then has
    // no dates to work with and falls back to "today" for every stage,
    // collapsing all of a project's stage timestamps onto the same date
    // (breaks the weekly-completions chart, which needs stages spread across
    // real weeks to draw anything but isolated points). Join it here, once,
    // centrally, the same way ProjectDetailView.jsx does for archived
    // projects' nested snapshot.statusHistory.
    const statusHistoryBySo = new Map();
    (data.statusHistory || []).forEach(h => {
      const so = String(h.so);
      if (!statusHistoryBySo.has(so)) statusHistoryBySo.set(so, []);
      statusHistoryBySo.get(so).push(h);
    });

    const mergedPriorityAnalysis = data.priorityAnalysis.map(p => {
      const override = overrides[p.so];
      const costData = data.topCostProjects?.find(cp => cp.name === p.name);

      let status = p.status;
      let onHoldReason = null;
      if (override) {
        status = override.status || p.status;
        onHoldReason = override.onHoldReason || null;
      }

      return {
        ...p,
        status,
        onHoldReason,
        designer: projectDesigners[p.so] || p.designer || '',
        totalAmt: costData ? costData.cost : '$0',
        statusHistory: statusHistoryBySo.get(String(p.so)) || []
      };
    });

    // Merge material matrix requirements
    const mergedMaterialRequirements = [...(data.materialRequirements || [])];
    const seenSos = new Set(mergedMaterialRequirements.map(m => String(m.so)));

    const updatedMaterialRequirements = mergedMaterialRequirements.map(m => {
      const override = materialOverrides[m.so];
      if (override) {
        return {
          ...m,
          thermofoil: override.thermofoil !== undefined ? override.thermofoil : m.thermofoil,
          noHoles: override.noHoles !== undefined ? override.noHoles : m.noHoles,
          dovetail: override.dovetail !== undefined ? override.dovetail : m.dovetail,
          element: override.element !== undefined ? override.element : m.element,
        };
      }
      return m;
    });

    Object.entries(materialOverrides).forEach(([so, override]) => {
      if (!seenSos.has(String(so))) {
        const project = mergedPriorityAnalysis?.find(p => String(p.so) === String(so));
        updatedMaterialRequirements.push({
          so: so,
          name: project ? project.name : `SO #${so}`,
          installDate: project ? (project.install || '') : '',
          thermofoil: override.thermofoil || 'No',
          noHoles: override.noHoles || 'No',
          dovetail: override.dovetail || 'No',
          element: override.element || 'No'
        });
      }
    });

    return {
      ...data,
      priorityAnalysis: mergedPriorityAnalysis,
      materialRequirements: updatedMaterialRequirements
    };
  }, [data, overrides, projectDesigners, materialOverrides]);

  // Build real-time alerts from actual project data
  const realAlerts = useMemo(() => {
    if (!mergedData || !userProfile?.designerName) return [];
    const alerts = [];
    const projects = mergedData.priorityAnalysis || [];

    if (isSuperAdminRole(userProfile.role) && pendingUsersCount > 0) {
      alerts.push({
        type: 'admin_request',
        text: language === 'es'
          ? (pendingUsersCount === 1
            ? 'Hay 1 solicitud de cuenta pendiente de aprobación'
            : `Hay ${pendingUsersCount} solicitudes de cuenta pendientes de aprobación`)
          : (pendingUsersCount === 1
            ? '1 account request pending approval'
            : `${pendingUsersCount} account requests pending approval`)
      });
    }
    const myDesignerName = userProfile.designerName.trim().toLowerCase();
    const isGlobalRole = userProfile.role === 'engineer_nester' || userProfile.role === 'administrative' || userProfile.role === 'admin';

    // Warn about every project currently ON HOLD under this user's name
    const onHoldProjects = projects.filter(p => {
      if (p.status !== 'ON HOLD') return false;
      if (isGlobalRole) return true;
      return p.eng && p.eng.trim().toLowerCase() === myDesignerName;
    });
    onHoldProjects.forEach(p => {
      const reason = p.onHoldReason ? ` — ${p.onHoldReason}` : '';
      alerts.push({
        so: p.so,
        type: 'warning',
        text: language === 'es'
          ? `SO #${p.so} "${shortProjectName(p.name)}" está ON HOLD${reason}`
          : `SO #${p.so} "${shortProjectName(p.name)}" is ON HOLD${reason}`
      });
    });

    // Warn about installations in the next 14 days under this user's name
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in14Days = new Date(today);
    in14Days.setDate(today.getDate() + 14);
    
    // Process new notes and installations, and clean up readNotes for COMPLETED/CANCELLED
    let readNotesUpdates = {};
    let hasReadNotesUpdates = false;

    projects.forEach(p => {
      // Raw sheet status text isn't guaranteed uppercase (sheet has e.g.
      // "Completed"); every other status comparison in this codebase
      // normalizes with .toUpperCase() (see stageUtils.js, PipelineView.jsx)
      // before comparing to constants like this — do the same here.
      const statusUpper = (p.status || '').toUpperCase();
      const isCompletedOrCancelled = statusUpper === 'COMPLETED' || statusUpper === 'CANCELLED';

      // Cleanup readNotes for completed/cancelled projects. Note: this only
      // clears this user's own "last read" marker — it must NEVER delete
      // project_notes itself. Completed Projects is meant to preserve a
      // project's full My Projects history (notes included), so notes stay
      // in RTDB indefinitely and remain visible on that project's detail
      // page even after it's archived.
      if (isCompletedOrCancelled && userProfile.readNotes && userProfile.readNotes[p.so]) {
        readNotesUpdates[p.so] = null; // Mark for deletion
        hasReadNotesUpdates = true;
      }

      // Check if user should see alerts for this project
      let belongsToMe = false;
      if (isGlobalRole) {
        belongsToMe = true;
      } else {
        belongsToMe = p.eng && p.eng.trim().toLowerCase() === myDesignerName;
      }

      if (!belongsToMe) return;

      const notes = projectNotes[p.so] || [];

      // 2. Urgent installs logic
      if (!isCompletedOrCancelled && p.status !== 'ON HOLD' && p.install) {
        const d = new Date(p.install);
        if (!isNaN(d) && d >= today && d <= in14Days) {
          const diffTime = d - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          alerts.push({
            so: p.so,
            type: 'urgent',
            text: language === 'es'
              ? `¡Urgente! SO #${p.so} tiene instalación en ${diffDays} día${diffDays === 1 ? '' : 's'}: ${shortProjectName(p.name)}`
              : `Urgent! SO #${p.so} installs in ${diffDays} day${diffDays === 1 ? '' : 's'}: ${shortProjectName(p.name)}`
          });
        }
      }

      // 3. Unread Notes logic
      if (!isCompletedOrCancelled) {
        const lastReadTimestamp = userProfile.readNotes ? userProfile.readNotes[p.so] : null;
        
        let unreadCount = 0;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        notes.forEach(note => {
          const noteDate = new Date(note.timestamp);
          
          // Ignore notes from the current user
          const isMyNote = note.author && (
            note.author.trim().toLowerCase() === myDesignerName || 
            note.author.trim().toLowerCase() === userProfile.email.toLowerCase()
          );

          if (!isMyNote) {
            if (lastReadTimestamp) {
              if (noteDate > new Date(lastReadTimestamp)) {
                unreadCount++;
              }
            } else {
              // If no last read timestamp, only count notes from the last 7 days to avoid spam
              if (noteDate > sevenDaysAgo) {
                unreadCount++;
              }
            }
          }
        });

        if (unreadCount > 0) {
          alerts.push({
            so: p.so,
            type: 'note',
            text: language === 'es'
              ? `SO #${p.so}: ${unreadCount} nota${unreadCount > 1 ? 's' : ''} nueva${unreadCount > 1 ? 's' : ''} en ${shortProjectName(p.name)}`
              : `SO #${p.so}: ${unreadCount} new note${unreadCount > 1 ? 's' : ''} on ${shortProjectName(p.name)}`
          });
        }
      }

      // 4. Notas "Designer" sin resolver — cada día que quedan abiertas le
      // restan puntos al KPI de Fase 2 del diseñador (ver redFlags.ts), así
      // que quien puede gestionarlas (roles de ingeniería) recibe un
      // recordatorio en cada apertura de la app hasta que la resuelva o
      // confirme si el diseñador realmente pidió ese cambio.
      if (!isCompletedOrCancelled && canManageDesignerNotes(userProfile)) {
        const unresolvedDesignerNotes = notes.filter(n => {
          const effectiveType = n.noteType || (n.priority ? 'priority' : 'normal');
          return effectiveType === 'designer' && !n.resolvedAt;
        });
        if (unresolvedDesignerNotes.length > 0) {
          const maxDays = Math.max(...unresolvedDesignerNotes.map(n => noteDaysOpen(n, Date.now())));
          const count = unresolvedDesignerNotes.length;
          alerts.push({
            so: p.so,
            type: 'designer_review',
            text: language === 'es'
              ? (count === 1
                ? `SO #${p.so} "${shortProjectName(p.name)}": revisar nota Designer (${maxDays} día${maxDays === 1 ? '' : 's'} abierta) — ¿lo solicitó el diseñador?`
                : `SO #${p.so} "${shortProjectName(p.name)}": ${count} notas Designer sin revisar (hasta ${maxDays} días abiertas)`)
              : (count === 1
                ? `SO #${p.so} "${shortProjectName(p.name)}": review Designer note (open ${maxDays} day${maxDays === 1 ? '' : 's'}) — did the designer request it?`
                : `SO #${p.so} "${shortProjectName(p.name)}": ${count} Designer notes to review (up to ${maxDays} days open)`)
          });
        }
      }
    });

    // Fire and forget readNotes cleanup
    if (hasReadNotesUpdates && currentUser && db) {
      // Small timeout to avoid state loops during render
      setTimeout(() => {
        Object.keys(readNotesUpdates).forEach(so => {
          const refPath = `users/${currentUser.uid}/readNotes/${so}`;
          set(ref(db, refPath), null);
        });
      }, 100);
    }

    return alerts;
  }, [mergedData, userProfile, projectNotes, currentUser, pendingUsersCount, language]);

  const renderView = () => {
    // Standalone shareable project detail page (intentionally public/read-only —
    // no auth required, bypasses the gate below)
    const urlParams = new URLSearchParams(window.location.search);
    const projectSoParam = urlParams.get('project');
    if (projectSoParam) {
      if (loading || authLoading) return <ViewSkeleton />;
      return (
        <ProjectDetailView
          data={mergedData}
          projectNotes={projectNotes}
          projectDesigners={projectDesigners}
          overrides={overrides}
        />
      );
    }

    if (loading || authLoading) return <ViewSkeleton />;
    if (error) return <div className="error-state">Error: {error}</div>;

    if (!currentUser) {
      return <LoginView data={data} />;
    }

    if (userProfile?.status !== 'approved' && !isSuperAdminRole(userProfile?.role)) {
      return (
        <div className="loading-state pending-approval-state">
          <h2>{t('common.pendingApprovalTitle')}</h2>
          <p>{t('common.pendingApprovalBody')}</p>
          <button className="btn-secondary" onClick={() => signOut(auth)}>{t('common.signOut')}</button>
        </div>
      );
    }

    // Standalone Logbook / Bitácora editor page — write-capable, so it sits
    // behind the same auth/approval gate as the rest of the app (unlike the
    // read-only ProjectDetailView above).
    const logbookSoParam = urlParams.get('logbook');
    if (logbookSoParam) {
      return <LogbookView so={logbookSoParam} />;
    }

    // Standalone Engineering Checklist page — same access level as Logbook
    // (write-capable, behind the same auth/approval gate).
    const checklistSoParam = urlParams.get('checklist');
    if (checklistSoParam) {
      return <ChecklistView so={checklistSoParam} />;
    }

    const isDesigner = userProfile?.role === 'designer';

    // Redirect designer away from restricted tabs
    if (isDesigner && !['pipeline', 'calendar', 'designer-performance'].includes(activeTab)) {
      setTimeout(() => setActiveTab('pipeline'), 0);
      return <div className="loading-state"><Loader2 size={20} className="animate-spin" /> Loading...</div>;
    }

    switch (activeTab) {
      case 'dashboard':
        return isDesigner ? null : <DashboardView data={mergedData} weeklyHistory={weeklyHistory} projectHistory={projectHistory} />;
      case 'calendar': return <CalendarView data={mergedData} currentUser={currentUser} userProfile={userProfile} />;
      case 'my-projects':
        return isDesigner ? null : <MyProjectsView data={mergedData} currentUser={currentUser} userProfile={userProfile} setActiveTab={setActiveTab} setFocusedProjectSo={setFocusedProjectSo} focusedProjectSo={focusedProjectSo} clearFocusedProjectSo={() => setFocusedProjectSo(null)} />;
      case 'pipeline': return <PipelineView data={mergedData} currentUser={currentUser} userProfile={userProfile} focusedProjectSo={focusedProjectSo} clearFocusedProjectSo={() => setFocusedProjectSo(null)} />;
      case 'materials':
        return isDesigner ? null : <MaterialsView data={mergedData} />;
      case 'quality': 
        if (userProfile?.role === 'administrative') {
          return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} projectHistory={projectHistory} />;
        }
        return isDesigner ? null : <DesignQualityView data={mergedData} />;
      case 'designer-performance':
        return <DesignerPerformanceApp data={mergedData} projectDesigners={projectDesigners} userProfile={userProfile} currentUser={currentUser} masterProjects={masterProjects} />;
      case 'admin':
        return isSuperAdminRole(userProfile?.role) ? <AdminUsersView userProfile={userProfile} data={mergedData} masterProjects={masterProjects} /> : <DashboardView data={mergedData} weeklyHistory={weeklyHistory} projectHistory={projectHistory} />;
      case 'ess':
        return isSuperAdminRole(userProfile?.role) ? (
          <Suspense fallback={<div className="loading-state"><Loader2 size={20} className="animate-spin" /> Loading...</div>}>
            <EssView data={mergedData} />
          </Suspense>
        ) : <DashboardView data={mergedData} weeklyHistory={weeklyHistory} projectHistory={projectHistory} />;
      default: return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} projectHistory={projectHistory} />;
    }
  };

  /* Proyectos propios que llegaron del sheet sin disenador registrado. Toda la
     decision de a quien bloquear vive en pendingDesignerAssignments; aca solo
     se pregunta si la cola tiene algo. Alcanza con `data` en vez de
     `mergedData`: lo unico que hace falta es la columna ENG del sheet. */
  const designerAssignmentQueue = useMemo(
    () => pendingDesignerAssignments({
      userProfile,
      projects: data?.priorityAnalysis,
      projectDesigners,
    }),
    [userProfile, data?.priorityAnalysis, projectDesigners],
  );

  /* Re-lee antes de escribir, igual que el modal "Disenador a Cargo" de
     MyProjectsView: project_designers/{so} tambien se escribe desde Designer
     Perf., y dos personas asignando a la vez se pisarian en silencio. Si otro
     ya lo asigno mientras este gate estaba abierto se respeta ese valor y el
     proyecto sale de la cola igual: no hay nada que corregir. */
  const assignDesigner = async (so, designerName) => {
    if (!db) return { error: 'No database connection.' };
    try {
      const designerRef = ref(db, `project_designers/${so}`);
      const snapshot = await get(designerRef);
      if (snapshot.exists() && String(snapshot.val()).trim()) return {};
      await set(designerRef, designerName);
      return {};
    } catch (err) {
      console.error('No se pudo asignar el disenador:', err);
      return {
        error: language === 'es'
          ? 'No se pudo guardar. Revisá tu conexión e intentá de nuevo.'
          : 'Could not save. Check your connection and try again.',
      };
    }
  };

  const isApproved = userProfile?.status === 'approved';
  const isSuperAdmin = isSuperAdminRole(userProfile?.role);

  return (
    <div className="app-container">
      {showSplash && <IntroSplash onDone={() => setShowSplash(false)} />}
      {(!loading && !authLoading && currentUser && (isApproved || isSuperAdmin)) && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userProfile={userProfile}
          isSuperAdmin={isSuperAdmin}
          pendingUsersCount={pendingUsersCount}
        />
      )}
      <main className={`main-content ${(!currentUser || !(isApproved || isSuperAdmin)) ? 'no-sidebar' : ''}`}>
        <ErrorBoundary>
          {/* El ErrorBoundary queda por fuera a proposito: si falla la
              descarga de un chunk, React la propaga como error de render y
              tiene que atraparla el boundary, no el fallback. */}
          <Suspense fallback={<ViewSkeleton />}>
            {renderView()}
          </Suspense>
        </ErrorBoundary>
      </main>
      {currentUser && (isApproved || isSuperAdmin) && (
        <ProjectChatbot
          projects={mergedData?.priorityAnalysis}
          materialsMatrix={mergedData?.materialsMatrix}
          currentUser={currentUser}
          userProfile={userProfile}
        />
      )}
      <NotificationBubble
        alerts={realAlerts}
        onAlertClick={(alert) => {
          if (alert.type === 'admin_request') {
            setActiveTab('admin');
            return;
          }
          if (alert.type === 'note' && currentUser && db) {
            // Update read timestamp to dismiss the notification
            const refPath = `users/${currentUser.uid}/readNotes/${alert.so}`;
            set(ref(db, refPath), new Date().toISOString());
          }
          setFocusedProjectSo(alert.so);
          // Las notas Designer se resuelven desde My Projects (ahi estan los
          // controles para marcarlas resueltas y cambiarles el tipo); Pipeline
          // solo las muestra. Las demas alertas siguen yendo a Pipeline.
          setActiveTab(alert.type === 'designer_review' ? 'my-projects' : 'pipeline');
        }}
      />
      {/* Ultimo hijo a proposito: gate bloqueante por encima de todo, incluidos
          el FAB del chat y la campana. Solo se monta con la sesion ya resuelta
          y con permiso para operar, para no pisar al gate de aprobacion de
          cuenta. Mismo criterio que el Navbar: (isApproved || isSuperAdmin),
          porque el super admin entra sin pasar por la aprobacion, y con solo
          isApproved este gate no se le mostraba nunca. */}
      {!loading && !authLoading && currentUser && (isApproved || isSuperAdmin) && designerAssignmentQueue.length > 0 && (
        <AssignDesignerGate
          pending={designerAssignmentQueue}
          onAssign={assignDesigner}
          onSignOut={() => signOut(auth)}
        />
      )}
    </div>
  )
}

export default App
