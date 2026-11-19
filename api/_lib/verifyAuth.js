// Verifies the Firebase Auth ID token sent by the client on every /api/*
// call. Only needs the project ID (no service account) — verifyIdToken
// checks the JWT signature against Google's public keys and confirms the
// token's `aud` matches this Firebase project.
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ projectId: PROJECT_ID });
}

// The raw ID token off the Authorization header. Exported so callers that
// need to act *as the user* (see requireApprovedUser.js) can reuse the same
// parsing instead of re-implementing it.
export function getBearerToken(req) {
  const header = req?.headers?.authorization || '';
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : null;
}

export async function requireAuth(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <idToken> header' });
    return null;
  }

  try {
    const auth = getAuth(getAdminApp());
    const decoded = await auth.verifyIdToken(token);
    return decoded;
  } catch {
    // Expired/malformed tokens are routine, not worth logging per request.
    res.status(401).json({ error: 'Invalid or expired ID token' });
    return null;
  }
}
