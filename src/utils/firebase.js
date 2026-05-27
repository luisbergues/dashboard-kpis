import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, remove, onValue, get, child } from 'firebase/database';

// Firebase configuration using Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if credentials have been populated (not the default placeholder)
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
  firebaseConfig.databaseURL && 
  firebaseConfig.databaseURL !== 'YOUR_DATABASE_URL';

let db = null;
let firebaseApp = null;

if (isConfigured) {
  try {
    // Prevent double initialization
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getDatabase(firebaseApp);
    console.log('🔥 Firebase Realtime Database initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Realtime Database:', error);
    db = null;
  }
} else {
  console.warn('⚠️ Firebase credentials not fully configured in .env.local. Operating in Local Storage Mode.');
}

// Export database reference and RTDB methods
export { 
  db, 
  ref, 
  set, 
  remove, 
  onValue, 
  get, 
  child,
  isConfigured 
};
