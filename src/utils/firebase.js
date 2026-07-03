import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, update, remove, onValue, get, child, runTransaction } from 'firebase/database';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

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
let auth = null;
let storage = null;
let initError = null;

if (isConfigured) {
  try {
    // Prevent double initialization
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getDatabase(firebaseApp);
    auth = getAuth(firebaseApp);
    storage = getStorage(firebaseApp);
    console.log('🔥 Firebase initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    initError = error.message || String(error);
    db = null;
    auth = null;
    storage = null;
  }
} else {
  console.warn('⚠️ Firebase credentials not fully configured in environment variables (.env.local or hosting provider dashboard). Operating in Local Storage Mode.');
  initError = 'Credentials not fully configured in environment variables';
}

// Export database reference and RTDB methods
export { 
  db, 
  auth,
  storage,
  initError,
  ref,
  storageRef,
  set,
  update,
  remove,
  onValue,
  get,
  child,
  runTransaction,
  isConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll
};
