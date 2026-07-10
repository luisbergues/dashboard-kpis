// Verifies the Firebase Auth ID token sent by the client on every /api/*
// call. Only needs the project ID (no service account) — verifyIdToken
// checks the JWT signature against Google's public keys and confirms the
// token's `aud` matches this Firebase project.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID;

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ projectId: PROJECT_ID });
}

export async function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <idToken> header' });
    return null;
  }

  try {
    const auth = getAuth(getAdminApp());
    const decoded = await auth.verifyIdToken(match[1]);
    return decoded;
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired ID token' });
    return null;
  }
}
