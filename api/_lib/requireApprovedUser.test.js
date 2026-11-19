import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the identity check; the profile lookup is plain fetch, stubbed per test.
vi.mock('./verifyAuth.js', () => ({
  requireAuth: vi.fn(),
  getBearerToken: vi.fn(() => 'id-token-123'),
}));

import { requireAuth, getBearerToken } from './verifyAuth.js';
import { requireApprovedUser } from './requireApprovedUser.js';

const DB_URL = 'https://example-rtdb.firebaseio.com';

// Minimal res double: records the status code and JSON body.
function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

// Stubs the RTDB REST read -> `profile`.
function stubProfile(profile) {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => profile }));
}

describe('requireApprovedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBearerToken.mockReturnValue('id-token-123');
    process.env.VITE_FIREBASE_DATABASE_URL = DB_URL;
  });

  afterEach(() => { delete global.fetch; });

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

  it('reads the caller own record, authenticated with the caller own token', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'approved', role: 'engineer' });
    await requireApprovedUser({}, makeRes());
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(`${DB_URL}/users/u1.json?auth=id-token-123`);
  });

  it('returns 403 (fail closed) when the lookup throws', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    global.fetch = vi.fn(async () => { throw new Error('network down'); });
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  // The admin-SDK version of this helper hung forever when it had no
  // credentials; a non-OK REST response must fail closed instead.
  it('returns 403 (fail closed) when RTDB denies the read', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 (fail closed) when the database URL is not configured', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    delete process.env.VITE_FIREBASE_DATABASE_URL;
    global.fetch = vi.fn();
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
