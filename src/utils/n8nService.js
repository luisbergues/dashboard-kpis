/**
 * n8nService.js
 *
 * Servicio para enviar eventos de cambio al webhook de n8n.
 * n8n recibe el evento y actualiza la Google Sheet mirror.
 *
 * Configuración: VITE_N8N_WEBHOOK_URL en .env.local
 */

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://jl-kpi-dashboard.app.n8n.cloud/webhook-test/f7d526bb-fe4d-4eb8-8e43-876782bbaa82';

// ──────────────────────────────────────────────────────────────────────────────
// Mapa de estado de la app → valor exacto del dropdown en Google Sheets
// ──────────────────────────────────────────────────────────────────────────────
const APP_STATUS_TO_SHEET = {
  // Estados del pipeline
  'REVIEW':       'Review',
  'ENGINEERING':  'Engineering',
  'CHECK ENG.':   'Check Eng.',
  'CHECK ENG':    'Check Eng.',
  'PAPERWORK':    'Paperwork',
  'CHECK':        'Check',
  'NESTING':      'Nesting',
  'STAND BY':     'StandBy',
  'STANDBY':      'StandBy',
  'ON HOLD':      'ON HOLD',
  'COMPLETED':    '✓',
  'CANCELLED':    '✓',
  // Stages internos (nombres que usa n8nService)
  'check_eng':    'Check Eng.',
  'nesting':      'Nesting',
  'paperwork':    'Paperwork',
  'check1':       'Eng. Check',
  'check2':       'PW Check',
};

/**
 * Convierte un status de la app al valor exacto del dropdown de Sheets.
 * Devuelve el valor original si no hay mapeo (fallback seguro).
 */
function toSheetStatus(appStatus) {
  if (!appStatus) return '';
  // Intentar lookup directo primero (para stages como 'check_eng')
  if (APP_STATUS_TO_SHEET[appStatus]) return APP_STATUS_TO_SHEET[appStatus];
  // Luego normalizar a uppercase para los status del pipeline
  const key = String(appStatus).toUpperCase().trim();
  return APP_STATUS_TO_SHEET[key] || appStatus;
}

// ──────────────────────────────────────────────────────────────────────────────
// Core: envío al webhook con reintentos
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Envía un evento al webhook de n8n con reintentos automáticos.
 * Falla silenciosamente si la URL no está configurada.
 *
 * @param {string} eventType - Tipo de evento
 * @param {object} payload - Datos del evento (siempre incluye sheetStatus)
 * @param {number} [retries=3] - Número de reintentos
 */
