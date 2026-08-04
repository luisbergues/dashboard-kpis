import { describe, it, expect } from 'vitest';
import { reviewChanged, buildHistoryEntry } from '../reviewHistory';
import type { Phase1OutcomeRecord } from '../../types';

const ACTOR = { uid: 'u1', name: 'Monica Gabriel' };
const DEADLINE = new Date(2026, 7, 10).getTime();

const outcome = (over: Partial<Phase1OutcomeRecord> = {}): Phase1OutcomeRecord => ({
  result: 'Deficient', reason: 'faltan medidas', deadline: DEADLINE,
  setAt: 1, resolvedAt: null, ...over,
});
const state = (over = {}) => ({ status: 'Deficient' as const, outcome: outcome(), phase1Score: 90, ...over });

describe('que se registra', () => {
  it('un proyecto nuevo siempre se registra', () => {
    expect(reviewChanged(undefined, state())).toBe(true);
  });

  it('cambiar de estado se registra', () => {
    expect(reviewChanged(state(), state({ status: 'Approved' }))).toBe(true);
  });

  it('cambiar el resultado se registra', () => {
    expect(reviewChanged(state(), state({ outcome: outcome({ result: 'Deferred' }) }))).toBe(true);
  });

  it('reescribir el aviso se registra', () => {
    expect(reviewChanged(state(), state({ outcome: outcome({ reason: 'otra cosa' }) }))).toBe(true);
  });

  it('mover el plazo se registra', () => {
    expect(reviewChanged(state(), state({ outcome: outcome({ deadline: DEADLINE + 86400000 }) }))).toBe(true);
  });
});

describe('que NO ensucia el historial', () => {
  it('guardar sin cambiar nada de la revision no registra', () => {
    expect(reviewChanged(state(), state())).toBe(false);
  });

  it('tildar un documento no es una decision de revision', () => {
    // El checklist cambia el puntaje, pero registrar cada tilde llenaria el
    // historial de ruido hasta volverlo inservible.
    expect(reviewChanged(state(), state({ phase1Score: 72 }))).toBe(false);
  });
});

describe('forma de la entrada', () => {
  it('guarda quien, cuando y en que quedo', () => {
    const e = buildHistoryEntry(state(), ACTOR, 1234);
    expect(e).toEqual({
      at: 1234,
      by: { uid: 'u1', name: 'Monica Gabriel' },
      status: 'Deficient',
      result: 'Deficient',
      reason: 'faltan medidas',
      deadline: DEADLINE,
      phase1Score: 90,
    });
  });

  it('nunca deja undefined: Firebase lo rechaza al escribir', () => {
    const e = buildHistoryEntry({ status: 'To review', outcome: undefined, phase1Score: null }, ACTOR, 1);
    expect(Object.values(e).some(v => v === undefined)).toBe(false);
    expect(e.result).toBeNull();
    expect(e.deadline).toBeNull();
    expect(e.reason).toBe('');
  });

  it('sin sesion identificable deja constancia igual', () => {
    const e = buildHistoryEntry(state(), { uid: null, name: '' }, 1);
    expect(e.by).toEqual({ uid: null, name: 'Unknown User' });
  });
});
