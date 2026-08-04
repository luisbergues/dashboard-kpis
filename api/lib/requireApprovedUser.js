// Authorization gate for /api/* endpoints that write company data.
//
// verifyAuth.js proves *who* the caller is (valid Firebase ID token), but
// Firebase signup is open — anyone can register and hold a valid token while
// their users/{uid}/status is still 'pending'. Endpoints that write outside
// the Realtime Database (e.g. api/sync.js -> Google Sheets) get no protection
// from database.rules.json, so they must check approval server-side here.
//
// The profile is read over the RTDB REST API using the CALLER'S OWN ID token
// rather than a service account. database.rules.json already grants
// users/$uid/.read to that same uid, and status/role are writable only by an
// engineer-admin, so the values stay authoritative while this endpoint needs
// no private key of its own.
//
// Why not the admin SDK: getDatabase() requires Application Default
// Credentials, which do not exist on Vercel. Without them it does not throw —
// it retries the connection indefinitely, so `await once('value')` hangs until
// the function times out instead of failing closed.
//
// Fails closed: any doubt (missing record, unreachable DB, timeout) is a 403.
import { requireAuth, getBearerToken } from './verifyAuth.js';

// Bounded so a slow or unreachable RTDB fails closed quickly instead of
// holding the request open for the whole function timeout.
const LOOKUP_TIMEOUT_MS = 5000;

export async function requireApprovedUser(req, res, options = {}) {
  const decoded = await requireAuth(req, res);
  if (!decoded) return null; // requireAuth already wrote a 401.

  const databaseUrl = (process.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
  const token = getBearerToken(req);

  let profile;
  try {
    if (!databaseUrl) throw new Error('VITE_FIREBASE_DATABASE_URL is not configured');
    if (!token) throw new Error('missing bearer token');

    const url = `${databaseUrl}/users/${encodeURIComponent(decoded.uid)}.json?auth=${encodeURIComponent(token)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`RTDB REST returned ${resp.status}`);
    profile = await resp.json();
  } catch (err) {
    console.error('requireApprovedUser: user lookup failed:', err?.message || err);
    res.status(403).json({ error: 'Could not verify account status' });
    return null;
  }

  if (!profile || profile.status !== 'approved') {
    res.status(403).json({ error: 'Account is not approved' });
    return null;
  }

  const { allowedRoles } = options;
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    res.status(403).json({ error: 'Insufficient role' });
    return null;
  }

  return { ...decoded, profile };
}
