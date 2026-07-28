export type ProjectStatus = 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'To review';

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
