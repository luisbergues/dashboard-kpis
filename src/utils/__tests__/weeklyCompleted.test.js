import { describe, it, expect } from 'vitest';
import {
  buildCompletedEntry,
  completedEntryChanged,
  normalizeWeeklyCompleted,
  weeklyCompleted,
  completedChartSeries,
} from '../weeklyCompleted';

const wow = [
  { metric: 'Total Active Projects', previous: '25', current: '22', variance: '-3' },
  { metric: 'Completed Projects', previous: '102', current: '140', variance: '38' },
];
const nov13 = new Date(2026, 10, 13); // viernes -> semana del lunes 9

describe('buildCompletedEntry', () => {
  it('la clave es el lunes de la semana, no lo que diga el sheet', () => {
    expect(buildCompletedEntry(wow, 'August 24, 2026', nov13).weekStart).toBe('2026-11-09');
  });

  it('un domingo pertenece a la semana que arranco el lunes anterior', () => {
    expect(buildCompletedEntry(wow, '', new Date(2026, 10, 15)).weekStart).toBe('2026-11-09');
  });

  it('guarda solo la fila Completed Projects', () => {
    expect(buildCompletedEntry(wow, 'November 2, 2026', nov13))
      .toEqual({ weekStart: '2026-11-09', completedTotal: 140, completedThisWeek: 38 });
  });

  it('con Previous Week congelada (August 24) no guarda la Variance: no es de esta semana', () => {
    expect(buildCompletedEntry(wow, 'August 24, 2026', nov13))
      .toEqual({ weekStart: '2026-11-09', completedTotal: 140 });
  });

  it('sin la fila guarda 0', () => {
    expect(buildCompletedEntry(undefined, 'November 2, 2026', nov13).completedTotal).toBe(0);
  });
});

describe('completedEntryChanged', () => {
  const entry = { weekStart: '2026-11-09', completedTotal: 140 };

  it('sin registro guardado hay que escribir', () => {
    expect(completedEntryChanged(null, entry)).toBe(true);
  });

  it('el mismo valor (con savedAt y claves en otro orden) no reescribe', () => {
    expect(completedEntryChanged({ savedAt: 'x', completedTotal: 140, weekStart: '2026-11-09' }, entry)).toBe(false);
  });

  it('un acumulado distinto reescribe', () => {
    expect(completedEntryChanged({ completedTotal: 139 }, entry)).toBe(true);
  });
});

describe('normalizeWeeklyCompleted', () => {
  it('ordena por semana y descarta claves que no son fechas', () => {
    const result = normalizeWeeklyCompleted({
      '2026-11-16': { completedTotal: 146 },
      '2026-11-09': { completedTotal: 140 },
      'basura': { completedTotal: 1 },
    });
    expect(result.map(r => r.completedTotal)).toEqual([140, 146]);
    expect(result[0].weekDate).toEqual(new Date(2026, 10, 9));
  });

  it('nodo vacio', () => {
    expect(normalizeWeeklyCompleted(null)).toEqual([]);
  });
});

describe('weeklyCompleted', () => {
  const week = (iso, fields) => ({ weekDate: new Date(iso + 'T00:00:00'), ...fields });

  it('usa completedThisWeek cuando se guardo', () => {
    expect(weeklyCompleted([week('2026-11-09', { completedTotal: 140, completedThisWeek: 38 })])).toEqual([38]);
  });

  it('si no, resta el acumulado contra la semana anterior', () => {
    const h = [week('2026-11-09', { completedTotal: 140 }), week('2026-11-16', { completedTotal: 146 })];
    expect(weeklyCompleted(h)).toEqual([null, 6]);
  });

  it('no resta a traves de semanas faltantes', () => {
    const h = [week('2026-11-09', { completedTotal: 140 }), week('2026-11-30', { completedTotal: 160 })];
    expect(weeklyCompleted(h)).toEqual([null, null]);
  });

  it('una caida del acumulado no se grafica como negativa', () => {
    const h = [week('2026-11-09', { completedTotal: 140 }), week('2026-11-16', { completedTotal: 40 })];
    expect(weeklyCompleted(h)).toEqual([null, null]);
  });
});

describe('completedChartSeries', () => {
  const week = (iso, fields) => ({ weekDate: new Date(iso + 'T00:00:00'), ...fields });
  const start = new Date(2026, 10, 16);

  it('antes de la fecha de inicio no muestra nada', () => {
    expect(completedChartSeries([week('2026-11-09', { completedTotal: 140 })], start)).toEqual([]);
  });

  it('la primera semana visible resta contra la anterior aunque esa no se muestre', () => {
    const h = [week('2026-11-09', { completedTotal: 140 }), week('2026-11-16', { completedTotal: 146 })];
    expect(completedChartSeries(h, start)).toEqual([{ weekDate: h[1].weekDate, value: 6 }]);
  });
});
