import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firebase RTDB wiring so readArchiveMap/writeArchiveMap run their real
// logic against a controllable stub.
const get = vi.fn();
const set = vi.fn();
vi.mock('../firebase', () => ({
  db: {},                       // truthy → module proceeds
  ref: (_db, path) => ({ path }),
  get: (...a) => get(...a),
  set: (...a) => set(...a),
}));

import { readArchiveMap, writeArchiveMap, invalidateArchiveCache } from '../archiveStore';

const snap = (exists, val) => ({ exists: () => exists, val: () => val });

beforeEach(() => {
  get.mockReset();
  set.mockReset();
  // La copia en memoria es estado de modulo: sin esto un caso le serviria a
  // otro el nodo que leyo el anterior.
  invalidateArchiveCache();
});

describe('archiveStore.readArchiveMap — fail-safe reads (data-loss guard)', () => {
  it('returns {} when the archive node does not exist yet', async () => {
    get.mockResolvedValue(snap(false, null));
    await expect(readArchiveMap('archive/x')).resolves.toEqual({});
  });

  it('returns the stored map when the node exists', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));
    await expect(readArchiveMap('archive/x')).resolves.toEqual({ '100': { so: '100' } });
  });

  it('THROWS on a read error (permission denied / network) so callers do not overwrite', async () => {
    get.mockRejectedValue(new Error('permission_denied'));
    await expect(readArchiveMap('archive/x')).rejects.toThrow('permission_denied');
  });

  it('writeArchiveMap sets the map at the given path', async () => {
    set.mockResolvedValue(undefined);
    await writeArchiveMap('archive/x', { '100': { so: '100' } });
    expect(set).toHaveBeenCalledTimes(1);
    const [refArg, payload] = set.mock.calls[0];
    expect(refArg).toEqual({ path: 'archive/x' });
    expect(payload).toEqual({ '100': { so: '100' } });
  });
});

// Esta es la optimizacion que baja el consumo: el archivo se leia de la red en
// CADA tick de 30 s del useQuery de App.jsx, aunque sólo cambia cuando se
// archiva un proyecto.
describe('archiveStore — copia en memoria (ahorro de descargas)', () => {
  it('lee la red una sola vez y sirve las siguientes lecturas de memoria', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));

    await readArchiveMap('archive/x');
    await readArchiveMap('archive/x');
    await readArchiveMap('archive/x');

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('devuelve copias independientes, para que un consumidor no le pise el mapa a otro', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));

    const first = await readArchiveMap('archive/x');
    first['999'] = { so: '999' }; // el caller muta lo suyo, como en un read-modify-write

    await expect(readArchiveMap('archive/x')).resolves.toEqual({ '100': { so: '100' } });
  });

  it('writeArchiveMap deja la copia al dia sin volver a la red (escritura pasante)', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));
    set.mockResolvedValue(undefined);

    await readArchiveMap('archive/x');
    await writeArchiveMap('archive/x', { '100': { so: '100' }, '200': { so: '200' } });

    await expect(readArchiveMap('archive/x')).resolves.toEqual({
      '100': { so: '100' },
      '200': { so: '200' },
    });
    expect(get).toHaveBeenCalledTimes(1); // la escritura no obligo a releer
  });

  it('un write fallido NO envenena la copia con lo que no se llego a escribir', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));
    set.mockRejectedValue(new Error('network down'));

    await readArchiveMap('archive/x');
    await expect(
      writeArchiveMap('archive/x', { '100': { so: '100' }, '200': { so: '200' } })
    ).rejects.toThrow('network down');

    // Sigue viendose el contenido real del nodo remoto, no el que fallo.
    await expect(readArchiveMap('archive/x')).resolves.toEqual({ '100': { so: '100' } });
  });

  it('{ fresh: true } fuerza la relectura, para el read-modify-write sin lease', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));
    await readArchiveMap('archive/x');

    get.mockResolvedValue(snap(true, { '100': { so: '100' }, '300': { so: '300' } }));
    await expect(readArchiveMap('archive/x', { fresh: true })).resolves.toEqual({
      '100': { so: '100' },
      '300': { so: '300' },
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('invalidateArchiveCache fuerza la relectura del siguiente ciclo', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));
    await readArchiveMap('archive/x');

    invalidateArchiveCache();
    await readArchiveMap('archive/x');

    expect(get).toHaveBeenCalledTimes(2);
  });
});
