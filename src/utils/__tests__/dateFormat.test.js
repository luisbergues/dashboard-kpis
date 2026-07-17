import { describe, it, expect } from 'vitest';
import { formatDisplayDate } from '../dateFormat';

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
