import { describe, it, expect } from 'vitest';
import { calculatePhase1ScoreAndStatus } from '../scoreCalculator';
import type { Project } from '../../types';

// Mediodia local para que la normalizacion a medianoche no dependa de la hora.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();

// Fechas con dia de semana conocido (2026):
const LUN_3  = at(2026, 8, 3);
const VIE_7  = at(2026, 8, 7);
const LUN_10 = at(2026, 8, 10);
const VIE_14 = at(2026, 8, 14);
const LUN_17 = at(2026, 8, 17);
const LUN_31 = at(2026, 8, 31);

// Todos los items entregados el mismo dia que el alta, salvo lo que se pise.
const checklist = (over: Partial<Project['checklist']> = {}, base = LUN_3): Project['checklist'] => ({
  kcdFile: base,
  jlContract: base,
  quoteComplete: base,
  quoteBreakdown: base,
  creditCardForm: base,
  drawingsSigned: base,
  finalMeasurementsApplies: false,
  finalMeasurementsDelivered: false,
  ...over,
});

const score = (over?: Partial<Project['checklist']>, createdAt = LUN_3) =>
  calculatePhase1ScoreAndStatus(checklist(over, createdAt), createdAt).score;

describe('calculatePhase1ScoreAndStatus — base', () => {
  it('da 100 y Approved si todo se entrega el mismo dia', () => {
    const r = calculatePhase1ScoreAndStatus(checklist(), LUN_3);
    expect(r.score).toBe(100);
    expect(r.status).toBe('Approved');
  });

  it('marca Rejected si falta un item obligatorio', () => {
    const r = calculatePhase1ScoreAndStatus(checklist({ drawingsSigned: false }), LUN_3);
    expect(r.status).toBe('Rejected');
  });

  it('sigue Approved aunque el puntaje baje por demoras', () => {
    const r = calculatePhase1ScoreAndStatus(checklist({ drawingsSigned: LUN_10 }), LUN_3);
    expect(r.status).toBe('Approved');
    expect(r.score).toBeLessThan(100);
  });
});

describe('dias habiles: los fines de semana no penalizan', () => {
  it('viernes -> lunes es 1 dia habil, no 3', () => {
    // -1 pt/dia los primeros 4 dias habiles
    expect(score({ drawingsSigned: LUN_10 }, VIE_7)).toBe(99);
  });

  it('lunes -> viernes de la misma semana son 4 dias habiles', () => {
    expect(score({ drawingsSigned: VIE_7 })).toBe(96); // 4 x 1
  });

  it('lunes -> lunes siguiente son 5 dias habiles, no 7', () => {
    // 4 x 1 + 1 x 2 = 6
    expect(score({ drawingsSigned: LUN_10 })).toBe(94);
  });

  it('dos semanas son 10 dias habiles, no 14', () => {
    // 4 x 1 + 6 x 2 = 16
    expect(score({ drawingsSigned: LUN_17 })).toBe(84);
  });

  it('un item entregado el mismo dia no penaliza', () => {
    expect(score({ drawingsSigned: LUN_3 })).toBe(100);
  });
});

describe('Final Measurements penaliza mucho mas suave', () => {
  const finals = (delivered: number) =>
    score({ finalMeasurementsApplies: LUN_3, finalMeasurementsDelivered: delivered });

  it('no penaliza si se entrega el mismo dia', () => {
    expect(finals(LUN_3)).toBe(100);
  });

  it('0.1 por dia habil durante la primera semana laboral', () => {
    expect(finals(VIE_7)).toBe(99.6);  // 4 habiles x 0.1 = 0.4
    expect(finals(LUN_10)).toBe(99.5); // 5 habiles x 0.1 = 0.5
  });

  it('0.2 por dia habil pasada la primera semana', () => {
    // 5 x 0.1 + 5 x 0.2 = 1.5
    expect(finals(LUN_17)).toBe(98.5);
    // 5 x 0.1 + 15 x 0.2 = 3.5
    expect(finals(LUN_31)).toBe(96.5);
  });

  it('pesa mucho menos que un item comun con la misma demora', () => {
    const comun = score({ drawingsSigned: LUN_17 });        // 10 habiles -> -16
    const final = finals(LUN_17);                            // 10 habiles -> -1.5
    expect(100 - final).toBeLessThan(100 - comun);
    expect(100 - final).toBeCloseTo(1.5, 5);
    expect(100 - comun).toBeCloseTo(16, 5);
  });

  it('no penaliza si Final Measurements no aplica, aunque no este entregado', () => {
    expect(score({ finalMeasurementsApplies: false, finalMeasurementsDelivered: false })).toBe(100);
  });
});

describe('acumulacion entre items', () => {
  it('suma las demoras de cada item', () => {
    // drawings 4 habiles (-4) + quote 4 habiles (-4)
    expect(score({ drawingsSigned: VIE_7, quoteComplete: VIE_7 })).toBe(92);
  });

  it('nunca baja de 0', () => {
    const muyTarde = at(2027, 6, 1);
    expect(score({
      kcdFile: muyTarde, jlContract: muyTarde, quoteComplete: muyTarde,
      quoteBreakdown: muyTarde, creditCardForm: muyTarde, drawingsSigned: muyTarde,
    })).toBe(0);
  });

  it('topea cada item comun en 20 puntos', () => {
    const muyTarde = at(2027, 6, 1);
    // Un solo item topeado: 100 - 20 = 80
    expect(score({ drawingsSigned: muyTarde })).toBe(80);
  });
});

describe('items nuevos no penalizan retroactivamente', () => {
  it('quoteBreakdown arranca su reloj el dia que se lanzo, no en createdAt', () => {
    // Proyecto viejo (marzo 2026); el item se lanzo el 28-jul-2026.
    const marzo = at(2026, 3, 2);
    const r = calculatePhase1ScoreAndStatus(
      checklist({ quoteBreakdown: at(2026, 7, 28) }, marzo),
      marzo,
    );
    // quoteBreakdown entregado el mismo dia del lanzamiento: sin penalizacion.
    // Los demas items estan al dia respecto de createdAt.
    expect(r.score).toBe(100);
  });
});
