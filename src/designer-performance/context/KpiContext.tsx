import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Project, Designer } from '../types';
import { calculateDesignerStats } from '../utils/scoreCalculator';
import { db, ref, set, onValue } from '../../utils/firebase';

interface KpiContextType {
  projects: Project[];
  designers: Designer[];
  designerNames: string[];
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  getProjectComplexity: (soNumber: string) => Partial<Project['complexity']>;
}

const KpiContext = createContext<KpiContextType | undefined>(undefined);

export const KpiProvider: React.FC<{ children: ReactNode; externalData?: any; projectDesigners?: Record<string, string> }> = ({
  children,
  externalData,
  projectDesigners = {},
}) => {
  const [performanceProjects, setPerformanceProjects] = useState<Record<string, Partial<Project>>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [allowedDesigners, setAllowedDesigners] = useState<string[]>([]);

  // 1. Fetch allowed_designers list from Firebase
  useEffect(() => {
    if (!db) return;
    const designersRef = ref(db, 'allowed_designers');
    const unsub = onValue(designersRef, (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      let names: string[] = [];
      if (Array.isArray(val)) names = val.filter(Boolean);
      else if (typeof val === 'object') names = Object.values(val).filter(Boolean) as string[];
      setAllowedDesigners(names);
    });
    return () => unsub();
  }, []);

  // 2. Fetch performance data from Firebase
  useEffect(() => {
    if (!db) return;
    const perfRef = ref(db, 'designer_performance_projects');
    const unsub = onValue(perfRef, (snapshot) => {
      const val = snapshot.val();
      setPerformanceProjects(val || {});
    });
    return () => unsub();
  }, []);

  // 3. Merge externalData + projectDesigners + performanceData
  useEffect(() => {
    if (!externalData?.priorityAnalysis) return;

    const merged: Project[] = externalData.priorityAnalysis.map((p: any) => {
      const so = String(p.so);
      const designerName = projectDesigners[so] || p.eng || 'Unassigned';
      const perfData = performanceProjects[so] || {};

      // Auto-derive complexity from project materials data
      const matReq = externalData.materialRequirements?.find((m: any) => String(m.so) === so);
      const autoComplexity: Project['complexity'] = {
        colorsDefined:     perfData.complexity?.colorsDefined     ?? false,
        thermofoilDoors:   perfData.complexity?.thermofoilDoors   ?? (matReq?.thermofoil === 'Yes'),
        customBoreHoles:   perfData.complexity?.customBoreHoles   ?? (matReq?.noHoles === 'Yes'),
        routingRequired:   perfData.complexity?.routingRequired   ?? (matReq?.dovetail === 'Yes'),
        customPanels:      perfData.complexity?.customPanels      ?? (matReq?.element === 'Yes'),
      };

      return {
        id: so,
        createdAt:    perfData.createdAt    ?? Date.now(),
        approvedAt:   perfData.approvedAt   ?? null,
        projectName:  p.name || `SO #${so}`,
        designerName,
        status:       perfData.status       ?? 'Pending',
        totalRooms:   perfData.totalRooms   ?? 1,
        icp:          perfData.icp          ?? 1,
        phase1Score:  perfData.phase1Score  ?? null,
        phase2Score:  perfData.phase2Score  ?? null,
        checklist: {
          kcdFile:                      false,
          jlContract:                   false,
          quoteComplete:                false,
          drawingsSigned:               false,
          finalMeasurementsApplies:     false,
          finalMeasurementsDelivered:   false,
          ...(perfData.checklist || {}),
        },
        complexity: autoComplexity,
        phase2Data: perfData.phase2Data ?? { totalRedFlags: 0, redFlagsOver4Days: 0 },
      };
    });

    setProjects(merged);
  }, [externalData, projectDesigners, performanceProjects]);

  // Dynamic unique list of designers: from Firebase + from project assignments
  const designerNames: string[] = React.useMemo(() => {
    const set = new Set<string>(allowedDesigners);
    Object.values(projectDesigners).forEach(name => { if (name) set.add(name); });
    return Array.from(set).sort();
  }, [allowedDesigners, projectDesigners]);

  const designers: Designer[] = designerNames.map(name => calculateDesignerStats(name, projects));

  // Helper to get the auto-derived complexity for any SO (used in Phase1Form pre-fill)
  const getProjectComplexity = (soNumber: string): Partial<Project['complexity']> => {
    const matReq = externalData?.materialRequirements?.find((m: any) => String(m.so) === soNumber);
    if (!matReq) return {};
    return {
      thermofoilDoors: matReq.thermofoil === 'Yes',
      customBoreHoles: matReq.noHoles    === 'Yes',
      routingRequired: matReq.dovetail   === 'Yes',
      customPanels:    matReq.element    === 'Yes',
    };
  };

  const addProject = (project: Project) => {
    if (!db) return;
    set(ref(db, `designer_performance_projects/${project.id}`), project);
  };

  const updateProject = (updatedProject: Project) => {
    if (!db) return;
    set(ref(db, `designer_performance_projects/${updatedProject.id}`), updatedProject);
  };

  return (
    <KpiContext.Provider value={{ projects, designers, designerNames, addProject, updateProject, getProjectComplexity }}>
      {children}
    </KpiContext.Provider>
  );
};

export const useKpi = () => {
  const context = useContext(KpiContext);
  if (!context) throw new Error('useKpi must be used within a KpiProvider');
  return context;
};
