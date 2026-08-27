import { db, ref, get, set } from './firebase';

// Cold archive of project data, stored in the PRIMARY project's Realtime
// Database. It previously lived in a separate, unauthenticated Firebase project
// (insecure), and then briefly in Firebase Storage (which was never provisioned
// for this project and required CORS/gcloud access the org blocks). RTDB is what
// the app already uses, needs no CORS, is authenticated, and is secured by the
// same rules as everything else (see database.rules.json).
//
// Each "collection" is one RTDB node holding a map keyed by id (SO number or
// week key). The app fetches the whole archive and filters in memory, so a
// single-node read is a natural fit. NOTE: RTDB keys can't contain '.', '#',
// '$', '[' or ']', so paths are plain (no ".json").
export const ARCHIVE_PATHS = {
  completed: 'archive/completed_projects',
  weekly: 'archive/weekly_history',
  deleted: 'archive/deleted_projects',
  // Mediciones CHECK -> NESTING por proyecto (ver validationMetrics.js). A
  // diferencia de `completed`, este nodo NO se purga: el archivo de proyectos
  // se corta al año, pero el promedio de validacion tiene que acumular todo lo
  // que se pueda.
  validation: 'archive/validation_metrics',
};

// Copia en memoria de cada nodo de archivo que este cliente ya leyó, con
// escritura pasante: writeArchiveMap la actualiza con lo que acaba de escribir.
//
// Por qué es seguro cachear algo que se usa para read-modify-write: todas las
// mutaciones del archivo corren dentro de withArchiveLease (archiveCoordinator.js),
// que elige UN solo escritor a la vez. Mientras este cliente tiene el lease,
// nadie más puede tocar el nodo, así que la copia local no se puede quedar
// vieja por debajo.
//
// Fuera del lease sí puede envejecer, y por eso hay dos escapes: App.jsx llama
// a invalidateArchiveCache() al empezar cada ciclo de fetch vivo, y
// manuallyArchiveProject lee con { fresh: true }.
//
// Lo que esto evita: fetchArchivedCompletedProjects() corre en cada tick de 30 s
// del useQuery de App.jsx, y el archivo sólo cambia cuando se archiva un
// proyecto — algo que pasa cada varios días. Antes eso eran ~13 descargas del
// nodo entero cada 5 minutos; ahora es 1.
const sessionCache = new Map();

// Copia profunda: cada consumidor tiene que poder mutar lo que recibe sin
// pisarle el contenido al cache (ni a otro consumidor), igual que cuando cada
// llamada hacía su propia lectura fresca.
const copy = (value) => JSON.parse(JSON.stringify(value));

// Descarta la copia en memoria para forzar una lectura fresca. Sin argumento
// descarta todos los nodos.
export function invalidateArchiveCache(path) {
  if (path) sessionCache.delete(path);
  else sessionCache.clear();
}

// Rejects if `promise` doesn't settle within `ms`, so a slow/offline DB read can
// never block the app's load path for long.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Reads an archive node into a plain object. Returns {} when the node simply
// doesn't exist yet. IMPORTANT: on a real error (permission denied, network) it
// THROWS, because callers do read-modify-write over the whole node — returning
// {} on a transient failure would let them overwrite a non-empty archive and
// lose data. A thrown error makes the caller abort its write.
export async function readArchiveMap(path, { fresh = false } = {}) {
  if (!db) return {};
  if (!fresh && sessionCache.has(path)) return copy(sessionCache.get(path));
  const snapshot = await withTimeout(get(ref(db, path)), 8000, `read "${path}"`);
  const map = snapshot.exists() ? (snapshot.val() || {}) : {};
  sessionCache.set(path, copy(map));
  return copy(map);
}

// Overwrites an archive node with the given map (read-modify-write). Concurrent
// writers are serialized by the archive lease (see archiveCoordinator.js).
export async function writeArchiveMap(path, map) {
  if (!db) return;
  await withTimeout(set(ref(db, path), map), 8000, `write "${path}"`);
  // Escritura pasante: recién ahora se sabe que el nodo remoto quedó así. Si el
  // set() hubiera fallado, la línea de arriba lanza y el cache conserva el
  // contenido anterior, que sigue siendo el correcto.
  sessionCache.set(path, copy(map));
}
