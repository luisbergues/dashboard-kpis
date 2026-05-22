import { useState, useEffect } from 'react'
import { fetchAndParseData } from './utils/sheetParser'
import Navbar from './components/Navbar'
import DashboardView from './views/DashboardView'
import PipelineView from './views/PipelineView'
import CostAnalysisView from './views/CostAnalysisView'
import MaterialsView from './views/MaterialsView'
import CalendarView from './views/CalendarView'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const renderView = () => {
    if (loading) return <div className="loading-state">Loading data...</div>;
    if (error) return <div className="error-state">Error: {error}</div>;

    switch (activeTab) {
      case 'dashboard': return <DashboardView data={data} />;
      case 'calendar': return <CalendarView data={data} />;
      case 'pipeline': return <PipelineView data={data} />;
      case 'costs': return <CostAnalysisView data={data} />;
      case 'materials': return <MaterialsView data={data} />;
      default: return <DashboardView data={data} />;
    }
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  )
}

export default App
