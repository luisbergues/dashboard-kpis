import { db, ref, set, get, isConfigured } from './firebase';

// PDFs in this flow are text-based Contracts/Quotes/Drawings, not scans, so
// they shouldn't come close to this. It exists to fail loudly instead of
// writing a huge Base64 string into RTDB.
export const MAX_ESS_PDF_BYTES = 8 * 1024 * 1024;

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
export async function saveEssFile(so, docType, file) {
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    throw new Error(sizeCheck.reason);
  }
  const data = await fileToBase64(file);
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await set(ref(db, `ess_files/${so}/${docType}`), {
    name: file.name,
    mimeType: file.type,
    data,
    uploadedAt: new Date().toISOString(),
  });
}

export async function loadEssFile(so, docType) {
  if (!isConfigured || !db) return null;
  const snapshot = await get(ref(db, `ess_files/${so}/${docType}`));
  return snapshot.exists() ? snapshot.val() : null;
}