export async function sendChangeEvent(eventType, payload, retries = 3) {
  if (!WEBHOOK_URL) {
    console.debug('[n8n] VITE_N8N_WEBHOOK_URL no configurada. Evento omitido:', eventType);
    return;
  }

  const body = {
    eventType,
    timestamp: new Date().toISOString(),
    source: 'jlclosets-dashboard',
    ...payload,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        console.debug(`[n8n] ✅ Evento "${eventType}" enviado (SO: ${payload.so || 'N/A'}) → sheetStatus: "${payload.sheetStatus || '—'}"`);
        return;
      } else {
        console.warn(`[n8n] ⚠️ Intento ${attempt}/${retries} fallido (HTTP ${response.status}) para "${eventType}"`);
      }
    } catch (err) {
      console.warn(`[n8n] ⚠️ Intento ${attempt}/${retries} error de red para "${eventType}":`, err.message);
    }

    if (attempt < retries) {
      // Backoff exponencial: 500ms → 1s → 2s
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
    }
  }

  console.error(`[n8n] ❌ "${eventType}" no pudo enviarse después de ${retries} intentos.`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers tipados — cada uno inyecta `sheetStatus` con el valor exacto del dropdown
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Proyecto puesto en ON HOLD.
 * sheetStatus → "ON HOLD"
 */
export function sendOnHoldEvent(project, reason, changedBy) {
  return sendChangeEvent('ON_HOLD', {
    so:           project.so,
    projectName:  project.name    || '',
    engineer:     project.eng     || '',
    installDate:  project.install || '',
    onHoldReason: reason,
    changedBy,
    sheetStatus:  'ON HOLD',    // ← valor exacto del dropdown de Sheets
  });
}

/**
 * Hold liberado — el proyecto vuelve a su estado original.
 * sheetStatus vacío → n8n no sobreescribe la columna STATUS
 * (el status real ya está en la hoja fuente).
 */
export function sendReleaseHoldEvent(project, changedBy) {
  return sendChangeEvent('RELEASE_HOLD', {
    so:          project.so,
    projectName: project.name || '',
    engineer:    project.eng  || '',
    changedBy,
    sheetStatus: '',   // Sin cambio de status al liberar hold
  });
}

/**
 * Stage de ingeniería completado (check_eng, nesting, paperwork, etc.).
 *
 * Solo actualiza sheetStatus cuando action === 'finished'.
 * 'started' se registra como log pero no cambia la columna STATUS.
 *
 * Mapa:
 *   check_eng  finished → "Check Eng."
 *   nesting    finished → "Nesting"
 *   paperwork  finished → "Paperwork"
 */
export function sendStageEvent(so, stageName, action, engineer) {
  const sheetStatus = action === 'finished' ? toSheetStatus(stageName) : '';

  // Calcular las fechas según la etapa y acción
  let startDate = '';
  let checkDate1 = '';
  let checkDate2 = '';
  let completionDate = '';

  const today = new Date().toLocaleDateString('en-US'); // MM/DD/YYYY

  if (action === 'started') {
    if (stageName === 'ingenieria') startDate = today;
    if (stageName === 'check_eng' || stageName === 'check1') checkDate1 = today;
    if (stageName === 'check_eng2' || stageName === 'check2') checkDate2 = today;
  } else if (action === 'finished') {
    if (stageName === 'paperwork') completionDate = today;
  }

  return sendChangeEvent('STAGE_UPDATE', {
    so,
    stage:       stageName,
    action,      // 'started' | 'finished'
    engineer,
    sheetStatus, // valor exacto del dropdown, o '' si solo 'started'
    startDate,
    checkDate1,
    checkDate2,
    completionDate
  });
}

/**
 * QA Checklist completado y guardado.
 * No modifica la columna STATUS de la hoja (es un log interno).
 */
export function sendQAChecklistEvent(so, stageId, qaType, checkedBy) {
  return sendChangeEvent('QA_CHECKLIST', {
    so,
    stage:         stageId,
    checklistType: qaType,
    checkedBy,
    sheetStatus:   '',   // QA no cambia la columna STATUS
  });
}

/**
 * Nota de proyecto agregada (campo Obs / Accessories / Notes de la Sheet).
 * @param {string} so - Sales Order
 * @param {string} noteText - Texto de la nota
 * @param {string} createdBy - Nombre del usuario
 * @param {object} [project] - Objeto del proyecto para incluir nombre e ingeniero
 * @param {string} noteType - Tipo de nota ('normal', 'priority', 'obs')
 */
export function sendNoteEvent(so, noteText, createdBy, project = {}, noteType = 'normal') {
  return sendChangeEvent('NOTE_ADDED', {
    so,
    projectName:  project.name || '',
    engineer:     project.eng  || '',
    noteText:     noteText.slice(0, 500), // Truncar a 500 chars por seguridad
    createdBy,
    noteType,     // Solo actualiza la hoja si es 'obs'
    sheetStatus:  '',   // Las notas no cambian el STATUS
  });
}

/**
 * Asignación de ingeniero a un proyecto (columna ENG).
 */
export function sendEngineerAssignEvent(so, engineerName, project = {}) {
  return sendChangeEvent('ENGINEER_ASSIGNED', {
    so,
    projectName:  project.name || '',
    engineer:     engineerName,
    sheetStatus:  '',   // Asignar ingeniero no cambia el STATUS
  });
}

/**
 * Nota del calendario guardada (vinculada o no a un SO).
 * @param {object} noteData - { date, text, so, authorName }
 * @param {boolean} isEdit - true si es edición de nota existente
 */
export function sendCalendarNoteEvent(noteData, isEdit = false) {
  return sendChangeEvent(isEdit ? 'CALENDAR_NOTE_UPDATED' : 'CALENDAR_NOTE_ADDED', {
    so:          noteData.so || '',
    noteText:    (noteData.text || '').slice(0, 500),
    noteDate:    noteData.date || '',
    createdBy:   noteData.authorName || '',
    sheetStatus: '',   // Las notas de calendario no cambian el STATUS
  });
}

/**
 * Cambio de fecha de instalación detectado (cuando la Sheet se actualiza).
 * Se llama cuando hay una discrepancia entre la fecha cacheada y la nueva.
 * @param {string} so - Sales Order
 * @param {string} oldDate - Fecha anterior
 * @param {string} newDate - Fecha nueva
 * @param {object} [project] - Objeto del proyecto
 */
export function sendInstallDateChangeEvent(so, oldDate, newDate, project = {}) {
  return sendChangeEvent('INSTALL_DATE_CHANGED', {
    so,
    projectName:  project.name || '',
    engineer:     project.eng  || '',
    oldDate,
    newDate,
    sheetStatus:  '',   // Cambio de fecha no modifica STATUS
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Utilidad de test — para verificar que el webhook está activo
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Envía un evento de prueba al webhook.
 * Usar desde DevTools: import { testWebhook } from './utils/n8nService'; testWebhook()
 * O bien, se puede exponer en un botón de configuración admin.
 */
export async function testWebhook() {
  if (!WEBHOOK_URL) {
    console.warn('[n8n] ⚠️ VITE_N8N_WEBHOOK_URL no configurada. No se puede testear.');
    return { success: false, reason: 'URL no configurada' };
  }

  console.log('[n8n] 🧪 Enviando evento de test al webhook...');
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: 'WEBHOOK_TEST',
        timestamp: new Date().toISOString(),
        source: 'jlclosets-dashboard',
        so: 'TEST-001',
        projectName: '🧪 Test desde la app',
        sheetStatus: '',
        message: 'Si ves esto en n8n, el webhook está funcionando correctamente ✅',
      }),
    });

    if (response.ok) {
      console.log('[n8n] ✅ Test exitoso — el webhook está activo y respondiendo');
      return { success: true };
    } else {
      console.error(`[n8n] ❌ Test fallido — HTTP ${response.status}`);
      return { success: false, status: response.status };
    }
  } catch (err) {
    console.error('[n8n] ❌ Test fallido — error de red:', err.message);
    return { success: false, error: err.message };
  }
}
