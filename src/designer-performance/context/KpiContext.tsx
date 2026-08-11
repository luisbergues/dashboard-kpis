import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Project, Designer, DesignerNote, Actor, Phase1HistoryEntry } from '../types';
import { calculateDesignerStats, calculatePhase1ScoreAndStatus } from '../utils/scoreCalculator';
import { db, ref, set, get, push, onValue } from '../../utils/firebase';
import { actorFrom } from '../../utils/actorIdentity';
import { reviewChanged, buildHistoryEntry } from '../utils/reviewHistory';
import { stripUndefined } from '../../utils/stripUndefined';
import { shortProjectName } from '../../utils/projectName';
import { canForceApproveIntake } from '../../utils/intakePermissions';
import { normalizeNotesBySo } from '../../utils/projectNotes';
import { deriveComplexity, complexityFromSheet } from '../utils/complexity';

// Result of a project_designers/{so} write attempt. `project_designers` is
// also written directly from MyProjectsView (the main app's "Designer in
// Charge" button) with no coordination between the two UIs — last write
// wins silently. `conflict: true` means the value changed underneath this
// form between load and submit; the caller should warn instead of clobbering it.
// `error` cubre el rechazo de la base: las reglas pueden negar una escritura
// (aprobar con documentacion faltante sin ser administrative, por ejemplo) y
// sin devolverlo el formulario se quedaba mudo, como si hubiera guardado.
export type SaveProjectResult =
  | { conflict: false; error?: string }
  | { conflict: true; currentDesignerName: string };

interface KpiContextType {
  projects: Project[];
  designers: Designer[];
  designerNames: string[];
  projectDesigners: Record<string, string>;
  addProject: (project: Project) => Promise<SaveProjectResult>;
  updateProject: (project: Project) => Promise<SaveProjectResult>;
  getProjectComplexity: (soNumber: string) => Partial<Project['complexity']>;
  getProjectNotes: (soNumber: string) => DesignerNote[];
  /** Secuencia completa de cambios de estado/resultado, mas vieja primero. */
  getProjectHistory: (soNumber: string) => Phase1HistoryEntry[];
  /** Quien esta operando, para sellar lo que se guarda. */
  actor: Actor;
  // Si el usuario puede aprobar un intake con documentacion faltante.
  canForceApprove: boolean;
  // Si el usuario puede escribir en designer_performance_projects. Los
  // designers son solo-lectura de este modulo (ven su KPI, no lo editan), y
  // asi lo exige la regla de RTDB — exponerlo aca deja que la UI oculte los
  // formularios en vez de mostrarlos y fallar con un error de permisos.
  canEditIntake: boolean;
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

export const KpiProvider: React.FC<{
  children: ReactNode;
  externalData?: any;
  projectDesigners?: Record<string, string>;
  userProfile?: { role?: string; designerName?: string } | null;
  /** Usuario de Firebase Auth, para firmar los cambios con su uid. */
  currentUser?: { uid?: string; displayName?: string; email?: string } | null;
  /** Proyectos activos de "Master Schedule Mirror": `{ so, name, spaces }`. */
  masterProjects?: { so: string; name: string; spaces: number | null }[] | null;
}> = ({
  children,
  externalData,
  projectDesigners = {},
  userProfile = null,
  currentUser = null,
  masterProjects = null,
}) => {
  const actor = React.useMemo(() => actorFrom(userProfile, currentUser), [userProfile, currentUser]);
  const [performanceProjects, setPerformanceProjects] = useState<Record<string, Partial<Project>>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectNotes, setProjectNotes] = useState<Record<string, DesignerNote[]>>({});
  const [projectHistory, setProjectHistory] = useState<Record<string, Record<string, Phase1HistoryEntry>>>({});

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

  // 2b. Notas de proyecto — las de noteType 'designer' son los red flags de Fase 2
  useEffect(() => {
    if (!db) return;
    const notesRef = ref(db, 'project_notes');
    const unsub = onValue(notesRef, (snapshot) => {
      // Ver projectNotes.js: normaliza el formato viejo (array indexado) y el
      // nuevo (una clave por nota) a un mismo array por SO.
      setProjectNotes(normalizeNotesBySo(snapshot.val()));
    });
    return () => unsub();
  }, []);

  // 2c. Historial de la revision de Fase 1 — append-only, ver appendHistory.
  useEffect(() => {
    if (!db) return;
    const histRef = ref(db, 'designer_performance_history');
    const unsub = onValue(histRef, (snapshot) => {
      setProjectHistory(snapshot.val() || {});
    });
    return () => unsub();
  }, []);

