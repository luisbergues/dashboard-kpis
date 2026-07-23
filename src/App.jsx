import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAndParseData, fetchAndParseProjectMaterials } from './utils/sheetParser'
import { getCachedData, setCachedData, isCacheFresh } from './utils/dbCache'
import { checkDbSizeAndArchive } from './utils/archiveHelpers'
import { archiveMissingCompletedProjects, archiveCurrentlyCompletedProjects, fetchArchivedCompletedProjects, purgeExpiredArchives } from './utils/completedProjectsArchive'
import { withArchiveLease } from './utils/archiveCoordinator'
import Navbar from './components/Navbar'
import DashboardView from './views/DashboardView'
import PipelineView from './views/PipelineView'
import MaterialsView from './views/MaterialsView'
import CalendarView from './views/CalendarView'
import LoginView from './views/LoginView'
import MyProjectsView from './views/MyProjectsView'
import DesignQualityView from './views/DesignQualityView'
import ProjectDetailView from './views/ProjectDetailView'
import LogbookView from './views/LogbookView'
import ChecklistView from './views/ChecklistView'
import DesignerPerformanceApp from './designer-performance/App'
import ErrorBoundary from './components/ErrorBoundary'
import NotificationBubble from './components/NotificationBubble'
import ProjectChatbot from './components/ProjectChatbot'
import AdminUsersView from './views/AdminUsersView'
import { useLanguage } from './utils/LanguageContext'
import { isSuperAdminRole } from './utils/adminConfig'
import { usePendingUsersCount } from './utils/usePendingUsersCount'
import { auth, db, onAuthStateChanged, ref, onValue, set, get, child, signOut } from './utils/firebase'
import { shortProjectName } from './utils/projectName'

