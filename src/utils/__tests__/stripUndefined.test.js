import { describe, it, expect } from 'vitest';
import { stripUndefined } from '../stripUndefined';

describe('stripUndefined', () => {
  it('saca las claves con valor undefined', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('la clave desaparece, no queda con otro valor', () => {
    expect('b' in stripUndefined({ a: 1, b: undefined })).toBe(false);
  });

  it('conserva null: Firebase lo acepta y no significa lo mismo que ausente', () => {
    expect(stripUndefined({ a: null })).toEqual({ a: null });
  });

  it('conserva false y 0', () => {
    expect(stripUndefined({ a: false, b: 0, c: '' })).toEqual({ a: false, b: 0, c: '' });
  });

  it('limpia en profundidad', () => {
    expect(stripUndefined({ o: { p: undefined, q: 2 } })).toEqual({ o: { q: 2 } });
  });

  it('conserva los arrays como arrays', () => {
    const out = stripUndefined({ list: [{ a: 1, b: undefined }, { c: 3 }] });
    expect(Array.isArray(out.list)).toBe(true);
    expect(out.list).toEqual([{ a: 1 }, { c: 3 }]);
  });

  it('el caso real que rompia el guardado', () => {
    // Un proyecto que nunca cerro Fase 2 llega con phase2Data undefined por el
    // spread de `{...existing}`, y Firebase rechazaba el set entero.
    const project = {
      id: '22222', status: 'Approved', phase1Score: 100,
      phase2Score: null, phase2Data: undefined,
      checklist: { kcdFile: 123, jlContract: false },
    };
    const clean = stripUndefined(project);
    expect('phase2Data' in clean).toBe(false);
    expect(clean.phase2Score).toBeNull();
    expect(clean.checklist).toEqual({ kcdFile: 123, jlContract: false });
  });

  it('no rompe con valores primitivos ni null en la raiz', () => {
    expect(stripUndefined(null)).toBeNull();
    expect(stripUndefined(5)).toBe(5);
    expect(stripUndefined('x')).toBe('x');
  });
});
