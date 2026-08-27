import { db } from './firebase';
import { ref, get } from 'firebase/database';
import { ARCHIVE_PATHS, readArchiveMap, writeArchiveMap } from './archiveStore';
import { stagesFromProjectOrArchive } from './stageUtils';
import { pendingValidationMetrics } from './validationMeasure';

// Registro permanente del tiempo CHECK -> NESTING de cada proyecto.
//
// Por que existe: la tarjeta "Avg. Validation Time" promediaba SOLO las filas
// vivas del sheet, y al archivarse un proyecto clearAuxData borra su
// project_history. La muestra no crecia nunca: se reciclaba, y por eso la
// tarjeta decia "2 projects measured" despues de meses de uso.
//
// Por que cuelga de `archive/` y no de un nodo propio: hereda las reglas de
// `archive` (database.rules.json) sin publicar reglas nuevas, el lease de
// escritor unico de archiveCoordinator, y el cache de sesion de archiveStore
// (una descarga por sesion en vez de una cada 30 s). Ningun purgador lo toca:
// purgeExpiredArchives solo limpia archive/completed_projects y
// checkDbSizeAndArchive solo mira weekly_history y deleted_projects. El
// registro es permanente a proposito — el archivo de proyectos se corta al
// año, el promedio no deberia.

// project_history solo existe para los proyectos vivos. Se lee aca, y no se
// reusa el mapa que ya bajo recordStatusTransitions, porque esta funcion corre
// DESPUES: necesita ver las transiciones que aquella acaba de escribir, para
// que un proyecto que entro a NESTING en esta misma pasada quede medido ya.
async function readLiveHistory() {
  try {
    const snap = await get(ref(db, 'project_history'));
    return snap.exists() ? (snap.val() || {}) : {};
  } catch (error) {
    // Los archivados no dependen de este nodo, asi que un fallo aca no puede
    // abortar la pasada entera.
    console.error('❌ Error reading project_history for validation metrics:', error);
    return {};
  }
}

// El parser deja la seccion "Status History" del sheet como un array
// top-level ({ so, status, statusDate }), no colgada de cada proyecto, y
// App.jsx recien la une dentro de mergedData — o sea, en el render. Esto corre
// en el queryFn, sobre parsedData, antes de esa union: sin rehacerla aca, un
// proyecto cuya fecha de CHECK solo existe en el sheet contaria en la tarjeta
// (que si usa mergedData) pero no se guardaria nunca, y se perderia al cerrar.
function withSheetStatusHistory(projects, statusHistory) {
  if (!statusHistory?.length) return projects;

  const bySo = new Map();
  statusHistory.forEach((h) => {
    const so = String(h?.so ?? '');
    if (!bySo.has(so)) bySo.set(so, []);
    bySo.get(so).push(h);
  });

  return projects.map((project) => (
    project?.statusHistory
      ? project
      : { ...project, statusHistory: bySo.get(String(project?.so)) || [] }
  ));
}

/**
 * Registra en el archivo la medicion de todo proyecto medible que todavia no
 * la tenga, mirando tanto las filas vivas del sheet como las entradas ya
 * archivadas (backfill via snapshot.history).
 *
 * DEBE llamarse dentro de withArchiveLease (ver App.jsx): hace un
 * read-modify-write del nodo, y sin ese lock dos navegadores abiertos se
 * pisarian mutuamente.
 *
 * @param {Array} projects - priorityAnalysis (filas vivas)
 * @param {Array} archivedProjects - entradas de archive/completed_projects
 * @param {Array} statusHistory - parsedData.statusHistory (seccion del sheet)
 * @returns {Promise<number>} cuantas mediciones nuevas se escribieron
 */
export async function recordValidationMetrics(projects = [], archivedProjects = [], statusHistory = []) {
  if (!db) return 0;
  if (projects.length === 0 && archivedProjects.length === 0) return 0;

  try {
    // El mapa guardado se lee PRIMERO (sale del cache de sesion de
    // archiveStore, no cuesta red) para poder descartar de entrada lo ya
    // registrado: gana el primer registro, asi que un proyecto que ya esta no
    // se vuelve a medir jamas.
    const existing = await readArchiveMap(ARCHIVE_PATHS.validation);
    const unrecorded = (list) => list.filter((p) => !existing[String(p?.so ?? '').trim()]);

    const liveTodo = unrecorded(projects);
    const archivedTodo = unrecorded(archivedProjects);
    if (liveTodo.length === 0 && archivedTodo.length === 0) return 0;

    // project_history es un nodo entero, y recordStatusTransitions ya lo baja
    // en esta misma pasada. Saltearlo cuando no queda ningun proyecto vivo por
    // medir evita duplicar esa descarga en regimen estable, que es casi
    // siempre. Los archivados no lo necesitan: su historial vive en
    // snapshot.history.
    const historyBySo = liveTodo.length > 0 ? await readLiveHistory() : {};

    const candidates = [
      ...withSheetStatusHistory(liveTodo, statusHistory),
      ...archivedTodo,
    ].map((project) => ({
      so: project?.so,
      // stagesFromProjectOrArchive cubre los dos casos: para una fila viva usa
      // el project_history del nodo, y para una archivada cae al
      // snapshot.history que quedo copiado antes de borrarlo.
      stages: stagesFromProjectOrArchive(project, historyBySo?.[String(project?.so)]),
    }));

    const pending = pendingValidationMetrics(candidates, existing);
    // Sin este corte, cada ciclo de fetch reescribiria el nodo entero aunque no
    // haya cambiado nada.
    if (pending.length === 0) return 0;

    pending.forEach(({ so, record }) => { existing[so] = record; });
    await writeArchiveMap(ARCHIVE_PATHS.validation, existing);
    console.log(`📐 Recorded ${pending.length} validation measurement(s).`);
    return pending.length;
  } catch (error) {
    console.error('❌ Error recording validation metrics:', error);
    return 0;
  }
}

/**
 * Mapa SO -> medicion guardada. Devuelve {} ante cualquier fallo: la tarjeta
 * tiene que poder dibujarse con lo que haya en vivo aunque el archivo no se
 * pueda leer.
 */
export async function fetchValidationMetrics() {
  if (!db) return {};
  try {
    return await readArchiveMap(ARCHIVE_PATHS.validation);
  } catch (error) {
    console.error('❌ Error fetching validation metrics:', error);
    return {};
  }
}
