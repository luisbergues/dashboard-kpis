import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stand-in en memoria del nodo de archivo, mismo patron que
// completedProjectsArchive.test.js.
const store = new Map(); // path -> object

const readArchiveMap = vi.fn(async (path) => {
  const v = store.get(path);
  return v ? JSON.parse(JSON.stringify(v)) : {};
});
const writeArchiveMap = vi.fn(async (path, map) => {
  store.set(path, JSON.parse(JSON.stringify(map)));
});

vi.mock('../archiveStore', () => ({
  // Inline (no la const de afuera) porque vi.mock se iza por encima de ella.
  ARCHIVE_PATHS: {
    completed: 'archive/completed_projects',
    weekly: 'archive/weekly_history',
    deleted: 'archive/deleted_projects',
    validation: 'archive/validation_metrics',
  },
  readArchiveMap: (...a) => readArchiveMap(...a),
  writeArchiveMap: (...a) => writeArchiveMap(...a),
}));
vi.mock('../firebase', () => ({ db: {} }));

let rtdb = {};
vi.mock('firebase/database', () => ({
  ref: (_db, path) => ({ path }),
  get: vi.fn(async (r) => ({
    exists: () => r.path in rtdb,
    val: () => (r.path in rtdb ? rtdb[r.path] : null),
  })),
}));

import { recordValidationMetrics, fetchValidationMetrics } from '../validationMetrics';

const VALIDATION_PATH = 'archive/validation_metrics';

const stageEvent = (status, timestamp) => ({ type: 'stage_status', status, timestamp });
const CHECK_EV = stageEvent('CHECK', '2026-08-03T09:00:00.000Z');
const NESTING_EV = stageEvent('NESTING', '2026-08-05T15:00:00.000Z'); // 54 h despues

// Fila viva del sheet, todavia en priorityAnalysis.
const proyectoVivo = {
  so: '444',
  status: 'NESTING',
  statusHistory: [{ status: 'NESTING', statusDate: '2026-08-05' }],
};

// Entrada del archivo: ya salio del sheet, su project_history vivo fue borrado
// por clearAuxData y lo unico que queda es la copia en snapshot.history.
const proyectoArchivado = {
  so: '777',
  status: 'Completed',
  snapshot: { history: [CHECK_EV, NESTING_EV] },
};

beforeEach(() => {
  store.clear();
  rtdb = {};
  readArchiveMap.mockClear();
  writeArchiveMap.mockClear();
});

