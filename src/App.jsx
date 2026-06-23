import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAndParseData } from './utils/sheetParser'
import { getCachedData, setCachedData, isCacheFresh } from './utils/dbCache'
import { checkDbSizeAndArchive } from './utils/archiveHelpers'
import { archiveMissingCompletedProjects, fetchArchivedCompletedProjects } from './utils/completedProjectsArchive'
import Navbar from './components/Navbar'
import DashboardView from './views/DashboardView'
import PipelineView from './views/PipelineView'
import MaterialsView from './views/MaterialsView'
import CalendarView from './views/CalendarView'
import LoginView from './views/LoginView'
import MyProjectsView from './views/MyProjectsView'
import DesignQualityView from './views/DesignQualityView'
import ErrorBoundary from './components/ErrorBoundary'
import ToastNotifications from './components/ToastNotifications'
import ProjectChatbot from './components/ProjectChatbot'
import { auth, db, onAuthStateChanged, ref, onValue, set, get, child } from './utils/firebase'

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('active_tab') || 'dashboard';
  });
  const [overrides, setOverrides] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [weeklyHistory, setWeeklyHistory] = useState([]);
  const [focusedProjectSo, setFocusedProjectSo] = useState(null);

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
          const parsedData = await fetchAndParseData();
          
          if (cached && cached.parsedData) {
            await archiveMissingCompletedProjects(cached.parsedData, parsedData);
          }
          
          await setCachedData(parsedData);
          checkDbSizeAndArchive().catch(console.error);
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
  useEffect(() => {
    if (!data || !db) return;

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
  }, [data]);

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
    return () => unsubscribeOverrides();
  }, []);

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab);
  }, [activeTab]);

  const getMergedData = () => {
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
        totalAmt: costData ? costData.cost : '$0'
      };
    });

    return {
      ...data,
      priorityAnalysis: mergedPriorityAnalysis
    };
  };

  const mergedData = getMergedData();

  // Build real-time alerts from actual project data
  const realAlerts = useMemo(() => {
    if (!mergedData || !userProfile?.designerName) return [];
    const alerts = [];
    const projects = mergedData.priorityAnalysis || [];
    const myDesignerName = userProfile.designerName.trim().toLowerCase();

    // Warn about every project currently ON HOLD under this user's name
    const onHoldProjects = projects.filter(p => {
      return p.status === 'ON HOLD' && p.eng && p.eng.trim().toLowerCase() === myDesignerName;
    });
    onHoldProjects.forEach(p => {
      const reason = p.onHoldReason ? ` — ${p.onHoldReason}` : '';
      alerts.push({
        so: p.so,
        type: 'warning',
        text: `SO #${p.so} "${p.name.split(':')[0].trim()}" está ON HOLD${reason}`
      });
    });

    // Warn about installations in the next 3 days under this user's name
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in3Days = new Date(today);
    in3Days.setDate(today.getDate() + 3);
    const urgentInstalls = projects.filter(p => {
      if (!p.install || p.status === 'ON HOLD') return false;
      const belongsToMe = p.eng && p.eng.trim().toLowerCase() === myDesignerName;
      if (!belongsToMe) return false;
      const d = new Date(p.install);
      return !isNaN(d) && d >= today && d <= in3Days;
    });
    urgentInstalls.forEach(p => {
      const d = new Date(p.install);
      const daysLeft = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
      alerts.push({
        so: p.so,
        type: daysLeft === 0 ? 'error' : 'info',
        text: `SO #${p.so} tiene instalación ${daysLeft === 0 ? 'HOY' : `en ${daysLeft} día${daysLeft > 1 ? 's' : ''}`}: ${p.name.split(':')[0].trim()}`
      });
    });

    return alerts;
  }, [mergedData, userProfile]);

  const renderView = () => {
    if (loading || authLoading) return <div className="loading-state">Loading application...</div>;
    if (error) return <div className="error-state">Error: {error}</div>;

    if (!currentUser) {
      return <LoginView data={data} />;
    }

    switch (activeTab) {
      case 'dashboard': return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
      case 'calendar': return <CalendarView data={mergedData} currentUser={currentUser} userProfile={userProfile} />;
      case 'my-projects': return <MyProjectsView data={mergedData} currentUser={currentUser} userProfile={userProfile} />;
      case 'pipeline': return <PipelineView data={mergedData} currentUser={currentUser} userProfile={userProfile} focusedProjectSo={focusedProjectSo} clearFocusedProjectSo={() => setFocusedProjectSo(null)} />;
      case 'materials': return <MaterialsView data={mergedData} />;
      case 'quality': 
        if (userProfile?.role === 'administrative') {
          return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
        }
        return <DesignQualityView data={mergedData} />;
      default: return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
    }
  };

  return (
    <div className="app-container">
      {(!loading && !authLoading && currentUser) && (
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userProfile={userProfile}
        />
      )}
      <main className={`main-content ${!currentUser ? 'no-sidebar' : ''}`}>
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </main>
      {currentUser && (
        <ProjectChatbot 
          projects={mergedData?.priorityAnalysis} 
          materialsMatrix={mergedData?.materialsMatrix}
          currentUser={currentUser} 
          userProfile={userProfile} 
        />
      )}
      <ToastNotifications 
        alerts={realAlerts} 
        onClickAlert={(so) => {
          setFocusedProjectSo(so);
          setActiveTab('pipeline');
        }} 
      />
    </div>
  )
}

export default App
