// Authorization gate for /api/* endpoints that write company data.
//
// verifyAuth.js proves *who* the caller is (valid Firebase ID token), but
// Firebase signup is open — anyone can register and hold a valid token while
// their users/{uid}/status is still 'pending'. Endpoints that write outside
// the Realtime Database (e.g. api/sync.js -> Google Sheets) get no protection
// from database.rules.json, so they must check approval server-side here.
//
// Fails closed: any doubt (missing record, unreadable DB) is a 403.
import { initializeApp, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { requireAuth } from './verifyAuth.js';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;
const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL;

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ projectId: PROJECT_ID, databaseURL: DATABASE_URL });
}

export async function requireApprovedUser(req, res, options = {}) {
  const decoded = await requireAuth(req, res);
  if (!decoded) return null; // requireAuth already wrote a 401.

  let profile;
  try {
    const snapshot = await getDatabase(getAdminApp())
      .ref(`users/${decoded.uid}`)
      .once('value');
    profile = snapshot.val();
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
