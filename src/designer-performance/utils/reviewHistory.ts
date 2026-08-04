import type { Actor, Phase1HistoryEntry, Project } from '../types';

/* Decide que se registra en designer_performance_history y con que forma.

   Vive aparte del contexto para poder probarse sin Firebase: es la logica que
   sostiene la traza de auditoria, asi que conviene que sea verificable. */

type ReviewState = Pick<Project, 'status' | 'outcome' | 'phase1Score'>;

/**
 * Si este guardado cambia algo que valga la pena registrar.
 *
 * Se mira el estado y el resultado de la revision — no el checklist ni el
 * puntaje: tildar un documento no es una decision, y registrar cada tilde
 * llenaria el historial de ruido hasta volverlo inservible.
 */
export const reviewChanged = (previous: Partial<ReviewState> | undefined, next: ReviewState): boolean =>
  previous?.status !== next.status
  || previous?.outcome?.result !== next.outcome?.result
  || previous?.outcome?.reason !== next.outcome?.reason
  || previous?.outcome?.deadline !== next.outcome?.deadline;

/**
 * Entrada del historial. Todos los campos se normalizan a null en vez de
 * dejarlos undefined: Firebase rechaza undefined al escribir.
 */
export const buildHistoryEntry = (
  project: ReviewState,
  actor: Actor,
  at: number = Date.now(),
): Phase1HistoryEntry => ({
  at,
  by: { uid: actor?.uid ?? null, name: actor?.name || 'Unknown User' },
  status: project.status,
  result: project.outcome?.result ?? null,
  reason: project.outcome?.reason ?? '',
  deadline: project.outcome?.deadline ?? null,
  phase1Score: project.phase1Score ?? null,
});
