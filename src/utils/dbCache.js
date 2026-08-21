import { db, ref, get, update, onValue } from './firebase';

const CACHE_KEY = 'dashboard_parsed_data';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache validity

// El cache vive partido en dos nodos a proposito:
//
//   firebase_cache/data  -> { timestamp, parsedData }  (pesado: decenas de KB)
//   firebase_cache/meta  -> { timestamp, version }     (liviano: ~60 bytes)
//
// `version` es la huella del parsedData que hay guardado en data. Con eso un
// cliente puede contestar "¿lo que hay en la nube es lo mismo que ya tengo en
// memoria?" bajando 60 bytes en vez del nodo entero. Antes de esta division,
// App.jsx bajaba `data` completo CADA 30 SEGUNDOS sólo para leerle el
// timestamp y, 9 de cada 10 veces, descartarlo por estar fresco todavia.
const DATA_PATH = 'firebase_cache/data';
const META_PATH = 'firebase_cache/meta';

/**
 * Checks if the cached data is fresh (less than 5 minutes old)
 * @param {string} timestampStr - ISO string of when cache was saved
 * @returns {boolean}
 */
export function isCacheFresh(timestampStr) {
  if (!timestampStr) return false;
  const elapsed = Date.now() - new Date(timestampStr).getTime();
  return elapsed < CACHE_TTL_MS;
}

