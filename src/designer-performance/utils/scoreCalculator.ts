import type { Project, Designer } from '../types';
import { businessDaysBetween, deliveryDaysLate } from './businessDays';
import { effectivePhase1Score } from './phase1Outcome';

type ChecklistKey = keyof Project['checklist'];

// A checklist item added to the product after a project was already registered
// can't be counted late from that project's createdAt — it didn't exist yet.
// Its clock starts the day the item appeared. Add an entry here whenever a new
// checklist item ships, using the date it went live.
const ITEM_INTRODUCED_AT: Partial<Record<ChecklistKey, number>> = {
  quoteBreakdown: new Date(2026, 6, 28).getTime(),
  creditCardForm: new Date(2026, 6, 28).getTime(),
};

// Business days between the item's baseline (project intake, or the item's own
// introduction date if it shipped later) and when it was checked — or today if
// it's still unchecked. Same-day completion (day 0) costs nothing.
//
// Un item ya entregado usa `deliveryDaysLate`, que aplica la excepcion de fin
// de semana: subir el archivo un sabado cuenta 1 dia y un domingo 2. Un item
// todavia sin marcar se mide con la regla base contra hoy — no hubo subida, asi
// que no corresponde el recargo (si no, el puntaje de un proyecto pendiente
// cambiaria solo por mirarlo un domingo).
const daysLate = (
  createdAt: number,
  checkedAt: number | false,
  now: number,
  introducedAt?: number,
): number => {
  const from = Math.max(createdAt, introducedAt ?? 0);
  return checkedAt === false
    ? businessDaysBetween(from, now)
    : deliveryDaysLate(from, checkedAt);
};

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

// El reloj de atraso no puede arrancar despues del primer papel recibido.
// `createdAt` es la fecha en que el proyecto se dio de alta EN ESTE MODULO, no
// la de venta: al cargar un proyecto retroactivamente quedaba en "hoy", y como
// businessDaysBetween devuelve 0 cuando el fin es anterior al inicio, todos los
// documentos previos daban 0 dias de atraso y el puntaje quedaba clavado en 100
// por mas dispersas que fueran las fechas.
//
// Se toma el minimo contra los items ya tildados, no un promedio ni la fecha
// mas tardia: la evidencia mas vieja de que el proyecto ya estaba en marcha es
// el primer documento que entro. Un alta ANTERIOR al primer papel gana igual
// (el min la conserva), asi que un proyecto cargado a tiempo no se vuelve mas
// indulgente.
//
// Solo se miran timestamps: los registros viejos guardaban las marcas como
// `true`, y un booleano colado en el Math.min daria un baseline de 1970.
const effectiveBaseline = (
  createdAt: number,
  checklist: Project['checklist'],
  keys: ChecklistKey[],
): number => {
  const stamps = keys
    .map(key => checklist[key])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  return stamps.length ? Math.min(createdAt, ...stamps) : createdAt;
};

/**
 * @param now  Momento contra el que se mide un item TODAVIA sin entregar. Por
 *   defecto ahora, que es lo correcto mientras el proyecto sigue vivo. Un
 *   proyecto ya cerrado en Fase 2 pasa su `closedAt`: nada mas va a llegar, asi
 *   que su reloj tiene que detenerse ahi en vez de seguir corriendo para
 *   siempre. Los items ya entregados no dependen de este valor.
 */
export const calculatePhase1ScoreAndStatus = (
  checklist: Project['checklist'],
  createdAt: number,
  now: number = Date.now(),
) => {
  const { kcdFile, jlContract, quoteComplete, quoteBreakdown, creditCardForm, drawingsSigned, finalMeasurementsApplies, finalMeasurementsDelivered } = checklist;

  // If final measurements applies, it MUST be delivered.
  const finalMeasurementsValid = !finalMeasurementsApplies || (finalMeasurementsApplies && finalMeasurementsDelivered);

  const isApproved = kcdFile && jlContract && quoteComplete && quoteBreakdown && creditCardForm && drawingsSigned && finalMeasurementsValid;

  const requiredKeys: ChecklistKey[] = ['kcdFile', 'jlContract', 'quoteComplete', 'quoteBreakdown', 'creditCardForm', 'drawingsSigned'];
  if (finalMeasurementsApplies) requiredKeys.push('finalMeasurementsDelivered');

  const baseline = effectiveBaseline(createdAt, checklist, requiredKeys);

  const penalty = requiredKeys.reduce(
    (acc, key) => acc + latePenalty(daysLate(baseline, checklist[key], now, ITEM_INTRODUCED_AT[key]), rateFor(key)),
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

  // `null` = todavia no hay con que promediar. Distinto de 0, que es un
  // promedio real y pesimo. Antes las tres metricas eran `number` con 0 de
  // relleno y `globalKpi` usaba `> 0` para preguntar "hay datos?": un
  // diseñador con Fase 2 en cero salia con el KPI global de su Fase 1 sola
  // (el cero desaparecia), y uno con Fase 1 en cero salia con globalKpi 0
  // aunque su Fase 2 fuera 90. Ahora la pregunta es cuantos proyectos hay,
  // que es lo que realmente se queria saber.
  let avgPhase1: number | null = null;
  if (phase1Projects.length > 0) {
    // Se usa el puntaje efectivo y no el guardado: un Deficient/Deferred que se
    // pasa del plazo sigue descontando aunque nadie vuelva a abrir el
    // formulario, asi que la penalizacion se deriva en cada lectura.
    const sum = phase1Projects.reduce((acc, p) => acc + (effectivePhase1Score(p) ?? 0), 0);
    avgPhase1 = sum / phase1Projects.length;
  }

  // Solo los cerrados en Fase 2 tienen puntaje; el filtro por `!== null` es la
  // red por si alguna vez se marca Completed por otra via.
  const phase2Projects = completedProjects.filter(p => p.phase2Score !== null && p.phase2Score !== undefined);
  let avgPhase2: number | null = null;
  if (phase2Projects.length > 0) {
    const sum = phase2Projects.reduce((acc, p) => acc + (p.phase2Score as number), 0);
    avgPhase2 = sum / phase2Projects.length;
  }

  let globalKpi: number | null = null;
  if (avgPhase1 !== null && avgPhase2 !== null) {
    globalKpi = (avgPhase1 + avgPhase2) / 2;
  } else {
    globalKpi = avgPhase1 ?? avgPhase2;
  }

  const evaluatedProjects = designerProjects.filter(p => p.status !== 'Pending');
  const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

  return {
    name: designerName,
    totalProjects: evaluatedProjects.length,
    avgPhase1Score: round1(avgPhase1),
    avgPhase2Score: round1(avgPhase2),
    globalKpi: round1(globalKpi),
  };
};
