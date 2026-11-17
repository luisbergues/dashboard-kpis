import { describe, it, expect } from 'vitest';
import { __normalizeNamesForTests as normalizeNames } from '../useTeam';

describe('normalizeNames — lo que llega de /team/engineers', () => {
  it('acepta un array y lo ordena', () => {
    expect(normalizeNames(['Luis', 'Andres', 'Jose'])).toEqual(['Andres', 'Jose', 'Luis']);
  });

  it('acepta el objeto indexado que devuelve RTDB cuando las claves no son contiguas', () => {
    expect(normalizeNames({ 0: 'Luis', 2: 'Andres' })).toEqual(['Andres', 'Luis']);
  });

  it('descarta entradas vacias, espacios y lo que no sea string', () => {
    expect(normalizeNames(['  Luis  ', '', '   ', null, 42, 'Jose'])).toEqual(['Jose', 'Luis']);
  });

  it('devuelve null si el nodo no existe: ahi gana el respaldo del codigo', () => {
    expect(normalizeNames(null)).toBeNull();
    expect(normalizeNames(undefined)).toBeNull();
  });

  it('un nodo presente pero vacio tambien cae al respaldo', () => {
    // Si no, borrar el ultimo nombre a mano dejaria el <select> de "Assign
    // ENG" sin ninguna opcion y nadie podria asignar ingeniero.
    expect(normalizeNames([])).toBeNull();
    expect(normalizeNames({})).toBeNull();
    expect(normalizeNames(['', '  '])).toBeNull();
  });
});
