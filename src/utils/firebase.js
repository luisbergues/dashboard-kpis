import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  update as rtdbUpdate,
  remove as rtdbRemove,
  onValue as rtdbOnValue,
  get as rtdbGet,
  child as rtdbChild,
  push as rtdbPush,
  runTransaction as rtdbRunTransaction,
} from 'firebase/database';
import {
  getAuth,
  signInWithEmailAndPassword as fbSignIn,
  createUserWithEmailAndPassword as fbSignUp,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged
} from 'firebase/auth';
import { createDemoDb, createDemoAuth } from './demoDb';
import { buildDemoTree, DEMO_USER } from './demoData';

// La puerta del modo demo se evalua ACA, en linea, y no importada desde otro
// modulo. Vite reemplaza `import.meta.env.DEV` por el literal `false` al
// compilar, y solo si la expresion vive en este archivo puede Rollup plegar el
// `&&` a `false`, resolver los ternarios de mas abajo a `null` y descartar los
// modulos de demo del bundle. Importando la constante, el plegado no cruza el
// limite del modulo y los datos de mentira terminan viajando a produccion —
// medido, no supuesto.
//
// La segunda condicion (?demo en la URL) mantiene el `npm run dev` normal
// hablando con el Firebase real: el modo demo hay que pedirlo.
//
// Uso: npm run dev  ->  http://localhost:5173/?demo
const IS_DEMO = Boolean(
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('demo')
);

// Firebase configuration using Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if credentials have been populated (not the default placeholder)
const hasCredentials =
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
  firebaseConfig.databaseURL &&
  firebaseConfig.databaseURL !== 'YOUR_DATABASE_URL';

let db = null;
let firebaseApp = null;
let auth = null;
let initError = null;

// Modo demo (solo dev + ?demo — ver demoMode.js): se cambia el backend, no la
// app. Todo lo que sigue exportandose tiene la misma forma que la API real, asi
// que App.jsx y las vistas corren su codigo tal cual contra una base en
// memoria. En el build de produccion IS_DEMO es literalmente `false` y este
// bloque entero lo elimina el bundler.
const demoDb = IS_DEMO ? createDemoDb(buildDemoTree()) : null;
const demoAuth = IS_DEMO ? createDemoAuth(DEMO_USER) : null;

if (IS_DEMO) {
  db = demoDb.db;
  auth = demoAuth.auth;
  console.info('%c[demo] Backend en memoria. Los datos son inventados y no se guardan.', 'color:#10B981;font-weight:600');
} else if (hasCredentials) {
  try {
    // Prevent double initialization
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getDatabase(firebaseApp);
    auth = getAuth(firebaseApp);
    console.log('🔥 Firebase initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    initError = error.message || String(error);
    db = null;
    auth = null;
  }
} else {
  console.warn('⚠️ Firebase credentials not fully configured in environment variables (.env.local or hosting provider dashboard). Operating in Local Storage Mode.');
  initError = 'Credentials not fully configured in environment variables';
}

// `isConfigured` responde "¿hay backend usable?", no "¿hay credenciales?" — en
// modo demo lo hay, aunque no haya credenciales de por medio.
const isConfigured = IS_DEMO ? true : Boolean(hasCredentials);

// Attaches the current user's Firebase ID token as a Bearer header for
// calls to our own /api/* endpoints, which verify it server-side.
export async function authHeaders() {
  if (IS_DEMO) return {};
  if (!auth || !auth.currentUser) return {};
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// Cada operacion sale del backend elegido arriba. Un solo punto de decision:
// ningun consumidor sabe cual de los dos esta usando.
const ref = IS_DEMO ? demoDb.ref : rtdbRef;
const set = IS_DEMO ? demoDb.set : rtdbSet;
const update = IS_DEMO ? demoDb.update : rtdbUpdate;
const remove = IS_DEMO ? demoDb.remove : rtdbRemove;
const onValue = IS_DEMO ? demoDb.onValue : rtdbOnValue;
const get = IS_DEMO ? demoDb.get : rtdbGet;
const child = IS_DEMO ? demoDb.child : rtdbChild;
const push = IS_DEMO ? demoDb.push : rtdbPush;
const runTransaction = IS_DEMO ? demoDb.runTransaction : rtdbRunTransaction;

const signInWithEmailAndPassword = IS_DEMO ? demoAuth.signInWithEmailAndPassword : fbSignIn;
const createUserWithEmailAndPassword = IS_DEMO ? demoAuth.createUserWithEmailAndPassword : fbSignUp;
const signOut = IS_DEMO ? demoAuth.signOut : fbSignOut;
const onAuthStateChanged = IS_DEMO ? demoAuth.onAuthStateChanged : fbOnAuthStateChanged;

// Export database reference and RTDB methods
export {
  db,
  auth,
  initError,
  ref,
  set,
  update,
  remove,
  onValue,
  get,
  child,
  push,
  runTransaction,
  isConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};