function App() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(() => {
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
  const [weeklyHistory, setWeeklyHistory] = useState([]);
  const [focusedProjectSo, setFocusedProjectSo] = useState(null);
  const [projectDesigners, setProjectDesigners] = useState({});
  const pendingUsersCount = usePendingUsersCount(userProfile?.role);

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const cached = await getCachedData();
      let dataToReturn = null;
      
      if (cached && isCacheFresh(cached.timestamp)) {
        dataToReturn = cached.parsedData;
        // Fetch archived projects
        dataToReturn.archivedProjects = await fetchArchivedCompletedProjects();
      } else {
        try {
          const [parsedData, projectMaterialsData] = await Promise.all([
            fetchAndParseData(),
            fetchAndParseProjectMaterials()
          ]);
          
          parsedData.projectSpecificMaterials = projectMaterialsData;

          // All archive writes go through a single-writer lease so concurrent
          // clients can't clobber each other's read-modify-write on the archive nodes.
          await withArchiveLease(async () => {
            if (cached && cached.parsedData) {
              await archiveMissingCompletedProjects(cached.parsedData, parsedData);
            }
            await archiveCurrentlyCompletedProjects(parsedData);
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
          const allWeeks = historySnap.val();
          const weeksArray = Object.entries(allWeeks).map(([key, val]) => ({
            key,
            ...val
          }));

          // Sort chronologically by parsing the label date
          weeksArray.sort((a, b) => {
            const dateA = new Date(a.label);
            const dateB = new Date(b.label);
            if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
            return a.key.localeCompare(b.key);
          });

          // Deduplicate by normalized label to ensure unique weeks
          const uniqueWeeks = [];
          const seenLabels = new Set();
          for (const week of weeksArray) {
            const normalizedLabel = week.label.toLowerCase().trim();
            if (!seenLabels.has(normalizedLabel)) {
              seenLabels.add(normalizedLabel);
              uniqueWeeks.push(week);
            } else {
              const existingIndex = uniqueWeeks.findIndex(w => w.label.toLowerCase().trim() === normalizedLabel);
              const existingWeek = uniqueWeeks[existingIndex];
              const existingHasNested = existingWeek.metrics && Object.values(existingWeek.metrics).some(v => typeof v === 'object' && v !== null);
              const currentHasNested = week.metrics && Object.values(week.metrics).some(v => typeof v === 'object' && v !== null);
              
              // Replace existing if it has nested objects (old format) but the current one has clean numbers
              if (existingHasNested && !currentHasNested) {
                uniqueWeeks[existingIndex] = week;
              } else if (!existingHasNested && !currentHasNested) {
                // If both are clean, keep the newer one based on savedAt
                const existingTime = new Date(existingWeek.savedAt || 0).getTime();
                const currentTime = new Date(week.savedAt || 0).getTime();
                if (currentTime > existingTime) {
                  uniqueWeeks[existingIndex] = week;
                }
              }
            }
          }

          // Keep only last 10
          setWeeklyHistory(uniqueWeeks.slice(-10));
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

    const notesRef = ref(db, 'project_notes');
    const unsubscribeNotes = onValue(notesRef, (snapshot) => {
      setProjectNotes(snapshot.val() || {});
    });

    const matOverridesRef = ref(db, 'project_materials');
    const unsubscribeMatOverrides = onValue(matOverridesRef, (snapshot) => {
      setMaterialOverrides(snapshot.val() || {});
    });

    const designersRef = ref(db, 'project_designers');
    const unsubscribeDesigners = onValue(designersRef, (snapshot) => {
      setProjectDesigners(snapshot.val() || {});
    });

    return () => {
      unsubscribeOverrides();
      unsubscribeNotes();
      unsubscribeMatOverrides();
      unsubscribeDesigners();
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
        totalAmt: costData ? costData.cost : '$0'
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
        text: pendingUsersCount === 1
          ? 'Hay 1 solicitud de cuenta pendiente de aprobación'
          : `Hay ${pendingUsersCount} solicitudes de cuenta pendientes de aprobación`
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
        text: `SO #${p.so} "${shortProjectName(p.name)}" está ON HOLD${reason}`
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
    let notesToDelete = {};

    projects.forEach(p => {
      const isCompletedOrCancelled = p.status === 'COMPLETED' || p.status === 'CANCELLED';

      // 1. Cleanup readNotes for completed/cancelled projects
      if (isCompletedOrCancelled && userProfile.readNotes && userProfile.readNotes[p.so]) {
        readNotesUpdates[p.so] = null; // Mark for deletion
        hasReadNotesUpdates = true;
      }

      // 1.5 Cleanup actual project notes for completed/cancelled projects
      if (isCompletedOrCancelled && projectNotes[p.so]) {
        notesToDelete[p.so] = true;
      }

      // Check if user should see alerts for this project
      let belongsToMe = false;
      if (isGlobalRole) {
        belongsToMe = true;
      } else {
        belongsToMe = p.eng && p.eng.trim().toLowerCase() === myDesignerName;
      }

      if (!belongsToMe) return;

      // 2. Urgent installs logic
      if (!isCompletedOrCancelled && p.status !== 'ON HOLD' && p.install) {
        const d = new Date(p.install);
        if (!isNaN(d) && d >= today && d <= in14Days) {
          const diffTime = d - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          alerts.push({
            so: p.so,
            type: 'urgent',
            text: `¡Urgente! SO #${p.so} tiene instalación en ${diffDays} días: ${shortProjectName(p.name)}`
          });
        }
      }

      // 3. Unread Notes logic
      if (!isCompletedOrCancelled) {
        const notes = projectNotes[p.so] || [];
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
            text: `SO #${p.so}: ${unreadCount} nota${unreadCount > 1 ? 's' : ''} nueva${unreadCount > 1 ? 's' : ''} en ${shortProjectName(p.name)}`
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

    // Fire and forget project_notes cleanup for completed projects
    if (Object.keys(notesToDelete).length > 0 && db) {
      setTimeout(() => {
        Object.keys(notesToDelete).forEach(so => {
          const refPath = `project_notes/${so}`;
          set(ref(db, refPath), null);
        });
      }, 200);
    }

    return alerts;
  }, [mergedData, userProfile, projectNotes, currentUser, pendingUsersCount]);

  const renderView = () => {
    // Standalone shareable project detail page (intentionally public/read-only —
    // no auth required, bypasses the gate below)
    const urlParams = new URLSearchParams(window.location.search);
    const projectSoParam = urlParams.get('project');
    if (projectSoParam) {
      if (loading || authLoading) return <div className="loading-state">Loading project...</div>;
      return (
        <ProjectDetailView
          data={mergedData}
          projectNotes={projectNotes}
          projectDesigners={projectDesigners}
          overrides={overrides}
        />
      );
    }

    if (loading || authLoading) return <div className="loading-state">Loading application...</div>;
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
      return <div className="loading-state">Loading...</div>;
    }

    switch (activeTab) {
      case 'dashboard':
        return isDesigner ? null : <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
      case 'calendar': return <CalendarView data={mergedData} currentUser={currentUser} userProfile={userProfile} />;
      case 'my-projects':
        return isDesigner ? null : <MyProjectsView data={mergedData} currentUser={currentUser} userProfile={userProfile} setActiveTab={setActiveTab} setFocusedProjectSo={setFocusedProjectSo} />;
      case 'pipeline': return <PipelineView data={mergedData} currentUser={currentUser} userProfile={userProfile} focusedProjectSo={focusedProjectSo} clearFocusedProjectSo={() => setFocusedProjectSo(null)} />;
      case 'materials':
        return isDesigner ? null : <MaterialsView data={mergedData} />;
      case 'quality': 
        if (userProfile?.role === 'administrative') {
          return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
        }
        return isDesigner ? null : <DesignQualityView data={mergedData} />;
      case 'designer-performance':
        return <DesignerPerformanceApp data={mergedData} projectDesigners={projectDesigners} />;
      case 'admin':
        return isSuperAdminRole(userProfile?.role) ? <AdminUsersView userProfile={userProfile} data={mergedData} /> : <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
      default: return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
    }
  };

  const isApproved = userProfile?.status === 'approved';
  const isSuperAdmin = isSuperAdminRole(userProfile?.role);

  return (
    <div className="app-container">
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
          {renderView()}
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
        activeTab={activeTab}
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
          setActiveTab('pipeline');
        }}
      />
    </div>
  )
}

export default App
