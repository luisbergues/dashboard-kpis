import { describe, it, expect } from 'vitest';
import { formatDisplayDate, parseInstallDateLocal } from '../dateFormat';

describe('formatDisplayDate', () => {
  it('formatea M/D/YYYY (formato del sheet)', () => {
    expect(formatDisplayDate('7/30/2026')).toBe('Jul 30, 2026');
    expect(formatDisplayDate('12/5/2026')).toBe('Dec 05, 2026');
  });

  it('formatea YYYY-MM-DD (notas/archivo)', () => {
    expect(formatDisplayDate('2026-07-27')).toBe('Jul 27, 2026');
  });

  it('respeta el idioma español', () => {
    expect(formatDisplayDate('7/30/2026', 'es').toLowerCase()).toContain('jul');
  });

  it('acepta Date y timestamp numérico', () => {
    expect(formatDisplayDate(new Date(2026, 6, 30))).toBe('Jul 30, 2026');
    expect(formatDisplayDate(new Date(2026, 6, 30).getTime())).toBe('Jul 30, 2026');
  });

  it('devuelve el texto original cuando no puede parsear — nunca lanza', () => {
    expect(formatDisplayDate('TBD')).toBe('TBD');
    expect(formatDisplayDate('N/A')).toBe('N/A');
    expect(formatDisplayDate(undefined)).toBe('');
    expect(formatDisplayDate(null)).toBe('');
    expect(formatDisplayDate('')).toBe('');
  });
});

// Regresion de zona horaria: `new Date('2026-06-12')` parsea como medianoche
// UTC, asi que en cualquier zona UTC-negativa (toda America) el dia LOCAL
// resultante es el 11, no el 12. Cuando ese Date se compara contra un "hoy"
// truncado con setHours(0,0,0,0) — que trunca en hora local — un install
// agendado para hoy queda "en el pasado" y desaparece de Upcoming Deadlines.
// El contrato de esta funcion es: los componentes LOCALES del Date devuelto
// coinciden exactamente con los del string de entrada, en cualquier zona.
describe('parseInstallDateLocal', () => {
  it('devuelve el mismo dia calendario que el string ISO, en medianoche local', () => {
    const d = parseInstallDateLocal('2026-06-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // junio
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('no se corre de dia en el borde de fin de mes', () => {
    const d = parseInstallDateLocal('2026-01-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('ignora la hora cuando el valor trae timestamp completo', () => {
    const d = parseInstallDateLocal('2026-06-12T23:45:00.000Z');
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it('acepta otros formatos vía Date, truncando a medianoche local', () => {
    const d = parseInstallDateLocal('6/12/2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it('devuelve null ante un valor imparseable en vez de un Invalid Date', () => {
    expect(parseInstallDateLocal('TBD')).toBeNull();
    expect(parseInstallDateLocal('')).toBeNull();
    expect(parseInstallDateLocal(undefined)).toBeNull();
  });
});
