import { describe, it, expect } from 'vitest';
import {
  requiresReasonAndDeadline, outcomeToStatus, statusToOutcome, missingOutcomeFields,
  overdueBusinessDays, overduePenalty, effectivePhase1Score, isOverdue,
  MAX_OVERDUE_PENALTY,
} from '../phase1Outcome';
import type { Phase1OutcomeRecord } from '../../types';

// Lunes 3-ago-2026, para que la aritmetica de dias habiles sea legible.
const MON = new Date(2026, 7, 3).getTime();
const day = (n: number) => new Date(2026, 7, 3 + n).getTime();

const record = (over: Partial<Phase1OutcomeRecord> = {}): Phase1OutcomeRecord => ({
  result: 'Deficient', reason: 'faltan medidas', deadline: MON,
  setAt: MON, resolvedAt: null, ...over,
});

describe('que exige cada resultado', () => {
  it('Complete no pide nada escrito', () => {
    expect(requiresReasonAndDeadline('Complete')).toBe(false);
    expect(missingOutcomeFields('Complete', '', null)).toEqual([]);
  });

  it('Deficient exige aviso escrito y plazo de subsanacion', () => {
    expect(requiresReasonAndDeadline('Deficient')).toBe(true);
    expect(missingOutcomeFields('Deficient', '', null)).toHaveLength(2);
    expect(missingOutcomeFields('Deficient', 'hay errores', null)).toHaveLength(1);
    expect(missingOutcomeFields('Deficient', 'hay errores', MON)).toEqual([]);
  });

  it('Deferred exige razon escrita y plazo', () => {
    expect(requiresReasonAndDeadline('Deferred')).toBe(true);
    expect(missingOutcomeFields('Deferred', '', null)).toHaveLength(2);
    expect(missingOutcomeFields('Deferred', 'falta el contrato', MON)).toEqual([]);
  });

  it('no acepta un motivo en blanco', () => {
    expect(missingOutcomeFields('Deficient', '    ', MON)).toHaveLength(1);
  });

  it('sin resultado elegido no se puede guardar', () => {
    expect(missingOutcomeFields('', 'algo', MON)).toEqual(['Review result']);
  });
});

describe('mapeo a estado del proyecto', () => {
  it('Complete se guarda como Approved, que es lo que habilita Fase 2', () => {
    expect(outcomeToStatus('Complete')).toBe('Approved');
  });

  it('Deficient y Deferred son estados propios', () => {
    expect(outcomeToStatus('Deficient')).toBe('Deficient');
    expect(outcomeToStatus('Deferred')).toBe('Deferred');
  });

  it('se puede volver del estado al resultado', () => {
    expect(statusToOutcome('Approved')).toBe('Complete');
    expect(statusToOutcome('Deficient')).toBe('Deficient');
    expect(statusToOutcome('Deferred')).toBe('Deferred');
    expect(statusToOutcome('Pending')).toBeNull();
  });

  it('un proyecto ya cerrado en Fase 2 cuenta como Complete', () => {
    // Si no, abrirlo para corregir un typo del checklist exigia volver a elegir
    // un resultado que el proyecto ya habia obtenido.
    expect(statusToOutcome('Completed')).toBe('Complete');
  });
});

describe('dias habiles vencidos', () => {
  it('el mismo dia del plazo todavia no esta vencido', () => {
    expect(overdueBusinessDays(record(), MON)).toBe(0);
  });

  it('cuenta desde el dia siguiente al plazo', () => {
    expect(overdueBusinessDays(record(), day(1))).toBe(1);
    expect(overdueBusinessDays(record(), day(2))).toBe(2);
  });

  it('no cuenta el fin de semana', () => {
    // Plazo el lunes 3; el lunes siguiente (dia 7) son 5 habiles, no 7.
    expect(overdueBusinessDays(record(), day(7))).toBe(5);
  });

  it('se congela cuando se subsana', () => {
    const r = record({ resolvedAt: day(2) });
    expect(overdueBusinessDays(r, day(30))).toBe(2);
  });

  it('un Complete que nunca tuvo plazo no acumula nada', () => {
    expect(overdueBusinessDays(record({ result: 'Complete', deadline: 0 }), day(30))).toBe(0);
  });

  it('subsanar tarde no borra lo acumulado: pasa a Complete pero conserva el plazo', () => {
    const cured = record({ result: 'Complete', resolvedAt: day(2) });
    expect(overdueBusinessDays(cured, day(365))).toBe(2);
  });

  it('un proyecto sin resultado no acumula nada', () => {
    expect(overdueBusinessDays(undefined, day(30))).toBe(0);
  });
});

describe('penalizacion por vencimiento', () => {
  it('en plazo no descuenta', () => {
    expect(overduePenalty(record(), MON)).toBe(0);
  });

  it('-1 por dia habil los primeros 4 dias', () => {
    expect(overduePenalty(record(), day(1))).toBe(1);
    expect(overduePenalty(record(), day(2))).toBe(2);
  });

  it('-2 por dia a partir del quinto', () => {
    // dia 7 => 5 habiles => 4x1 + 1x2 = 6
    expect(overduePenalty(record(), day(7))).toBe(6);
  });

  it('tiene tope', () => {
    expect(overduePenalty(record(), day(365))).toBe(MAX_OVERDUE_PENALTY);
  });

  it('elegir Deficient por si solo no descuenta nada', () => {
    // El resultado es un diagnostico, no una falta: solo cuesta pasarse del plazo.
    expect(overduePenalty(record({ deadline: day(10) }), MON)).toBe(0);
  });
});

describe('puntaje efectivo', () => {
  it('sin resultado devuelve el guardado', () => {
    expect(effectivePhase1Score({ phase1Score: 90, outcome: undefined }, day(30))).toBe(90);
  });

  it('descuenta lo acumulado por el plazo vencido', () => {
    expect(effectivePhase1Score({ phase1Score: 90, outcome: record() }, day(2))).toBe(88);
  });

  it('un Complete limpio no descuenta', () => {
    const r = record({ result: 'Complete', deadline: 0 });
    expect(effectivePhase1Score({ phase1Score: 90, outcome: r }, day(30))).toBe(90);
  });

  it('un Complete subsanado tarde arrastra su descuento', () => {
    const r = record({ result: 'Complete', resolvedAt: day(2) });
    expect(effectivePhase1Score({ phase1Score: 90, outcome: r }, day(365))).toBe(88);
  });

  it('no baja de cero', () => {
    expect(effectivePhase1Score({ phase1Score: 3, outcome: record() }, day(365))).toBe(0);
  });

  it('un proyecto sin puntaje sigue sin puntaje', () => {
    expect(effectivePhase1Score({ phase1Score: null, outcome: record() }, day(30))).toBeNull();
  });
});

describe('marca de vencido', () => {
  it('en plazo no esta vencido', () => {
    expect(isOverdue(record(), MON)).toBe(false);
  });

  it('pasado el plazo y sin subsanar, si', () => {
    expect(isOverdue(record(), day(1))).toBe(true);
  });

  it('ya subsanado deja de marcarse aunque haya sido tarde', () => {
    expect(isOverdue(record({ resolvedAt: day(2) }), day(30))).toBe(false);
  });
});
