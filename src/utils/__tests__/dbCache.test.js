// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// RTDB en memoria: nodo -> valor. Los tests miden CUANTAS veces se toca la red
// y QUE se escribe, que es exactamente lo que esta optimizacion cambia.
let rtdb = {};
let metaListener = null;

// Las implementaciones van aparte porque varios casos usan mockRejectedValue,
// que REEMPLAZA la implementacion de forma permanente. mockClear() no la
// devuelve, asi que el beforeEach las vuelve a poner explicitamente — sin eso
// un caso que simula un fallo de red se lo contagia a todos los que siguen.
const defaultGet = async (r) => ({
  exists: () => r.path in rtdb && rtdb[r.path] != null,
  val: () => (r.path in rtdb ? rtdb[r.path] : null),
});
const defaultUpdate = async (_r, patch) => {
  for (const [path, value] of Object.entries(patch)) {
    if (value === null) delete rtdb[path];
    else rtdb[path] = JSON.parse(JSON.stringify(value));
  }
};
const defaultOnValue = (r, cb) => {
  if (r.path === 'firebase_cache/meta') metaListener = cb;
  return () => {};
};

const get = vi.fn(defaultGet);
const update = vi.fn(defaultUpdate);
const onValue = vi.fn(defaultOnValue);

vi.mock('../firebase', () => ({
  db: {},
  ref: (_db, path) => ({ path }),
  get: (...a) => get(...a),
  update: (...a) => update(...a),
  onValue: (...a) => onValue(...a),
}));

import {
  getCachedData,
  setCachedData,
  isCacheFresh,
  fingerprint,
  resetCacheStateForTests,
} from '../dbCache';

const DATA = 'firebase_cache/data';
const META = 'firebase_cache/meta';

// Payload de juguete con la forma que produce sheetParser.
const payload = (n = 1) => ({
  priorityAnalysis: Array.from({ length: n }, (_, i) => ({ so: String(100 + i), name: `P${i}` })),
  alerts: [],
});

// Deja el nodo escrito como si lo hubiera guardado una version anterior de la
// app: `data` sin su `meta` al lado.
function seedLegacyCache(parsedData, timestamp = new Date().toISOString()) {
  rtdb[DATA] = { timestamp, parsedData };
}

beforeEach(() => {
  rtdb = {};
  metaListener = null;
  get.mockReset().mockImplementation(defaultGet);
  update.mockReset().mockImplementation(defaultUpdate);
  onValue.mockReset().mockImplementation(defaultOnValue);
  resetCacheStateForTests();
  localStorage.clear();
});

describe('fingerprint', () => {
  it('da lo mismo para el mismo payload y distinto para uno distinto', () => {
    expect(fingerprint(payload(3))).toBe(fingerprint(payload(3)));
    expect(fingerprint(payload(3))).not.toBe(fingerprint(payload(4)));
  });
});

describe('isCacheFresh', () => {
  it('es fresco dentro de los 5 minutos y no despues', () => {
    expect(isCacheFresh(new Date().toISOString())).toBe(true);
    expect(isCacheFresh(new Date(Date.now() - 6 * 60 * 1000).toISOString())).toBe(false);
    expect(isCacheFresh(null)).toBe(false);
  });
});

