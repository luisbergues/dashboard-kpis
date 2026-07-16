# Security & Robustness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two authorization holes and three crash/corruption bugs found in the 2026-07-15 audit, so an unapproved account cannot write company data and malformed sheet rows cannot take down a view.

**Architecture:** Five independent fixes, ordered by severity. Tasks 1–2 add server-side authorization (a new `requireApprovedUser` helper in `api/lib/`, plus tightened `database.rules.json`). Tasks 3–5 harden client code against the unvalidated Google Sheets data that flows through `sheetParser.js` (defensive string coercion, a corrected date predicate, a shared Firebase key sanitizer). Each task is independently shippable.

**Tech Stack:** React 19 + Vite 8, Firebase (Auth + Realtime Database + Firestore), `firebase-admin` v14 on Vercel serverless functions, `googleapis` v173, Vitest 4.

## Global Constraints

- Node/browser split: files under `api/` are server-only (Node, may read `process.env` secrets); files under `src/` are bundled into the public client (must never reference `GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, or `SYNC_SHEET_ID`).
- Tests are Vitest, colocated next to the unit under test, named `<unit>.test.js` — follow the existing `api/lib/syncMapping.test.js` pattern. Run with `npx vitest run <path>`.
- `src/services/__tests__/kpiCalculator.test.js` has **2 pre-existing failures** (`calculateCADErrors is not a function`) unrelated to this plan. A run is "green" if those 2 are the *only* failures. Do not fix or delete them here.
- Roles in this app: `designer`, `engineer`, `engineer_nester`, `administrative`, `admin`, and the hidden super-admin `engineer-admin` (set only via Firebase Console, never via app UI). `status` is one of `pending` | `approved` | `rejected`.
- `database.rules.json` is the real authorization boundary. Client-side role checks are UX only. Any new server-side check must mirror the rules file, not replace it.
- Deploying `database.rules.json` is a **manual step by the repo owner** via Firebase Console or `firebase deploy --only database`. Do not attempt to deploy it from a task.
- Every task ends with a commit. Do not push; do not create PRs.

---

## File Structure

**Create:**
- `api/lib/requireApprovedUser.js` — server-side authorization gate: verifies the ID token (delegating to existing `requireAuth`) **and** reads `users/{uid}` from the Realtime Database to confirm `status === 'approved'`, optionally enforcing a role allowlist. This is the missing half of `verifyAuth.js`, which only proves *who* you are, not *whether you may*.
- `api/lib/requireApprovedUser.test.js` — unit tests for the gate, with the Admin SDK mocked.
- `src/utils/firebaseKeys.js` — `sanitizeFirebaseKey(value)`, the single chokepoint for turning a sheet-derived SO number into a legal RTDB path segment.
- `src/utils/firebaseKeys.test.js` — unit tests for the sanitizer.

**Modify:**
- `api/sync.js:26` — swap `requireAuth` for `requireApprovedUser` (Task 1).
- `database.rules.json:112-127` — add the `status === 'approved'` condition to the four permissive collections (Task 2).
- `src/views/PipelineView.jsx:362-366,385-393` — guard the unprotected string calls (Task 3).
- `src/views/CalendarView.jsx:148` — same `getStatusColor` guard (Task 3).
- `src/services/kpiCalculator.js:262-269` — fix the unbounded date comparison (Task 4).
- `src/utils/notesHelper.js:31,56` — apply `sanitizeFirebaseKey` at the RTDB path chokepoint (Task 5).

---

### Task 1: Server-side approval gate for `/api/sync`

**Context for the implementer:** `api/sync.js` writes directly into the company's live Google Sheet. Today it calls `requireAuth`, which only proves the caller holds a valid Firebase ID token. Firebase signup is open (`src/views/LoginView.jsx` calls `createUserWithEmailAndPassword` with no gate), so **anyone can register and immediately get a valid token while their `users/{uid}/status` is still `pending`** — then overwrite any SO row they like. `database.rules.json` does not protect this path, because the write target is an external Google Sheet, not the Realtime Database. The fix is to look up the caller's own user record server-side and reject unless approved.

**Files:**
- Create: `api/lib/requireApprovedUser.js`
- Create: `api/lib/requireApprovedUser.test.js`
- Modify: `api/sync.js` (line 6 import, line 26 call site)

**Interfaces:**
- Consumes: `requireAuth(req, res)` from `api/lib/verifyAuth.js` — returns the decoded token object (with `.uid`) on success, or `null` after having already written a 401 to `res`.
- Produces: `requireApprovedUser(req, res, options?)` → `Promise<DecodedIdToken & { profile: { role: string, status: string } } | null>`. Returns `null` after writing 401/403 to `res` when the caller is unauthenticated, unapproved, or role-disallowed. `options.allowedRoles?: string[]` — when provided, the caller's role must be in the list.

- [ ] **Step 1: Write the failing test**

Create `api/lib/requireApprovedUser.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two collaborators before importing the unit under test.
vi.mock('./verifyAuth.js', () => ({ requireAuth: vi.fn() }));
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn() }));
vi.mock('firebase-admin/app', () => ({ getApps: vi.fn(() => [{}]), initializeApp: vi.fn() }));

