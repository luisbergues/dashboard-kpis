// Base de datos en memoria que imita la API de Realtime Database.
//
// Existe para el modo demo (ver demoMode.js): reemplaza a `db`/`auth` en
// firebase.js, de forma que App.jsx y TODAS las vistas corren su codigo real
// sin una sola rama de "si es demo". Los listeners, las proyecciones, las
// escrituras atomicas y el estado de leido se ejercitan de verdad — lo unico
// falso es donde se guardan los bytes.
//
// No pretende ser un emulador: no evalua reglas de seguridad, no persiste, y
// notifica a los listeners comparando JSON en vez de calcular deltas finos.
// Para una demo eso alcanza y se lee en una sentada.

const SEPARATOR = '/';

const clone = (value) => (value === undefined || value === null)
  ? null
  : JSON.parse(JSON.stringify(value));

const segments = (path) => String(path ?? '')
  .split(SEPARATOR)
  .filter(Boolean);

export function createDemoDb(initialTree = {}) {
  let tree = clone(initialTree) || {};
  const listeners = new Set(); // { path, cb, last }

  // --- lectura / escritura sobre el arbol ---

  function readPath(path) {
    let node = tree;
    for (const key of segments(path)) {
      if (node === null || typeof node !== 'object') return null;
      node = Object.prototype.hasOwnProperty.call(node, key) ? node[key] : null;
    }
    return node === undefined ? null : node;
  }

  function writePath(path, value) {
    const parts = segments(path);
    // Escribir en la raiz reemplaza el arbol entero.
    if (parts.length === 0) {
      tree = clone(value) || {};
      return;
    }
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (node[key] === null || typeof node[key] !== 'object') node[key] = {};
      node = node[key];
    }
    const leaf = parts[parts.length - 1];
    // null borra, igual que en RTDB.
    if (value === null || value === undefined) delete node[leaf];
    else node[leaf] = clone(value);
  }

  // Se re-evalua cada listener y se dispara el que cambio de valor. Es O(n)
  // sobre la cantidad de listeners, que en esta app son unas dos docenas.
  function notify() {
    listeners.forEach((entry) => {
      const next = readPath(entry.path);
      const serialized = JSON.stringify(next);
      if (serialized === entry.last) return;
      entry.last = serialized;
      entry.cb(snapshot(next));
    });
  }

  const snapshot = (value) => ({
    exists: () => value !== null && value !== undefined,
    val: () => clone(value),
  });

  // --- API con la forma de firebase/database ---

  const ref = (_db, path = '') => ({ __demoRef: true, path: String(path ?? '') });

  const child = (parent, path) => ref(null, [parent.path, path].filter(Boolean).join(SEPARATOR));

  const get = async (reference) => snapshot(readPath(reference.path));

  const set = async (reference, value) => {
    writePath(reference.path, value);
    notify();
  };

  const remove = async (reference) => {
    writePath(reference.path, null);
    notify();
  };

  // Multi-path: las claves del objeto son rutas relativas a `reference`. Con
  // la raiz como referencia son rutas absolutas, que es como las usa
  // noteTags.createNoteWithTags para escribir nota y tags de una sola vez.
  const update = async (reference, patch) => {
    Object.entries(patch || {}).forEach(([relative, value]) => {
      writePath([reference.path, relative].filter(Boolean).join(SEPARATOR), value);
    });
    notify();
  };

  let pushCounter = 0;
  const push = (reference, value) => {
    pushCounter += 1;
    const key = `demo_${Date.now().toString(36)}_${pushCounter}`;
    const childRef = ref(null, [reference.path, key].filter(Boolean).join(SEPARATOR));
    if (value !== undefined) { writePath(childRef.path, value); notify(); }
    return childRef;
  };

  const onValue = (reference, cb, _errorCb) => {
    const entry = { path: reference.path, cb, last: undefined };
    listeners.add(entry);
    // RTDB entrega el valor actual apenas se suscribe uno.
    const current = readPath(reference.path);
    entry.last = JSON.stringify(current);
    cb(snapshot(current));
    return () => listeners.delete(entry);
  };

  const runTransaction = async (reference, updater) => {
    const current = readPath(reference.path);
    const next = updater(clone(current));
    // `undefined` significa abortar, igual que en RTDB.
    if (next === undefined) {
      return { committed: false, snapshot: snapshot(current) };
    }
    writePath(reference.path, next);
    notify();
    return { committed: true, snapshot: snapshot(next) };
  };

  return {
    db: { __demoDb: true },
    ref, child, get, set, remove, update, push, onValue, runTransaction,
    // Solo para inspeccionar desde la consola del navegador.
    _dump: () => clone(tree),
  };
}

// Auth de mentira: entrega un usuario ya logueado apenas alguien se suscribe,
// que es lo que saltea la pantalla de login sin tocar App.jsx.
export function createDemoAuth(user) {
  return {
    auth: { __demoAuth: true, currentUser: user },
    onAuthStateChanged: (_auth, cb) => { cb(user); return () => {}; },
    signOut: async () => {
      console.info('[demo] signOut es un no-op: recargá sin ?demo para salir.');
    },
    signInWithEmailAndPassword: async () => ({ user }),
    createUserWithEmailAndPassword: async () => ({ user }),
  };
}
