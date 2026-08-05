import { db } from './firebase';
import { ref, get, update } from 'firebase/database';
import { STATUS_INDEX_MAP } from './stageUtils';

// El sheet solo trae UNA fecha por proyecto (la de su estado actual), asi que
// no hay forma de saber cuando paso por las etapas anteriores:
// calculateAutomaticStages tenia que rellenar con "hoy", y eso amontonaba todo
// en la semana en curso — por eso el grafico semanal de My Analytics mostraba
// un solo punto.
//
// La app ya ve el estado de cada proyecto cada 30s. Registrar el momento en
// que ese estado CAMBIA construye, de aca en adelante, el historial real que
// el sheet nunca tuvo. No arregla el pasado; empieza a generar datos ciertos.
//
// Se guarda en project_history/{so}, el mismo nodo que ya usan los eventos de
// ON HOLD / ACTIVE, pero con su propio `type` para no mezclarse con aquellos
// (que usan un vocabulario distinto de estados).
export const STAGE_EVENT_TYPE = 'stage_status';

// Normaliza el texto de estado del sheet a las claves de STATUS_INDEX_MAP.
export function normalizeStatus(status) {
  return String(status ?? '').toUpperCase().trim();
}

// Ultimo estado de etapa registrado para un proyecto, o null si todavia no hay
// ninguno. Solo mira eventos STAGE_EVENT_TYPE: los de ON HOLD / ACTIVE hablan
// de otra cosa y mezclarlos haria registrar transiciones falsas al salir de un
// hold.
export function lastRecordedStatus(historyForSo = []) {
  const events = (historyForSo || []).filter(e => e && e.type === STAGE_EVENT_TYPE && e.status);
  if (events.length === 0) return null;
  return normalizeStatus(events[events.length - 1].status);
}

/**
 * Decide que transiciones hay que registrar en esta pasada.
 *
 * @param {Array} projects - priorityAnalysis (ya mergeado)
 * @param {Object} historyBySo - contenido actual de project_history
 * @param {string} timestamp - ISO de esta observacion
 * @returns {Array<{so, status, event}>} una entrada por proyecto que cambio
 */
export function pendingStatusTransitions(projects = [], historyBySo = {}, timestamp = new Date().toISOString()) {
  const pending = [];

  projects.forEach(project => {
    const so = String(project?.so ?? '').trim();
    if (!so) return;

    const status = normalizeStatus(project.status);
    // Un estado que no es una etapa conocida (vacio, "TBD", "ON HOLD") no
    // aporta nada al progreso por etapas y no se registra: ON HOLD ademas ya
    // tiene su propio evento, y guardarlo aca haria que al volver a ACTIVE se
    // registre una "transicion" a una etapa por la que el proyecto ya paso.
    if (STATUS_INDEX_MAP[status] === undefined) return;

    if (lastRecordedStatus(historyBySo?.[so]) === status) return;

    pending.push({
      so,
      status,
      event: { type: STAGE_EVENT_TYPE, status, timestamp },
    });
  });

  return pending;
}

/**
 * Registra en project_history las transiciones de etapa observadas en esta
 * lectura del sheet.
 *
 * DEBE llamarse dentro de withArchiveLease (ver App.jsx): sin ese lock, cada
 * navegador abierto registraria el mismo cambio y el historial quedaria con
 * un evento duplicado por cliente conectado.
 */
export async function recordStatusTransitions(projects = []) {
  if (!db || !projects.length) return 0;

  try {
    const historySnap = await get(ref(db, 'project_history'));
    const historyBySo = historySnap.exists() ? (historySnap.val() || {}) : {};

    const pending = pendingStatusTransitions(projects, historyBySo);
    if (pending.length === 0) return 0;

    // Un solo update() multi-path: es atomico, asi que una caida a mitad de
    // camino no deja el historial con algunos proyectos actualizados y otros no.
    const updates = {};
    pending.forEach(({ so, event }) => {
      const existing = Array.isArray(historyBySo[so])
        ? historyBySo[so]
        : Object.values(historyBySo[so] || {});
      updates[so] = [...existing, event];
    });

    await update(ref(db, 'project_history'), updates);
    console.log(`🕒 Recorded ${pending.length} stage transition(s).`);
    return pending.length;
  } catch (error) {
    console.error('❌ Error recording stage transitions:', error);
    return 0;
  }
}
