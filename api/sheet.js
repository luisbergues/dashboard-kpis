// Vercel serverless function — unica puerta de entrada a las planillas.
//
// POR QUE EXISTE: hasta ahora el cliente bajaba las pestañas con
// `docs.google.com/.../export?format=csv`, que exige tener la planilla
// PUBLICADA EN LA WEB. Publicada quiere decir que cualquiera con el link la
// descarga sin login: Revenue, Client, City, Salesperson, pagos en efectivo y
// multiplicadores de precio, todo abierto. Y el link viajaba en el bundle, que
// es publico por definicion.
//
// Ahora la planilla se lee con una cuenta de servicio desde el servidor, y el
// navegador nunca ve ni el ID de la planilla ni el rango.
//
// LO QUE ESTE ENDPOINT NO HACE: no acepta IDs ni rangos del cliente. El
// parametro `name` se busca en SHEETS y nada mas; cualquier otra cosa es 400.
// Si aceptara un spreadsheetId del cliente, la cuenta de servicio se
// convertiria en un proxy para leer cualquier planilla a la que tenga acceso.
import { google } from 'googleapis';
import { requireAuth, getBearerToken } from './_lib/verifyAuth.js';

// Mapa fijo nombre -> pestaña. El gid es el identificador de la pestaña que
// venia en las URLs viejas; la API v4 lee por TITULO, asi que el gid se
// traduce a titulo con spreadsheets.get (ver resolveTitle).
//
// `gid: 0` es la primera pestaña, la que la URL vieja usaba sin parametro gid.
const SHEETS = {
  main: { gid: 0 },
  quality: { gid: 1762634268 },
  projectMaterials: { gid: 2135314033 },
  masterSchedule: { gid: 1648942410 },
};

// Dominios cuyos usuarios pueden leer las planillas.
const ALLOWED_DOMAINS = (process.env.SHEET_ALLOWED_DOMAINS || 'jlclosets.com')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const LOOKUP_TIMEOUT_MS = 5000;

function emailDomainAllowed(email) {
  const at = String(email || '').lastIndexOf('@');
  if (at < 0) return false;
  return ALLOWED_DOMAINS.includes(String(email).slice(at + 1).toLowerCase());
}

