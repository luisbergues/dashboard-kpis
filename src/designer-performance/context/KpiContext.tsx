import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Project, Designer } from '../types';
import { calculateDesignerStats } from '../utils/scoreCalculator';
import { db, ref, set, get, onValue } from '../../utils/firebase';
import { shortProjectName } from '../../utils/projectName';

// Result of a project_designers/{so} write attempt. `project_designers` is
// also written directly from MyProjectsView (the main app's "Designer in
// Charge" button) with no coordination between the two UIs — last write
// wins silently. `conflict: true` means the value changed underneath this
// form between load and submit; the caller should warn instead of clobbering it.
export type SaveProjectResult = { conflict: false } | { conflict: true; currentDesignerName: string };

interface KpiContextType {
  projects: Project[];
  designers: Designer[];
  designerNames: string[];
  projectDesigners: Record<string, string>;
  addProject: (project: Project) => Promise<SaveProjectResult>;
  updateProject: (project: Project) => Promise<SaveProjectResult>;
  getProjectComplexity: (soNumber: string) => Partial<Project['complexity']>;
}

// Canonical list of designers — separate from engineers
const CANONICAL_DESIGNERS: string[] = [
  'Monica Gabriel',
  'Natalie Ball',
  'Marsha Diquez',
  'Iris Lopes',
  'Kat Baumgartner',
  'Melissa Barker',
  'Nicole Dugan',
  'Tricia Hatton',
  'Blerta Veseli',
  'Lana Kravtchenko',
  'Krisztina Vizi',
  'Luana Tamagnone',
  'Russell Reiner',
  'Mauricio Dasso',
  'Sarah Manev',
  'Caryn Henslovitz',
  'Michael Kaboskey',
  'Malanie Dalfrey',
];

const KpiContext = createContext<KpiContextType | undefined>(undefined);

export const KpiProvider: React.FC<{ children: ReactNode; externalData?: any; projectDesigners?: Record<string, string> }> = ({
  children,
  externalData,
  projectDesigners = {},
}) => {
  const [performanceProjects, setPerformanceProjects] = useState<Record<string, Partial<Project>>>({});
  const [projects, setProjects] = useState<Project[]>([]);

  // Session-stable fallback for createdAt on a project that hasn't persisted
  // one yet (perfData.createdAt is undefined until the first addProject/
  // updateProject write). Without this, `perfData.createdAt ?? Date.now()`
  // below generated a NEW timestamp on every rerun of the merge effect
  // (every externalData/projectDesigners/performanceProjects change), so
  // "Registered: {date}" could visibly change between renders for the same
  // project. A ref survives across renders without triggering them, so the
  // first Date.now() seen for a given SO this session sticks until Firebase
  // has a real value.
  const sessionCreatedAt = useRef<Record<string, number>>({});

  // 1. Designer list is canonical (CANONICAL_DESIGNERS) — not read from allowed_designers (that node stores engineers)

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
      const baseDesignerName = projectDesigners[so] || 'Unassigned';
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

      if (perfData.createdAt === undefined && sessionCreatedAt.current[so] === undefined) {
        sessionCreatedAt.current[so] = Date.now();
      }

      return {
        id: so,
        createdAt:    perfData.createdAt    ?? sessionCreatedAt.current[so],
        approvedAt:   perfData.approvedAt   ?? null,
        projectName:  shortProjectName(p.name) || `SO #${so}`,
        designerName: perfData.designerName || baseDesignerName,
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

  // designerNames: canonical list + any extra assigned via projectDesigners
  const designerNames: string[] = React.useMemo(() => {
    const s = new Set<string>(CANONICAL_DESIGNERS);
    Object.values(projectDesigners).forEach(name => { if (name) s.add(name); });
    return Array.from(s).sort();
  }, [projectDesigners]);

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

  // Re-reads project_designers/{so} right before writing and refuses to
  // overwrite it if it changed since this form last saw it (`expectedValue`,
  // the value this component loaded the form from) — the same
  // read-before-write guard MyProjectsView's "Designer in Charge" button uses.
  const saveDesignerName = async (so: string, newName: string): Promise<SaveProjectResult> => {
    if (!db) return { conflict: false };
    const designerRef = ref(db, `project_designers/${so}`);
    const snapshot = await get(designerRef);
    const currentValue = snapshot.exists() ? snapshot.val() : '';
    const expectedValue = projectDesigners[so] || '';
    if (currentValue !== expectedValue && currentValue !== newName) {
      return { conflict: true, currentDesignerName: currentValue };
    }
    await set(designerRef, newName);
    return { conflict: false };
  };

  const addProject = async (project: Project): Promise<SaveProjectResult> => {
    if (!db) return { conflict: false };
    if (project.designerName) {
      const result = await saveDesignerName(project.id, project.designerName);
      if (result.conflict) return result;
    }
    await set(ref(db, `designer_performance_projects/${project.id}`), project);
    return { conflict: false };
  };

  const updateProject = async (updatedProject: Project): Promise<SaveProjectResult> => {
    if (!db) return { conflict: false };
    if (updatedProject.designerName) {
      const result = await saveDesignerName(updatedProject.id, updatedProject.designerName);
      if (result.conflict) return result;
    }
    await set(ref(db, `designer_performance_projects/${updatedProject.id}`), updatedProject);
    return { conflict: false };
  };

  return (
    <KpiContext.Provider value={{ projects, designers, designerNames, projectDesigners, addProject, updateProject, getProjectComplexity }}>
      {children}
    </KpiContext.Provider>
  );
};

export const useKpi = () => {
  const context = useContext(KpiContext);
  if (!context) throw new Error('useKpi must be used within a KpiProvider');
  return context;
};
