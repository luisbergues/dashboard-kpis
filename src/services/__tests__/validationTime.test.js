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

/* Los proyectos cerrados salen de priorityAnalysis y su project_history se
   borra al archivarse, asi que la muestra viva se recicla en vez de crecer.
   archive/validation_metrics guarda la medicion congelada de cada proyecto
   (ver validationMetrics.js) y la tarjeta la suma a lo que este vivo. */
describe('calculateGlobalValidationTime — registros guardados', () => {
  const guardado = (hours) => ({ checkAt: 'a', nestingAt: 'b', hours, recordedAt: 'c' });

  it('suma los registros guardados a la muestra viva', () => {
    const r = calculateGlobalValidationTime(
      { '111': stages({ check: '2026-08-03T00:00:00Z', nesting: '2026-08-03T10:00:00Z' }) }, // 10h
      [{ so: '111' }],
      { '999': guardado(20) },
    );
    expect(r).toEqual({ hours: 15, sampleSize: 2 });
  });

  it('promedia solo con guardados cuando no queda ningun proyecto vivo medible', () => {
    const r = calculateGlobalValidationTime({}, [], { '999': guardado(30), '888': guardado(10) });
    expect(r).toEqual({ hours: 20, sampleSize: 2 });
  });

  it('cuenta una sola vez un SO que esta guardado y vivo a la vez', () => {
    const r = calculateGlobalValidationTime(
      { '111': stages({ check: '2026-08-03T00:00:00Z', nesting: '2026-08-03T10:00:00Z' }) },
      [{ so: '111' }],
      { '111': guardado(50) },
    );
    // Gana el registro guardado: es la medicion original, congelada.
    expect(r).toEqual({ hours: 50, sampleSize: 1 });
  });

  it('descarta un registro corrupto en vez de envenenar el promedio', () => {
    const r = calculateGlobalValidationTime({}, [], {
      '111': guardado(10),
      '222': guardado('muchas'),
      '333': guardado(-5),
      '444': guardado(91 * 24),
      '555': null,
    });
    expect(r).toEqual({ hours: 10, sampleSize: 1 });
  });

  it('sigue devolviendo null cuando no hay ni guardados ni vivos', () => {
    expect(calculateGlobalValidationTime({}, [], {})).toBeNull();
    expect(calculateGlobalValidationTime(null, [], undefined)).toBeNull();
  });
});
