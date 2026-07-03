import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock RTDB: a single shared lock value plus an atomic runTransaction that
// mimics Firebase's abort-on-undefined semantics.
let lock = null;
const runTransaction = vi.fn(async (_ref, updater) => {
  const next = updater(lock);
  if (next === undefined) {
    return { committed: false, snapshot: { val: () => lock } };
  }
  lock = next;
  return { committed: true, snapshot: { val: () => lock } };
});

vi.mock('../firebase', () => ({
  db: {},
  ref: (_db, path) => ({ path }),
  runTransaction: (...a) => runTransaction(...a),
}));

import { withArchiveLease } from '../archiveCoordinator';

beforeEach(() => {
  lock = null;
  runTransaction.mockClear();
});

describe('withArchiveLease', () => {
  it('runs the write when the lease is free', async () => {
    const fn = vi.fn(async () => {});
    const ran = await withArchiveLease(fn);
    expect(ran).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('skips the write when another client holds a valid lease', async () => {
    // Simulate a different client owning a non-expired lease.
    lock = { owner: 'someone-else', expiresAt: Date.now() + 60_000 };
    const fn = vi.fn(async () => {});
    const ran = await withArchiveLease(fn);
    expect(ran).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it('takes over an expired lease', async () => {
    lock = { owner: 'someone-else', expiresAt: Date.now() - 1000 }; // expired
    const fn = vi.fn(async () => {});
    const ran = await withArchiveLease(fn);
    expect(ran).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('serializes overlapping calls in-process (no concurrent fn execution)', async () => {
    let active = 0;
    let maxActive = 0;
    const fn = () => new Promise((resolve) => {
      active++;
      maxActive = Math.max(maxActive, active);
      setTimeout(() => { active--; resolve(); }, 10);
    });
    await Promise.all([
      withArchiveLease(fn),
      withArchiveLease(fn),
      withArchiveLease(fn),
    ]);
    expect(maxActive).toBe(1); // never two archive writes in flight at once
  });

  it('does not run the write if coordination throws', async () => {
    runTransaction.mockRejectedValueOnce(new Error('rtdb unavailable'));
    const fn = vi.fn(async () => {});
    const ran = await withArchiveLease(fn);
    expect(ran).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
