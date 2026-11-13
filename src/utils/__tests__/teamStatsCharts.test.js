import { describe, it, expect } from 'vitest';
import { weeklyTimeline, monthTotals, shortMonth } from '../teamStatsCharts';

const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
const current = {
  month: 'November 2026',
  weeks,
  rows: [
    { engineer: 'Luis', weeks: [85939.22, 4165.9, 0, 0, 0], monthTotal: 90105.12 },
    { engineer: 'Rocio', weeks: [0, 0, 0, 0, 0], monthTotal: 0 },
  ],
};
const previous = {
  month: 'October 2026',
  weeks,
  rows: [
    { engineer: 'Luis', weeks: [25176.9, 15977.5, 48931.65, -50026.22, 101575.78], monthTotal: 141635.61 },
    { engineer: 'Andres', weeks: [0, 0, 40735.88, 17321.05, 10404.8], monthTotal: 68461.73 },
  ],
};

describe('shortMonth', () => {
  it('abrevia segun el idioma', () => {
    expect(shortMonth('November 2026')).toBe('Nov');
    expect(shortMonth('October 2026', 'es')).toBe('oct');
  });
});

describe('weeklyTimeline', () => {
  const t = weeklyTimeline(previous, current);

  it('pone las semanas del mes anterior antes que las del actual', () => {
    expect(t.labels).toEqual(['Oct W1', 'Oct W2', 'Oct W3', 'Oct W4', 'Oct W5', 'Nov W1', 'Nov W2']);
  });

  it('recorta las semanas del mes actual que todavia no pasaron (todo en cero)', () => {
    expect(t.labels).not.toContain('Nov W3');
  });

  it('una serie por ingeniero, con 0 donde no figura en ese mes', () => {
    const andres = t.series.find(s => s.engineer === 'Andres');
    expect(andres.data).toEqual([0, 0, 40735.88, 17321.05, 10404.8, 0, 0]);
  });

  it('conserva los negativos de la hoja', () => {
    expect(t.series.find(s => s.engineer === 'Luis').data[3]).toBeCloseTo(-50026.22);
  });

  it('sin tablas devuelve null', () => {
    expect(weeklyTimeline(null, null)).toBeNull();
  });
});

describe('monthTotals', () => {
  it('Month Total por ingeniero, mes anterior y actual', () => {
    expect(monthTotals(previous, current)).toEqual({
      engineers: ['Luis', 'Andres', 'Rocio'],
      months: [
        { month: 'October 2026', data: [141635.61, 68461.73, 0] },
        { month: 'November 2026', data: [90105.12, 0, 0] },
      ],
    });
  });

  it('funciona con un solo mes', () => {
    expect(monthTotals(null, current).months).toHaveLength(1);
  });
});
