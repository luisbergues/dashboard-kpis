// Sends app change-events to the native /api/sync serverless endpoint,
// which writes them into the 'copy testing' Google Sheet tab (match by SO#).
// Fire-and-forget: never throws to the UI; logs and moves on.

import { authHeaders } from './firebase';

const ENDPOINT = '/api/sync';

// Shows the expired-session alert at most once per page load — sync fires
// on every stage/note/status change, and repeating the alert on each one
// would be spammy once the session has expired.
let sessionExpiredWarned = false;
function warnSessionExpiredOnce() {
  if (sessionExpiredWarned) return;
  sessionExpiredWarned = true;
  alert('Tu sesión expiró y este cambio NO se sincronizó con la hoja de cálculo. Recargá la página para volver a iniciar sesión.\n\nYour session expired and this change was NOT synced to the spreadsheet. Please reload the page to sign in again.');
}

// Exact dropdown values in the Sheet's STATUS column.
const APP_STATUS_TO_SHEET = {
  'REVIEW': 'Review', 'ENGINEERING': 'Engineering', 'CHECK ENG.': 'Check', 'CHECK ENG': 'Check',
  'PAPERWORK': 'Paperwork', 'CHECK': 'Check', 'NESTING': 'Nesting', 'STAND BY': 'StandBy',
  'STANDBY': 'StandBy', 'ON HOLD': 'ON HOLD', 'COMPLETED': '✓', 'CANCELLED': '✓',
};

function toSheetStatus(appStatus) {
  if (!appStatus) return '';
  const key = String(appStatus).toUpperCase().trim();
  return APP_STATUS_TO_SHEET[key] || appStatus;
}

// Stage + action -> exact STATUS text for column N. Client is the source of truth.
export function stageToStatus(stageName, action) {
  const s = String(stageName || '').toLowerCase();
  if (s === 'ingenieria' || s === 'engineering') return 'Engineering';
  if (s === 'check_eng' || s === 'check1' || s === 'check_eng2' || s === 'check2') return 'Check';
  if (s === 'paperwork') return 'Paperwork';
  if (s === 'nesting') return 'Nesting';
  return '';
}

async function post(eventType, payload) {
  const body = { eventType, timestamp: new Date().toISOString(), source: 'jlclosets-dashboard', ...payload };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(body),
    });
    if (res.ok) {
      console.debug(`[sync] ✅ ${eventType} (SO ${payload.so || 'N/A'})`);
    } else {
      console.warn(`[sync] ⚠️ ${eventType} HTTP ${res.status}`);
      if (res.status === 401) warnSessionExpiredOnce();
    }
  } catch (err) {
    console.warn(`[sync] ⚠️ ${eventType} network error:`, err.message);
  }
}

export function sendOnHoldEvent(project, reason, changedBy) {
  return post('ON_HOLD', {
    so: project.so, projectName: project.name || '', engineer: project.eng || '',
    installDate: project.install || '', onHoldReason: reason, changedBy, sheetStatus: 'ON HOLD',
  });
}

export function sendReleaseHoldEvent(project, changedBy) {
  return post('RELEASE_HOLD', { so: project.so, projectName: project.name || '', engineer: project.eng || '', changedBy, sheetStatus: '' });
}

export function sendStageEvent(so, stageName, action, engineer) {
  const sheetStatus = stageToStatus(stageName, action);
  let startDate = '', checkDate1 = '', checkDate2 = '', completionDate = '';
  const today = new Date().toLocaleDateString('en-US'); // MM/DD/YYYY
  if (action === 'started') {
    if (stageName === 'ingenieria') startDate = today;
    if (stageName === 'check_eng' || stageName === 'check1') checkDate1 = today;
    if (stageName === 'check_eng2' || stageName === 'check2') checkDate2 = today;
  } else if (action === 'finished') {
    if (stageName === 'paperwork') completionDate = today;
  }
  return post('STAGE_UPDATE', { so, stage: stageName, action, engineer, sheetStatus, startDate, checkDate1, checkDate2, completionDate });
}

// Fires from the My Projects stages timeline: changes ONLY the STATUS column
// (N), never the date columns (J/K/L/M). Those dates stay exclusively under
// Pipeline's Start Check buttons (sendStageEvent above).
export function sendStageStatusOnlyEvent(so, stageName) {
  const sheetStatus = stageToStatus(stageName);
  return post('STAGE_UPDATE', {
    so, stage: stageName, sheetStatus,
    startDate: '', checkDate1: '', checkDate2: '', completionDate: '',
  });
}

export function sendQAChecklistEvent(so, stageId, qaType, checkedBy) {
  return post('QA_CHECKLIST', { so, stage: stageId, checklistType: qaType, checkedBy, sheetStatus: '' });
}

export function sendNoteEvent(so, noteText, createdBy, project = {}, noteType = 'normal') {
  return post('NOTE_ADDED', {
    so, projectName: project.name || '', engineer: project.eng || '',
    noteText: (noteText || '').slice(0, 500), createdBy, noteType, sheetStatus: '',
  });
}

export function sendEngineerAssignEvent(so, engineerName, project = {}) {
  return post('ENGINEER_ASSIGNED', { so, projectName: project.name || '', engineer: engineerName, sheetStatus: '' });
}

export function sendCalendarNoteEvent(noteData, isEdit = false) {
  return post(isEdit ? 'CALENDAR_NOTE_UPDATED' : 'CALENDAR_NOTE_ADDED', {
    so: noteData.so || '', noteText: (noteData.text || '').slice(0, 500),
    noteDate: noteData.date || '', createdBy: noteData.authorName || '', sheetStatus: '',
  });
}

export function sendInstallDateChangeEvent(so, oldDate, newDate, project = {}) {
  return post('INSTALL_DATE_CHANGED', { so, projectName: project.name || '', engineer: project.eng || '', oldDate, newDate, sheetStatus: '' });
}

export async function testSync() {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ eventType: 'WEBHOOK_TEST', so: 'TEST-001', source: 'jlclosets-dashboard' }),
    });
    return { success: res.ok, status: res.status };
  } catch (err) { return { success: false, error: err.message }; }
}

export { toSheetStatus };
