import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two collaborators before importing the unit under test.
vi.mock('./verifyAuth.js', () => ({ requireAuth: vi.fn() }));
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn() }));
vi.mock('firebase-admin/app', () => ({ getApps: vi.fn(() => [{}]), initializeApp: vi.fn() }));

import { requireAuth } from './verifyAuth.js';
import { getDatabase } from 'firebase-admin/database';
import { requireApprovedUser } from './requireApprovedUser.js';

// Minimal res double: records the status code and JSON body.
function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

// Stubs getDatabase().ref(path).once('value') -> snapshot of `profile`.
function stubProfile(profile) {
  getDatabase.mockReturnValue({
    ref: () => ({ once: async () => ({ val: () => profile }) }),
  });
}

describe('requireApprovedUser', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when requireAuth rejects (already wrote 401)', async () => {
    requireAuth.mockResolvedValue(null);
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
  });

  it('returns 403 when the user record does not exist', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile(null);
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when status is pending', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'pending', role: 'engineer' });
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when status is rejected', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'rejected', role: 'engineer' });
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('returns the decoded token plus profile when approved', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'approved', role: 'engineer' });
    const res = makeRes();
    const result = await requireApprovedUser({}, res);
    expect(result.uid).toBe('u1');
    expect(result.profile.role).toBe('engineer');
    expect(res.statusCode).toBe(null);
  });

  it('returns 403 when the role is not in allowedRoles', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'approved', role: 'designer' });
    const res = makeRes();
    const result = await requireApprovedUser({}, res, { allowedRoles: ['engineer', 'engineer_nester'] });
    expect(result).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('allows an approved user whose role is in allowedRoles', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'approved', role: 'engineer_nester' });
    const res = makeRes();
    const result = await requireApprovedUser({}, res, { allowedRoles: ['engineer', 'engineer_nester'] });
    expect(result.uid).toBe('u1');
  });

  it('returns 403 (fail closed) when the database read throws', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    getDatabase.mockReturnValue({
      ref: () => ({ once: async () => { throw new Error('rtdb down'); } }),
    });
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });
});
