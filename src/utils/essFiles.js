import { db, ref, get, update, remove, isConfigured } from './firebase';

// PDFs in this flow are text-based Contracts/Quotes/Drawings, not scans, so
// they shouldn't come close to this. It exists to fail loudly instead of
// writing a huge Base64 string into RTDB.
// Base64 inflates a file by ~33%, and RTDB caps a single string value at
// 10MB — 7MB of PDF becomes a ~9.33MB string, safely under that ceiling.
// Anything larger would pass client validation and then fail the write.
export const MAX_ESS_PDF_BYTES = 7 * 1024 * 1024;

export function validateFileSize(file) {
  if (file.size > MAX_ESS_PDF_BYTES) {
    return { valid: false, reason: 'FILE_TOO_LARGE' };
  }
  return { valid: true };
}

export async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// No Firebase Storage bucket in this repo — see the design doc's "Storage"
// section for why. Files live as Base64 strings in RTDB, same pattern as
// note attachments in src/services/imageService.js.
//
// The Base64 payload is written twice-over in shape: the full record under
// ess_files/, plus a `data`-free metadata entry under ess_file_index/. Callers
// that only need to know a file exists (or its name) read the index instead of
// dragging megabytes of Base64 across the wire. Both paths go out in a single
// atomic multi-path update so the index can never describe a file that isn't
// there — and `name`/`uploadedAt` are computed once so the two copies can't
// drift.
export async function saveEssFile(so, docType, file) {
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    throw new Error(sizeCheck.reason);
  }
  const data = await fileToBase64(file);
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  const name = file.name;
  const uploadedAt = new Date().toISOString();
  await update(ref(db), {
    [`ess_files/${so}/${docType}`]: { name, mimeType: file.type, data, uploadedAt },
    [`ess_file_index/${so}/${docType}`]: { name, uploadedAt },
  });
}

export async function loadEssFile(so, docType) {
  if (!isConfigured || !db) return null;
  const snapshot = await get(ref(db, `ess_files/${so}/${docType}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// Metadata-only counterpart to loadEssFile: same shape minus the Base64 blob,
// for callers that just need the file's name/timestamp.
export async function loadEssFileIndexEntry(so, docType) {
  if (!isConfigured || !db) return null;
  const snapshot = await get(ref(db, `ess_file_index/${so}/${docType}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// The purge mark lives inside the index node rather than in a node of its own,
// so this feature needs no new RTDB rule block. Consumers read named docType
// keys (loadEssFileIndexEntry, EssView's statusFor), so the extra sibling key
// is inert to them.
export async function markForPurge(so, markedAt) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await update(ref(db, `ess_file_index/${so}`), { purgeMarkedAt: markedAt });
}

export async function clearPurgeMark(so) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await remove(ref(db, `ess_file_index/${so}/purgeMarkedAt`));
}

// Order is load-bearing: the heavy node first, the index (carrying the mark)
// second. A failure in between leaves the index and its mark intact, so the
// next sweep retries. The reverse would leave megabytes of Base64 with nothing
// referencing them — invisible to the UI and to this sweep, so unreachable.
export async function purgeEssFiles(so) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await remove(ref(db, `ess_files/${so}`));
  await remove(ref(db, `ess_file_index/${so}`));
}

// El id no puede salir del nombre del archivo: se repiten entre proyectos
// ('Room 2.pdf') y el ambiente no se conoce hasta parsear el PDF, así que no
// hay identidad natural en el momento de escribir.
function newQuoteId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Mismo contrato atómico que saveEssFile: el nodo pesado y el índice salen en
// un solo update, así el índice nunca describe un archivo que no está.
// De paso borra el Quote singular del modelo viejo — una línea en vez de
// código de migración, sin la cual quedan megabytes de Base64 huérfanos.
export async function addEssQuote(so, file, area) {
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    throw new Error(sizeCheck.reason);
  }
  const data = await fileToBase64(file);
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  const quoteId = newQuoteId();
  const name = file.name;
  const uploadedAt = new Date().toISOString();
  const areaValue = area ?? null;
  await update(ref(db), {
    [`ess_files/${so}/quotes/${quoteId}`]: { name, mimeType: file.type, data, uploadedAt, area: areaValue },
    [`ess_file_index/${so}/quotes/${quoteId}`]: { name, uploadedAt, area: areaValue },
    [`ess_files/${so}/quote`]: null,
    [`ess_file_index/${so}/quote`]: null,
  });
  return quoteId;
}

// Orden load-bearing, igual que purgeEssFiles: el nodo pesado primero.
export async function removeEssQuote(so, quoteId) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await remove(ref(db, `ess_files/${so}/quotes/${quoteId}`));
  await remove(ref(db, `ess_file_index/${so}/quotes/${quoteId}`));
}

export async function loadEssQuoteIndex(so) {
  if (!isConfigured || !db) return {};
  const snapshot = await get(ref(db, `ess_file_index/${so}/quotes`));
  return snapshot.exists() ? snapshot.val() : {};
}

export async function loadEssQuotes(so) {
  if (!isConfigured || !db) return [];
  const snapshot = await get(ref(db, `ess_files/${so}/quotes`));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([quoteId, value]) => ({ quoteId, ...value }));
}
