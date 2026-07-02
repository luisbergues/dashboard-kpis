import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Project, Designer } from '../types';
import { calculateDesignerStats } from '../utils/scoreCalculator';
import { db, ref, set, onValue } from '../../utils/firebase';

interface KpiContextType {
  projects: Project[];
  designers: Designer[];
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
}

const mockDesigners = [
  'Monica Gabriel', 'Natalie Ball', 'Marsha Diquez', 'Iris Lopes',
  'Kat Baumgartner', 'Melissa Barker', 'Nicole Dugan', 'Tricia Hatton',
  'Blerta Veseli', 'Lana Kravtchenko', 'Krisztina Vizi', 'Luana Tamagnone',
  'Russell Reiner', 'Mauricio Dasso', 'Sarah Manev', 'Caryn Henslovitz',
  'Her Henslovitz', 'Caryn Heitlovitz', 'Her Heitlovitz', 'Michael Kaboskey',
  'Malanie Dalfrey'
];

const KpiContext = createContext<KpiContextType | undefined>(undefined);

export const KpiProvider: React.FC<{ children: ReactNode, externalData?: any, projectDesigners?: any }> = ({ children, externalData, projectDesigners }) => {
  const [performanceProjects, setPerformanceProjects] = useState<Record<string, Partial<Project>>>({});
  const [projects, setProjects] = useState<Project[]>([]);

  // 1. Fetch Performance metrics from Firebase
  useEffect(() => {
    if (!db) return;
    const perfRef = ref(db, 'designer_performance_projects');
    const unsubscribe = onValue(perfRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setPerformanceProjects(val);
      } else {
        setPerformanceProjects({});
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Merge external SO data with performance metrics
  useEffect(() => {
    if (!externalData?.priorityAnalysis) return;

    const mergedProjects: Project[] = externalData.priorityAnalysis.map((p: any) => {
      const so = p.so;
      const designerName = (projectDesigners && projectDesigners[so]) ? projectDesigners[so] : (p.eng || 'Unassigned');
      const perfData = performanceProjects[so] || {};

      return {
        id: String(so),
        createdAt: perfData.createdAt || Date.now(),
        approvedAt: perfData.approvedAt || null,
        projectName: p.name || `SO #${so}`,
        designerName: designerName,
        status: perfData.status || 'Pending',
        totalRooms: perfData.totalRooms || 1,
        icp: perfData.icp || 1,
        phase1Score: perfData.phase1Score ?? null,
        phase2Score: perfData.phase2Score ?? null,
        checklist: {
          kcdFile: false,
          jlContract: false,
          quoteComplete: false,
          drawingsSigned: false,
          finalMeasurementsApplies: false,
          finalMeasurementsDelivered: false,
          ...(perfData.checklist || {})
        },
        complexity: {
          colorsDefined: false,
          thermofoilDoors: false,
          customBoreHoles: false,
          routingRequired: false,
          customPanels: false,
          ...(perfData.complexity || {})
        },
        phase2Data: perfData.phase2Data || {
          totalRedFlags: 0,
          redFlagsOver4Days: 0
        }
      };
    });

    setProjects(mergedProjects);
  }, [externalData, projectDesigners, performanceProjects]);

  const designers: Designer[] = mockDesigners.map(name =>
    calculateDesignerStats(name, projects)
  );

  const addProject = (project: Project) => {
    if (!db) return;
    set(ref(db, `designer_performance_projects/${project.id}`), project);
  };

  const updateProject = (updatedProject: Project) => {
    if (!db) return;
    set(ref(db, `designer_performance_projects/${updatedProject.id}`), updatedProject);
  };

  return (
    <KpiContext.Provider value={{ projects, designers, addProject, updateProject }}>
      {children}
    </KpiContext.Provider>
  );
};

export const useKpi = () => {
  const context = useContext(KpiContext);
  if (context === undefined) {
    throw new Error('useKpi must be used within a KpiProvider');
  }
  return context;
};
