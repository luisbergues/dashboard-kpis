// Client-side helper for the Gemini-backed translation proxy (api/translate.js).
// Used for spreadsheet-sourced free text (e.g. Executive/Weekly Summary) that
// isn't a catalogued UI string and so can't go through the static i18n system.
//
// TODA la UI de chrome (navegacion, labels, botones, headers, badges) va por el
// diccionario estatico de translations.js. Este proxy es SOLO para texto libre
// que llega del Sheet y no puede catalogarse de antemano. Si algo de la UI
// aparece sin traducir, la solucion es agregar la clave alla, no traerla aca.
//
// El proxy es flaky (500 intermitentes). Antes cada fallo escribia un
// console.error, asi que un backend caido ensuciaba la consola en cada render
// y no habia reintento ni cache entre recargas. Ahora: reintento con backoff,
// cache persistente en sessionStorage y degradado silencioso al texto original.

import { authHeaders } from './firebase';

const memoryCache = new Map();

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 400;
const STORAGE_PREFIX = 'jl_tr_';

// Hash corto y estable del texto: la clave de sessionStorage no puede ser el
// texto completo (los resumenes son largos y hay limite de cuota).
function hashText(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function storageKey(targetLanguage, text) {
  return `${STORAGE_PREFIX}${targetLanguage}_${hashText(text)}`;
}

function readCache(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null; // modo privado / cuota: la cache es opcional
  }
}

function writeCache(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Sin cache persistente se sigue funcionando con la de memoria.
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Un 4xx es determinista (texto invalido, no autorizado): reintentar no ayuda.
// Solo se reintenta ante fallo de red o 5xx, que es el modo de falla real.
function isRetriable(status) {
  return status === undefined || status === 429 || status >= 500;
}

let warnedThisSession = false;

export async function translateText(text, targetLanguage) {
  if (!text || !text.trim()) return text;
  if (targetLanguage !== 'es') return text; // source content is already English

  const memKey = `${targetLanguage}::${text}`;
  if (memoryCache.has(memKey)) return memoryCache.get(memKey);

  const persistKey = storageKey(targetLanguage, text);
  const cached = readCache(persistKey);
  if (cached !== null) {
    memoryCache.set(memKey, cached);
    return cached;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let status;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ text, targetLanguage }),
      });
      status = res.status;
      if (!res.ok) throw new Error(`translate proxy error: ${res.status}`);

      const data = await res.json();
      const translated = data.text || text;
      memoryCache.set(memKey, translated);
      writeCache(persistKey, translated);
      return translated;
    } catch {
      if (attempt < MAX_ATTEMPTS && isRetriable(status)) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1)); // 400ms, 800ms
        continue;
      }
      // Degradado silencioso: se muestra el texto original. Un solo aviso por
      // sesion en vez de un error por cada render.
      if (!warnedThisSession) {
        warnedThisSession = true;
        console.warn('Translation proxy unavailable — showing dynamic content in its original language.');
      }
      memoryCache.set(memKey, text); // no reintentar el mismo texto en bucle
      return text;
    }
  }

  return text;
}
