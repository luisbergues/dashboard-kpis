import type { Project, Designer } from '../types';

export const calculatePhase1ScoreAndStatus = (checklist: Project['checklist']) => {
  const { kcdFile, jlContract, quoteComplete, drawingsSigned, finalMeasurementsApplies, finalMeasurementsDelivered } = checklist;
  
  // If final measurements applies, it MUST be delivered.
  const finalMeasurementsValid = !finalMeasurementsApplies || (finalMeasurementsApplies && finalMeasurementsDelivered);

  const isApproved = kcdFile && jlContract && quoteComplete && drawingsSigned && finalMeasurementsValid;

  return {
    score: isApproved ? 100 : 0,
    status: isApproved ? 'Approved' as const : 'Rejected' as const
  };
};

export const calculateTechnicalPoints = (complexity: Project['complexity']): number => {
  let points = 0;
  if (complexity.colorsDefined) points += 2;
  if (complexity.thermofoilDoors) points += 1;
  if (complexity.customBoreHoles) points += 4;
  if (complexity.routingRequired) points += 2;
  if (complexity.customPanels) points += 1;
  return points;
};

export const calculatePhase2Score = (totalRedFlags: number, redFlagsOver4Days: number, icp: number): number => {
  if (icp === 0) return 0; // Avoid division by zero
  
  let ifr = 100 - ((totalRedFlags / icp) * 40) - (redFlagsOver4Days * 5);
  return Math.max(0, Math.round(ifr * 10) / 10); // Keep 1 decimal place and minimum 0
};

export const calculateDesignerStats = (designerName: string, projects: Project[]): Designer => {
  const designerProjects = projects.filter(p => p.designerName === designerName);
  const completedProjects = designerProjects.filter(p => p.status === 'Completed');
  const phase1Projects = designerProjects.filter(p => p.phase1Score !== null);

  let avgPhase1 = 0;
  if (phase1Projects.length > 0) {
    const sum = phase1Projects.reduce((acc, p) => acc + (p.phase1Score || 0), 0);
    avgPhase1 = sum / phase1Projects.length;
  }

  let avgPhase2 = 0;
  if (completedProjects.length > 0) {
    const sum = completedProjects.reduce((acc, p) => acc + (p.phase2Score || 0), 0);
    avgPhase2 = sum / completedProjects.length;
  }

  let globalKpi = 0;
  if (avgPhase1 > 0 && avgPhase2 > 0) {
    globalKpi = (avgPhase1 + avgPhase2) / 2;
  } else if (avgPhase1 > 0) {
    globalKpi = avgPhase1;
  }

  return {
    name: designerName,
    totalProjects: completedProjects.length,
    avgPhase1Score: Math.round(avgPhase1 * 10) / 10,
    avgPhase2Score: Math.round(avgPhase2 * 10) / 10,
    globalKpi: Math.round(globalKpi * 10) / 10,
  };
};
