import { describe, it, expect } from 'vitest';
import {
  parseWeekLabel,
  weekKey,
  formatWeekAxisLabel,
  normalizeWeeklyHistory,
} from '../weeklyHistory';

const snap = (label, metrics, savedAt) => ({ label, metrics, savedAt });

describe('parseWeekLabel', () => {
  it('parsea la etiqueta que escribe una persona en el sheet', () => {
    const d = parseWeekLabel('JULY 6, 2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(6);
  });

  it('trata igual el dia con y sin cero adelante', () => {
    expect(weekKey(parseWeekLabel('JULY 06, 2026'))).toBe(weekKey(parseWeekLabel('JULY 6, 2026')));
  });

  // Cuando el parseo del sheet no encontraba weekLabels, App.jsx guardaba un
  // snapshot con un literal de respaldo. Ese registro no se puede ubicar en el
  // tiempo y es el que dibujaba la barra fantasma con la linea cayendo a 0.
  it('devuelve null para etiquetas que no son una fecha', () => {
    expect(parseWeekLabel('Previous Week')).toBeNull();
    expect(parseWeekLabel('Previous')).toBeNull();
    expect(parseWeekLabel('Current Week')).toBeNull();
    expect(parseWeekLabel('Semana Anterior')).toBeNull();
    expect(parseWeekLabel('')).toBeNull();
    expect(parseWeekLabel(null)).toBeNull();
    expect(parseWeekLabel(undefined)).toBeNull();
  });
});

describe('formatWeekAxisLabel', () => {
  it('produce el mismo texto sin importar como se escribio la etiqueta', () => {
    const a = formatWeekAxisLabel(parseWeekLabel('JULY 06, 2026'));
    const b = formatWeekAxisLabel(parseWeekLabel('JULY 6, 2026'));
    expect(a).toBe('Jul 6');
    expect(b).toBe('Jul 6');
  });

  it('respeta el idioma de la app', () => {
    expect(formatWeekAxisLabel(parseWeekLabel('JULY 6, 2026'), 'es').toLowerCase()).toContain('jul');
  });

  it('no lanza con una fecha invalida', () => {
    expect(formatWeekAxisLabel(null)).toBe('');
    expect(formatWeekAxisLabel(new Date('nope'))).toBe('');
  });
});

describe('normalizeWeeklyHistory', () => {
  it('descarta los snapshots sin fecha valida', () => {
    const raw = {
      previous_week: snap('Previous Week', {}, '2026-07-01T00:00:00.000Z'),
      july_6_2026: snap('JULY 6, 2026', { 'Total Active Projects': 25 }, '2026-07-06T00:00:00.000Z'),
    };
    const result = normalizeWeeklyHistory(raw);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('JULY 6, 2026');
  });

  // El caso exacto del grafico: dos barras para el 6 de julio, una etiquetada
  // "Jul 06" y otra "Jul 6", porque el dedup comparaba el texto crudo.
  it('colapsa la misma semana escrita de dos formas distintas', () => {
    const raw = {
      july_06_2026: snap('JULY 06, 2026', { 'Total Active Projects': 26 }, '2026-07-06T10:00:00.000Z'),
      july_6_2026:  snap('JULY 6, 2026',  { 'Total Active Projects': 29 }, '2026-07-07T10:00:00.000Z'),
    };
    const result = normalizeWeeklyHistory(raw);
    expect(result).toHaveLength(1);
    // Ante duplicados limpios gana el guardado mas recientemente.
    expect(result[0].metrics['Total Active Projects']).toBe(29);
  });

  it('ordena cronologicamente, no alfabeticamente por clave', () => {
    const raw = {
      a: snap('JUNE 8, 2026', {}, '2026-06-08T00:00:00.000Z'),
      b: snap('JULY 13, 2026', {}, '2026-07-13T00:00:00.000Z'),
      c: snap('JUNE 29, 2026', {}, '2026-06-29T00:00:00.000Z'),
    };
    const result = normalizeWeeklyHistory(raw);
    expect(result.map(w => w.weekKey)).toEqual(['2026-06-08', '2026-06-29', '2026-07-13']);
  });

  it('prefiere el formato limpio sobre el anidado viejo', () => {
    const raw = {
      viejo: snap('JULY 6, 2026', { 'Total Active Projects': { current: 20, previous: 18 } }, '2026-07-10T00:00:00.000Z'),
      nuevo: snap('JULY 6, 2026', { 'Total Active Projects': 29 }, '2026-07-06T00:00:00.000Z'),
    };
    const result = normalizeWeeklyHistory(raw);
    expect(result).toHaveLength(1);
    // Gana el limpio aunque sea mas viejo por savedAt.
    expect(result[0].metrics['Total Active Projects']).toBe(29);
  });

  it('se queda con las ultimas N semanas', () => {
    const raw = {};
    for (let d = 1; d <= 12; d++) {
      raw[`w${d}`] = snap(`JULY ${d}, 2026`, {}, `2026-07-${String(d).padStart(2, '0')}T00:00:00.000Z`);
    }
    const result = normalizeWeeklyHistory(raw, 10);
    expect(result).toHaveLength(10);
    expect(result[0].weekKey).toBe('2026-07-03');   // se descartaron las 2 mas viejas
    expect(result[9].weekKey).toBe('2026-07-12');
  });

  it('devuelve [] ante entrada vacia o basura, sin lanzar', () => {
    expect(normalizeWeeklyHistory(null)).toEqual([]);
    expect(normalizeWeeklyHistory({})).toEqual([]);
    expect(normalizeWeeklyHistory({ a: null, b: 'texto suelto' })).toEqual([]);
  });

  it('expone weekDate para que el eje X no dependa del texto del sheet', () => {
    const raw = { x: snap('JULY 6, 2026', {}, '2026-07-06T00:00:00.000Z') };
    const [week] = normalizeWeeklyHistory(raw);
    expect(week.weekDate).toBeInstanceOf(Date);
    expect(formatWeekAxisLabel(week.weekDate)).toBe('Jul 6');
  });
});
