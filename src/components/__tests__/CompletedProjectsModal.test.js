import { describe, it, expect } from 'vitest';
import { parseArchivedAt } from '../CompletedProjectsModal';

// Regression coverage: archivedAt is stored as a plain ISO string
// (completedProjectsArchive.js does `new Date().toISOString()`), but the
// modal's original date-detection only recognized Firestore-Timestamp
// shapes (`.toDate()` / `.seconds`) — a leftover from when this data briefly
// lived in Firestore/Storage (see archiveStore.js's history comment). Every
// real archived project's "Archived" column silently fell through to the
// "Still in sheet" default, even though it genuinely wasn't in the sheet
// anymore.
describe('parseArchivedAt', () => {
  it('parses the real stored format: a plain ISO string', () => {
    const iso = '2026-03-15T10:00:00.000Z';
    const result = parseArchivedAt(iso);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(iso);
  });

  it('parses a legacy Firestore Timestamp instance (.toDate())', () => {
    const fakeTimestamp = { toDate: () => new Date('2026-01-01T00:00:00.000Z') };
    const result = parseArchivedAt(fakeTimestamp);
    expect(result.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('parses a legacy Firestore Timestamp-shaped plain object (.seconds)', () => {
    const seconds = Math.floor(new Date('2026-02-01T00:00:00.000Z').getTime() / 1000);
    const result = parseArchivedAt({ seconds });
    expect(result.getTime()).toBe(seconds * 1000);
  });

  it('returns null for a missing archivedAt (still only in the live sheet)', () => {
    expect(parseArchivedAt(undefined)).toBeNull();
    expect(parseArchivedAt(null)).toBeNull();
    expect(parseArchivedAt('')).toBeNull();
  });

  it('returns null instead of throwing on an unparseable value', () => {
    expect(() => parseArchivedAt('not a date')).not.toThrow();
    expect(parseArchivedAt('not a date')).toBeNull();
  });
});
