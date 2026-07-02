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
    totalRedFlags: number;
    redFlagsOver4Days: number;
  };
}

export interface Designer {
  name: string;
  totalProjects: number;
  avgPhase1Score: number;
  avgPhase2Score: number;
  globalKpi: number;
}
