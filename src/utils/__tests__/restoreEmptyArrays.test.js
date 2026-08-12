import { describe, it, expect } from 'vitest';
import { restoreEmptyArrays } from '../usePagedModal';

/* Firebase RTDB no puede guardar un array vacio: escribir `[]` BORRA la clave.
   Una pagina de ESS sin cajones ni barrales se guarda como
   `{ drawers: [], rods: [] }` y vuelve como `{}`. Despues `drawers.map(...)`
   tira "Cannot read properties of undefined (reading 'map')". */

// Lo que hace RTDB con un objeto al guardarlo: se come arrays y objetos vacios.
const asFirebaseWouldReturn = (page) => {
  const out = {};
  for (const [k, v] of Object.entries(page)) {
    if (Array.isArray(v) && v.length === 0) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
};

const FIELDS = ['drawers', 'rods'];

describe('restoreEmptyArrays', () => {
  it('repone como array vacio la clave que Firebase se comio', () => {
    const guardada = { headerData: { jobName: 'x' }, drawers: [], rods: [], miscCol1: '' };
    const vuelta = asFirebaseWouldReturn(guardada);

    // El round-trip es el bug: las dos claves desaparecieron.
    expect(vuelta.drawers).toBeUndefined();
    expect(vuelta.rods).toBeUndefined();

    const arreglada = restoreEmptyArrays(vuelta, FIELDS);
    expect(arreglada.drawers).toEqual([]);
    expect(arreglada.rods).toEqual([]);
    // Y no pisa lo que si sobrevivio.
    expect(arreglada.headerData).toEqual({ jobName: 'x' });
    expect(arreglada.miscCol1).toBe('');
  });

  it('no toca los arrays que si tienen contenido', () => {
    const page = { drawers: [{ qty: 1 }], rods: [{ qty: 2 }] };
    const out = restoreEmptyArrays(page, FIELDS);
    expect(out.drawers).toEqual([{ qty: 1 }]);
    expect(out.rods).toEqual([{ qty: 2 }]);
    // Sin nada que reponer devuelve el mismo objeto, sin copiarlo.
    expect(out).toBe(page);
  });

  it('repone solo la clave que falta', () => {
    const out = restoreEmptyArrays({ drawers: [{ qty: 1 }] }, FIELDS);
    expect(out.drawers).toEqual([{ qty: 1 }]);
    expect(out.rods).toEqual([]);
  });

  it('NO rellena con filas de ejemplo: un borrado a mano se respeta', () => {
    // Firebase no distingue "nunca tuvo cajones" de "el usuario los borro
    // todos". Reponer desde createDefaultPage() resucitaria DEFAULT_DRAWERS.
    const out = restoreEmptyArrays({}, FIELDS);
    expect(out.drawers).toEqual([]);
    expect(out.rods).toEqual([]);
  });

  it('corrige un valor que no es array (dato viejo o corrupto)', () => {
    const out = restoreEmptyArrays({ drawers: null, rods: 'nope' }, FIELDS);
    expect(out.drawers).toEqual([]);
    expect(out.rods).toEqual([]);
  });

  it('sin arrayFields no toca nada — el modal de IP no tiene arrays', () => {
    const page = { clientName: 'x', observations: '' };
    expect(restoreEmptyArrays(page, [])).toBe(page);
    expect(restoreEmptyArrays(page)).toBe(page);
  });

  it('tolera una pagina nula', () => {
    expect(restoreEmptyArrays(null, FIELDS)).toBeNull();
    expect(restoreEmptyArrays(undefined, FIELDS)).toBeUndefined();
  });
});
