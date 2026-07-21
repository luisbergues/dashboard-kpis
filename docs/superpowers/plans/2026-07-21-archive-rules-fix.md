# Archive Rules Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firebase Realtime Database rules for the `archive/*` and `archive_lock` nodes so the Completed Projects archive system (currently silently dead in production — every read/write hits the `$other` catch-all `.read: false, .write: false`) actually works.

**Architecture:** `database.rules.json` is a static JSON tree evaluated by Firebase's rules engine — there is no code to unit-test in the traditional sense. This plan adds two new top-level rule blocks (`archive`, `archive_lock`) following the exact permission pattern already used by every other node in the file (`auth != null && .../status === 'approved'`, some excluding `role === 'designer'`), then verifies them two ways: (1) a repo-local Node script that re-implements Firebase's rule-expression semantics for the specific paths and roles this app has, run against concrete allow/deny cases (the same technique used to verify the `users/$uid` rule fix in an earlier session — no Firebase emulator is installed in this environment and installing `firebase-tools` requires a network fetch outside this plan's scope), and (2) manual verification in the Firebase Console Rules Playground once the user publishes the rules, since that's the only way to test against the *real* rules engine before rollout.

**Tech Stack:** Firebase Realtime Database rules (JSON + Firebase's rules expression language), Node.js (rules-behavior simulation script), no test framework changes needed (this isn't application code).

## Global Constraints

- Every existing top-level node in `database.rules.json` follows this exact shape: `.read: "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"`, and `.write` is the same expression, optionally AND'd with `root.child('users').child(auth.uid).child('role').val() !== 'designer'` for nodes designers shouldn't write to. New rules MUST follow this exact pattern — do not invent a different expression style.
- The archive nodes are read/written by ANY approved user during the app's normal data-load path (`src/App.jsx`'s main `useQuery`, unconditional — not gated by role), same access level as `project_notes`/`calendar_notes` (approved-only, no role exclusion). Do NOT exclude `designer` from `archive`/`archive_lock` — that would just move the silent-failure bug from "everyone" to "designers only," and nothing in the codebase currently restricts archive reads to non-designers.
- `archive_lock` holds a single object (`{owner, expiresAt}`, written via `runTransaction` in `src/utils/archiveCoordinator.js:23`), not a map of children — its rule does not need a `$key` wildcard child rule, unlike `archive`.
- `archive` is a parent node with three known children (`completed_projects`, `weekly_history`, `deleted_projects`, per `src/utils/archiveStore.js:14-18` `ARCHIVE_PATHS`) plus one more read directly in `src/App.jsx` — the DB-size check (Task 1, Step 1 has you confirm the exact path). Give `archive` itself `.read`/`.write` (inherited by all children) rather than three separate per-child blocks, since all three need identical access and the app does whole-node `get`/`set` on each (`src/utils/archiveStore.js:35-46`).
- Do not touch any other existing rule block in `database.rules.json` — this plan only adds two new ones.
- The user must manually republish `database.rules.json` in Firebase Console after this plan's changes are committed — no deploy step runs automatically. The plan's last task is a manual verification checklist for the user, not an automated deploy.

---

## File Structure

| File | Role |
|---|---|
| `database.rules.json` | Add two new top-level blocks: `archive`, `archive_lock`. |
| `scripts/verify-archive-rules.js` (create) | Standalone Node script simulating the rule expressions against concrete `(role, status, path)` cases — the same manual-verification technique used for the `users/$uid` rule fix. No dependencies, run with plain `node`. |
| `docs/superpowers/plans/2026-07-21-archive-rules-fix.md` | This plan (already created). |

---

### Task 1: Confirm every path the app actually touches under `archive`

Before writing rules, confirm the exact set of RTDB paths the archive system reads/writes, so the new rule covers all of them and nothing extra is assumed.

**Files:**
- Read (no modification): `src/utils/archiveStore.js`, `src/utils/archiveCoordinator.js`, `src/App.jsx`

