// Normalizacion del nodo weekly_history (snapshots semanales del Week over
// Week Comparison — ver App.jsx saveAndLoadHistory).
//
// Cada snapshot se guarda bajo una clave derivada de la etiqueta que escribe
// una persona en el sheet ("JULY 6, 2026"), y esa etiqueta era ademas lo que
// se usaba para ordenar y deduplicar. Eso rompia de tres formas:
//
//   1. "JULY 06, 2026" y "JULY 6, 2026" son la misma semana, pero como el
//      dedup comparaba el TEXTO crudo quedaban dos barras para el mismo dia
//      (y el contador decia 10 semanas cuando habia 9).
//   2. Cuando el parseo del sheet no encontraba weekLabels, App.jsx caia a un
//      literal de respaldo y guardaba un snapshot etiquetado "Previous Week"
//      con metricas vacias. Como solo se escribe si la clave no existe, ese
//      registro basura queda para siempre y dibujaba una barra fantasma con la
//      linea cayendo a 0.
//   3. El comparador mezclaba criterios (cronologico si ambas etiquetas
//      parseaban como fecha, alfabetico por clave si no). Eso no es transitivo,
//      asi que con un solo elemento no parseable el orden final era arbitrario.
//
// La fecha real de la semana es la unica identidad confiable: se parsea una
// vez, se descarta lo que no sea una fecha, y todo lo demas (orden, dedup)
// cuelga de ahi.

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

// Convierte la etiqueta del sheet en la fecha de esa semana. Devuelve null
// cuando no es una fecha ("Previous Week", "Current", vacio), que es
// justamente la senal para descartar el snapshot.
export function parseWeekLabel(label) {
  const str = String(label ?? '').trim();
  if (!str) return null;
  // Exige un dia numerico: sin esto, `new Date("Previous")` puede resolver a
  // algo valido en algunos motores y el registro basura volveria a colarse.
  if (!/\d/.test(str)) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Etiqueta corta para el eje X ("Jun 8"). Se deriva de la fecha ya parseada en
// vez de recortar el texto del sheet: ese recorte conservaba los digitos tal
// cual, asi que "JULY 06, 2026" y "JULY 6, 2026" salian como dos etiquetas
// distintas para el mismo dia.
export function formatWeekAxisLabel(date, language = 'en') {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  return format(date, 'MMM d', { locale: language === 'es' ? es : enUS });
}

// Identidad de la semana, estable frente a como se haya escrito la etiqueta
// ("JULY 06, 2026" y "JULY 6, 2026" colapsan en la misma).
export function weekKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// El formato viejo guardaba { current, previous } anidado por metrica; el nuevo
// guarda un numero plano. Ante duplicados se prefiere el limpio.
function hasNestedMetrics(entry) {
  return Boolean(entry?.metrics) && Object.values(entry.metrics).some(v => typeof v === 'object' && v !== null);
}

function savedAtMs(entry) {
  const t = new Date(entry?.savedAt || 0).getTime();
  return isNaN(t) ? 0 : t;
}

// Entre dos snapshots de la misma semana, cual conservar.
function preferred(existing, candidate) {
  const existingNested = hasNestedMetrics(existing);
  const candidateNested = hasNestedMetrics(candidate);
  if (existingNested && !candidateNested) return candidate;
  if (!existingNested && candidateNested) return existing;
  return savedAtMs(candidate) > savedAtMs(existing) ? candidate : existing;
}

/**
 * Deja el historial semanal listo para graficar.
 *
 * @param {Object} rawMap - contenido crudo de weekly_history
 * @param {number} limit - cuantas semanas mantener (las mas recientes)
 * @returns {Array} entradas { key, label, metrics, savedAt, weekDate, weekKey },
 *   sin registros sin fecha, sin semanas repetidas y en orden cronologico.
 */
export function normalizeWeeklyHistory(rawMap, limit = 10) {
  if (!rawMap) return [];

  const byWeek = new Map();

  Object.entries(rawMap).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') return;
    const weekDate = parseWeekLabel(value.label);
    if (!weekDate) return; // descarta "Previous Week" y compania

    const entry = { key, ...value, weekDate, weekKey: weekKey(weekDate) };
    const existing = byWeek.get(entry.weekKey);
    byWeek.set(entry.weekKey, existing ? preferred(existing, entry) : entry);
  });

  return [...byWeek.values()]
    .sort((a, b) => a.weekDate - b.weekDate)
    .slice(-limit);
}
