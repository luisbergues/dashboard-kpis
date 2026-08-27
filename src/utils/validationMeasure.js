// Medicion pura del tiempo de validacion CHECK -> NESTING.
//
// Vive aparte de validationMetrics.js (que hace la I/O contra el archivo)
// porque kpiCalculator.js tambien necesita estas reglas para leer los
// registros guardados, y no puede arrastrar firebase a sus tests. Tener una
// sola definicion de "que cuenta como medicion valida" evita que el filtro de
// la tarjeta y el del registro se separen con el tiempo.

// Indices dentro del array que devuelve calculateAutomaticStages (ver STAGES
// en stageUtils.js).
const CHECK_INDEX = 3;
const NESTING_INDEX = 4;

// Tope de cordura: mas de 90 dias entre CHECK y NESTING es un dato sucio (un
// proyecto reabierto, una fecha mal cargada), no un tiempo de validacion.
export const MAX_REASONABLE_HOURS = 90 * 24;

// Una fecha FABRICADA (`estimated: true`) es la hora en que se abrio el
// dashboard, no el momento en que ocurrio la etapa. Medir con eso es lo que
// hacia que la tarjeta mostrara 0 hrs permanentes.
const usable = (s) => Boolean(s && s.completed && s.timestamp && !s.estimated);

/**
 * @param {Array} stages - salida de calculateAutomaticStages / stagesFromProjectOrArchive
 * @returns {{ checkAt: string, nestingAt: string, hours: number } | null}
 *   null cuando el proyecto no es medible todavia.
 */
export function measureValidation(stages) {
  if (!Array.isArray(stages)) return null;

  const check = stages[CHECK_INDEX];
  const nesting = stages[NESTING_INDEX];
  if (!usable(check) || !usable(nesting)) return null;

  const start = new Date(check.timestamp).getTime();
  const end = new Date(nesting.timestamp).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  const hours = (end - start) / (1000 * 60 * 60);
  if (hours < 0 || hours > MAX_REASONABLE_HOURS) return null;

  return {
    checkAt: new Date(start).toISOString(),
    nestingAt: new Date(end).toISOString(),
    hours: parseFloat(hours.toFixed(1)),
  };
}

/**
 * Decide que mediciones hay que escribir en esta pasada.
 *
 * @param {Array<{so: string, stages: Array}>} candidates - proyectos vivos y archivados
 * @param {Object} existing - contenido actual de archive/validation_metrics
 * @param {string} now - ISO de esta observacion
 * @returns {Array<{so: string, record: Object}>} una entrada por medicion nueva
 */
export function pendingValidationMetrics(candidates = [], existing = {}, now = new Date().toISOString()) {
  const pending = [];

  candidates.forEach((candidate) => {
    const so = String(candidate?.so ?? '').trim();
    if (!so) return;
    // El primer registro gana. Un proyecto reabierto vuelve a pasar por CHECK
    // y NESTING; re-medirlo pisaria su validacion original con la de la
    // segunda vuelta.
    if (existing?.[so]) return;

    const measured = measureValidation(candidate.stages);
    if (!measured) return;

    pending.push({ so, record: { ...measured, recordedAt: now } });
  });

  return pending;
}

/**
 * Horas de un registro ya guardado, o null si el registro no sirve.
 *
 * Se revalida en la LECTURA a proposito: el nodo hereda las reglas de
 * `archive`, o sea que cualquier usuario aprobado puede escribirlo, y un
 * registro corrupto no puede envenenar el promedio de toda la tarjeta.
 */
export function storedMetricHours(record) {
  const hours = record?.hours;
  if (typeof hours !== 'number' || !Number.isFinite(hours)) return null;
  if (hours < 0 || hours > MAX_REASONABLE_HOURS) return null;
  return hours;
}
