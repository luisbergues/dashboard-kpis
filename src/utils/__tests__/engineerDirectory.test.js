import { describe, it, expect, vi, beforeEach } from 'vitest';

let rtdb = {};
const defaultSet = async (r, value) => { rtdb[r.path] = value; };
const defaultOnValue = (r, cb) => { cb({ val: () => rtdb[r.path] ?? null }); return () => {}; };

const set = vi.fn(defaultSet);
const onValue = vi.fn(defaultOnValue);

vi.mock('../firebase', () => ({
  db: {},
  ref: (_db, path) => ({ path }),
  set: (...a) => set(...a),
  onValue: (...a) => onValue(...a),
}));

import {
  registerSelf,
  subscribeToDirectory,
  uidForName,
  nameForUid,
  taggableEngineers,
} from '../engineerDirectory';

const directory = {
  'u-santi': { name: 'Santiago' },
  'u-luis': { name: 'Luis' },
};

beforeEach(() => {
  rtdb = {};
  set.mockReset().mockImplementation(defaultSet);
  onValue.mockReset().mockImplementation(defaultOnValue);
});

describe('registerSelf', () => {
  it('escribe SOLO la entrada propia', async () => {
    await registerSelf('u-santi', 'Santiago');
    const [refArg, value] = set.mock.calls[0];
    expect(refArg.path).toBe('engineer_directory/u-santi');
    expect(value.name).toBe('Santiago');
    expect(value.updatedAt).toBeTypeOf('string');
  });

  it('no escribe sin uid o sin nombre', async () => {
    await registerSelf(null, 'Santiago');
    await registerSelf('u-santi', '');
    await registerSelf('u-santi', '   ');
    expect(set).not.toHaveBeenCalled();
  });

  it('guarda el nombre sin espacios de sobra', async () => {
    await registerSelf('u-santi', '  Santiago  ');
    expect(set.mock.calls[0][1].name).toBe('Santiago');
  });

  it('un fallo de escritura no propaga: el login no debe romperse por esto', async () => {
    set.mockRejectedValue(new Error('permission_denied'));
    await expect(registerSelf('u-santi', 'Santiago')).resolves.toBeUndefined();
  });
});

describe('subscribeToDirectory', () => {
  it('entrega el directorio y devuelve una funcion para desuscribirse', () => {
    rtdb['engineer_directory'] = directory;
    const seen = [];
    const unsub = subscribeToDirectory(d => seen.push(d));
    expect(seen[0]).toEqual(directory);
    expect(unsub).toBeTypeOf('function');
  });

  it('entrega {} cuando el nodo no existe todavia', () => {
    const seen = [];
    subscribeToDirectory(d => seen.push(d));
    expect(seen[0]).toEqual({});
  });
});

describe('uidForName / nameForUid', () => {
  it('resuelve en los dos sentidos', () => {
    expect(uidForName(directory, 'Santiago')).toBe('u-santi');
    expect(nameForUid(directory, 'u-luis')).toBe('Luis');
  });

  it('ignora mayusculas y espacios al buscar por nombre', () => {
    expect(uidForName(directory, '  santiago ')).toBe('u-santi');
  });

  it('devuelve null cuando no esta', () => {
    expect(uidForName(directory, 'Andres')).toBeNull();
    expect(nameForUid(directory, 'u-nadie')).toBeNull();
    expect(uidForName(null, 'Santiago')).toBeNull();
  });
});

describe('taggableEngineers', () => {
  it('lista los 8 marcando quien tiene cuenta vinculada', () => {
    const list = taggableEngineers(directory);
    expect(list).toHaveLength(8);
    const santi = list.find(e => e.name === 'Santiago');
    expect(santi).toEqual({ name: 'Santiago', uid: 'u-santi', registered: true });
    const andres = list.find(e => e.name === 'Andres');
    expect(andres).toEqual({ name: 'Andres', uid: null, registered: false });
  });

  it('con el directorio vacio nadie es tageable, pero los 8 siguen listados', () => {
    const list = taggableEngineers({});
    expect(list).toHaveLength(8);
    expect(list.every(e => e.registered === false)).toBe(true);
  });
});
