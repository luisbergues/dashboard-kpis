// Realtime Database keys may not contain '.', '#', '$', '[', ']', or '/' —
// ref() throws synchronously on one. SO numbers come from free-text Google
// Sheet cells (sheetParser.js), so a typo ('1234/5'), a spilled formula error
// ('#N/A'), or a stray decimal ('12345.0') would otherwise crash the write.
// Most callers only console.error in their catch, after the optimistic UI
// update has already rendered — so the user sees "saved" and loses the data.
//
// Returns '' when there is no usable key; callers must treat that as
// "skip the write" rather than writing to a path ending in an empty segment.
const ILLEGAL_KEY_CHARS = /[.#$[\]/]/g;

export function sanitizeFirebaseKey(value) {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.replace(ILLEGAL_KEY_CHARS, '_');
}
