import { describe, it, expect } from 'vitest';
import { calculateAutomaticStages, stagesFromProjectOrArchive, STAGES } from '../stageUtils';
import { STAGE_EVENT_TYPE } from '../statusTransitions';

const today = () => new Date().toISOString().slice(0, 10);
const day = (iso) => iso.slice(0, 10);
const stageEvent = (status, timestamp) => ({ type: STAGE_EVENT_TYPE, status, timestamp });

describe('calculateAutomaticStages', () => {
  // 'INSTALL' y 'COMPLETED' mapean ambos al indice 5. Buscar el estado del
  // indice con Object.keys().find() devolvia siempre 'INSTALL' (la primera
  // clave declarada), asi que un proyecto en 'Completed' consultaba una fecha
  // que no existia y caia al fallback de hoy — perdiendo su fecha real de
  // finalizacion y contandose siempre en la semana en curso.
  it('usa la fecha real de un proyecto Completed, no la de hoy', () => {
    const project = {
      so: '100',
      status: 'Completed',
      statusHistory: [{ so: '100', status: 'Completed', statusDate: '2026-03-10' }],
    };

    const stages = calculateAutomaticStages(project);

    expect(day(stages[5].timestamp)).toBe('2026-03-10');
    expect(stages[5].estimated).toBe(false);
  });

  it('marca como estimadas las etapas para las que no hay fecha real', () => {
    const project = {
      so: '200',
      status: 'Nesting',
      statusHistory: [{ so: '200', status: 'Nesting', statusDate: '2026-05-20' }],
    };

    const stages = calculateAutomaticStages(project);

    // La etapa actual tiene fecha real del sheet...
    expect(day(stages[4].timestamp)).toBe('2026-05-20');
    expect(stages[4].estimated).toBe(false);
    // ...pero de las anteriores el sheet no sabe nada: se rellenan con hoy y
    // quedan marcadas para que los graficos temporales no las cuenten.
    expect(day(stages[0].timestamp)).toBe(today());
    expect(stages[0].estimated).toBe(true);
  });

  it('prefiere las transiciones reales registradas por sobre la fecha del sheet', () => {
    const project = {
      so: '300',
      status: 'Nesting',
      statusHistory: [{ so: '300', status: 'Nesting', statusDate: '2026-05-20' }],
    };
    const recorded = [
      stageEvent('ENGINEERING', '2026-04-01T10:00:00.000Z'),
      stageEvent('PAPERWORK', '2026-04-15T10:00:00.000Z'),
      stageEvent('NESTING', '2026-05-01T10:00:00.000Z'),
    ];

    const stages = calculateAutomaticStages(project, recorded);

    expect(day(stages[0].timestamp)).toBe('2026-04-01');
    expect(stages[0].estimated).toBe(false);
    expect(day(stages[2].timestamp)).toBe('2026-04-15');
    expect(stages[2].estimated).toBe(false);
    // La transicion registrada gana sobre el 2026-05-20 del sheet: sabe el
    // momento exacto en que entro a la etapa.
    expect(day(stages[4].timestamp)).toBe('2026-05-01');
    expect(stages[4].estimated).toBe(false);
  });

  it('se queda con la PRIMERA vez que entro a una etapa, no la ultima', () => {
    const project = { so: '400', status: 'Nesting', statusHistory: [] };
    const recorded = [
      stageEvent('NESTING', '2026-04-01T10:00:00.000Z'),
      stageEvent('NESTING', '2026-06-01T10:00:00.000Z'), // re-entro tras un hold
    ];

    const stages = calculateAutomaticStages(project, recorded);
    expect(day(stages[4].timestamp)).toBe('2026-04-01');
  });

  it('ignora eventos registrados sin timestamp o con estado desconocido', () => {
    const project = { so: '500', status: 'Nesting', statusHistory: [] };
    const recorded = [
      { type: STAGE_EVENT_TYPE, status: 'NESTING' }, // sin timestamp
      stageEvent('ALGO RARO', '2026-04-01T10:00:00.000Z'),
    ];

    expect(() => calculateAutomaticStages(project, recorded)).not.toThrow();
    const stages = calculateAutomaticStages(project, recorded);
    expect(stages[4].estimated).toBe(true); // no habia dato real utilizable
  });

  it('marca completadas todas las etapas hasta la actual', () => {
    const project = { so: '600', status: 'Nesting', statusHistory: [] };
    const stages = calculateAutomaticStages(project);

    for (let i = 0; i <= 4; i++) expect(stages[i].completed).toBe(true);
    expect(stages[5]).toBe(false); // install todavia no
    expect(stages).toHaveLength(STAGES.length);
  });

  it('no marca ninguna etapa cuando el estado no es reconocible', () => {
    const stages = calculateAutomaticStages({ so: '700', status: 'TBD', statusHistory: [] });
    expect(stages.every(s => s === false)).toBe(true);
  });

  it('no lanza con statusDate basura del sheet', () => {
    const project = {
      so: '800',
      status: 'Nesting',
      statusHistory: [{ so: '800', status: 'Nesting', statusDate: 'N/A' }],
    };
    expect(() => calculateAutomaticStages(project)).not.toThrow();
  });
});