// Huella barata del payload (FNV-1a de 32 bits, prefijada con la longitud del
// JSON). Sólo necesita contestar "¿es exactamente el mismo payload?", no ser
// criptografica. La longitud va adelante porque obliga a que una colision de
// hash coincida ademas en tamaño, lo que la vuelve irrelevante en la practica.
//
// JSON.stringify es determinista aca porque parsedData siempre lo construye el
// mismo parser, en el mismo orden de claves.
export function fingerprint(parsedData) {
  const json = JSON.stringify(parsedData);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${json.length}-${(hash >>> 0).toString(36)}`;
}

// Copia en memoria del ultimo payload que este cliente bajo, junto con la
// huella que tenia. Mientras la huella de la nube no cambie, volver a bajar el
// nodo devolveria byte por byte lo mismo que ya esta aca.
let memory = null; // { version, parsedData }

// Espejo vivo del nodo meta. Un unico listener alcanza: RTDB lo empuja cuando
// cambia y no cuesta nada mientras no cambie, asi que en regimen estable un
// tick que no tiene novedades no genera NINGUN trafico. El get() puntual de
// readMeta() queda como respaldo para el primer tick (antes de que llegue el
// primer snapshot) y para cuando el listener falla.
let liveMeta = null;
let metaSubscribed = false;

function subscribeToMeta() {
  if (metaSubscribed || !db) return;
  metaSubscribed = true;
  onValue(
    ref(db, META_PATH),
    (snapshot) => { liveMeta = snapshot.val(); },
    (error) => {
      // Perder el listener no puede romper la app: se vuelve al get() puntual,
      // que sigue siendo ~60 bytes por tick.
      console.warn('⚠️ Cache meta listener failed, falling back to polling:', error?.message || error);
      liveMeta = null;
      metaSubscribed = false;
    }
  );
}

async function readMeta() {
  if (liveMeta) return liveMeta;
  const snapshot = await get(ref(db, META_PATH));
  return snapshot.exists() ? snapshot.val() : null;
}

function readLocalCache() {
  try {
    const localVal = localStorage.getItem(CACHE_KEY);
    if (localVal) {
      const cached = JSON.parse(localVal);
      if (cached && cached.parsedData) {
        console.log('⚡ Retrieved cached data from localStorage');
        return cached;
      }
    }
  } catch (error) {
    console.warn('⚠️ Error reading cache from localStorage:', error);
  }
  return null;
}

/**
 * Gets cached dashboard data from Firebase or LocalStorage
 * @returns {Promise<{parsedData: Object, timestamp: string} | null>}
 */
export async function getCachedData() {
  // 1. Try Firebase if configured
  if (db) {
    try {
      subscribeToMeta();
      const meta = await readMeta();

      // Camino rapido: la nube tiene la misma huella que la copia en memoria,
      // asi que no hay nada nuevo que bajar. Esto es lo que hace que un tick
      // sin novedades no descargue nada.
      if (meta?.version && memory && memory.version === meta.version) {
        return { timestamp: meta.timestamp, parsedData: { ...memory.parsedData } };
      }

      const snapshot = await get(ref(db, DATA_PATH));
      if (snapshot.exists()) {
        const cached = snapshot.val();
        if (cached && cached.parsedData) {
          // Sin nodo meta (cache escrito por una version anterior de la app) la
          // huella se calcula aca, para que el proximo tick ya pueda cortar
          // por el camino rapido.
          memory = {
            version: meta?.version || fingerprint(cached.parsedData),
            parsedData: cached.parsedData,
          };
          console.log('⚡ Retrieved cached data from Firebase');
          // Copia superficial: App.jsx le cuelga `archivedProjects` al objeto
          // que recibe, y esa mutacion no debe ensuciar la copia en memoria
          // (ensuciarla desincronizaria el payload de su propia huella).
          return { timestamp: cached.timestamp, parsedData: { ...cached.parsedData } };
        }
      }
    } catch (error) {
      console.warn('⚠️ Error reading cache from Firebase:', error);
    }
  }

  // 2. LocalStorage Fallback
  return readLocalCache();
}

/**
 * Saves dashboard data to both Firebase and LocalStorage
 * @param {Object} parsedData
 * @returns {Promise<void>}
 */
export async function setCachedData(parsedData) {
  if (!parsedData) return;

  const timestamp = new Date().toISOString();
  const version = fingerprint(parsedData);
  const cachePayload = { timestamp, parsedData };

  // 1. Write to LocalStorage (instant)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
  } catch (error) {
    console.warn('⚠️ Error writing cache to localStorage:', error);
  }

  // 2. Write to Firebase RTDB in background
  if (db) {
    try {
      let currentVersion = null;
      try {
        currentVersion = (await readMeta())?.version || null;
      } catch (error) {
        // Sin la huella actual no se puede saber si cambio: se reescribe todo,
        // que es exactamente lo que hacia esta funcion antes.
        console.warn('⚠️ Could not read cache meta, rewriting the full payload:', error?.message || error);
      }

      // El sheet no cambio desde la ultima escritura. Reescribir `data` entero
      // aca haria que TODOS los clientes conectados se lo vuelvan a bajar para
      // recibir exactamente los mismos bytes, cada 5 minutos, para siempre. Se
      // refresca sólo el timestamp y el nodo pesado queda intacto.
      const payloadUnchanged = currentVersion === version;

      // Multi-path update: `data` y `meta` salen en una sola escritura atomica,
      // asi la huella nunca puede describir un payload que no esta.
      await update(ref(db), payloadUnchanged
        ? {
            [`${DATA_PATH}/timestamp`]: timestamp,
            [META_PATH]: { timestamp, version },
          }
        : {
            [DATA_PATH]: cachePayload,
            [META_PATH]: { timestamp, version },
          });

      // Copia superficial por el mismo motivo que en getCachedData: quien
      // llamo a esta funcion sigue siendo dueño de `parsedData` y le va a
      // colgar campos despues.
      memory = { version, parsedData: { ...parsedData } };

      console.log(payloadUnchanged
        ? '🔥 Dashboard cache unchanged — refreshed timestamp only'
        : '🔥 Cached dashboard data to Firebase successfully!');
    } catch (error) {
      console.warn('⚠️ Failed to write cache to Firebase:', error);
    }
  }
}

// Sólo para tests: limpia el estado de modulo (copia en memoria y espejo del
// nodo meta) para que cada caso arranque de cero.
export function resetCacheStateForTests() {
  memory = null;
  liveMeta = null;
  metaSubscribed = false;
}
