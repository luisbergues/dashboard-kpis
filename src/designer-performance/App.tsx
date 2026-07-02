import React, { useState } from 'react';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { KpiProvider } from './context/KpiContext';
import { Layout } from './components/Layout';
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { Phase1Form } from './views/Phase1Form';
import { Phase2Form } from './views/Phase2Form';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView}>
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'projects' && <ProjectsView />}
      {currentView === 'phase1' && <Phase1Form />}
      {currentView === 'phase2' && <Phase2Form />}
    </Layout>
  );
};

function App({ data, projectDesigners }) {
  return (
    <KpiProvider externalData={data} projectDesigners={projectDesigners}>
      <AppContent />
      <Toaster position="top-right" />
    </KpiProvider>
  );
}

export default App;
