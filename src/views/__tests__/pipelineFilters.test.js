import { describe, it, expect } from 'vitest';

// These mirror the logic inlined in PipelineView.jsx: getStatusColor (line 385)
// and the search/filter predicate (line 362). They are duplicated here rather
// than imported because the originals are closures inside the component; this
// test pins the *contract* both must satisfy — never throw on sheet rows with
// missing cells, which sheetParser.js produces as `undefined` fields.
//
// NOTE: CalendarView.jsx and DashboardView.jsx have near-identical status-color
// helpers that return differently-prefixed class names ('cal-status-hold',
// 'st-hold', …). Only the guard is shared between them; the return values
// intentionally differ. This test pins PipelineView's unprefixed names.
function getStatusColor(status) {
  const s = (status || '').toUpperCase();
  if (s.includes('HOLD')) return 'status-hold';
  if (s.includes('CHECK')) return 'status-check';
  if (s.includes('REVIEW')) return 'status-review';
  if (s.includes('ENG')) return 'status-eng';
  if (s.includes('NEST')) return 'status-nesting';
  return 'status-default';
}

function matches(p, filter, searchTerm) {
  const term = searchTerm.toLowerCase();
  const matchesFilter =
    filter === 'ALL' || filter === 'KANBAN' ||
    String(p.status || '').toUpperCase() === filter.toUpperCase();
  const matchesSearch =
    String(p.name || '').toLowerCase().includes(term) ||
    String(p.so || '').includes(searchTerm) ||
    String(p.eng || '').toLowerCase().includes(term);
  return matchesFilter && matchesSearch;
}

// Mirrors the `p.name.split(':')[0].trim()` display idiom used across the
// views to strip a trailing ":detail" suffix from a project name. The sheet's
// Name column is free text and can be blank, so the raw form throws.
function shortName(name) {
  return String(name || '').split(':')[0].trim();
}

describe('getStatusColor', () => {
  it('returns the default class for undefined status instead of throwing', () => {
    expect(getStatusColor(undefined)).toBe('status-default');
  });

  it('returns the default class for an empty status', () => {
    expect(getStatusColor('')).toBe('status-default');
  });

  it('still classifies a real status', () => {
    expect(getStatusColor('ON HOLD')).toBe('status-hold');
    expect(getStatusColor('Nesting')).toBe('status-nesting');
  });
});

describe('pipeline project filter', () => {
  const complete = { so: '12345', name: 'Perez', eng: 'Luis', status: 'CHECK' };

  it('does not throw on a row with every field missing', () => {
    expect(() => matches({}, 'ALL', '')).not.toThrow();
  });

  it('does not throw when eng is missing (unassigned project)', () => {
    expect(() => matches({ so: '1', name: 'X', status: 'CHECK' }, 'ALL', 'x')).not.toThrow();
  });

  it('does not throw when status is missing under a status filter', () => {
    expect(() => matches({ so: '1', name: 'X', eng: 'Luis' }, 'ON HOLD', '')).not.toThrow();
  });

  it('a row with missing fields simply does not match a search', () => {
    expect(matches({}, 'ALL', 'perez')).toBe(false);
  });

  it('a complete row still matches by name, so, and eng', () => {
    expect(matches(complete, 'ALL', 'perez')).toBe(true);
    expect(matches(complete, 'ALL', '12345')).toBe(true);
    expect(matches(complete, 'ALL', 'luis')).toBe(true);
  });

  it('a complete row still respects the status filter', () => {
    expect(matches(complete, 'CHECK', '')).toBe(true);
    expect(matches(complete, 'ON HOLD', '')).toBe(false);
  });

  it('a numeric so (not a string) does not throw', () => {
    expect(() => matches({ so: 12345, name: 'X', eng: 'L', status: 'CHECK' }, 'ALL', '123')).not.toThrow();
    expect(matches({ so: 12345, name: 'X', eng: 'L', status: 'CHECK' }, 'ALL', '123')).toBe(true);
  });
});

describe('shortName (project name display)', () => {
  it('does not throw on an undefined name', () => {
    expect(() => shortName(undefined)).not.toThrow();
    expect(shortName(undefined)).toBe('');
  });

  it('does not throw on an empty name', () => {
    expect(shortName('')).toBe('');
  });

  it('strips the suffix after a colon and trims', () => {
    expect(shortName('Perez: Master Closet')).toBe('Perez');
  });

  it('leaves a name without a colon intact', () => {
    expect(shortName('Perez')).toBe('Perez');
  });
});
