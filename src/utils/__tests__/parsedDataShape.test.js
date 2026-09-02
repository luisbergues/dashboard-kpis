import { describe, it, expect } from 'vitest';
import { normalizeParsedData, emptyParsedData, PARSED_ARRAY_FIELDS } from '../parsedDataShape';

// Lo que RTDB devuelve despues de guardar un parsedData con secciones vacias:
// las claves de array vacio simplemente no estan.
const cacheDegradado = {
  priorityAnalysis: [{ so: '111', name: 'Casa A' }],
  weekOverWeek: [{ metric: 'Completed Projects', current: '2', previous: '1' }],
  insights: { executive: 'texto' },
  weekLabels: { previous: 'JULY 6, 2026', current: 'JULY 13, 2026' },
  // onHoldNotes, meetingPoints, topCostProjects, materialRequirements,
  // statusHistory, financialImpact y alerts fueron borrados por RTDB.
};

describe('normalizeParsedData', () => {
  it('devuelve array en todos los campos que el parser garantiza', () => {
    const out = normalizeParsedData(cacheDegradado);
    for (const field of PARSED_ARRAY_FIELDS) {
      expect(Array.isArray(out[field]), `${field} deberia ser array`).toBe(true);
    }
  });

  it('onHoldNotes vuelve como array vacio: es el crash de PipelineView', () => {
    // PipelineView hace onHoldNotes.find(...) sin guard dentro de un .map.
    const out = normalizeParsedData(cacheDegradado);
    expect(out.onHoldNotes).toEqual([]);
    expect(() => out.onHoldNotes.find(n => n.project === 'x')).not.toThrow();
  });

  it('no pisa los datos que si llegaron', () => {
    const out = normalizeParsedData(cacheDegradado);
    expect(out.priorityAnalysis).toHaveLength(1);
    expect(out.priorityAnalysis[0].so).toBe('111');
    expect(out.weekLabels.current).toBe('JULY 13, 2026');
    expect(out.insights.executive).toBe('texto');
  });

  it('completa los sub-campos que faltan sin borrar los presentes', () => {
    const out = normalizeParsedData(cacheDegradado);
    // insights llego con executive solo; weekly y actionPlan tienen que existir.
    expect(out.insights.weekly).toBe('');
    expect(out.insights.actionPlan).toBe('');
  });

  it('restaura alerts, que desaparece entero por tener todos los valores null', () => {
    const out = normalizeParsedData(cacheDegradado);
    expect(out.alerts).toEqual({ unassignedEngineer: null, pendingCheckReview: null });
  });

  it('restaura financialImpact.rows', () => {
    const out = normalizeParsedData({ ...cacheDegradado, financialImpact: { description: 'algo' } });
    expect(out.financialImpact.description).toBe('algo');
    expect(out.financialImpact.rows).toEqual([]);
  });

  it('convierte los objetos indexados que RTDB devuelve en lugar de arrays', () => {
    // Pasa cuando las claves del array dejaron de ser contiguas.
    const out = normalizeParsedData({ ...cacheDegradado, onHoldNotes: { 0: { project: 'A' }, 2: { project: 'B' } } });
    expect(out.onHoldNotes).toEqual([{ project: 'A' }, { project: 'B' }]);
  });

  it('un parsedData completo pasa sin cambios de forma', () => {
    const completo = emptyParsedData();
    expect(normalizeParsedData(completo)).toEqual(completo);
  });

  it('entradas que no son objeto devuelven null', () => {
    expect(normalizeParsedData(null)).toBeNull();
    expect(normalizeParsedData(undefined)).toBeNull();
    expect(normalizeParsedData('x')).toBeNull();
    expect(normalizeParsedData([1, 2])).toBeNull();
  });
});
