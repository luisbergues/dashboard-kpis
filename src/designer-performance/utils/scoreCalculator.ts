import type { Project, Designer } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ChecklistKey = keyof Project['checklist'];

// A checklist item added to the product after a project was already registered
// can't be counted late from that project's createdAt — it didn't exist yet.
// Its clock starts the day the item appeared. Add an entry here whenever a new
// checklist item ships, using the date it went live.
const ITEM_INTRODUCED_AT: Partial<Record<ChecklistKey, number>> = {
  quoteBreakdown: new Date(2026, 6, 28).getTime(),
  creditCardForm: new Date(2026, 6, 28).getTime(),
};

// Penalties are counted in whole calendar days, so a document checked at 09:00
// the same day the project was registered at 14:00 is day 0, not "-1".
const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Calendar days between the item's baseline (project intake, or the item's own
// introduction date if it shipped later) and when it was checked — or today if
// it's still unchecked. Same-day completion (day 0) costs nothing.
const daysLate = (createdAt: number, checkedAt: number | false, introducedAt?: number): number => {
  const baseline = startOfDay(Math.max(createdAt, introducedAt ?? 0));
  const until = startOfDay(checkedAt === false ? Date.now() : checkedAt);
  return Math.max(0, Math.round((until - baseline) / MS_PER_DAY));
};

// -1 pt/day for the first 4 days late, -2 pts/day after that, capped per item
// so one very-late document can't sink the whole score on its own.
const MAX_PENALTY_PER_ITEM = 20;

const latePenalty = (days: number): number => {
  const first4 = Math.min(days, 4) * 1;
  const rest = Math.max(0, days - 4) * 2;
  return Math.min(MAX_PENALTY_PER_ITEM, first4 + rest);
};

export const calculatePhase1ScoreAndStatus = (checklist: Project['checklist'], createdAt: number) => {
  const { kcdFile, jlContract, quoteComplete, quoteBreakdown, creditCardForm, drawingsSigned, finalMeasurementsApplies, finalMeasurementsDelivered } = checklist;

  // If final measurements applies, it MUST be delivered.
  const finalMeasurementsValid = !finalMeasurementsApplies || (finalMeasurementsApplies && finalMeasurementsDelivered);

  const isApproved = kcdFile && jlContract && quoteComplete && quoteBreakdown && creditCardForm && drawingsSigned && finalMeasurementsValid;

  const requiredKeys: ChecklistKey[] = ['kcdFile', 'jlContract', 'quoteComplete', 'quoteBreakdown', 'creditCardForm', 'drawingsSigned'];
  if (finalMeasurementsApplies) requiredKeys.push('finalMeasurementsDelivered');

  const penalty = requiredKeys.reduce(
    (acc, key) => acc + latePenalty(daysLate(createdAt, checklist[key], ITEM_INTRODUCED_AT[key])),
    0,
  );
  const score = Math.max(0, 100 - penalty);

  return {
    score,
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

  const evaluatedProjects = designerProjects.filter(p => p.status !== 'Pending');

  return {
    name: designerName,
    totalProjects: evaluatedProjects.length,
    avgPhase1Score: Math.round(avgPhase1 * 10) / 10,
    avgPhase2Score: Math.round(avgPhase2 * 10) / 10,
    globalKpi: Math.round(globalKpi * 10) / 10,
  };
};
