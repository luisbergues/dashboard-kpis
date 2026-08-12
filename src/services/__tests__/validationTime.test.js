import { describe, it, expect } from 'vitest';
import { calculateGlobalValidationTime } from '../kpiCalculator';
import { calculateAutomaticStages } from '../../utils/stageUtils';

/* La tarjeta "Avg. Validation Time" mostraba 0 hrs de forma permanente por dos
   motivos independientes:
     1. Medía Paperwork -> CHECK (etapas 2 -> 3) en vez de CHECK -> NESTING.
     2. No descartaba las fechas FABRICADAS. El sheet trae una sola fecha por
        proyecto (la del estado actual), así que calculateAutomaticStages marca
        toda etapa anterior con `estimated: true` y la hora de "ahora": dos
        etapas fabricadas daban diferencia 0, y una fabricada contra una real
        daba diferencia negativa. Las dos quedaban fuera de los filtros. */

const stage = (iso, estimated = false) => ({ completed: true, timestamp: iso, estimated });

// Índices: 0 ENG, 1 CHK ENG, 2 PAPERWORK, 3 CHECK, 4 NESTING, 5 INSTALL
const stages = ({ check, nesting, checkEstimated = false, nestingEstimated = false }) => {
  const arr = Array(6).fill(false);
  if (check) arr[3] = stage(check, checkEstimated);
  if (nesting) arr[4] = stage(nesting, nestingEstimated);
  return arr;
};

describe('calculateGlobalValidationTime — CHECK a NESTING', () => {
  it('mide las horas entre CHECK y NESTING', () => {
    const r = calculateGlobalValidationTime(
      { '111': stages({ check: '2026-08-03T09:00:00Z', nesting: '2026-08-05T15:00:00Z' }) },
      [{ so: '111' }],
    );
    expect(r).toEqual({ hours: 54, sampleSize: 1 });
  });

  it('promedia entre proyectos y reporta el tamaño de la muestra', () => {
    const r = calculateGlobalValidationTime(
      {
        '111': stages({ check: '2026-08-03T00:00:00Z', nesting: '2026-08-03T10:00:00Z' }), // 10h
        '222': stages({ check: '2026-08-03T00:00:00Z', nesting: '2026-08-03T20:00:00Z' }), // 20h
      },
      [{ so: '111' }, { so: '222' }],
    );
    expect(r).toEqual({ hours: 15, sampleSize: 2 });
  });

  it('descarta las etapas con fecha fabricada', () => {
    const r = calculateGlobalValidationTime(
      { '111': stages({ check: '2026-08-03T09:00:00Z', nesting: '2026-08-05T15:00:00Z', checkEstimated: true }) },
      [{ so: '111' }],
    );
    expect(r).toBeNull();
  });

  it('mezcla: solo entra el proyecto con las dos fechas reales', () => {
    const r = calculateGlobalValidationTime(
      {
        '111': stages({ check: '2026-08-03T00:00:00Z', nesting: '2026-08-03T10:00:00Z' }),
        '222': stages({ check: '2026-08-03T00:00:00Z', nesting: '2026-08-04T00:00:00Z', nestingEstimated: true }),
      },
      [{ so: '111' }, { so: '222' }],
    );
    expect(r).toEqual({ hours: 10, sampleSize: 1 });
  });

  it('devuelve null —no 0— cuando no hay ningun proyecto medible', () => {
    expect(calculateGlobalValidationTime({}, [])).toBeNull();
    expect(calculateGlobalValidationTime(null, [])).toBeNull();
    expect(calculateGlobalValidationTime(
      { '111': stages({ check: '2026-08-03T00:00:00Z' }) }, // sin NESTING
      [{ so: '111' }],
    )).toBeNull();
  });

  it('ignora diferencias negativas y absurdamente largas', () => {
    const negativa = calculateGlobalValidationTime(
      { '111': stages({ check: '2026-08-05T00:00:00Z', nesting: '2026-08-03T00:00:00Z' }) },
      [{ so: '111' }],
    );
    expect(negativa).toBeNull();

    const eterna = calculateGlobalValidationTime(
      { '111': stages({ check: '2026-01-01T00:00:00Z', nesting: '2026-08-03T00:00:00Z' }) },
      [{ so: '111' }],
    );
    expect(eterna).toBeNull();
  });

  it('una transicion en el mismo instante cuenta como 0 horas, no se descarta', () => {
    const r = calculateGlobalValidationTime(
      { '111': stages({ check: '2026-08-03T00:00:00Z', nesting: '2026-08-03T00:00:00Z' }) },
      [{ so: '111' }],
    );
    expect(r).toEqual({ hours: 0, sampleSize: 1 });
  });
});

describe('integracion con calculateAutomaticStages', () => {
  const proyecto = {
    so: '444',
    status: 'NESTING',
    statusHistory: [{ status: 'NESTING', statusDate: '2026-08-05' }],
  };

  it('sin historial registrado no hay nada que medir', () => {
    // Este es el estado real de hoy: el sheet solo aporta la fecha del estado
    // actual, asi que CHECK sale fabricado.
    const st = { '444': calculateAutomaticStages(proyecto) };
    expect(calculateGlobalValidationTime(st, [proyecto])).toBeNull();
  });

  it('con las transiciones de project_history sale el tiempo real', () => {
    const historial = [
      { type: 'stage_status', status: 'CHECK', timestamp: '2026-08-03T09:00:00.000Z' },
      { type: 'stage_status', status: 'NESTING', timestamp: '2026-08-05T15:00:00.000Z' },
    ];
    const st = { '444': calculateAutomaticStages(proyecto, historial) };
    expect(calculateGlobalValidationTime(st, [proyecto])).toEqual({ hours: 54, sampleSize: 1 });
  });
});
