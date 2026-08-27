import { describe, it, expect } from 'vitest';
import { measureValidation, pendingValidationMetrics } from '../validationMeasure';

// Indices de STAGES: 0 ENG, 1 CHK ENG, 2 PAPERWORK, 3 CHECK, 4 NESTING, 5 INSTALL
const stage = (iso, estimated = false) => ({ completed: true, timestamp: iso, estimated });

const stages = ({ check, nesting, checkEstimated = false, nestingEstimated = false }) => {
  const arr = Array(6).fill(false);
  if (check) arr[3] = stage(check, checkEstimated);
  if (nesting) arr[4] = stage(nesting, nestingEstimated);
  return arr;
};

describe('measureValidation', () => {
  it('devuelve las dos fechas reales y las horas entre ellas', () => {
    expect(measureValidation(stages({
      check: '2026-08-03T09:00:00.000Z',
      nesting: '2026-08-05T15:00:00.000Z',
    }))).toEqual({
      checkAt: '2026-08-03T09:00:00.000Z',
      nestingAt: '2026-08-05T15:00:00.000Z',
      hours: 54,
    });
  });

  it('devuelve null cuando alguna de las dos fechas es fabricada', () => {
    expect(measureValidation(stages({
      check: '2026-08-03T09:00:00.000Z',
      nesting: '2026-08-05T15:00:00.000Z',
      checkEstimated: true,
    }))).toBeNull();
  });

  it('devuelve null cuando falta NESTING', () => {
    expect(measureValidation(stages({ check: '2026-08-03T09:00:00.000Z' }))).toBeNull();
  });

  it('descarta una diferencia negativa', () => {
    expect(measureValidation(stages({
      check: '2026-08-05T00:00:00.000Z',
      nesting: '2026-08-03T00:00:00.000Z',
    }))).toBeNull();
  });

  it('descarta una diferencia mayor a 90 dias', () => {
    expect(measureValidation(stages({
      check: '2026-01-01T00:00:00.000Z',
      nesting: '2026-08-03T00:00:00.000Z',
    }))).toBeNull();
  });

  it('no explota con etapas ausentes', () => {
    expect(measureValidation(undefined)).toBeNull();
    expect(measureValidation([])).toBeNull();
  });
});

describe('pendingValidationMetrics', () => {
  const AHORA = '2026-08-27T12:00:00.000Z';
  const medible = {
    so: '111',
    stages: stages({ check: '2026-08-03T00:00:00.000Z', nesting: '2026-08-03T10:00:00.000Z' }),
  };

  it('arma el registro de un proyecto medible todavia no guardado', () => {
    expect(pendingValidationMetrics([medible], {}, AHORA)).toEqual([{
      so: '111',
      record: {
        checkAt: '2026-08-03T00:00:00.000Z',
        nestingAt: '2026-08-03T10:00:00.000Z',
        hours: 10,
        recordedAt: AHORA,
      },
    }]);
  });

  // El primer registro gana: un proyecto reabierto volveria a pasar por CHECK y
  // NESTING, y re-medirlo pisaria la validacion original con la de la segunda
  // vuelta.
  it('no vuelve a registrar un SO que ya esta guardado', () => {
    const existente = { '111': { checkAt: 'x', nestingAt: 'y', hours: 99, recordedAt: 'z' } };
    expect(pendingValidationMetrics([medible], existente, AHORA)).toEqual([]);
  });

  it('ignora los proyectos que todavia no son medibles', () => {
    const sinNesting = { so: '222', stages: stages({ check: '2026-08-03T00:00:00.000Z' }) };
    expect(pendingValidationMetrics([sinNesting], {}, AHORA)).toEqual([]);
  });

  it('ignora candidatos sin SO', () => {
    expect(pendingValidationMetrics([{ so: '', stages: medible.stages }], {}, AHORA)).toEqual([]);
  });

  it('devuelve un registro por cada proyecto medible', () => {
    const otro = {
      so: '222',
      stages: stages({ check: '2026-08-03T00:00:00.000Z', nesting: '2026-08-03T20:00:00.000Z' }),
    };
    const pending = pendingValidationMetrics([medible, otro], {}, AHORA);
    expect(pending.map(p => p.so)).toEqual(['111', '222']);
    expect(pending.map(p => p.record.hours)).toEqual([10, 20]);
  });
});