  // 3. Merge fuente de proyectos + projectDesigners + performanceData
  useEffect(() => {
    // La lista de proyectos sale de "Master Schedule Mirror" (aguas arriba del
    // weekly KPI), para que el intake de Fase 1 se evalúe en su etapa real.
    // Si esa lectura falla o todavía no llegó, se cae a priorityAnalysis: es
    // preferible mostrar los proyectos que ya venían que dejar el módulo vacío.
    const source = masterProjects?.length ? masterProjects : externalData?.priorityAnalysis;
    if (!source?.length) return;

    const merged: Project[] = source.map((p: any) => {
      const so = String(p.so);
      const baseDesignerName = projectDesigners[so] || 'Unassigned';
      const perfData = performanceProjects[so] || {};

      // La complejidad se re-deriva de la planilla en cada lectura: si el
      // proyecto se dio de alta antes de que existieran sus materiales, se
      // completa solo en cuanto aparecen. Ver deriveComplexity.
      // `externalData` puede ser null cuando masterProjects ya resolvio pero el
      // fetch principal fallo sin cache: la linea del `source` arriba ya lo
      // contempla con `?.`, asi que aca tambien hace falta o el modulo entero
      // (y con el todo renderView, envuelto en un solo ErrorBoundary) se cae.
      const matReq = externalData?.materialRequirements?.find((m: any) => String(m.so) === so);
      const autoComplexity = deriveComplexity(perfData.complexity, matReq, perfData.complexityOverrides);

      if (perfData.createdAt === undefined && sessionCreatedAt.current[so] === undefined) {
        sessionCreatedAt.current[so] = Date.now();
      }

      const createdAt = perfData.createdAt ?? sessionCreatedAt.current[so];
      const checklist = {
        kcdFile:                      false,
        jlContract:                   false,
        quoteComplete:                false,
        quoteBreakdown:               false,
        creditCardForm:               false,
        drawingsSigned:               false,
        finalMeasurementsApplies:     false,
        finalMeasurementsDelivered:   false,
        ...(perfData.checklist || {}),
      };

      /* El puntaje de Fase 1 se DERIVA del checklist en cada lectura, igual que
         `complexity` mas arriba. Antes se leia el valor congelado en Firebase
         al momento de guardar, asi que cualquier correccion a las reglas de
         puntaje quedaba sin efecto en todo lo ya evaluado hasta que alguien
         reabriera el formulario proyecto por proyecto. Es la mitad que le
         faltaba a `effectivePhase1Score`, que ya deriva la parte de plazo
         vencido por exactamente el mismo motivo.

         `null` se respeta: un proyecto sin evaluar (Pending) o guardado para
         revisar despues no tiene puntaje, y no hay que inventarle uno.

         `asOf` frena el reloj de los items todavia sin entregar cuando el
         proyecto ya se cerro en Fase 2: nada mas va a llegar, asi que un
         documento faltante no puede seguir descontando despues del cierre. */
      const storedScore = perfData.phase1Score ?? null;
      const asOf = perfData.phase2Data?.closedAt ?? Date.now();
      const phase1Score = storedScore === null
        ? null
        : calculatePhase1ScoreAndStatus(checklist, createdAt, asOf).score;

      return {
        id: so,
        createdAt,
        approvedAt:   perfData.approvedAt   ?? null,
        projectName:  shortProjectName(p.name) || `SO #${so}`,
        designerName: perfData.designerName || baseDesignerName,
        status:       perfData.status       ?? 'Pending',
        totalRooms:   perfData.totalRooms   ?? 1,
        icp:          perfData.icp          ?? 1,
        phase1Score,
        phase2Score:  perfData.phase2Score  ?? null,
        checklist,
        complexity: autoComplexity,
        // Que campos de complexity se corrigieron a mano: se reescribe tal
        // cual en cada guardado, la planilla no lo toca (ver deriveComplexity).
        complexityOverrides: perfData.complexityOverrides,
        // Resultado de la revision manual de Fase 1 (Complete/Deficient/Deferred)
        // con su motivo y plazo. Ausente en los proyectos que aun no se revisaron.
        outcome: perfData.outcome,
        // Sin default fabricado: un proyecto que nunca se cerro no tiene datos
        // de Fase 2, y inventarle ceros hacia que el detalle mostrara
        // "Friction Metrics 0 / 0" en proyectos Pending.
        phase2Data: perfData.phase2Data,
      };
    });

    setProjects(merged);
  }, [masterProjects, externalData, projectDesigners, performanceProjects]);

  // designerNames: canonical list + any extra assigned via projectDesigners
  const designerNames: string[] = React.useMemo(() => {
    const s = new Set<string>(CANONICAL_DESIGNERS);
    Object.values(projectDesigners).forEach(name => { if (name) s.add(name); });
    return Array.from(s).sort();
  }, [projectDesigners]);

