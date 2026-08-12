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

  it('0.1 por dia habil durante los primeros 4 dias', () => {
    expect(finals(VIE_7)).toBe(99.6); // 4 habiles x 0.1 = 0.4
  });

  it('0.4 por dia habil a partir del 4to dia', () => {
    // 4 x 0.1 + 1 x 0.4 = 0.8
    expect(finals(LUN_10)).toBe(99.2);
    // 4 x 0.1 + 6 x 0.4 = 2.8
    expect(finals(LUN_17)).toBe(97.2);
    // 4 x 0.1 + 16 x 0.4 = 6.8
    expect(finals(LUN_31)).toBe(93.2);
  });

  it('usa el mismo corte de 4 dias que los items comunes, pero tasa mas baja', () => {
    const comun = score({ drawingsSigned: LUN_17 });        // 10 habiles -> -16
    const final = finals(LUN_17);                            // 10 habiles -> -2.8
    expect(100 - final).toBeLessThan(100 - comun);
    expect(100 - final).toBeCloseTo(2.8, 5);
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

describe('excepcion: subir un documento en dia inhabil si penaliza', () => {
  // LUN_3 = lunes 3-ago-2026. El fin de semana anterior es sab 1 / dom 2, y
  // VIE_7 es el viernes de esa misma semana.
  const VIE_31 = at(2026, 7, 31);
  const SAB_1  = at(2026, 8, 1);
  const DOM_2  = at(2026, 8, 2);

  it('un documento subido el sabado cuesta 1 punto', () => {
    expect(score({ drawingsSigned: SAB_1 }, VIE_31)).toBe(99);
  });

  it('subido el domingo cuesta 2: tambien paso el sabado', () => {
    expect(score({ drawingsSigned: DOM_2 }, VIE_31)).toBe(98);
  });

  it('subido el lunes sigue costando 1: la regla base no cambio', () => {
    expect(score({ drawingsSigned: LUN_3 }, VIE_31)).toBe(99);
  });

  it('un item sin marcar no paga recargo de fin de semana', () => {
    // Se mide contra hoy con la regla base. Con createdAt = ahora son 0 dias,
    // asi que el resultado no depende de que hoy sea sabado o domingo.
    const ahora = Date.now();
    const r = calculatePhase1ScoreAndStatus(
      { ...checklist({}, ahora), drawingsSigned: false },
      ahora,
    );
    expect(r.score).toBe(100);
    expect(r.status).toBe('Rejected');
  });
});

describe('items sin entregar: el parametro `now` frena el reloj', () => {
  // El puntaje ahora se deriva en cada lectura (ver KpiContext), asi que un
  // item sin tildar seguiria descontando para siempre contra "hoy". Un
  // proyecto ya cerrado en Fase 2 pasa su closedAt: nada mas va a llegar.
  const sinDrawings = checklist({ drawingsSigned: false }, LUN_3);

  it('sin `now` mide contra hoy y el faltante sigue corriendo', () => {
    // LUN_3 es 2026, muy en el pasado respecto de cualquier corrida real, asi
    // que el item faltante ya toco el tope por item.
    const r = calculatePhase1ScoreAndStatus(sinDrawings, LUN_3);
    expect(r.score).toBeLessThan(100);
    expect(r.status).toBe('Rejected');
  });

  it('con `now` = fecha de cierre, el faltante deja de acumular ahi', () => {
    // Cerrado el viernes 7: 4 dias habiles de atraso -> -4.
    const r = calculatePhase1ScoreAndStatus(sinDrawings, LUN_3, VIE_7);
    expect(r.score).toBe(96);
  });

  it('cerrado el mismo dia del alta, un faltante no descuenta nada', () => {
    const r = calculatePhase1ScoreAndStatus(sinDrawings, LUN_3, LUN_3);
    expect(r.score).toBe(100);
    expect(r.status).toBe('Rejected'); // falta el documento, pero sin demora
  });

  it('`now` no afecta a los items ya entregados', () => {
    const entregados = checklist({}, LUN_3);
    expect(calculatePhase1ScoreAndStatus(entregados, LUN_3, VIE_7).score).toBe(100);
    expect(calculatePhase1ScoreAndStatus(entregados, LUN_3, LUN_31).score).toBe(100);
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

describe('alta retroactiva: el reloj no puede arrancar despues del primer papel', () => {
  // Un proyecto cargado en el modulo despues de haber arrancado tenia
  // createdAt = "hoy". Como businessDaysBetween devuelve 0 cuando el fin es
  // anterior al inicio, TODO documento con fecha previa daba 0 dias de atraso
  // y el puntaje quedaba clavado en 100 por mas dispersas que fueran las
  // fechas. El baseline es ahora min(createdAt, primer item tildado).

  it('penaliza la dispersion entre documentos aunque el alta sea posterior a todos', () => {
    // Caso real reportado: alta el 11-ago, papeles entre el 31-jul y el 11-ago.
    const alta = at(2026, 8, 11);
    const r = calculatePhase1ScoreAndStatus(
      {
        kcdFile: at(2026, 8, 1),
        jlContract: at(2026, 7, 31),
        quoteComplete: at(2026, 8, 11),
        quoteBreakdown: at(2026, 8, 11),
        creditCardForm: at(2026, 7, 31),
        drawingsSigned: at(2026, 7, 31),
        finalMeasurementsApplies: at(2026, 8, 11),
        finalMeasurementsDelivered: at(2026, 8, 11),
      },
      alta,
    );
    // Baseline = 31-jul (viernes).
    //   kcdFile      sab 01-ago  -> 1 dia por la excepcion de fin de semana  -1
    //   quoteComplete    11-ago  -> 7 dias habiles                          -10
    //   quoteBreakdown   11-ago  -> 7 dias habiles                          -10
    //   finalMeasurements 11-ago -> 7 dias habiles a tasa suave              -1.6
    // El resto llego el mismo 31-jul: dia 0, sin costo.
    expect(r.score).toBe(77.4);
    expect(r.status).toBe('Approved');
  });

  it('un alta anterior al primer papel manda: no se le regalan esos dias', () => {
    // createdAt lunes 3, todos los papeles el lunes 10 -> el baseline sigue
    // siendo el 3: 5 dias habiles por item (-4 los primeros 4, -2 el quinto),
    // 6 items obligatorios = -36.
    const r = calculatePhase1ScoreAndStatus(checklist({}, LUN_10), LUN_3);
    expect(r.score).toBe(64);
  });

  it('sin ningun item tildado el baseline sigue siendo createdAt', () => {
    const vacio = {
      kcdFile: false, jlContract: false, quoteComplete: false,
      quoteBreakdown: false, creditCardForm: false, drawingsSigned: false,
      finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
    } as const;
    // Todos sin marcar cuentan contra hoy; con createdAt = hoy son 0 dias.
    const r = calculatePhase1ScoreAndStatus(vacio, Date.now());
    expect(r.score).toBe(100);
    expect(r.status).toBe('Rejected');
  });

  it('ignora los valores booleanos de registros viejos al buscar el minimo', () => {
    // Antes las marcas se guardaban como `true`, no como timestamp. Un `true`
    // colado en el Math.min daria baseline = 1ms de 1970 y hundiria el puntaje.
    const r = calculatePhase1ScoreAndStatus(
      { ...checklist({}, LUN_10), kcdFile: true as unknown as number },
      LUN_10,
    );
    expect(r.score).toBe(100);
  });
});
