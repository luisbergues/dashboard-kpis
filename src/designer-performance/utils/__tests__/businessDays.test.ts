import { describe, it, expect } from 'vitest';
import { businessDaysBetween, deliveryDaysLate } from '../businessDays';

// Mediodia local para que la normalizacion a medianoche no dependa de la hora.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();

// Semana de referencia (2026): 31-jul es viernes.
const MIE_29 = at(2026, 7, 29);
const JUE_30 = at(2026, 7, 30);
const VIE_31 = at(2026, 7, 31);
const SAB_1  = at(2026, 8, 1);
const DOM_2  = at(2026, 8, 2);
const LUN_3  = at(2026, 8, 3);
const MAR_4  = at(2026, 8, 4);

describe('businessDaysBetween — regla base (sin cambios)', () => {
  it('viernes -> lunes es 1 dia habil, no 3', () => {
    expect(businessDaysBetween(VIE_31, LUN_3)).toBe(1);
  });

  it('el fin de semana no suma cuando la entrega cae en dia habil', () => {
    expect(businessDaysBetween(VIE_31, MAR_4)).toBe(2);
  });

  it('entregar el mismo dia es 0', () => {
    expect(businessDaysBetween(VIE_31, VIE_31)).toBe(0);
  });

  it('una entrega en fin de semana no suma nada (por eso hace falta la excepcion)', () => {
    expect(businessDaysBetween(VIE_31, SAB_1)).toBe(0);
    expect(businessDaysBetween(VIE_31, DOM_2)).toBe(0);
  });
});

describe('deliveryDaysLate — excepcion: subir en dia inhabil si cuenta', () => {
  it('subir el sabado cuenta 1 dia', () => {
    expect(deliveryDaysLate(VIE_31, SAB_1)).toBe(1);
  });

  it('subir el domingo cuenta 2: para llegar ahi paso tambien el sabado', () => {
    expect(deliveryDaysLate(VIE_31, DOM_2)).toBe(2);
  });

  it('entregar en dia habil deja la regla base intacta', () => {
    expect(deliveryDaysLate(VIE_31, LUN_3)).toBe(1);
    expect(deliveryDaysLate(VIE_31, MAR_4)).toBe(2);
    expect(deliveryDaysLate(VIE_31, VIE_31)).toBe(0);
  });

  it('el recargo se suma a los dias habiles ya acumulados', () => {
    // Mie -> Sab: jueves y viernes habiles (2) + el sabado de entrega (1).
    expect(deliveryDaysLate(MIE_29, SAB_1)).toBe(3);
    // Mie -> Dom: los mismos 2 habiles + sabado y domingo (2).
    expect(deliveryDaysLate(MIE_29, DOM_2)).toBe(4);
    expect(deliveryDaysLate(JUE_30, SAB_1)).toBe(2);
  });

  it('no cobra dias de fin de semana anteriores al inicio del reloj', () => {
    // El baseline ya es sabado: solo el domingo puede sumar.
    expect(deliveryDaysLate(SAB_1, DOM_2)).toBe(1);
    // Y entregar el mismo sabado del baseline sigue siendo dia 0.
    expect(deliveryDaysLate(SAB_1, SAB_1)).toBe(0);
    expect(deliveryDaysLate(DOM_2, DOM_2)).toBe(0);
  });

  it('una entrega anterior al inicio del reloj sigue siendo 0', () => {
    expect(deliveryDaysLate(LUN_3, SAB_1)).toBe(0);
  });

  it('el recargo no se acumula por semanas: solo cuenta el fin de semana de la entrega', () => {
    // Vie 31-jul -> Sab 8-ago: 5 dias habiles (3,4,5,6,7) + el sabado 8.
    expect(deliveryDaysLate(VIE_31, at(2026, 8, 8))).toBe(6);
  });
});
