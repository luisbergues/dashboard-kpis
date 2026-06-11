// Script to clean old weekly_history data and seed correct snapshots
// Run: node fix-history.mjs

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, remove, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyAk8TSIE6UE9PFO5lvbj3lZbbQSzLELDdo',
  databaseURL: 'https://jl-closets-kpi-default-rtdb.firebaseio.com',
  authDomain: 'jl-closets-kpi.firebaseapp.com',
  projectId: 'jl-closets-kpi',
  storageBucket: 'jl-closets-kpi.appspot.com',
  appId: '1:9823044566:web:c217cc9b87076ff5c59a77'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function main() {
  // 1. Delete all old weekly_history data
  console.log('🗑️  Cleaning old weekly_history...');
  const historyRef = ref(db, 'weekly_history');
  
  const oldSnap = await get(historyRef);
  if (oldSnap.exists()) {
    console.log('Old data found:', Object.keys(oldSnap.val()));
    await remove(historyRef);
    console.log('✅ Old data removed');
  } else {
    console.log('No old data found');
  }

  // 2. The app will auto-save the correct snapshots on next load
  // (both previous and current weeks from the sheet)
  console.log('✅ Done! The app will now save correct snapshots automatically on next page load.');
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