describe('stagesFromProjectOrArchive — un proyecto archivado no pierde su historia', () => {
  // Al archivar se BORRA project_history/{so} de la base y su contenido queda
  // copiado dentro de `snapshot` (ver completedProjectsArchive.js). Sin leer
  // ese snapshot, el proyecto vuelve con todas las etapas `estimated` y
  // desaparece de las metricas temporales: las semanas que ya habia sumado al
  // grafico Projects Completed se borraban solas al archivarse.
  const archivado = (snapshot) => ({
    so: '999',
    status: 'Completed',
    snapshot,
  });

  const historia = [
    { status: 'ENGINEERING', timestamp: '2026-07-06T10:00:00.000Z' },
    { status: 'NESTING', timestamp: '2026-07-20T10:00:00.000Z' },
  ];

  it('usa el project_history guardado en el snapshot cuando el nodo vivo ya no esta', () => {
    const stages = stagesFromProjectOrArchive(archivado({ history: historia }), undefined);
    expect(stages[0].estimated).toBe(false);
    expect(stages[0].timestamp).toBe('2026-07-06T10:00:00.000Z');
    expect(stages[4].estimated).toBe(false);
    expect(stages[4].timestamp).toBe('2026-07-20T10:00:00.000Z');
  });

  it('tolera que el snapshot vuelva como objeto indexado', () => {
    // RTDB devuelve los arrays como objetos {0:…, 1:…} cuando las claves no
    // son contiguas. Sin normalizar, el .forEach de calculateAutomaticStages
    // revienta.
    const comoObjeto = { 0: historia[0], 1: historia[1] };
    const stages = stagesFromProjectOrArchive(archivado({ history: comoObjeto }), undefined);
    expect(stages[0].estimated).toBe(false);
    expect(stages[4].timestamp).toBe('2026-07-20T10:00:00.000Z');
  });

  it('usa el statusHistory del snapshot cuando el proyecto ya no lo trae', () => {
    const stages = stagesFromProjectOrArchive(
      archivado({ statusHistory: [{ so: '999', status: 'ENGINEERING', statusDate: '2026-07-06' }] }),
      undefined,
    );
    expect(stages[0].estimated).toBe(false);
  });

  it('el nodo vivo le gana al snapshot: un proyecto activo no cambia de comportamiento', () => {
    const vivo = [{ status: 'ENGINEERING', timestamp: '2026-08-03T10:00:00.000Z' }];
    const stages = stagesFromProjectOrArchive(archivado({ history: historia }), vivo);
    expect(stages[0].timestamp).toBe('2026-08-03T10:00:00.000Z');
  });

  it('sin snapshot se comporta igual que calculateAutomaticStages', () => {
    const p = { so: '111', status: 'Engineering', statusHistory: [] };
    expect(stagesFromProjectOrArchive(p, [])).toEqual(calculateAutomaticStages(p, []));
  });
});
