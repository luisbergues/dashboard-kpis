import type { Phase1Outcome, Phase1OutcomeRecord, Project, ProjectStatus } from '../types';
import { businessDaysBetween } from './businessDays';

/* Resultado de la revision manual de Fase 1. Reemplaza al Approved/Rejected que
   antes se deducia solo de los tildes del checklist: el checklist sigue midiendo
   las demoras (el puntaje), pero quien decide si la etapa esta aprobada es el
   ingeniero que la revisa. */

export const OUTCOMES: Phase1Outcome[] = ['Complete', 'Deficient', 'Deferred'];

// Definiciones tal como estan redactadas en el documento de status de ingenieria.
export const OUTCOME_DEFINITION: Record<Phase1Outcome, string> = {
  Complete:
    'The project has all necessary documentation and passed the manual quality review. It is fully ready for engineers to begin work.',
  Deficient:
    'The project reached engineering, but errors, wrong measurements, or inconsistencies were found during the manual review. It must be returned to the designer for corrections.',
  Deferred:
    'The project is sold, but it is currently on hold because vital files (such as the contract or the .job KCD file) are missing. The project is incomplete.',
};

// Los tres resultados llevan nota escrita: el diseñador tiene que poder leer que
// paso o que falto. En Deficient y Deferred es obligatoria; en Complete es
// opcional, para dejar un comentario de cierre.
export const REASON_LABEL: Record<Phase1Outcome, string> = {
  Complete: 'Note for the designer (optional)',
  Deficient: 'Written notice — what has to be corrected',
  Deferred: 'Reason — what is missing',
};

export const REASON_PLACEHOLDER: Record<Phase1Outcome, string> = {
  Complete: 'e.g., Approved as is. The revised elevation arrived on time — thanks.',
  Deficient: 'e.g., Wall dimensions on page 3 do not match the KCD file.',
  Deferred: 'e.g., Signed contract and .job KCD file still missing.',
};

export const DEADLINE_LABEL: Record<Phase1Outcome, string> = {
  Complete: '',
  Deficient: 'Cure deadline',
  Deferred: 'Deadline',
};

/** Deficient y Deferred no se pueden guardar sin motivo escrito ni plazo. */
export const requiresReasonAndDeadline = (outcome: Phase1Outcome): boolean =>
  outcome === 'Deficient' || outcome === 'Deferred';

/** 'Complete' se guarda como 'Approved': es el estado que ya habilita Fase 2 en
 *  todos los proyectos existentes, y renombrarlo obligaria a migrar la base. */
export const outcomeToStatus = (outcome: Phase1Outcome): ProjectStatus =>
  outcome === 'Complete' ? 'Approved' : outcome;

/** Inversa de outcomeToStatus, para mostrar el resultado de un proyecto ya
 *  guardado. Devuelve null si el estado no viene de una revision de Fase 1. */
export const statusToOutcome = (status: ProjectStatus): Phase1Outcome | null => {
  // 'Completed' es un proyecto ya cerrado en Fase 2: paso la revision de Fase 1
  // en su momento, asi que su resultado es Complete. Sin esto, abrirlo para
  // corregir un typo del checklist pedia elegir un resultado que ya tenia.
  if (status === 'Approved' || status === 'Completed') return 'Complete';
  if (status === 'Deficient' || status === 'Deferred') return status;
  return null;
};

/** Que le falta al resultado elegido para poder guardarse. */
export const missingOutcomeFields = (
  outcome: Phase1Outcome | '',
  reason: string,
  deadline: number | null,
): string[] => {
  if (!outcome) return ['Review result'];
  if (!requiresReasonAndDeadline(outcome)) return [];
  const missing: string[] = [];
  if (!reason.trim()) missing.push(REASON_LABEL[outcome]);
  if (!deadline) missing.push(DEADLINE_LABEL[outcome]);
  return missing;
};

/* ── plazo vencido ──────────────────────────────────────────────────────────
   El resultado en si no descuenta puntos: elegir Deficient no es una falta, es
   el diagnostico. Lo que si descuenta es no subsanarlo en el plazo acordado.
   Misma escala y tope que los items del checklist, y en dias habiles, para que
   un plazo que cae un viernes no cueste tres dias por el fin de semana. */
export const OVERDUE_RATE = { perDay: 1, perDayAfter: 2, threshold: 4 };
export const MAX_OVERDUE_PENALTY = 20;

/** Dias habiles vencidos. El plazo vence al TERMINAR el dia indicado, asi que
 *  el mismo dia del vencimiento devuelve 0. Se congela en resolvedAt.
 *
 *  Se mira `deadline` y no `result`: al subsanar, el proyecto pasa a Complete
 *  pero conserva el plazo y queda sellado con resolvedAt, de modo que lo que se
 *  acumulo por llegar tarde no se borra al corregir. Es el mismo criterio que
 *  el checklist, donde un documento entregado tarde sigue descontando. */
export const overdueBusinessDays = (
  record: Phase1OutcomeRecord | undefined,
  now: number = Date.now(),
): number => {
  if (!record?.deadline) return 0;
  return businessDaysBetween(record.deadline, record.resolvedAt ?? now);
};

export const overduePenalty = (
  record: Phase1OutcomeRecord | undefined,
  now: number = Date.now(),
): number => {
  const days = overdueBusinessDays(record, now);
  if (days <= 0) return 0;
  const first = Math.min(days, OVERDUE_RATE.threshold) * OVERDUE_RATE.perDay;
  const rest = Math.max(0, days - OVERDUE_RATE.threshold) * OVERDUE_RATE.perDayAfter;
  return Math.min(MAX_OVERDUE_PENALTY, first + rest);
};

/** Puntaje de Fase 1 que realmente cuenta: el guardado (100 menos las demoras
 *  del papeleo) menos lo que se acumulo por pasarse del plazo. Se deriva en vez
 *  de guardarse para que siga corriendo sin que nadie reabra el formulario. */
export const effectivePhase1Score = (
  project: Pick<Project, 'phase1Score' | 'outcome'>,
  now: number = Date.now(),
): number | null => {
  if (project.phase1Score === null || project.phase1Score === undefined) return null;
  const penalty = overduePenalty(project.outcome, now);
  if (penalty === 0) return project.phase1Score;
  return Math.max(0, Math.round((project.phase1Score - penalty) * 10) / 10);
};

/** Un plazo vencido y sin subsanar. Para resaltarlo en las listas. */
export const isOverdue = (
  record: Phase1OutcomeRecord | undefined,
  now: number = Date.now(),
): boolean => !!record && record.resolvedAt === null && overdueBusinessDays(record, now) > 0;
