// Throwaway diagnostic — borralo cuando termines. No se commitea.
//
// Prueba las tres operaciones RTDB de la retención de ESS contra tu Firebase
// REAL, autenticado como vos, o sea CONTRA LAS REGLAS REALES. Eso es lo que un
// script con firebase-admin no puede hacer: admin saltea las reglas y te daría
// un falso verde aunque estén denegando.
//
// Usa un SO de descarte (ZZZ-RETENTION-TEST). No toca ningún proyecto real.
//
//   node verify-retention.mjs tu@email.com 'tuPassword'

import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get, update, remove } from 'firebase/database';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node verify-retention.mjs tu@email.com \'tuPassword\'');
  process.exit(1);
}

// Lee .env.local a mano en vez de sumar dotenv por un script descartable.
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .map(line => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(m => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]),
);

const SO = 'ZZZ-RETENTION-TEST';
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
});
const db = getDatabase(app);

const results = [];
async function step(label, fn) {
  try {
    await fn();
    results.push(['OK  ', label]);
    console.log(`  OK    ${label}`);
  } catch (error) {
    results.push(['FALLA', `${label} — ${error.code || error.message}`]);
    console.log(`  FALLA ${label}\n        ${error.code || error.message}`);
  }
}

console.log(`\nAutenticando como ${email}...`);
const auth = getAuth(app);
const cred = await signInWithEmailAndPassword(auth, email, password).catch(e => {
  console.error(`No se pudo autenticar: ${e.code || e.message}`);
  process.exit(1);
});

// El rol es lo que las reglas evalúan. Si esto no dice engineer-admin, todo lo
// de abajo va a fallar por permisos y el problema es el rol, no el código.
const roleSnap = await get(ref(db, `users/${cred.user.uid}/role`)).catch(() => null);
const statusSnap = await get(ref(db, `users/${cred.user.uid}/status`)).catch(() => null);
console.log(`Rol: ${roleSnap?.val() ?? '(no se pudo leer)'} | Estado: ${statusSnap?.val() ?? '(no se pudo leer)'}\n`);

console.log('Probando las operaciones de retención contra las reglas reales:');

await step('escribir un archivo de prueba en ess_files + ess_file_index', async () => {
  await update(ref(db), {
    [`ess_files/${SO}/contract`]: { name: 't.pdf', mimeType: 'application/pdf', data: 'JVBERi0=', uploadedAt: new Date().toISOString() },
    [`ess_file_index/${SO}/contract`]: { name: 't.pdf', uploadedAt: new Date().toISOString() },
  });
});

await step('markForPurge — escribir purgeMarkedAt dentro del índice', async () => {
  await update(ref(db, `ess_file_index/${SO}`), { purgeMarkedAt: new Date().toISOString() });
});

await step('leer la marca de vuelta', async () => {
  const snap = await get(ref(db, `ess_file_index/${SO}/purgeMarkedAt`));
  if (!snap.exists()) throw new Error('la marca no quedó escrita');
});

await step('clearPurgeMark — borrar sólo el campo de la marca', async () => {
  await remove(ref(db, `ess_file_index/${SO}/purgeMarkedAt`));
  const snap = await get(ref(db, `ess_file_index/${SO}/contract`));
  if (!snap.exists()) throw new Error('borró el archivo, no sólo la marca');
});

await step('purgeEssFiles — borrar ess_files y después ess_file_index', async () => {
  await remove(ref(db, `ess_files/${SO}`));
  await remove(ref(db, `ess_file_index/${SO}`));
});

await step('confirmar que no quedó nada del SO de prueba', async () => {
  const a = await get(ref(db, `ess_files/${SO}`));
  const b = await get(ref(db, `ess_file_index/${SO}`));
  if (a.exists() || b.exists()) throw new Error('quedaron restos');
});

const failed = results.filter(([s]) => s === 'FALLA');
console.log(`\n${failed.length === 0
  ? 'TODO OK — las reglas permiten las tres operaciones. La retención va a funcionar en producción.'
  : `${failed.length} FALLARON — la retención NO va a funcionar hasta arreglar esto.`}\n`);
process.exit(failed.length === 0 ? 0 : 1);
