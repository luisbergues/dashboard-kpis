import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

// Mirrors the note-date rendering in CalendarView.jsx's notes sidebar. Notes
// come from the `calendar_notes` RTDB collection, where `date` is not enforced
// by any rule — a note written by an older build, or one whose write partially
// failed, can lack it entirely. The raw form built the string by concatenation
// (`new Date(n.date + 'T00:00:00')`), so a missing date produced
// "undefinedT00:00:00" -> Invalid Date -> format() throws RangeError, taking
// down the whole Calendar view.
function formatNoteDate(rawDate, locale = enUS) {
  if (!rawDate) return '';
  const d = new Date(`${rawDate}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return format(d, 'MMM dd, yyyy', { locale });
}

describe('formatNoteDate', () => {
  it('formats a well-formed note date', () => {
    expect(formatNoteDate('2026-07-15')).toBe('Jul 15, 2026');
  });

  it('returns empty string for a missing date instead of throwing', () => {
    expect(() => formatNoteDate(undefined)).not.toThrow();
    expect(formatNoteDate(undefined)).toBe('');
  });

  it('returns empty string for a null date', () => {
    expect(formatNoteDate(null)).toBe('');
  });

  it('returns empty string for an empty date', () => {
    expect(formatNoteDate('')).toBe('');
  });

  it('returns empty string for an unparseable date instead of throwing', () => {
    expect(() => formatNoteDate('N/A')).not.toThrow();
    expect(formatNoteDate('N/A')).toBe('');
  });

  it('returns empty string for a malformed date string', () => {
    expect(formatNoteDate('15/07/2026')).toBe('');
  });

  // Guards the regression this replaces: the old concatenation turned a
  // missing date into the literal string "undefinedT00:00:00".
  it('does not produce an Invalid Date from string concatenation', () => {
    const d = new Date(`${undefined}T00:00:00`);
    expect(isNaN(d.getTime())).toBe(true);
    expect(() => format(d, 'MMM dd, yyyy')).toThrow();
  });
});
