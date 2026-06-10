import { useState, useEffect } from 'react'
import { fetchAndParseData } from './utils/sheetParser'
import Navbar from './components/Navbar'
import DashboardView from './views/DashboardView'
import PipelineView from './views/PipelineView'
import CostAnalysisView from './views/CostAnalysisView'
import MaterialsView from './views/MaterialsView'
import CalendarView from './views/CalendarView'
import LoginView from './views/LoginView'
import MyProjectsView from './views/MyProjectsView'
import { auth, db, onAuthStateChanged, ref, onValue, set, get, child } from './utils/firebase'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [weeklyHistory, setWeeklyHistory] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const parsedData = await fetchAndParseData();
        setData(parsedData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Set up auto-polling interval (every 30 seconds) to keep data fresh
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Save weekly snapshot to Firebase & load history
  useEffect(() => {
    if (!data || !db) return;

    const saveAndLoadHistory = async () => {
      try {
        // Create a key from the current week label (sanitize for Firebase path)
        const currentWeekLabel = data.weekLabels?.current || 'Unknown';
        const weekKey = currentWeekLabel.replace(/[.#$/\[\]]/g, '_').replace(/\s+/g, '_');

        // Build the snapshot for this week
        const snapshot = {
          label: currentWeekLabel,
          previousLabel: data.weekLabels?.previous || 'Previous',
          savedAt: new Date().toISOString(),
          metrics: {}
        };

        data.weekOverWeek.forEach(m => {
          snapshot.metrics[m.metric] = {
            previous: parseInt(m.previous, 10) || 0,
            current: parseInt(m.current, 10) || 0,
            variance: parseInt(m.variance, 10) || 0
          };
        });

        // Save to Firebase (only writes if data changed due to set semantics)
        const weekRef = ref(db, `weekly_history/${weekKey}`);
        const existingSnap = await get(weekRef);
        if (!existingSnap.exists()) {
          await set(weekRef, snapshot);
          console.log(`📊 Saved weekly snapshot for: ${currentWeekLabel}`);
        }

        // Load all historical snapshots
        const historyRef = ref(db, 'weekly_history');
        const historySnap = await get(historyRef);
        if (historySnap.exists()) {
          const allWeeks = historySnap.val();
          // Convert to array, sort by date (try to parse the label), keep last 10
          const weeksArray = Object.entries(allWeeks).map(([key, val]) => ({
            key,
            ...val
          }));

          // Sort chronologically by trying to parse the label date
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
    if (Object.keys(overrides).length === 0) return data;

    const mergedPriorityAnalysis = data.priorityAnalysis.map(p => {
      const override = overrides[p.so];
      if (override) {
        return {
          ...p,
          status: override.status || p.status,
          onHoldReason: override.onHoldReason || null
        };
      }
      return p;
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
      case 'dashboard': return <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
      case 'calendar': return <CalendarView data={mergedData} currentUser={currentUser} userProfile={userProfile} />;
      case 'my-projects': return <MyProjectsView data={mergedData} currentUser={currentUser} userProfile={userProfile} />;
      case 'pipeline': return <PipelineView data={mergedData} />;
      case 'costs': return <CostAnalysisView data={mergedData} />;
      case 'materials': return <MaterialsView data={mergedData} />;
      default: return <DashboardView data={mergedData} />;
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
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  )
}

export default App