describe('recordValidationMetrics', () => {
  it('guarda la medicion de un proyecto vivo a partir de project_history', async () => {
    rtdb['project_history'] = { '444': [CHECK_EV, NESTING_EV] };

    const registrados = await recordValidationMetrics([proyectoVivo], []);

    expect(registrados).toBe(1);
    expect(store.get(VALIDATION_PATH)['444']).toMatchObject({
      checkAt: '2026-08-03T09:00:00.000Z',
      nestingAt: '2026-08-05T15:00:00.000Z',
      hours: 54,
    });
  });

  // El punto de todo el cambio: el proyecto ya NO esta en priorityAnalysis y su
  // nodo project_history ya no existe, y aun asi su medicion queda registrada.
  it('guarda la medicion de un archivado que ya no esta en priorityAnalysis', async () => {
    const registrados = await recordValidationMetrics([], [proyectoArchivado]);

    expect(registrados).toBe(1);
    expect(store.get(VALIDATION_PATH)['777']).toMatchObject({ hours: 54 });
  });

  it('registra vivos y archivados en la misma pasada', async () => {
    rtdb['project_history'] = { '444': [CHECK_EV, NESTING_EV] };

    const registrados = await recordValidationMetrics([proyectoVivo], [proyectoArchivado]);

    expect(registrados).toBe(2);
    expect(Object.keys(store.get(VALIDATION_PATH)).sort()).toEqual(['444', '777']);
  });

  // El nodo lo bajan todos los clientes: una escritura por ciclo de fetch que
  // no cambia nada es exactamente la fuga de ancho de banda que ya costo un
  // incidente en agosto de 2026.
  it('no escribe cuando no hay ninguna medicion nueva', async () => {
    store.set(VALIDATION_PATH, { '777': { checkAt: 'a', nestingAt: 'b', hours: 54, recordedAt: 'c' } });

    const registrados = await recordValidationMetrics([], [proyectoArchivado]);

    expect(registrados).toBe(0);
    expect(writeArchiveMap).not.toHaveBeenCalled();
  });

  it('no pisa el registro original de un proyecto reabierto', async () => {
    rtdb['project_history'] = { '444': [CHECK_EV, NESTING_EV] };
    store.set(VALIDATION_PATH, { '444': { checkAt: 'a', nestingAt: 'b', hours: 12, recordedAt: 'c' } });

    await recordValidationMetrics([proyectoVivo], []);

    expect(store.get(VALIDATION_PATH)['444'].hours).toBe(12);
  });

  // En App.jsx la seccion "Status History" del sheet se une a cada proyecto
  // recien en mergedData (render), y esto corre sobre parsedData (queryFn),
  // antes de esa union. Sin recibirla aparte, un proyecto cuya fecha de CHECK
  // solo existe en el sheet se ve en la tarjeta pero nunca se guarda.
  it('usa la seccion Status History del sheet cuando no hay project_history', async () => {
    const sinHistorial = { so: '555', status: 'NESTING' };
    const statusHistory = [
      { so: '555', status: 'CHECK', statusDate: '2026-08-03' },
      { so: '555', status: 'NESTING', statusDate: '2026-08-05' },
    ];

    const registrados = await recordValidationMetrics([sinHistorial], [], statusHistory);

    expect(registrados).toBe(1);
    expect(store.get(VALIDATION_PATH)['555']).toMatchObject({ hours: 48 });
  });

  // project_history es un nodo entero que ya baja recordStatusTransitions en
  // la misma pasada. Un proyecto ya registrado nunca se vuelve a medir (gana
  // el primer registro), asi que bajarlo de nuevo por el es ancho de banda
  // tirado — justo la clase de fuga del incidente de agosto de 2026.
  it('no baja project_history si todos los vivos ya estan registrados', async () => {
    rtdb['project_history'] = { '444': [CHECK_EV, NESTING_EV] };
    store.set(VALIDATION_PATH, { '444': { checkAt: 'a', nestingAt: 'b', hours: 54, recordedAt: 'c' } });
    const { get } = await import('firebase/database');
    get.mockClear();

    await recordValidationMetrics([proyectoVivo], []);

    expect(get).not.toHaveBeenCalled();
  });

  it('no explota si no hay proyectos que mirar', async () => {
    await expect(recordValidationMetrics([], [])).resolves.toBe(0);
    expect(writeArchiveMap).not.toHaveBeenCalled();
  });

  // Un fallo leyendo project_history no puede abortar el registro de los
  // archivados, que no dependen de ese nodo para nada.
  it('igual registra los archivados si falla la lectura de project_history', async () => {
    const { get } = await import('firebase/database');
    get.mockImplementationOnce(async () => { throw new Error('permission denied'); });

    const registrados = await recordValidationMetrics([proyectoVivo], [proyectoArchivado]);

    expect(registrados).toBe(1);
    expect(store.get(VALIDATION_PATH)['777']).toMatchObject({ hours: 54 });
  });
});

describe('fetchValidationMetrics', () => {
  it('devuelve el mapa guardado', async () => {
    store.set(VALIDATION_PATH, { '111': { hours: 10 } });
    await expect(fetchValidationMetrics()).resolves.toEqual({ '111': { hours: 10 } });
  });

  // La tarjeta tiene que poder dibujarse igual: una lectura fallida vale
  // "todavia no hay registros", no una pantalla rota.
  it('devuelve un mapa vacio cuando la lectura falla', async () => {
    readArchiveMap.mockImplementationOnce(async () => { throw new Error('offline'); });
    await expect(fetchValidationMetrics()).resolves.toEqual({});
  });
});
