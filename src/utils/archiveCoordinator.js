import { db, ref, runTransaction } from './firebase';

// Single-writer coordination for the Storage archive.
//
// The archive lives as shared JSON blobs in Storage, mutated via read-modify-write.
// Storage has no atomic/conditional writes in the client SDK, so two clients
// archiving at the same time could lose an update. RTDB *does* have atomic
// transactions, so we use one to elect a single archive writer at a time: a
// client must win a short-lived lease before touching the archive; everyone else
// skips this cycle. Archiving is idempotent and eventual, so skipping a cycle
// never loses data — the lease holder (or the next winner) writes it.

const LOCK_PATH = 'archive_lock';
const LEASE_MS = 60_000;

// Stable id for this browser session.
const CLIENT_ID =
  Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);

async function acquireLease() {
  if (!db) return false;
  try {
    const res = await runTransaction(ref(db, LOCK_PATH), (current) => {
      const now = Date.now();
      // Abort (leave as-is) if a *different* client holds a still-valid lease.
      if (current && current.expiresAt > now && current.owner !== CLIENT_ID) {
        return undefined;
      }
      // Otherwise take/renew the lease.
      return { owner: CLIENT_ID, expiresAt: now + LEASE_MS };
    });
    return res.committed && res.snapshot.val()?.owner === CLIENT_ID;
  } catch (error) {
    // If coordination itself fails, don't archive (safer than racing).
    console.warn('⚠️ Could not acquire archive lease:', error?.message || error);
    return false;
  }
}

// In-process serialization: chain calls so this client never runs two archive
// writes at once (cross-client is handled by the RTDB lease above; this covers
// overlapping calls within the same tab). Errors are swallowed on the chain so
// one failure doesn't wedge later calls.
let chain = Promise.resolve();

// Runs `fn` only if this client currently holds the archive-writer lease, and
// never concurrently with another in-flight archive write from this client.
// Returns true if it ran, false if another client owns the lease this cycle.
export function withArchiveLease(fn) {
  const run = chain.then(async () => {
    if (!(await acquireLease())) return false;
    await fn();
    return true;
  });
  chain = run.then(() => {}, () => {});
  return run;
}
