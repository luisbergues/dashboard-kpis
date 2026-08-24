import { describe, it, expect } from 'vitest';
import { ENGINEERS } from '../engineers';

describe('ENGINEERS', () => {
  it('tiene los 8 ingenieros del equipo', () => {
    expect(ENGINEERS).toHaveLength(8);
    expect(ENGINEERS).toContain('Santiago');
    expect(ENGINEERS).toContain('Josema');
  });

  it('viene ordenado, para que todo select muestre el mismo orden', () => {
    expect([...ENGINEERS].sort()).toEqual(ENGINEERS);
  });

  it('no tiene duplicados ni espacios de sobra', () => {
    expect(new Set(ENGINEERS).size).toBe(ENGINEERS.length);
    ENGINEERS.forEach(n => expect(n).toBe(n.trim()));
  });
});
