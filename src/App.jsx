import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAndParseData } from './utils/sheetParser'
import { getCachedData, setCachedData, isCacheFresh } from './utils/dbCache'
import { checkDbSizeAndArchive } from './utils/archiveHelpers'
import Navbar from './components/Navbar'
import GlobalFilterBar from './components/GlobalFilterBar'
import DashboardView from './views/DashboardView'
import PipelineView from './views/PipelineView'
import CostAnalysisView from './views/CostAnalysisView'
import MaterialsView from './views/MaterialsView'
import CalendarView from './views/CalendarView'
import LoginView from './views/LoginView'
import MyProjectsView from './views/MyProjectsView'
import DesignQualityView from './views/DesignQualityView'
import ErrorBoundary from './components/ErrorBoundary'
import ToastNotifications from './components/ToastNotifications'
import { auth, db, onAuthStateChanged, ref, onValue, set, get, child } from './utils/firebase'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [overrides, setOverrides] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [weeklyHistory, setWeeklyHistory] = useState([]);
  
  const [filters, setFilters] = useState({
    dateRange: 'ALL',
    location: 'ALL',
    designer: 'ALL'
  });

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: async () => {
      const cached = await getCachedData();
      let dataToReturn = null;
      
      if (cached && isCacheFresh(cached.timestamp)) {
        dataToReturn = cached.parsedData;
        // Trigger background refresh if we want, but React Query handles staleTime
      } else {
        try {
          const parsedData = await fetchAndParseData();
          await setCachedData(parsedData);
          checkDbSizeAndArchive().catch(console.error);
          dataToReturn = parsedData;
        } catch (err) {
          if (cached) {
            console.warn('Fallback to expired cache due to fetch error', err);
            dataToReturn = cached.parsedData;
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

        // Helper: sanitize label for Firebase key
        const toKey = (label) => label.replace(/[.#$/\[\]]/g, '_').replace(/\s+/g, '_');

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

          // Keep only last 10
          setWeeklyHistory(weeksArray.slice(-10));
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

  const renderView = () => {
    if (loading || authLoading) return <div className="loading-state">Loading application...</div>;
    if (error) return <div className="error-state">Error: {error}</div>;

    if (!currentUser) {
      return <LoginView data={data} />;
    }

    switch (activeTab) {
      case 'dashboard': return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} filters={filters} />;
      case 'calendar': return <CalendarView data={mergedData} currentUser={currentUser} userProfile={userProfile} filters={filters} />;
      case 'my-projects': return <MyProjectsView data={mergedData} currentUser={currentUser} userProfile={userProfile} filters={filters} />;
      case 'pipeline': return <PipelineView data={mergedData} filters={filters} />;
      case 'costs': return <CostAnalysisView data={mergedData} filters={filters} />;
      case 'materials': return <MaterialsView data={mergedData} filters={filters} />;
      case 'quality': return <DesignQualityView data={mergedData} filters={filters} />;
      default: return <DashboardView data={mergedData} filters={filters} />;
    }
  };

  return (
    <div className="app-container">
      {(!loading && !authLoading && currentUser) && (
        <>
          <Navbar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            userProfile={userProfile}
          />
          {activeTab !== 'calendar' && activeTab !== 'my-projects' && (
            <GlobalFilterBar 
              filters={filters} 
              onChange={setFilters} 
              projects={mergedData?.priorityAnalysis || []} 
              onHoldNotes={mergedData?.onHoldNotes || []} 
            />
          )}
        </>
      )}
      <main className="main-content">
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </main>
      <ToastNotifications />
    </div>
  )
}

export default App