// El nucleo del ahorro: App.jsx llama a getCachedData() cada 30 s. Antes cada
// llamada bajaba el nodo `data` entero (decenas de KB) sólo para mirarle el
// timestamp. Ahora baja `meta` (~60 bytes) y sólo va por `data` cuando la
// huella dice que efectivamente cambio.
describe('getCachedData — no vuelve a bajar el payload si no cambio', () => {
  it('la primera vez baja el payload', async () => {
    await setCachedData(payload(2));
    resetCacheStateForTests(); // simula una pestaña recien abierta
    get.mockClear();

    const cached = await getCachedData();

    expect(cached.parsedData.priorityAnalysis).toHaveLength(2);
    expect(get.mock.calls.map(([r]) => r.path)).toContain(DATA);
  });

  it('los ticks siguientes NO bajan el payload mientras la huella no cambie', async () => {
    await setCachedData(payload(2));
    resetCacheStateForTests();
    await getCachedData(); // primera bajada
    get.mockClear();

    for (let i = 0; i < 10; i++) await getCachedData();

    const paths = get.mock.calls.map(([r]) => r.path);
    expect(paths).not.toContain(DATA);          // el nodo pesado nunca se toco
    expect(paths.every((p) => p === META)).toBe(true);
  });

  it('sigue devolviendo los datos completos en esos ticks', async () => {
    await setCachedData(payload(2));
    resetCacheStateForTests();
    await getCachedData();

    const cached = await getCachedData();
    expect(cached.parsedData.priorityAnalysis).toHaveLength(2);
    expect(cached.timestamp).toBe(rtdb[META].timestamp);
  });

  it('vuelve a bajar el payload cuando la huella cambia', async () => {
    await setCachedData(payload(2));
    resetCacheStateForTests();
    await getCachedData();
    get.mockClear();

    // Otro cliente escribe un sheet distinto.
    rtdb[DATA] = { timestamp: new Date().toISOString(), parsedData: payload(5) };
    rtdb[META] = { timestamp: rtdb[DATA].timestamp, version: fingerprint(payload(5)) };

    const cached = await getCachedData();

    expect(get.mock.calls.map(([r]) => r.path)).toContain(DATA);
    expect(cached.parsedData.priorityAnalysis).toHaveLength(5);
  });

  it('mutar lo devuelto no ensucia la copia en memoria', async () => {
    await setCachedData(payload(2));
    resetCacheStateForTests();

    const first = await getCachedData();
    // App.jsx hace exactamente esto: le cuelga archivedProjects al objeto.
    first.parsedData.archivedProjects = ['contaminado'];

    const second = await getCachedData();
    expect(second.parsedData.archivedProjects).toBeUndefined();
  });

  it('funciona contra un cache viejo que todavia no tiene nodo meta', async () => {
    seedLegacyCache(payload(3));

    const cached = await getCachedData();
    expect(cached.parsedData.priorityAnalysis).toHaveLength(3);

    // Y a partir de ahi ya puede cortar por el camino corto.
    rtdb[META] = { timestamp: rtdb[DATA].timestamp, version: fingerprint(payload(3)) };
    get.mockClear();
    await getCachedData();
    expect(get.mock.calls.map(([r]) => r.path)).not.toContain(DATA);
  });

  it('cae a localStorage si Firebase falla', async () => {
    localStorage.setItem(
      'dashboard_parsed_data',
      JSON.stringify({ timestamp: new Date().toISOString(), parsedData: payload(7) })
    );
    get.mockRejectedValue(new Error('permission_denied'));

    const cached = await getCachedData();
    expect(cached.parsedData.priorityAnalysis).toHaveLength(7);
  });

  it('usa el listener del nodo meta y deja de consultarlo por red', async () => {
    await setCachedData(payload(2));
    resetCacheStateForTests();
    await getCachedData();

    // Llega el primer snapshot empujado por RTDB.
    expect(metaListener).toBeTypeOf('function');
    metaListener({ val: () => rtdb[META] });
    get.mockClear();

    await getCachedData();
    expect(get).not.toHaveBeenCalled(); // ni siquiera los 60 bytes del meta
  });
});

