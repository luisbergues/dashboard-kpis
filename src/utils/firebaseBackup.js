import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Backup Firebase (Firestore) configuration – values are read from Vite environment variables
const backupConfig = {
  apiKey: import.meta.env.VITE_BACKUP_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_BACKUP_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_BACKUP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_BACKUP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_BACKUP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_BACKUP_FIREBASE_APP_ID,
};

let backupApp = null;
let backupDb = null;

if (backupConfig.apiKey && backupConfig.projectId) {
  try {
    // Use a named app instance to avoid colliding with the primary app
    backupApp = getApps().some(app => app.name === 'backup')
      ? getApp('backup')
      : initializeApp(backupConfig, 'backup');
    backupDb = getFirestore(backupApp);
    console.log('🔥 Backup Firestore initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Backup Firestore:', error);
  }
} else {
  console.warn('⚠️ Backup Firebase credentials not fully configured in .env.local');
}

export { backupDb, backupApp };