import { requireAuth } from './verifyAuth.js';
import { getDatabase } from 'firebase-admin/database';
import { requireApprovedUser } from './requireApprovedUser.js';

// Minimal res double: records the status code and JSON body.
function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

// Stubs getDatabase().ref(path).once('value') -> snapshot of `profile`.
function stubProfile(profile) {
  getDatabase.mockReturnValue({
    ref: () => ({ once: async () => ({ val: () => profile }) }),
  });
}

describe('requireApprovedUser', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when requireAuth rejects (already wrote 401)', async () => {
    requireAuth.mockResolvedValue(null);
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
  });

  it('returns 403 when the user record does not exist', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile(null);
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when status is pending', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'pending', role: 'engineer' });
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when status is rejected', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'rejected', role: 'engineer' });
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('returns the decoded token plus profile when approved', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'approved', role: 'engineer' });
    const res = makeRes();
    const result = await requireApprovedUser({}, res);
    expect(result.uid).toBe('u1');
    expect(result.profile.role).toBe('engineer');
    expect(res.statusCode).toBe(null);
  });

  it('returns 403 when the role is not in allowedRoles', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'approved', role: 'designer' });
    const res = makeRes();
    const result = await requireApprovedUser({}, res, { allowedRoles: ['engineer', 'engineer_nester'] });
    expect(result).toBe(null);
    expect(res.statusCode).toBe(403);
  });

  it('allows an approved user whose role is in allowedRoles', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    stubProfile({ status: 'approved', role: 'engineer_nester' });
    const res = makeRes();
    const result = await requireApprovedUser({}, res, { allowedRoles: ['engineer', 'engineer_nester'] });
    expect(result.uid).toBe('u1');
  });

  it('returns 403 (fail closed) when the database read throws', async () => {
    requireAuth.mockResolvedValue({ uid: 'u1' });
    getDatabase.mockReturnValue({
      ref: () => ({ once: async () => { throw new Error('rtdb down'); } }),
    });
    const res = makeRes();
    expect(await requireApprovedUser({}, res)).toBe(null);
    expect(res.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/lib/requireApprovedUser.test.js`
Expected: FAIL — `Failed to resolve import "./requireApprovedUser.js"` (the module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `api/lib/requireApprovedUser.js`:

```js
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

  let profile = null;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/lib/requireApprovedUser.test.js`
Expected: PASS — 8 passed.

- [ ] **Step 5: Wire the gate into `api/sync.js`**

In `api/sync.js`, replace the import on line 6:

```js
import { requireApprovedUser } from './lib/requireApprovedUser.js';
```

and replace the call on line 26:

```js
  // Writes land in the live company Sheet, which database.rules.json cannot
  // protect — enforce approval + role here. 'designer' is excluded to mirror
  // the role restriction database.rules.json applies to equivalent RTDB paths.
  if (!(await requireApprovedUser(req, res, {
    allowedRoles: ['engineer', 'engineer_nester', 'administrative', 'admin', 'engineer-admin'],
  }))) return;
```

Note: the `requireAuth` import is now unused in this file — remove it from line 6's import list if it is still there.

- [ ] **Step 6: Verify nothing else broke**

Run: `npx vitest run api/`
Expected: PASS — `syncMapping.test.js` and `requireApprovedUser.test.js` both green.

Run: `npx eslint api/sync.js api/lib/requireApprovedUser.js`
Expected: only the pre-existing `'process' is not defined` no-undef errors (ESLint has no Node env configured for `api/`). No unused-import errors.

- [ ] **Step 7: Commit**

```bash
git add api/lib/requireApprovedUser.js api/lib/requireApprovedUser.test.js api/sync.js
git commit -m "fix(security): require an approved account to write the company Sheet

/api/sync only called requireAuth, which proves the caller holds a valid
Firebase ID token but not that their account was ever approved. Since signup
is open, any self-registered pending account could overwrite arbitrary SO
rows in the live Sheet — a path database.rules.json cannot protect, because
the write target is an external Google Sheet rather than the RTDB.

Add requireApprovedUser: verifies the token, then reads users/{uid} to
confirm status === 'approved' and (optionally) an allowed role. Fails closed
on a missing record or an unreadable database."
```

---

### Task 2: Close the permissive Realtime Database rules

**Context for the implementer:** In `database.rules.json`, every collection gates on `status === 'approved'` — except four. `essData`, `ipData`, `logbookData`, and `firebase_cache` only require `auth != null`. These hold real per-project engineering and installation data (consumed by `PDFGeneratorModal.jsx` / `IPGeneratorModal.jsx`), not throwaway cache. A pending self-registered account can read or overwrite any project's data through the client SDK directly, bypassing the UI entirely. This task makes those four consistent with the rest of the file.

**Files:**
- Modify: `database.rules.json:112-127`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks. This task is independent of Task 1 and could ship first.

- [ ] **Step 1: Read the current rules to confirm the four permissive blocks**

Run: `node -e "const r=require('./database.rules.json').rules; for (const k of ['essData','ipData','logbookData','firebase_cache']) console.log(k, JSON.stringify(r[k]));"`

Expected output — all four show only an auth check:
```
essData {".read":"auth != null",".write":"auth != null"}
ipData {".read":"auth != null",".write":"auth != null"}
logbookData {".read":"auth != null",".write":"auth != null"}
firebase_cache {".read":"auth != null",".write":"auth != null"}
```

- [ ] **Step 2: Apply the approval condition**

In `database.rules.json`, replace lines 112-127 with:

```json
    "essData": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },
    "ipData": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },
    "logbookData": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },
    "firebase_cache": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },
```

- [ ] **Step 3: Verify the file is still valid JSON and every collection is now gated**

Run:
```bash
node -e "
const r = require('./database.rules.json').rules;
const ungated = Object.entries(r)
  .filter(([k]) => k !== '\$other' && k !== '.read' && k !== '.write')
  .filter(([, v]) => typeof v === 'object' && v['.read'] && !v['.read'].includes(\"status').val() === 'approved'\"))
  .map(([k]) => k);
console.log('collections whose .read lacks an approved check:', ungated);
"
```
Expected: `collections whose .read lacks an approved check: [ 'users' ]`

(`users` is the intended exception: its `.read` is engineer-admin-only at the collection level, with a per-`$uid` self-read rule beneath it. Any other name appearing here is a bug — stop and investigate.)

- [ ] **Step 4: Commit**

```bash
git add database.rules.json
git commit -m "fix(security): require an approved account for essData/ipData/logbookData

These four collections only checked auth != null, while every other
collection in the rules file also requires status === 'approved'. Since
signup is open, a pending account could read or overwrite any project's
engineering (essData), installation-packet (ipData), or logbook data
straight through the client SDK. Bring them in line with the rest."
```

- [ ] **Step 5: Hand the deploy back to the repo owner**

Do **not** deploy. Report to the user, verbatim:

> `database.rules.json` is committed but **not yet live** — Realtime Database rules only take effect once deployed. Deploy with `firebase deploy --only database`, or paste the file into Firebase Console → Realtime Database → Rules → Publish. Until then, the hole is still open in production.

---

### Task 3: Stop malformed sheet rows from crashing Pipeline and Calendar

**Context for the implementer:** `src/utils/sheetParser.js` builds each project with bare positional indexing (`status: row[statusIdx]`, `name: row[nameIdx]`, …) and no fallback, so any short or blank-celled row in the Google Sheet yields `undefined` fields. Two places then call string methods on those fields unguarded:

1. `getStatusColor(status)` does `status.toUpperCase()` — while its sibling `getStatusLabel` in the same file guards with `if (!status) return ''`. The same unguarded copy exists in `CalendarView.jsx`.
2. The `projects` filter calls `.toUpperCase()` / `.toLowerCase()` / `.includes()` on `p.status`, `p.name`, `p.so`, and `p.eng`.

Either one throws a `TypeError` that takes down the whole view. Note the filter runs for **every** filter mode, not just Kanban. This is the same class of bug as the `stageUtils.js` `RangeError` fixed earlier today: unvalidated sheet data reaching a method call. Elsewhere in the codebase (`llmChat.js`) the established pattern is defensive `String(...)` coercion — follow it.

**Files:**
- Modify: `src/views/PipelineView.jsx:362-366` (the filter), `src/views/PipelineView.jsx:385-393` (`getStatusColor`)
- Modify: `src/views/CalendarView.jsx:148` (`getStatusColor`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Reproduce the crash with a test**

Create `src/views/__tests__/pipelineFilters.test.js`:

```js
import { describe, it, expect } from 'vitest';

// These mirror the logic inlined in PipelineView.jsx: getStatusColor (line 385)
// and the search/filter predicate (line 362). They are duplicated here rather
// than imported because the originals are closures inside the component; this
// test pins the *contract* both must satisfy — never throw on sheet rows with
// missing cells, which sheetParser.js produces as `undefined` fields.
//
// NOTE: CalendarView.jsx has a near-identical getStatusColor that returns
// 'cal-'-prefixed class names ('cal-status-hold', …). Only the guard is shared
// between the two; the return values intentionally differ. This test pins
// PipelineView's unprefixed names.
function getStatusColor(status) {
  const s = (status || '').toUpperCase();
  if (s.includes('HOLD')) return 'status-hold';
  if (s.includes('CHECK')) return 'status-check';
  if (s.includes('REVIEW')) return 'status-review';
  if (s.includes('ENG')) return 'status-eng';
  if (s.includes('NEST')) return 'status-nesting';
  return 'status-default';
}

function matches(p, filter, searchTerm) {
  const term = searchTerm.toLowerCase();
  const matchesFilter =
    filter === 'ALL' || filter === 'KANBAN' ||
    String(p.status || '').toUpperCase() === filter.toUpperCase();
  const matchesSearch =
    String(p.name || '').toLowerCase().includes(term) ||
    String(p.so || '').includes(searchTerm) ||
    String(p.eng || '').toLowerCase().includes(term);
  return matchesFilter && matchesSearch;
}

describe('getStatusColor', () => {
  it('returns the default class for undefined status instead of throwing', () => {
    expect(getStatusColor(undefined)).toBe('status-default');
  });

  it('returns the default class for an empty status', () => {
    expect(getStatusColor('')).toBe('status-default');
  });

  it('still classifies a real status', () => {
    expect(getStatusColor('ON HOLD')).toBe('status-hold');
    expect(getStatusColor('Nesting')).toBe('status-nesting');
  });
});

describe('pipeline project filter', () => {
  const complete = { so: '12345', name: 'Perez', eng: 'Luis', status: 'CHECK' };

  it('does not throw on a row with every field missing', () => {
    expect(() => matches({}, 'ALL', '')).not.toThrow();
  });

  it('does not throw when eng is missing (unassigned project)', () => {
    expect(() => matches({ so: '1', name: 'X', status: 'CHECK' }, 'ALL', 'x')).not.toThrow();
  });

  it('does not throw when status is missing under a status filter', () => {
    expect(() => matches({ so: '1', name: 'X', eng: 'Luis' }, 'ON HOLD', '')).not.toThrow();
  });

  it('a row with missing fields simply does not match a search', () => {
    expect(matches({}, 'ALL', 'perez')).toBe(false);
  });

  it('a complete row still matches by name, so, and eng', () => {
    expect(matches(complete, 'ALL', 'perez')).toBe(true);
    expect(matches(complete, 'ALL', '12345')).toBe(true);
    expect(matches(complete, 'ALL', 'luis')).toBe(true);
  });

  it('a complete row still respects the status filter', () => {
    expect(matches(complete, 'CHECK', '')).toBe(true);
    expect(matches(complete, 'ON HOLD', '')).toBe(false);
  });

  it('a numeric so (not a string) does not throw', () => {
    expect(() => matches({ so: 12345, name: 'X', eng: 'L', status: 'CHECK' }, 'ALL', '123')).not.toThrow();
    expect(matches({ so: 12345, name: 'X', eng: 'L', status: 'CHECK' }, 'ALL', '123')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes against the *fixed* logic**

Run: `npx vitest run src/views/__tests__/pipelineFilters.test.js`
Expected: PASS — 10 passed. (The test file contains the corrected logic; it pins the contract the component must now satisfy. The next step ports that same logic into the component.)

- [ ] **Step 3: Fix `getStatusColor` in `PipelineView.jsx`**

In `src/views/PipelineView.jsx`, replace line 386:

```js
  const getStatusColor = (status) => {
    // Sheet rows can arrive with a blank/missing Status cell (sheetParser.js
    // indexes row[statusIdx] with no fallback), so coerce before matching —
    // getStatusLabel below already guards the same way.
    const s = (status || '').toUpperCase();
```

Leave the rest of the function unchanged.

- [ ] **Step 4: Fix the project filter in `PipelineView.jsx`**

In `src/views/PipelineView.jsx`, replace lines 363-366 with:

```js
    // Every field here comes straight from the sheet and can be undefined on a
    // short or blank-celled row — coerce rather than let one bad row throw and
    // take down the whole list.
    const term = searchTerm.toLowerCase();
    const matchesFilter = filter === 'ALL' || filter === 'KANBAN' ||
                          String(p.status || '').toUpperCase() === filter.toUpperCase();
    const matchesSearch = String(p.name || '').toLowerCase().includes(term) ||
                          String(p.so || '').includes(searchTerm) ||
                          String(p.eng || '').toLowerCase().includes(term);
```

- [ ] **Step 5: Fix `getStatusColor` in `CalendarView.jsx`**

In `src/views/CalendarView.jsx`, replace line 148 (`const s = status.toUpperCase();`) with:

```js
    // Same guard as PipelineView: a blank Status cell in the sheet arrives here
    // as undefined. Note this copy returns 'cal-'-prefixed classes — only the
    // guard is shared, the class names deliberately differ.
    const s = (status || '').toUpperCase();
```

Leave the `cal-status-*` return values untouched.

- [ ] **Step 6: Verify the guards are gone and the app still builds**

Run: `grep -n "status.toUpperCase()\|p.name.toLowerCase()\|p.so.includes\|p.eng.toLowerCase()" src/views/PipelineView.jsx src/views/CalendarView.jsx`
Expected: no output (every unguarded call is gone).

Run: `npx vite build`
Expected: `✓ built in …` with no errors.

Run: `npx vitest run`
Expected: only the 2 pre-existing `kpiCalculator` failures.

- [ ] **Step 7: Commit**

```bash
git add src/views/PipelineView.jsx src/views/CalendarView.jsx src/views/__tests__/pipelineFilters.test.js
git commit -m "fix: don't crash Pipeline/Calendar on sheet rows with missing cells

sheetParser.js indexes row[idx] with no fallback, so a short or blank-celled
sheet row yields undefined fields. getStatusColor called status.toUpperCase()
unguarded (unlike its sibling getStatusLabel), and the project filter called
string methods on p.status/p.name/p.so/p.eng — any one of them throwing a
TypeError took down the entire view, on every filter mode, not just Kanban.

Coerce with String(x || '') at both sites, matching the defensive pattern
llmChat.js already uses. Same bug class as today's stageUtils.js RangeError."
```

---

### Task 4: Correct the delayed-projects date predicate

**Context for the implementer:** In `src/services/kpiCalculator.js`, `getDelayedProjectsCount` has a fallback branch for ON HOLD projects that have no status history. The comment says it checks whether the install date is "past or within 3 days", but the actual condition is:

```js
installDate.getTime() - currentDate.getTime() < threeDaysMs
```

That has no lower bound. It is true for an install date one year in the past *and* for one two days in the future — the only thing it excludes is dates more than 3 days out. So a project installing next week gets counted as "delayed" today. Compare with the primary branch just above (line 256), which correctly measures elapsed time *since* the hold date: `currentDate.getTime() - holdDate.getTime() > threeDaysMs`.

The intended meaning is "the install date has already passed" — a project whose install date is behind us and is still ON HOLD is delayed. Future install dates are not delayed, however close.

**Files:**
- Modify: `src/services/kpiCalculator.js:262-269`
- Test: `src/services/__tests__/kpiCalculator.test.js` (append a new `describe` block; do not touch the 2 pre-existing failures)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.
- Existing signature (unchanged): `getDelayedProjectsCount(projects, projectHistory = {}, currentDateStr = new Date().toISOString())` → `number`.

- [ ] **Step 1: Write the failing test**

The file already imports `getDelayedProjectsCount` from `../kpiCalculator` — no import change needed. Its whole body is wrapped in one top-level `describe('KPI Calculator Service Tests', …)`; add this block **inside** that wrapper, next to the other nested `describe`s (i.e. before the wrapper's final `});`):

```js
  describe('getDelayedProjectsCount — install-date fallback (no status history)', () => {
    const NOW = '2026-07-15T12:00:00.000Z';
    const onHold = (so, install) => ({ so, name: `P${so}`, status: 'ON HOLD', install });

    it('counts an ON HOLD project whose install date already passed', () => {
      const projects = [onHold('1', '07/01/2026')];
      expect(getDelayedProjectsCount(projects, {}, NOW)).toBe(1);
    });

    it('does NOT count an ON HOLD project installing two days from now', () => {
      const projects = [onHold('1', '07/17/2026')];
      expect(getDelayedProjectsCount(projects, {}, NOW)).toBe(0);
    });

    it('does NOT count an ON HOLD project installing far in the future', () => {
      const projects = [onHold('1', '12/25/2026')];
      expect(getDelayedProjectsCount(projects, {}, NOW)).toBe(0);
    });

    it('does NOT count an ON HOLD project with no install date', () => {
      const projects = [onHold('1', '')];
      expect(getDelayedProjectsCount(projects, {}, NOW)).toBe(0);
    });

    it('does NOT count an ON HOLD project with an unparseable install date', () => {
      const projects = [onHold('1', 'N/A')];
      expect(getDelayedProjectsCount(projects, {}, NOW)).toBe(0);
    });

    it('does not count projects that are not ON HOLD', () => {
      const projects = [{ so: '1', name: 'P1', status: 'CHECK', install: '07/01/2026' }];
      expect(getDelayedProjectsCount(projects, {}, NOW)).toBe(0);
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/__tests__/kpiCalculator.test.js -t "install-date fallback"`
Expected: FAIL — "does NOT count an ON HOLD project installing two days from now" expects 0 but receives 1, because the current unbounded condition counts near-future dates.

- [ ] **Step 3: Fix the predicate**

In `src/services/kpiCalculator.js`, replace lines 262-269 with:

```js
      } else {
        // Fallback for a project with no recorded status history: treat it as
        // delayed only once its install date has actually passed. The previous
        // condition (installDate - currentDate < threeDaysMs) had no lower
        // bound, so it also counted projects installing up to 3 days in the
        // *future* — those aren't delayed yet.
        if (p.install) {
          const installDate = new Date(p.install);
          if (!isNaN(installDate.getTime()) && installDate.getTime() <= currentDate.getTime()) {
            delayedCount++;
          }
        }
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/services/__tests__/kpiCalculator.test.js -t "install-date fallback"`
Expected: PASS — 6 passed.

- [ ] **Step 5: Confirm no other kpiCalculator test regressed**

Run: `npx vitest run src/services/__tests__/kpiCalculator.test.js`
Expected: the 2 pre-existing `calculateCADErrors` failures and **nothing else** failing.

- [ ] **Step 6: Commit**

```bash
git add src/services/kpiCalculator.js src/services/__tests__/kpiCalculator.test.js
git commit -m "fix: only count a project as delayed once its install date has passed

getDelayedProjectsCount's no-history fallback compared
installDate - currentDate < threeDaysMs, which has no lower bound: it counted
any install date in the past *and* any up to 3 days in the future, excluding
only dates further out. A project installing next week was reported as
delayed. The comment already claimed the intended meaning ('past or within 3
days'); the primary branch above measures elapsed-since-hold correctly.

Count only when the install date is at or before now."
```

---

### Task 5: Sanitize SO numbers used as Firebase path segments

**Context for the implementer:** Realtime Database keys cannot contain `.`, `#`, `$`, `[`, `]`, or `/`. Roughly a dozen call sites interpolate a sheet-derived SO straight into a path — `` ref(db, `project_notes/${so}`) `` — with no validation. If a SO cell ever holds `12345.0`, `#N/A`, or a typo'd `1234/5`, `ref()` throws synchronously. Most call sites wrap the write in a `catch` that only `console.error`s **after** the optimistic UI update has already run, so the user sees "saved" while the write is silently lost.

This task establishes the sanitizer and applies it to `notesHelper.js` (the chatbot's note-writing path). The remaining call sites are follow-up work, deliberately out of scope here: this task must stay independently reviewable, and a repo-wide sweep would bury the sanitizer's own test coverage.

**Files:**
- Create: `src/utils/firebaseKeys.js`
- Create: `src/utils/firebaseKeys.test.js`
- Modify: `src/utils/notesHelper.js` (lines 31 and 56, plus the localStorage keys on 39/43/51 for consistency)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `sanitizeFirebaseKey(value: unknown) => string` from `src/utils/firebaseKeys.js`. Coerces to string, trims, replaces each RTDB-illegal character (`.`, `#`, `$`, `[`, `]`, `/`) with `_`. Returns `''` for `null`/`undefined`/empty — callers must treat `''` as "no valid key" and skip the write.

- [ ] **Step 1: Write the failing test**

Create `src/utils/firebaseKeys.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { sanitizeFirebaseKey } from './firebaseKeys.js';

describe('sanitizeFirebaseKey', () => {
  it('leaves a normal SO number untouched', () => {
    expect(sanitizeFirebaseKey('12345')).toBe('12345');
  });

  it('coerces a numeric SO to a string', () => {
    expect(sanitizeFirebaseKey(12345)).toBe('12345');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeFirebaseKey('  12345  ')).toBe('12345');
  });

  it('replaces a period (RTDB-illegal)', () => {
    expect(sanitizeFirebaseKey('12345.0')).toBe('12345_0');
  });

  it('replaces a forward slash', () => {
    expect(sanitizeFirebaseKey('1234/5')).toBe('1234_5');
  });

  it('replaces a hash, as in a spilled #N/A formula error', () => {
    expect(sanitizeFirebaseKey('#N/A')).toBe('_N_A');
  });

  it('replaces every illegal character in one pass', () => {
    expect(sanitizeFirebaseKey('a.b#c$d[e]f/g')).toBe('a_b_c_d_e_f_g');
  });

  it('returns empty string for null', () => {
    expect(sanitizeFirebaseKey(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeFirebaseKey(undefined)).toBe('');
  });

  it('returns empty string for an empty or whitespace-only value', () => {
    expect(sanitizeFirebaseKey('')).toBe('');
    expect(sanitizeFirebaseKey('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/firebaseKeys.test.js`
Expected: FAIL — `Failed to resolve import "./firebaseKeys.js"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/firebaseKeys.js`:

```js
// Realtime Database keys may not contain '.', '#', '$', '[', ']', or '/' —
// ref() throws synchronously on one. SO numbers come from free-text Google
// Sheet cells (sheetParser.js), so a typo ('1234/5'), a spilled formula error
// ('#N/A'), or a stray decimal ('12345.0') would otherwise crash the write.
// Most callers only console.error in their catch, after the optimistic UI
// update has already rendered — so the user sees "saved" and loses the data.
//
// Returns '' when there is no usable key; callers must treat that as
// "skip the write" rather than writing to a path ending in an empty segment.
const ILLEGAL_KEY_CHARS = /[.#$[\]/]/g;

export function sanitizeFirebaseKey(value) {
  if (value === null || value === undefined) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.replace(ILLEGAL_KEY_CHARS, '_');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/firebaseKeys.test.js`
Expected: PASS — 10 passed.

- [ ] **Step 5: Apply the sanitizer in `notesHelper.js`**

In `src/utils/notesHelper.js`, add the import below the existing firebase import:

```js
import { sanitizeFirebaseKey } from './firebaseKeys.js';
```

Then, inside `addProjectNote`, insert the key derivation directly above `let currentNotes = [];` (line 26) — every path use sits below it, so `soKey` is in scope for all of them:

```js
  // Derive the RTDB path segment once. An SO with an illegal character would
  // otherwise make ref() throw and the note would be silently dropped by the
  // catch below, after the UI already showed it as saved.
  const soKey = sanitizeFirebaseKey(so);
  if (!soKey) throw new Error('addProjectNote: missing or invalid SO');
```

Then replace `${so}` with `${soKey}` at all **five** occurrences — confirmed at lines 31, 39, 43, 51, 56:
- lines 31, 56: `` ref(db, `project_notes/${so}`) `` → `` ref(db, `project_notes/${soKey}`) ``
- lines 39, 43, 51: `` `${CACHE_PREFIX}${so}` `` → `` `${CACHE_PREFIX}${soKey}` ``

The localStorage keys must use the same derived value, or the cache and the RTDB path would disagree about which project a note belongs to.

Throwing (rather than silently returning) is deliberate: the sole caller is `ProjectChatbot.jsx`'s `AWAITING_NOTE_TEXT` handler (line ~264), which already awaits inside a `try/catch` that surfaces an error message to the user. A missing SO is a caller bug, not a routine condition, and the existing catch turns it into visible feedback rather than a silent no-op.

- [ ] **Step 6: Verify no raw `${so}` path interpolation remains in the file**

Run: `grep -n '\${so}' src/utils/notesHelper.js`
Expected: no output.

Run: `npx vitest run src/utils/`
Expected: PASS.

Run: `npx vite build`
Expected: `✓ built in …`.

- [ ] **Step 7: Commit**

```bash
git add src/utils/firebaseKeys.js src/utils/firebaseKeys.test.js src/utils/notesHelper.js
git commit -m "fix: sanitize SO numbers used as Firebase path segments

RTDB keys can't contain . # \$ [ ] / and ref() throws synchronously on one.
SO numbers come from free-text sheet cells, so '12345.0', '#N/A', or a
typo'd '1234/5' crashes the write — and notesHelper's catch only logs, after
the optimistic UI update already showed the note as saved, so the note is
silently lost.

Add sanitizeFirebaseKey and apply it in notesHelper (the chatbot's note
path). Remaining call sites — essData, ipData, logbookData,
materialOverrides, engineeringCheck, and the project_* paths in
PipelineView/MyProjectsView — still need the same treatment; tracked as
follow-up."
```

---

## Out of Scope (deliberate)

- **Applying `sanitizeFirebaseKey` repo-wide.** Task 5 covers `notesHelper.js` only. The other ~10 call sites (`essData.js`, `ipData.js`, `logbookData.js`, `materialOverrides.js`, `engineeringCheck.js`, and the `project_*` paths in `PipelineView.jsx` / `MyProjectsView.jsx`) need the same fix, as a follow-up plan.
- **The 2 failing `calculateCADErrors` tests.** The function does not exist in `kpiCalculator.js`; the tests reference a removed or renamed API. Deciding whether to restore the function or delete the tests is a product question, not a bug fix.
- **`stageUtils.js` synthetic timestamps.** When a stage has no parseable date, it is stamped with "now", which quietly skews stage-duration KPIs. Real, but a behavior change needing a product decision on how unknown timestamps should be presented.
- **The Gemini free-tier quota.** Unrelated to these findings and not a code problem.