// El chequeo de dominio SOLO dejaria entrar a @jlclosets.com. Este proyecto
// tiene cuentas aprobadas con mail de otros dominios (entre ellas la del
// super admin), asi que el dominio por si solo las echaria de su propia app.
// Por eso tambien vale estar aprobado en users/{uid}, que es la puerta que la
// app ya usa para todo lo demas. Una cuenta recien registrada no alcanza: su
// status arranca en 'pending'.
//
// Se lee con el token del PROPIO usuario, no con la cuenta de servicio:
// database.rules.json ya le da acceso de lectura a users/$uid solo a ese uid,
// y status/role solo los escribe un engineer-admin. Mismo criterio que
// requireApprovedUser.js, que explica por que el admin SDK no sirve en Vercel.
async function isApprovedUser(uid, token) {
  const databaseUrl = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
  if (!databaseUrl || !token) return false;
  try {
    const url = `${databaseUrl}/users/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(token)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!resp.ok) return false;
    const profile = await resp.json();
    return profile?.status === 'approved';
  } catch {
    // Ante la duda, no. Falla cerrado.
    return false;
  }
}

function getSheetsAuth() {
  // Se reusa la misma variable que ya usa api/sync.js. GOOGLE_SA queda como
  // alias para quien prefiera separarlas.
  const raw = process.env.GOOGLE_SA || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!creds.client_email || !creds.private_key) return null;
  return new google.auth.GoogleAuth({
    credentials: creds,
    // Solo lectura: esta cuenta no tiene por que poder escribir nada.
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// ─── Cache en memoria de la instancia ─────────────────────────────────────
// Todas las lecturas pasan por UNA cuenta de servicio, y la cuota de lectura
// de la Sheets API es por cuenta (60/min por defecto). Con el polling de 30 s
// de la app, sin cache cada pestaña abierta gastaba ~8 llamadas/min y con
// unas 7 abiertas se agotaba (502). Vercel Fluid Compute reutiliza instancias,
// asi que estas variables de modulo sobreviven entre requests.
//
// Seguridad: la cache se consulta DESPUES de autenticar y autorizar en el
// handler; nunca se sirve a quien no paso esos chequeos.
const TITLES_TTL_MS = 10 * 60 * 1000; // los nombres de pestaña casi no cambian
const VALUES_TTL_MS = 25 * 1000;      // un poco menos que el polling de 30 s

let titlesCache = null; // { spreadsheetId, byGid: Map<gid, title>, expires }
const valuesCache = new Map(); // `${spreadsheetId}:${gid}` -> { promise, expires }

// gid -> titulo de la pestaña. Una sola llamada trae los titulos de TODAS las
// pestañas; se guardan 10 minutos. Si una pestaña se renombra, la lectura falla
// una vez, se invalida (ver handler) y la siguiente vuelve a resolver.
async function resolveTitle(sheets, spreadsheetId, gid) {
  const now = Date.now();
  if (!titlesCache || titlesCache.spreadsheetId !== spreadsheetId || titlesCache.expires < now) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
    const byGid = new Map();
    for (const s of meta.data.sheets || []) {
      if (s.properties) byGid.set(s.properties.sheetId, s.properties.title);
    }
    titlesCache = { spreadsheetId, byGid, expires: now + TITLES_TTL_MS };
  }
  return titlesCache.byGid.get(gid) || null;
}

// Lee una pestaña con cache corta y deduplicacion: si 5 pestañas del navegador
// piden lo mismo a la vez, se hace UNA llamada a Google y todas esperan esa
// misma promesa. Una lectura fallida no queda cacheada.
function readValuesCached(sheets, spreadsheetId, gid, title) {
  const key = `${spreadsheetId}:${gid}`;
  const now = Date.now();
  const hit = valuesCache.get(key);
  if (hit && hit.expires > now) return hit.promise;

  const promise = sheets.spreadsheets.values
    .get({
      spreadsheetId,
      range: title,
      // Los parsers esperan el texto tal como se ve en la planilla (fechas y
      // montos ya formateados), que es lo que daba el export CSV.
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    })
    .then((result) => padRows(result.data.values));
  valuesCache.set(key, { promise, expires: now + VALUES_TTL_MS });
  promise.catch(() => valuesCache.delete(key));
  return promise;
}

/**
 * Deja las filas con el mismo ancho, rellenando con ''.
 *
 * values.get RECORTA: omite las celdas vacias del final de cada fila y las
 * filas vacias del final del rango, asi que una fila puede volver con 3
 * elementos y la de al lado con 11. Los parsers leen por indice
 * (`row[statusIdx]`) y corrian con la salida de PapaParse sobre el CSV, que
 * siempre daba filas del mismo largo. Sin este relleno, una celda vacia a la
 * derecha pasa de '' a undefined y la columna se lee corrida.
 */
export function padRows(values) {
  const rows = Array.isArray(values) ? values : [];
  let width = 0;
  for (const row of rows) {
    if (Array.isArray(row) && row.length > width) width = row.length;
  }
  return rows.map((row) => {
    const r = Array.isArray(row) ? row : [];
    const out = new Array(width);
    for (let i = 0; i < width; i++) {
      const cell = r[i];
      out[i] = cell === undefined || cell === null ? '' : String(cell);
    }
    return out;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const name = typeof req.query?.name === 'string' ? req.query.name : '';
  const entry = Object.prototype.hasOwnProperty.call(SHEETS, name) ? SHEETS[name] : null;
  if (!entry) {
    res.status(400).json({ error: 'Unknown sheet name' });
    return;
  }

  const decoded = await requireAuth(req, res);
  if (!decoded) return; // requireAuth ya respondio 401.

  const allowed =
    emailDomainAllowed(decoded.email) ||
    (await isApprovedUser(decoded.uid, getBearerToken(req)));
  if (!allowed) {
    res.status(403).json({ error: 'Not authorized for company data' });
    return;
  }

  const spreadsheetId = process.env.SHEET_ID;
  const auth = getSheetsAuth();
  if (!spreadsheetId || !auth) {
    // Se loguea: antes este 500 no dejaba rastro en los logs de Vercel.
    console.error('Sheets access not configured:', { hasSheetId: Boolean(spreadsheetId), hasServiceAccount: Boolean(auth) });
    res.status(500).json({ error: 'Sheets access not configured (SHEET_ID / GOOGLE_SA)' });
    return;
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const title = await resolveTitle(sheets, spreadsheetId, entry.gid);
    if (!title) {
      console.error(`Sheet tab not found: gid ${entry.gid} (${name})`);
      res.status(404).json({ error: 'Sheet tab not found' });
      return;
    }
    const values = await readValuesCached(sheets, spreadsheetId, entry.gid, title);
    // Privado: no debe quedar en ningun cache compartido ni en un CDN.
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json({ values });
  } catch (error) {
    // Puede ser una pestaña renombrada: que la proxima request re-resuelva.
    titlesCache = null;
    console.error('Error reading sheet:', error?.message || error);
    res.status(502).json({ error: 'Could not read the spreadsheet' });
  }
}
