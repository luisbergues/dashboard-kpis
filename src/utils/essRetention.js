import { STATUS_INDEX_MAP } from './stageUtils';

// The PDFs exist to produce the ESS. Once the project is checked and nesting
// starts, the sheet has been generated, reviewed and taken to the floor, so the
// source documents are dead weight — see
// docs/superpowers/specs/2026-08-11-ess-file-retention-design.md for the full
// rationale, including why deletion is two-phase.
const NESTING_INDEX = STATUS_INDEX_MAP.NESTING;

export function hasReachedNesting(project) {
  const status = (project?.status || '').toUpperCase().trim();
  const index = STATUS_INDEX_MAP[status];
  return index !== undefined && index >= NESTING_INDEX;
}

export const DEFAULT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const DOC_TYPES = ['contract', 'summary', 'drawings'];

// Los Quotes son una colección, no una clave fija: un proyecto puede tener uno
// por ambiente. Recorrer sólo DOC_TYPES dejaba un SO con únicamente Quotes
// fuera de la retención entera, o sea con sus PDFs guardados para siempre.
function quoteEntries(entry) {
  return Object.values(entry?.quotes || {});
}

function hasAnyFile(entry) {
  return DOC_TYPES.some(docType => entry?.[docType]) || quoteEntries(entry).length > 0;
}

function parseTime(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function latestUploadAt(entry) {
  const times = [
    ...DOC_TYPES.map(docType => entry?.[docType]?.uploadedAt),
    ...quoteEntries(entry).map(quote => quote?.uploadedAt),
  ]
    .map(parseTime)
    .filter(ms => ms !== null);
  return times.length > 0 ? Math.max(...times) : null;
}

// Decides the three transitions for every project that has files, in one pass.
// Pure on purpose: the whole retention policy is testable without Firebase.
export function planRetention({ projects, fileIndex, now, graceMs = DEFAULT_GRACE_MS }) {
  const toMark = [];
  const toUnmark = [];
  const toPurge = [];
  const orphans = [];

  // The sheet is inconsistent about whether an SO is a string or a number.
  const bySo = new Map((projects || []).map(project => [String(project.so), project]));

  Object.entries(fileIndex || {}).forEach(([so, entry]) => {
    if (!hasAnyFile(entry)) return;

    const project = bySo.get(String(so));
    // No row on the sheet means the stage can't be evaluated. Deleting on a
    // guess is exactly what this feature exists to avoid, so surface it and
    // let a human decide.
    if (!project) {
      orphans.push(so);
      return;
    }

    const reached = hasReachedNesting(project);
    const markedAt = parseTime(entry.purgeMarkedAt);

    if (markedAt === null) {
      if (reached) toMark.push(so);
      return;
    }

    // The sheet moved back — a correction, or a flicker. Either way the files
    // are needed again.
    if (!reached) {
      toUnmark.push(so);
      return;
    }

    // Someone re-uploaded after the mark, so the countdown is stale.
    const latest = latestUploadAt(entry);
    if (latest !== null && latest > markedAt) {
      toUnmark.push(so);
      return;
    }

    if (now - markedAt >= graceMs) toPurge.push(so);
  });

  return { toMark, toUnmark, toPurge, orphans };
}

// Rounds up so the label never says "0 days left" for a file that is still
// there — 0 is reserved for "the next sweep will take it".
export function daysUntilPurge(entry, now, graceMs = DEFAULT_GRACE_MS) {
  const markedAt = parseTime(entry?.purgeMarkedAt);
  if (markedAt === null) return null;
  const remaining = markedAt + graceMs - now;
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
}