  const designers: Designer[] = designerNames.map(name => calculateDesignerStats(name, projects));

  // Firebase devuelve el array de notas como objeto indexado cuando las claves
  // no son correlativas (pasa si quedan huecos al borrar). Normalizamos a array
  // y descartamos los huecos, que llegan como null.
  const getProjectNotes = (soNumber: string): DesignerNote[] => {
    const raw = projectNotes[soNumber];
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.values(raw as Record<string, DesignerNote>);
    return list.filter(Boolean);
  };

  // Las entradas se crean con push(), asi que llegan como objeto indexado por
  // clave autogenerada. Se ordenan por fecha porque el orden de las claves no
  // es algo con lo que convenga contar.
  const getProjectHistory = (soNumber: string): Phase1HistoryEntry[] => {
    const raw = projectHistory[soNumber];
    if (!raw) return [];
    return Object.values(raw).filter(Boolean).sort((a, b) => (a.at || 0) - (b.at || 0));
  };

  /* Agrega una entrada al historial cuando cambia el estado o el resultado de la
     revision. Nunca modifica ni borra: la secuencia completa queda registrada,
     que es lo que permite responder "quien lo aprobo, y cuando cambio antes".

     Si esta escritura falla no se rompe el guardado del proyecto: perder la
     traza es malo, pero perder el trabajo del ingeniero es peor. */
  const appendHistory = async (project: Project, previous?: Partial<Project>) => {
    if (!db || !reviewChanged(previous, project)) return;
    try {
      await push(ref(db, `designer_performance_history/${project.id}`), stripUndefined(buildHistoryEntry(project, actor)));
    } catch (err) {
      console.error('No se pudo registrar el historial de Fase 1:', err);
    }
  };

  // Helper to get the auto-derived complexity for any SO (used in Phase1Form pre-fill)
  const getProjectComplexity = (soNumber: string): Partial<Project['complexity']> =>
    complexityFromSheet(externalData?.materialRequirements?.find((m: any) => String(m.so) === soNumber));

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

  /* Escribe el proyecto y traduce un rechazo de las reglas en un mensaje. Sin
     esto, un PERMISSION_DENIED solo quedaba en la consola: el formulario no
     mostraba error ni exito, y parecia que habia guardado. */
  const writeProject = async (project: Project): Promise<SaveProjectResult> => {
    try {
      // stripUndefined es obligatorio: el proyecto se arma con spread y arrastra
      // claves opcionales sin valor (phase2Data en uno que nunca cerro Fase 2).
      // Firebase rechaza el set entero por una sola de esas claves.
      await set(ref(db, `designer_performance_projects/${project.id}`), stripUndefined(project));
    } catch (err: any) {
      console.error('No se pudo guardar el proyecto:', err);
      const denied = String(err?.code || err?.message || '').toUpperCase().includes('PERMISSION');
      return {
        conflict: false,
        error: denied
          ? 'The database rejected this change — you may not have permission for it.'
          : 'Could not save. Check your connection and try again.',
      };
    }
    return { conflict: false };
  };

  const addProject = async (project: Project): Promise<SaveProjectResult> => {
    if (!db) return { conflict: false };
    if (project.designerName) {
      const result = await saveDesignerName(project.id, project.designerName);
      if (result.conflict) return result;
    }
    const written = await writeProject(project);
    if (written.error) return written;
    await appendHistory(project, performanceProjects[project.id]);
    return { conflict: false };
  };

  const updateProject = async (updatedProject: Project): Promise<SaveProjectResult> => {
    if (!db) return { conflict: false };
    if (updatedProject.designerName) {
      const result = await saveDesignerName(updatedProject.id, updatedProject.designerName);
      if (result.conflict) return result;
    }
    // El estado anterior se lee ANTES de escribir: es con lo que se compara para
    // saber si este guardado cambio algo digno de historial.
    const previous = performanceProjects[updatedProject.id];
    const written = await writeProject(updatedProject);
    if (written.error) return written;
    await appendHistory(updatedProject, previous);
    return { conflict: false };
  };

  return (
    <KpiContext.Provider value={{ projects, designers, designerNames, projectDesigners, addProject, updateProject, getProjectComplexity, getProjectNotes, getProjectHistory, actor, canForceApprove: canForceApproveIntake(userProfile), canEditIntake: userProfile?.role !== 'designer' }}>
      {children}
    </KpiContext.Provider>
  );
};

export const useKpi = () => {
  const context = useContext(KpiContext);
  if (!context) throw new Error('useKpi must be used within a KpiProvider');
  return context;
};