// La otra mitad: si el sheet no cambio, reescribir `data` obligaria a todos los
// clientes conectados a re-bajar bytes identicos cada 5 minutos.
describe('setCachedData — no reescribe el nodo pesado al pedo', () => {
  it('la primera vez escribe payload y meta juntos', async () => {
    await setCachedData(payload(2));

    expect(update).toHaveBeenCalledTimes(1);
    const [, patch] = update.mock.calls[0];
    expect(Object.keys(patch).sort()).toEqual([DATA, META]);
    expect(rtdb[META].version).toBe(fingerprint(payload(2)));
  });

  it('si el payload no cambio escribe SOLO el timestamp, no el payload', async () => {
    await setCachedData(payload(2));
    update.mockClear();

    await setCachedData(payload(2));

    const [, patch] = update.mock.calls[0];
    expect(Object.keys(patch).sort()).toEqual([`${DATA}/timestamp`, META]);
    expect(patch[DATA]).toBeUndefined(); // el nodo pesado quedo intacto
  });

  it('refresca igual el timestamp, para que el TTL de 5 min siga corriendo', async () => {
    await setCachedData(payload(2));
    const firstTs = rtdb[META].timestamp;

    await new Promise((r) => setTimeout(r, 5));
    await setCachedData(payload(2));

    expect(rtdb[META].timestamp).not.toBe(firstTs);
    expect(rtdb[`${DATA}/timestamp`]).toBe(rtdb[META].timestamp);
  });

  it('si el payload cambio reescribe el nodo entero', async () => {
    await setCachedData(payload(2));
    update.mockClear();

    await setCachedData(payload(9));

    const [, patch] = update.mock.calls[0];
    expect(Object.keys(patch).sort()).toEqual([DATA, META]);
    expect(patch[DATA].parsedData.priorityAnalysis).toHaveLength(9);
  });

  it('si no puede leer la huella actual reescribe todo (comportamiento anterior)', async () => {
    await setCachedData(payload(2));
    resetCacheStateForTests();
    update.mockClear();
    get.mockRejectedValue(new Error('network down'));

    await setCachedData(payload(2));

    const [, patch] = update.mock.calls[0];
    expect(Object.keys(patch).sort()).toEqual([DATA, META]);
  });

  it('un fallo de escritura en Firebase no rompe el guardado local', async () => {
    update.mockRejectedValueOnce(new Error('permission_denied'));

    await expect(setCachedData(payload(2))).resolves.toBeUndefined();
    expect(JSON.parse(localStorage.getItem('dashboard_parsed_data')).parsedData.priorityAnalysis)
      .toHaveLength(2);
  });
});

// Firebase RTDB BORRA la clave cuando el valor es un array vacio. Una semana
// sin notas de On Hold guarda `onHoldNotes: []`, RTDB tira la clave, y
// PipelineView -- que hace `onHoldNotes.find(...)` sin guard dentro de un .map
// -- revienta con "Cannot read properties of undefined (reading 'find')".
// El cache es el borde donde se repara, porque de ahi sale el objeto que
// consume media app.
describe('getCachedData — repone las secciones que RTDB borro por venir vacias', () => {
  const guardarCacheDegradado = () => {
    rtdb['firebase_cache/data'] = {
      timestamp: new Date().toISOString(),
      parsedData: {
        priorityAnalysis: [{ so: '111', name: 'Casa A' }],
        weekOverWeek: [],
        // onHoldNotes / statusHistory / materialRequirements / alerts: borrados.
      },
    };
  };

  it('onHoldNotes vuelve como array y no como undefined', async () => {
    resetCacheStateForTests();
    guardarCacheDegradado();
    const cached = await getCachedData();
    expect(cached.parsedData.onHoldNotes).toEqual([]);
    expect(() => cached.parsedData.onHoldNotes.find(n => n.project === 'x')).not.toThrow();
  });

  it('repone tambien el resto de las secciones y alerts', async () => {
    resetCacheStateForTests();
    guardarCacheDegradado();
    const { parsedData } = await getCachedData();
    expect(Array.isArray(parsedData.statusHistory)).toBe(true);
    expect(Array.isArray(parsedData.materialRequirements)).toBe(true);
    expect(Array.isArray(parsedData.topCostProjects)).toBe(true);
    expect(parsedData.alerts).toEqual({ unassignedEngineer: null, pendingCheckReview: null });
  });

  it('no toca los datos que si llegaron', async () => {
    resetCacheStateForTests();
    guardarCacheDegradado();
    const { parsedData } = await getCachedData();
    expect(parsedData.priorityAnalysis).toEqual([{ so: '111', name: 'Casa A' }]);
  });

  it('el camino rapido en memoria devuelve la misma forma reparada', async () => {
    resetCacheStateForTests();
    guardarCacheDegradado();
    await getCachedData();               // primera bajada, llena la memoria
    const segunda = await getCachedData(); // ahora sale por el atajo de memoria
    expect(segunda.parsedData.onHoldNotes).toEqual([]);
  });
});
