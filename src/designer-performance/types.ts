// 'Approved' es el estado que la revision manual llama "Complete": el proyecto
// paso el control y esta listo para ingenieria. Se conserva el nombre interno
// porque es el que habilita Fase 2 en todos los registros ya guardados.
export type ProjectStatus =
  | 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'To review'
  | 'Deficient' | 'Deferred';

// Resultado de la revision manual de Fase 1 (definiciones del documento de
// status del area de ingenieria).
export type Phase1Outcome = 'Complete' | 'Deficient' | 'Deferred';

/** Quien hizo el cambio. Ver utils/actorIdentity.js. */
export interface Actor {
  uid: string | null;
  name: string;
}

// Deficient y Deferred no se pueden registrar "a secas": ambos exigen dejar por
// escrito el motivo y la fecha limite para subsanarlo.
export interface Phase1OutcomeRecord {
  result: Phase1Outcome;
  /** Aviso escrito (Deficient) o razon del diferimiento (Deferred). */
  reason: string;
  /** Fecha limite para subsanar. Vence al terminar ese dia. */
  deadline: number;
  setAt: number;
  /** Cuando paso a Complete. Congela el conteo de dias vencidos. */
  resolvedAt: number | null;
  /** Quien fijo este resultado. Ausente en los registros anteriores al sello. */
  setBy?: Actor;
}

/** Entrada del historial designer_performance_history/{so}. Append-only: cada
 *  cambio de estado o de resultado agrega una, ninguna se modifica ni se borra. */
export interface Phase1HistoryEntry {
  at: number;
  by: Actor;
  status: ProjectStatus;
  result: Phase1Outcome | null;
  reason: string;
  deadline: number | null;
  phase1Score: number | null;
}

export interface Project {
  id: string; // Used for SO Number
  createdAt: number;
  approvedAt: number | null;
  projectName: string;
  designerName: string;
  status: ProjectStatus;
  totalRooms: number;
  icp: number; // Index of Complexity
  phase1Score: number | null;
  phase2Score: number | null;
  
  // Phase 1 specific data
  checklist: {
    kcdFile: number | false;          // timestamp when checked, false if not
    jlContract: number | false;
    quoteComplete: number | false;
    quoteBreakdown: number | false;
    creditCardForm: number | false;
    drawingsSigned: number | false;
    finalMeasurementsApplies: number | false;
    finalMeasurementsDelivered: number | false;
  };
  complexity: {
    colorsDefined: boolean;
    thermofoilDoors: boolean;
    customBoreHoles: boolean;
    routingRequired: boolean;
    customPanels: boolean;
  };

  /** Resultado de la revision manual. Ausente en los proyectos anteriores a
   *  la funcion y en los que todavia estan Pending. */
  outcome?: Phase1OutcomeRecord;
  
  // Phase 2 specific data
  phase2Data?: {
    // Formato viejo — proyectos cerrados antes del cambio a notas designer.
    totalRedFlags?: number;
    redFlagsOver4Days?: number;
    // Formato nuevo — desglose congelado al cerrar.
    closedAt?: number;
    totalNotes?: number;
    totalPenalty?: number;
    breakdown?: RedFlagLine[];
  };
}

export interface Designer {
  name: string;
  totalProjects: number;
  avgPhase1Score: number;
  avgPhase2Score: number;
  globalKpi: number;
}

export type Urgency = 'green' | 'yellow' | 'red';

// Una nota de project_notes/{so}. Solo las de noteType 'designer' puntúan
// en Fase 2; el resto se ignoran.
export interface DesignerNote {
  id: string;
  text: string;
  noteType: string;
  urgency?: Urgency;
  createdAt: string;          // ISO
  createdBy?: string;
  resolvedAt?: string | null; // ISO; ausente o null = abierta
}

export interface RedFlagLine {
  noteId: string;
  urgency: Urgency;
  days: number;
  penalty: number;
}

export interface Phase2Result {
  score: number;
  totalPenalty: number;
  breakdown: RedFlagLine[];
}
