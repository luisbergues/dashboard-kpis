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

// Business days elapsed after `from`, up to and including `to`. Weekends don't
// count: a document requested Friday and delivered Monday is 1 day late, not 3
// — nobody is working Saturday, so it isn't the designer's delay.
// Full weeks are taken in one step (5 business days each) so the loop never
// runs more than 6 times, however old the project is.
const businessDaysBetween = (from: number, to: number): number => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end <= start) return 0;

  const totalDays = Math.round((end - start) / MS_PER_DAY);
  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * 5;

  // setDate (en vez de sumar milisegundos) mantiene la cuenta correcta a través
  // de cambios de horario de verano y de fin de mes.
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + fullWeeks * 7);
  for (let i = 0; i < totalDays - fullWeeks * 7; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
};

// Business days between the item's baseline (project intake, or the item's own
// introduction date if it shipped later) and when it was checked — or today if
// it's still unchecked. Same-day completion (day 0) costs nothing.
const daysLate = (createdAt: number, checkedAt: number | false, introducedAt?: number): number =>
  businessDaysBetween(
    Math.max(createdAt, introducedAt ?? 0),
    checkedAt === false ? Date.now() : checkedAt,
  );

// Cap per item so one very-late document can't sink the whole score on its own.
const MAX_PENALTY_PER_ITEM = 20;

interface LateRate {
  perDay: number;      // hasta `threshold` días hábiles de atraso
  perDayAfter: number; // de ahí en adelante
  threshold: number;
}

// -1 pt/business day for the first 4 days, -2 after.
const DEFAULT_RATE: LateRate = { perDay: 1, perDayAfter: 2, threshold: 4 };

// Final Measurements depends on scheduling, not only on the designer, so it
// penalises an order of magnitude softer than the rest. Same 4-day threshold as
// the other items, but the rate after it quadruples instead of doubling: a
// scheduling delay that drags on is still a real problem for the project.
const FINALS_RATE: LateRate = { perDay: 0.1, perDayAfter: 0.4, threshold: 4 };

const rateFor = (key: ChecklistKey): LateRate =>
  key === 'finalMeasurementsDelivered' ? FINALS_RATE : DEFAULT_RATE;

const latePenalty = (days: number, rate: LateRate): number => {
  const first = Math.min(days, rate.threshold) * rate.perDay;
  const rest = Math.max(0, days - rate.threshold) * rate.perDayAfter;
  return Math.min(MAX_PENALTY_PER_ITEM, first + rest);
};

export const calculatePhase1ScoreAndStatus = (checklist: Project['checklist'], createdAt: number) => {
  const { kcdFile, jlContract, quoteComplete, quoteBreakdown, creditCardForm, drawingsSigned, finalMeasurementsApplies, finalMeasurementsDelivered } = checklist;

  // If final measurements applies, it MUST be delivered.
  const finalMeasurementsValid = !finalMeasurementsApplies || (finalMeasurementsApplies && finalMeasurementsDelivered);

  const isApproved = kcdFile && jlContract && quoteComplete && quoteBreakdown && creditCardForm && drawingsSigned && finalMeasurementsValid;

  const requiredKeys: ChecklistKey[] = ['kcdFile', 'jlContract', 'quoteComplete', 'quoteBreakdown', 'creditCardForm', 'drawingsSigned'];
  if (finalMeasurementsApplies) requiredKeys.push('finalMeasurementsDelivered');

  const penalty = requiredKeys.reduce(
    (acc, key) => acc + latePenalty(daysLate(createdAt, checklist[key], ITEM_INTRODUCED_AT[key]), rateFor(key)),
    0,
  );
  // Redondeo a 1 decimal: las tasas fraccionarias de finals arrastran error de
  // punto flotante (0.5 + 3 x 0.2 no da exactamente 1.1).
  const score = Math.max(0, Math.round((100 - penalty) * 10) / 10);

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

// El puntaje de Fase 2 se calcula en redFlags.ts a partir de las notas
// designer del proyecto. El ICP ya no interviene.

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
