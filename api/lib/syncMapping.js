// Pure decision function: event payload -> which columns to write.
// The endpoint handles the actual Sheets I/O. STATUS text is decided by the
// client (sheetSync.js) and passed in `sheetStatus`; this function never remaps it.

const push = (writes, col, value) => {
  if (value !== undefined && value !== null && value !== '') writes.push({ col, value: String(value) });
};

export function mapEventToCells(body = {}) {
  const b = body || {};
  const writes = [];

  switch (b.eventType) {
    case 'ENGINEER_ASSIGNED':
      push(writes, 'I', b.engineer);
      return { writes, needsObsRead: false };

    case 'ON_HOLD':
      push(writes, 'N', b.sheetStatus);
      return { writes, needsObsRead: false };

    case 'STAGE_UPDATE':
      push(writes, 'J', b.startDate);
      push(writes, 'K', b.checkDate1);
      push(writes, 'L', b.checkDate2);
      push(writes, 'M', b.completionDate);
      push(writes, 'N', b.sheetStatus);
      return { writes, needsObsRead: false };

    case 'NOTE_ADDED':
      if (b.noteType === 'obs' && b.noteText) {
        return { writes: [{ col: 'O', value: String(b.noteText) }], needsObsRead: true };
      }
      return { writes: [], needsObsRead: false };

    default:
      return { writes: [], needsObsRead: false };
  }
}