**Interfaces:**
- Produces: a written-down, verified list of exact paths (used by Task 2 to write the rule and by Task 3's script to pick test cases).

- [ ] **Step 1: Grep for every `checkDbSizeAndArchive` call and definition to see if it touches `archive/*` under a path not already in `ARCHIVE_PATHS`**

Run: `grep -rn "checkDbSizeAndArchive" src/`

Expected output:
```
src/App.jsx:5:import { checkDbSizeAndArchive } from './utils/archiveHelpers'
src/App.jsx:83:            await checkDbSizeAndArchive();
src/utils/archiveHelpers.js:10:export async function checkDbSizeAndArchive() {
```

(The function lives in `src/utils/archiveHelpers.js`, not a file named `dbSizeGuard.js`.)

Open `src/utils/archiveHelpers.js` and confirm: it calls `readArchiveMap`/`writeArchiveMap` from `archiveStore.js` for `ARCHIVE_PATHS.weekly` and `ARCHIVE_PATHS.deleted` (already covered by the `archive` rule this task adds) — but it ALSO does `get(ref(db, 'weekly_history'))`, `get(ref(db, 'deleted_projects'))`, and `remove(weeklyRef)` / `remove(deletedRef)` directly (lines 22-23, 44, 53) against the LIVE (non-archive) `weekly_history`/`deleted_projects` nodes. Those two live nodes already have their own rule blocks in `database.rules.json` (both exclude `role === 'designer'` from writing) — that is a pre-existing, separately-scoped concern (the same "designer gets PERMISSION_DENIED on a write it triggers unconditionally" class of bug flagged elsewhere in the audit for `weekly_history`), NOT something this plan's `archive`/`archive_lock` rule addition needs to fix. Do not add a designer exclusion to the `archive` rule to compensate — that would violate this plan's Global Constraint that archive access matches `project_notes`/`calendar_notes` (approved-only, no role exclusion), since `fetchArchivedCompletedProjects` and `archiveCurrentlyCompletedProjects` (the two calls that actually gate the "Completed Projects" view working at all) must remain accessible to every approved role including designer.

- [ ] **Step 2: Confirm the final path list**

You should end up with exactly these RTDB paths needing coverage:
- `archive/completed_projects` (map keyed by SO number)
- `archive/weekly_history` (map keyed by week key)
- `archive/deleted_projects` (map keyed by SO number)
- `archive_lock` (single object, NOT under `archive/`)

If Step 1 turned up any additional path under `archive/` not in this list, add it to this list before continuing — do not proceed to Task 2 until this list is final. If nothing new turned up, this step requires no code change; just note the confirmed list in your task report.

- [ ] **Step 3: Confirm no other top-level rule block already partially matches these paths**

Run: `grep -n '"archive' database.rules.json`

Expected: no output (confirms neither `archive` nor `archive_lock` has any existing partial rule — they currently fall through entirely to `$other`).

---

### Task 2: Add the `archive` and `archive_lock` rule blocks

**Files:**
- Modify: `database.rules.json`

**Interfaces:**
- Consumes: the confirmed path list from Task 1.
- Produces: two new top-level keys in the rules tree, following the file's established pattern (see Global Constraints).

- [ ] **Step 1: Add the two new blocks**

Insert these two blocks into `database.rules.json` immediately after the `firebase_cache` block (currently the last content block before `$other`, ending at line 130) and before the `$other` block (currently starting at line 132):

```json
    "archive": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },
    "archive_lock": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },

```

The file after this edit must have this exact structure around the insertion point (line numbers approximate — locate by the `firebase_cache` / `$other` text, not line number):

```json
    "firebase_cache": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },

    "archive": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },
    "archive_lock": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },

    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
```

- [ ] **Step 2: Validate the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json', 'utf8')); console.log('valid JSON')"`
Expected: `valid JSON`

If this fails, you have a trailing-comma or bracket-matching error — fix it before continuing. A common mistake is leaving a trailing comma after the last block before `$other`, or forgetting the comma after `firebase_cache`'s closing brace.

- [ ] **Step 3: Confirm rule count and structure with a quick grep**

Run: `git stash && grep -c '"\.read"\|"\.write"' database.rules.json && git stash pop`

This prints the pre-change count (60, confirmed baseline), then restores your uncommitted changes. Now run:

Run: `grep -c '"\.read"\|"\.write"' database.rules.json`

Expected: 64 — exactly 4 more than the pre-change baseline (2 new `.read` + 2 new `.write`, one pair each for `archive` and `archive_lock`).

Run: `git diff --stat database.rules.json`
Expected: shows only additions (no deletions), roughly 8-10 lines added.

- [ ] **Step 4: Commit**

```bash
git add database.rules.json
git commit -m "fix: add Firebase rules for archive/* and archive_lock nodes

The Completed Projects archive system (src/utils/completedProjectsArchive.js,
archiveStore.js, archiveCoordinator.js) reads and writes archive/completed_projects,
archive/weekly_history, archive/deleted_projects, and archive_lock, but none of
these paths had a rule — they fell through to the \$other catch-all
(.read/.write: false), so every archive operation failed with
PERMISSION_DENIED, silently swallowed by try/catch (console.error only).
Same access level as project_notes/calendar_notes: any approved user, no
designer exclusion (archive reads run unconditionally in App.jsx's main
data-load query for every role)."
```

---

### Task 3: Write a rules-behavior verification script

Since no Firebase emulator is installed in this environment (confirmed: `firebase-tools` is not present locally and installing it requires a network fetch outside this plan's scope), this task builds a small Node script that mirrors Firebase's rule-expression semantics for exactly the constructs this file uses (`auth != null`, `root.child(...).child(...).val()`, `===`, `&&`, `!==`) and evaluates them against concrete test cases. This is the same manual-verification technique used earlier in this project to verify the `users/$uid` write-rule fix.

**Files:**
- Create: `scripts/verify-archive-rules.js`

**Interfaces:**
- Produces: a script runnable via `node scripts/verify-archive-rules.js` that prints PASS/FAIL per test case and exits non-zero if any case fails.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
// Simulates Firebase RTDB rule evaluation for the archive/archive_lock rules
// added in database.rules.json, against a small fake `users` tree. There is
// no Firebase emulator installed in this environment; this script mirrors
// the exact expression this project's rules use (auth != null &&
// root.child('users').child(auth.uid).child(<field>).val() === <value>) so
// the rule's logic can be checked before the user publishes it in the
// Firebase Console. It is not a substitute for the Console's Rules
// Playground — run that too once published (see the plan's Task 4).

const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, '..', 'database.rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

// Fake `users` tree: uid -> { role, status }
const usersTree = {
  'uid-approved-engineer': { role: 'engineer', status: 'approved' },
  'uid-approved-designer': { role: 'designer', status: 'approved' },
  'uid-approved-admin': { role: 'engineer-admin', status: 'approved' },
  'uid-pending-engineer': { role: 'engineer', status: 'pending' },
  'uid-rejected-engineer': { role: 'engineer', status: 'rejected' },
};

// Minimal evaluator for exactly the expression shape this file's rules use:
//   "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
//   "... && root.child('users').child(auth.uid).child('role').val() !== 'designer'"
function evalRule(expr, authUid) {
  const auth = authUid ? { uid: authUid } : null;
  const root = {
    child(seg1) {
      return {
        child(seg2) {
          return {
            child(field) {
              return {
                val() {
                  if (seg1 !== 'users') throw new Error(`unexpected root.child('${seg1}')`);
                  const user = usersTree[seg2];
                  if (!user) return null;
                  return user[field] ?? null;
                },
              };
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('auth', 'root', `return (${expr});`);
  return fn(auth, root);
}

const cases = [
  // [description, uid|null, expectedRead, expectedWrite]
  ['approved engineer can read+write archive', 'uid-approved-engineer', true, true],
  ['approved designer can read+write archive (no role exclusion)', 'uid-approved-designer', true, true],
  ['approved admin can read+write archive', 'uid-approved-admin', true, true],
  ['pending user cannot read/write archive', 'uid-pending-engineer', false, false],
  ['rejected user cannot read/write archive', 'uid-rejected-engineer', false, false],
  ['unauthenticated (no auth) cannot read/write archive', null, false, false],
  ['unknown uid (not in users tree) cannot read/write archive', 'uid-does-not-exist', false, false],
];

let failed = 0;

for (const node of ['archive', 'archive_lock']) {
  const readExpr = rules.rules[node]['.read'];
  const writeExpr = rules.rules[node]['.write'];
  console.log(`\n=== ${node} ===`);
  for (const [desc, uid, expectRead, expectWrite] of cases) {
    const actualRead = evalRule(readExpr, uid);
    const actualWrite = evalRule(writeExpr, uid);
    const readOk = actualRead === expectRead;
    const writeOk = actualWrite === expectWrite;
    const status = readOk && writeOk ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failed++;
    console.log(
      `  [${status}] ${desc} — read=${actualRead}(expected ${expectRead}) write=${actualWrite}(expected ${expectWrite})`
    );
  }
}

console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it before the rule exists to confirm it fails meaningfully**

This step only makes sense if run against the pre-Task-2 version of `database.rules.json` (i.e., if you're doing this task before Task 2, or want to double check by temporarily stashing). Since Task 2 already ran first in this plan's order, instead do this: temporarily comment out the `archive`/`archive_lock` blocks added in Task 2, run the script, confirm it throws (because `rules.rules['archive']` would be `undefined`, so `rules.rules[node]['.read']` throws `TypeError: Cannot read properties of undefined`), then restore the blocks.

```bash
node scripts/verify-archive-rules.js
```
Expected (with blocks temporarily removed): `TypeError: Cannot read properties of undefined (reading '.read')` — confirms the script actually depends on the rule blocks existing, not a no-op.

Restore the blocks (git checkout the file or undo your temporary edit) before continuing.

- [ ] **Step 3: Run it for real against the committed rules**

```bash
node scripts/verify-archive-rules.js
```

Expected output: all 14 cases (7 cases × 2 nodes) print `[PASS]`, ending in:
```
ALL PASS
```

If any case prints `[FAIL]`, the rule expression was transcribed incorrectly in Task 2 — go back and fix `database.rules.json` (do not fix it by changing the test's expectations; the expectations encode the constraint from this plan's Global Constraints section).

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-archive-rules.js
git commit -m "test: add rules-behavior verification script for archive/archive_lock

No Firebase emulator is installed in this environment; this script mirrors
the exact rule-expression shape database.rules.json uses and checks it
against approved/pending/rejected/unauthenticated/unknown-uid cases,
including that designers are NOT excluded (archive access matches
project_notes/calendar_notes, not the role-gated nodes)."
```

---

### Task 4: Manual verification checklist (for the user, after publishing)

This task has no code changes — it is the verification step that only the user can perform, since it requires access to the live Firebase project and a subsequent app deploy. Document it so nothing gets missed.

**Files:** none.

- [ ] **Step 1: Publish the updated rules**

The user copies the full contents of `database.rules.json` (after Task 2's changes) into Firebase Console → Realtime Database → Rules, and clicks Publish. (This mirrors the same manual-publish step the project has always used — there is no CI/CD step that pushes rules automatically, confirmed by `firebase.json` only declaring `"database": {"rules": "database.rules.json"}` with no deploy hook wired to this repo's CI.)

- [ ] **Step 2: Verify in the Firebase Console Rules Playground**

In Firebase Console → Realtime Database → Rules → Rules Playground, run these simulations against the just-published rules:

1. **Read `archive/completed_projects`** as an authenticated user whose `users/{uid}/status` is `approved` → expect **Allowed**.
2. **Write `archive_lock`** as the same approved user → expect **Allowed**.
3. **Read `archive/completed_projects`** as an authenticated user whose `users/{uid}/status` is `pending` → expect **Denied**.
4. **Read `archive/completed_projects`** unauthenticated (no user selected) → expect **Denied**.

- [ ] **Step 3: Verify in the running app**

After publishing, open the app (any approved-user account, any role) and:
1. Open the browser console, reload the app, and confirm no `PERMISSION_DENIED` errors appear referencing `archive` or `archive_lock` (previously these were logged via `console.error('❌ Error fetching archived projects:', error)` in `src/utils/completedProjectsArchive.js:111-114` and similar).
2. Open the "Completed Projects" view and confirm previously-completed projects now appear (if any exist in the sheet/RTDB already) — or, if the archive was truly empty until now, confirm no error appears and the view renders its normal empty state instead of silently failing.
3. As an admin, open the Orphaned Projects panel (`AdminUsersView` → the panel rendered at `src/views/AdminUsersView.jsx:163`) and confirm the "manually archive" action succeeds without a console error.

- [ ] **Step 4: Report back**

Report to the development team whether all checks in Steps 2-3 passed. If any failed, capture the exact Firebase Console error message or browser console error and treat it as a new bug — do not attempt to work around it by loosening the rule further than this plan's Global Constraints specify.

---

## Self-Review Notes

- **Spec coverage:** the audit's critical finding (archive/archive_lock falling through to `$other`) is addressed by Task 2; the "silently swallowed by try/catch" symptom is directly checked in Task 4 Step 3.1; the finding's root cause (missing rules, not application code) means no `src/` application code needs to change — confirmed by re-reading `completedProjectsArchive.js`/`archiveStore.js`/`archiveCoordinator.js`, all of which already have correct error handling and just need the underlying permission to stop failing.
- **No placeholders:** every step has literal JSON/JS to write, exact commands, and exact expected output.
- **Type/interface consistency:** the script in Task 3 reads `rules.rules[node]['.read']`/`['.write']` — matching the exact keys written in Task 2's JSON blocks (`.read`, `.write`) and the exact node names (`archive`, `archive_lock`).
