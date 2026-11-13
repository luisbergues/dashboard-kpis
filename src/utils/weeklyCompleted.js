// Medicion semanal de "Completed" para el grafico Week over Week (ver App.jsx
// y DashboardView.jsx).
//
// Vive en su propio nodo, `weekly_completed/{YYYY-MM-DD}` (lunes de la
// semana), separado a proposito de `weekly_history`: ese nodo guarda las
// mediciones viejas (activos + etapas, sacados de toda la tabla del sheet y
// con claves derivadas de etiquetas del sheet) y se conserva tal cual, sin que
// la app lo lea ni lo escriba. Nombre de nodo y forma de los registros
// distintos hacen imposible mezclar una medicion con la otra.
//
// Registro:
//   {
//     weekStart: '2026-11-16',     // lunes de la semana (= la clave)
//     completedTotal: 146,         // fila "Completed Projects", columna Current Week (ACUMULADO)
//     completedThisWeek: 6,        // columna Variance — solo si era confiable
//     savedAt: '2026-11-20T...'
//   }

import { startOfWeek } from 'date-fns';
import { parseWeekLabel, weekKey } from './weeklyHistory';

export const WEEKLY_COMPLETED_PATH = 'weekly_completed';

// Semana desde la que se muestra el grafico. Se decidio arrancar de cero el
// 16/11/2026: la semana del 9/11 se guarda igual (la primera barra le resta a
// ella), pero no se muestra.
export const COMPLETED_CHART_START = new Date(2026, 10, 16);

const DAY_MS = 24 * 60 * 60 * 1000;

const mondayOf = (date) => startOfWeek(date, { weekStartsOn: 1 });

/**
 * Registro de la semana en curso, armado con la fila "Completed Projects" de
 * la tabla "Week over Week Comparison" del sheet. Las demas filas de la tabla
 * no se usan.
 *
 * `completedThisWeek` (Variance) solo se guarda si la "Previous Week" del
 * sheet es de verdad la semana anterior: el sheet la dejo clavada en August
 * 24, y en ese caso la Variance es todo lo completado desde agosto.
 *
 * @param {Array} weekOverWeek - filas parseadas de la tabla del sheet
 * @param {string} previousLabel - fecha del encabezado "Previous Week (...)"
 * @param {Date} today
 */
export function buildCompletedEntry(weekOverWeek, previousLabel, today = new Date()) {
  const thisWeek = mondayOf(today);
  const row = (weekOverWeek || []).find(m => m.metric === 'Completed Projects');
  const entry = {
    weekStart: weekKey(thisWeek),
    completedTotal: parseInt(row?.current, 10) || 0,
  };

  const previousDate = parseWeekLabel(previousLabel);
  const previousIsLastWeek = previousDate
    && Math.round((thisWeek - mondayOf(previousDate)) / DAY_MS) === 7;
  if (row && previousIsLastWeek) {
    entry.completedThisWeek = parseInt(row.variance, 10) || 0;
  }
  return entry;
}

// Si hace falta reescribir el registro guardado. Campo por campo y no con
// JSON.stringify: RTDB devuelve las claves en orden alfabetico.
export function completedEntryChanged(stored, entry) {
  if (!stored) return true;
  return stored.completedTotal !== entry.completedTotal
    || stored.completedThisWeek !== entry.completedThisWeek;
}

/**
 * Contenido crudo de `weekly_completed` -> registros en orden cronologico, con
 * `weekDate` (Date) derivado de la clave. Descarta lo que no sea una semana.
 */
export function normalizeWeeklyCompleted(raw) {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .map(([key, value]) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
      if (!m || !value || typeof value !== 'object') return null;
      return { ...value, weekDate: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) };
    })
    .filter(Boolean)
    .sort((a, b) => a.weekDate - b.weekDate);
}

/**
 * Proyectos completados EN cada semana (no el acumulado), alineado con
 * `entries`. `null` = no se puede saber.
 *
 *   1. `completedThisWeek`, si se guardo (ver buildCompletedEntry).
 *   2. Si no: acumulado de la semana menos el de la semana anterior, SOLO si
 *      esa semana esta guardada. Restar a traves de semanas faltantes mezclaria
 *      varias semanas en una barra.
 *
 * Un resultado negativo (el acumulado bajo, p. ej. el sheet lo reinicio) se
 * descarta: no hay "proyectos des-completados" que graficar.
 */
export function weeklyCompleted(entries) {
  const nonNegative = (n) => (Number.isFinite(n) && n >= 0 ? n : null);

  return (entries || []).map((week, i) => {
    if (week?.completedThisWeek !== undefined) {
      return nonNegative(Number(week.completedThisWeek));
    }
    const prev = entries[i - 1];
    if (!prev?.weekDate || !week?.weekDate) return null;
    if (Math.round((week.weekDate - prev.weekDate) / DAY_MS) !== 7) return null;
    return nonNegative(Number(week.completedTotal) - Number(prev.completedTotal));
  });
}

/**
 * Serie del grafico desde `start`. El calculo corre sobre todos los registros
 * para que la primera semana visible pueda restarle a la anterior, y recien
 * despues se recorta.
 *
 * @returns {Array<{ weekDate: Date, value: number|null }>}
 */
export function completedChartSeries(entries, start = COMPLETED_CHART_START) {
  const values = weeklyCompleted(entries);
  return (entries || [])
    .map((week, i) => ({ weekDate: week.weekDate, value: values[i] }))
    .filter(({ weekDate }) => weekDate && weekDate >= start);
}
