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
  console.log('🧹 Cleaning duplicate/unnormalized keys from weekly_history...');
  
  const badKeys = [
    'JUNE_15,_2026',
    'June_8,_2026',
    'current_week',
    'previous_week'
  ];

  for (const key of badKeys) {
    const keyRef = ref(db, `weekly_history/${key}`);
    const snap = await get(keyRef);
    if (snap.exists()) {
      console.log(`Deleting bad key: ${key}`);
      await remove(keyRef);
    }
  }

  console.log('✏️ Correcting june_22,_2026 node...');
  const june22Ref = ref(db, 'weekly_history/june_22,_2026');
  
  const correctJune22 = {
    label: "JUNE 22, 2026",
    metrics: {
      "Check": 6,
      "Check Eng": 0,
      "Completed Projects": 42,
      "Engineering": 7,
      "Nesting": 0,
      "ON HOLD": 8,
      "Paperwork": 1,
      "Review": 1,
      "Total Active Projects": 24
    },
    savedAt: new Date().toISOString()
  };

  await set(june22Ref, correctJune22);
  console.log('✅ Corrected june_22,_2026 node successfully!');
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
