import React, { useState } from 'react';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { KpiProvider, useKpi } from './context/KpiContext';
import { Layout } from './components/Layout';
import { DashboardView } from './views/DashboardView';
import { ProjectsView } from './views/ProjectsView';
import { Phase1Form } from './views/Phase1Form';
import { Phase2Form } from './views/Phase2Form';
import { getSharedProjectSo } from '../utils/projectDeepLink';

const AppContent: React.FC = () => {
  // Un link compartido (?so=12705) abre directo la lista, que es donde
  // ProjectsView levanta la ficha de ese proyecto.
  const [currentView, setCurrentView] = useState(getSharedProjectSo() ? 'projects' : 'dashboard');
  const { canEditIntake } = useKpi();

  // Sidebar ya oculta estas dos vistas para un designer; el guard aca evita
  // que queden accesibles por un currentView heredado si el rol cambia en
  // caliente (aprobacion/revocacion sin recargar la pagina).
  const showIntakeForms = canEditIntake;

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView}>
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'projects' && <ProjectsView />}
      {currentView === 'phase1' && showIntakeForms && <Phase1Form />}
      {currentView === 'phase2' && showIntakeForms && <Phase2Form />}
    </Layout>
  );
};

function App({ data, projectDesigners, userProfile, currentUser, masterProjects }) {
  return (
    <KpiProvider externalData={data} projectDesigners={projectDesigners} userProfile={userProfile} currentUser={currentUser} masterProjects={masterProjects}>
      <AppContent />
      <Toaster position="top-right" />
    </KpiProvider>
  );
}

export default App;
