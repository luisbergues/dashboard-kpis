import { describe, it, expect } from 'vitest';
import { hasReachedNesting, planRetention, DEFAULT_GRACE_MS } from '../essRetention';

describe('hasReachedNesting', () => {
  it('is true at NESTING, the moment the PDFs stop being needed', () => {
    expect(hasReachedNesting({ status: 'NESTING' })).toBe(true);
  });

  it('is true past nesting, at INSTALL and COMPLETED', () => {
    expect(hasReachedNesting({ status: 'INSTALL' })).toBe(true);
    expect(hasReachedNesting({ status: 'COMPLETED' })).toBe(true);
  });

  it('is false while the project is still being engineered', () => {
    expect(hasReachedNesting({ status: 'ENGINEERING' })).toBe(false);
    expect(hasReachedNesting({ status: 'CHECK ENG.' })).toBe(false);
    expect(hasReachedNesting({ status: 'PAPERWORK' })).toBe(false);
    expect(hasReachedNesting({ status: 'CHECK' })).toBe(false);
  });

  it('ignores casing and surrounding whitespace, which the sheet is full of', () => {
    expect(hasReachedNesting({ status: '  nesting  ' })).toBe(true);
  });

  it('is false for a status the sheet uses but the stage map does not know', () => {
    expect(hasReachedNesting({ status: 'ON HOLD' })).toBe(false);
  });

  it('is false rather than throwing when status is missing entirely', () => {
    expect(hasReachedNesting({ status: '' })).toBe(false);
    expect(hasReachedNesting({ status: null })).toBe(false);
    expect(hasReachedNesting({})).toBe(false);
    expect(hasReachedNesting(null)).toBe(false);
    expect(hasReachedNesting(undefined)).toBe(false);
  });
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-11T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

// One uploaded file, old enough never to be the thing that triggers an unmark.
const file = (uploadedAt = iso(NOW - 90 * DAY)) => ({ name: 'x.pdf', uploadedAt });

describe('DEFAULT_GRACE_MS', () => {
  it('is 7 days', () => {
    expect(DEFAULT_GRACE_MS).toBe(7 * DAY);
  });
});

describe('planRetention', () => {
  const nesting = { so: '100', status: 'NESTING' };
  const paperwork = { so: '100', status: 'PAPERWORK' };

  it('marks a project that reached nesting and has files', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file() } },
      now: NOW,
    });
    expect(plan.toMark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
    expect(plan.toUnmark).toEqual([]);
  });

  it('does not mark a project still short of nesting', () => {
    const plan = planRetention({
      projects: [paperwork],
      fileIndex: { 100: { contract: file() } },
      now: NOW,
    });
    expect(plan.toMark).toEqual([]);
  });

  it('does not mark a project that has no files at all', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: {} },
      now: NOW,
    });
    expect(plan.toMark).toEqual([]);
    expect(plan.orphans).toEqual([]);
  });

  it('does not re-mark a project that is already marked', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - DAY) } },
      now: NOW,
    });
    expect(plan.toMark).toEqual([]);
  });

  it('unmarks when the project fell back before nesting, the sheet-flicker guard', () => {
    const plan = planRetention({
      projects: [paperwork],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 30 * DAY) } },
      now: NOW,
    });
    expect(plan.toUnmark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
  });

  it('unmarks when a file was re-uploaded after the mark', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: {
        100: { contract: file(iso(NOW - DAY)), purgeMarkedAt: iso(NOW - 30 * DAY) },
      },
      now: NOW,
    });
    expect(plan.toUnmark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
  });

  it('does not purge before the grace window elapses', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 6 * DAY) } },
      now: NOW,
    });
    expect(plan.toPurge).toEqual([]);
  });

  it('purges exactly at the grace boundary', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 7 * DAY) } },
      now: NOW,
    });
    expect(plan.toPurge).toEqual(['100']);
  });

  it('purges once the grace window is well past', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 30 * DAY) } },
      now: NOW,
    });
    expect(plan.toPurge).toEqual(['100']);
  });

  it('honours a custom grace window', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 2 * DAY) } },
      now: NOW,
      graceMs: DAY,
    });
    expect(plan.toPurge).toEqual(['100']);
  });

  it('reports a project absent from the sheet as an orphan, touching nothing', () => {
    const plan = planRetention({
      projects: [],
      fileIndex: { 999: { contract: file() } },
      now: NOW,
    });
    expect(plan.orphans).toEqual(['999']);
    expect(plan.toMark).toEqual([]);
    expect(plan.toUnmark).toEqual([]);
    expect(plan.toPurge).toEqual([]);
  });

  it('re-marks over an unparseable purgeMarkedAt instead of trusting it', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: 'not a date' } },
      now: NOW,
    });
    expect(plan.toMark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
  });

  it('matches numeric and string SOs, which the sheet mixes', () => {
    const plan = planRetention({
      projects: [{ so: 100, status: 'NESTING' }],
      fileIndex: { 100: { contract: file() } },
      now: NOW,
    });
    expect(plan.toMark).toEqual(['100']);
    expect(plan.orphans).toEqual([]);
  });

  it('survives missing inputs without throwing', () => {
    expect(() => planRetention({ projects: null, fileIndex: null, now: NOW })).not.toThrow();
    const plan = planRetention({ projects: null, fileIndex: null, now: NOW });
    expect(plan).toEqual({ toMark: [], toUnmark: [], toPurge: [], orphans: [] });
  });
});
