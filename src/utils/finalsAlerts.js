import { parseInstallDateLocal } from './dateFormat';
import { shortProjectName } from './projectName';

// Cuantos dias antes del finals empieza a avisar la campana. Mas corto que los
// 14 dias del aviso de instalacion a proposito: un finals se agenda y se toma
// con mucho menos plazo, y avisar antes solo llenaria la campana de alertas
// que todavia no son accionables.
const DAYS_AHEAD = 3;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// El sheet escribe el literal "NA" (o deja la celda vacia) cuando todavia no
// hay fecha. Mismo criterio que CalendarView, que ya filtra los dos casos
// antes de intentar parsear.
export const isBlankSheetDate = (val) =>
  !val || !String(val).trim() || String(val).trim().toUpperCase() === 'NA';

// Un proyecto cerrado o pausado no genera aviso de finals: si esta COMPLETED o
// CANCELLED el finals ya no corre, y un ON HOLD ya tiene su propia alerta —
// duplicarla solo agrega ruido. Es la misma regla que usa el aviso de
// instalacion urgente en App.jsx.
const SKIPPED_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'ON HOLD']);

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

/**
 * Alerta de campana para el finals de UN proyecto, o null si no corresponde.
 *
 * Se la llama desde el forEach de `realAlerts` en App.jsx, ya filtrado por
 * pertenencia (el ingeniero dueño del proyecto o un rol global). Es pura: el
 * `today` entra por parametro para que los tests no dependan del reloj.
 *
 * @param {Object} project  fila de priorityAnalysis (so, name, status,
 *                          finalsScheduled, finalTaken)
 * @param {Date}   today    medianoche LOCAL de hoy
 * @param {string} language 'es' | 'en'
 * @returns {{so: string, type: string, text: string}|null}
 */
export function buildFinalsAlert(project, today, language) {
  if (!project) return null;

  const status = String(project.status ?? '').trim().toUpperCase();
  if (SKIPPED_STATUSES.has(status)) return null;

  // Con el finals ya tomado no queda nada que recordar, ni siquiera si la
  // fecha agendada quedo en el pasado.
  if (!isBlankSheetDate(project.finalTaken)) return null;
  if (isBlankSheetDate(project.finalsScheduled)) return null;

  // parseInstallDateLocal devuelve medianoche LOCAL. Importa: con
  // `new Date('2026-08-26')` la fecha se lee como medianoche UTC y en toda
  // America cae el dia anterior, asi que un finals de hoy se reportaria como
  // vencido ayer.
  const finalsDate = parseInstallDateLocal(project.finalsScheduled);
  if (!finalsDate) return null;

  const isES = language === 'es';
  const name = shortProjectName(project.name);
  const diffDays = Math.round((finalsDate - today) / MS_PER_DAY);

  if (diffDays < 0) {
    const late = Math.abs(diffDays);
    return {
      so: project.so,
      type: 'finals_overdue',
      text: isES
        ? `SO #${project.so} tiene el finals vencido hace ${late} ${plural(late, 'día', 'días')}: ${name}`
        : `SO #${project.so} finals overdue by ${late} ${plural(late, 'day', 'days')}: ${name}`,
    };
  }

  if (diffDays > DAYS_AHEAD) return null;

  const when = diffDays === 0
    ? (isES ? 'hoy' : 'today')
    : (isES
      ? `en ${diffDays} ${plural(diffDays, 'día', 'días')}`
      : `in ${diffDays} ${plural(diffDays, 'day', 'days')}`);

  return {
    so: project.so,
    type: 'finals',
    text: isES
      ? `SO #${project.so} tiene finals ${when}: ${name}`
      : `SO #${project.so} has finals ${when}: ${name}`,
  };
}
