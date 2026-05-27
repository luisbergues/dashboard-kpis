import { useState, useEffect } from 'react'
import { fetchAndParseData } from './utils/sheetParser'
import Navbar from './components/Navbar'
import DashboardView from './views/DashboardView'
import PipelineView from './views/PipelineView'
import CostAnalysisView from './views/CostAnalysisView'
import MaterialsView from './views/MaterialsView'
import CalendarView from './views/CalendarView'
import LoginView from './views/LoginView'
import { auth, db, onAuthStateChanged, ref, onValue } from './utils/firebase'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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
  }, []);

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

  const renderView = () => {
    if (loading || authLoading) return <div className="loading-state">Loading application...</div>;
    if (error) return <div className="error-state">Error: {error}</div>;

    if (!currentUser) {
      return <LoginView data={data} />;
    }

    switch (activeTab) {
      case 'dashboard': return <DashboardView data={data} />;
      case 'calendar': return <CalendarView data={data} currentUser={currentUser} userProfile={userProfile} />;
      case 'pipeline': return <PipelineView data={data} />;
      case 'costs': return <CostAnalysisView data={data} />;
      case 'materials': return <MaterialsView data={data} />;
      default: return <DashboardView data={data} />;
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
