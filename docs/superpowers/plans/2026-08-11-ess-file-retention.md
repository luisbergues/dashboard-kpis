# ESS File Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the heavy Base64 ESS source PDFs from RTDB once a project has reached nesting, with a two-phase mark-then-purge cycle that gives a recovery window.

**Architecture:** All retention policy lives in one new pure module (`src/utils/essRetention.js`) that takes plain data and returns a plan — no Firebase, no React. A thin layer in the existing `essFiles.js` executes that plan against RTDB. `EssView` runs the sweep in a `useEffect` when the (super-admin-only) ESS tab opens. The purge mark is stored as a field inside the existing `ess_file_index/{SO}` node, so **no RTDB rule changes and nothing to republish**.

**Tech Stack:** React 19, Vite, Vitest, Firebase Realtime Database.

## Global Constraints

- The feature stays super-admin-only (`role: 'engineer-admin'`). Do not relax any RTDB rule.
- Do not create any new top-level RTDB node. The purge mark goes inside `ess_file_index/{SO}`.
- Never delete `essAutoData` or `ess_corrections`. Only `ess_files/{SO}` and `ess_file_index/{SO}` are purged.
- Grace window is 7 days, expressed as `DEFAULT_GRACE_MS = 7 * 24 * 60 * 60 * 1000`.
- Nesting threshold comes from `STATUS_INDEX_MAP` in `src/utils/stageUtils.js`. Never hardcode `4`.
- Spec: `docs/superpowers/specs/2026-08-11-ess-file-retention-design.md`.
- Existing tests must stay green: run `npm test` before every commit.
- `EssView.jsx` does i18n with inline `language === 'es' ? 'es' : 'en'` ternaries, not the `t()` dictionary. Follow that local pattern.

---

### Task 1: Nesting threshold predicate

**Files:**
- Create: `src/utils/essRetention.js`
- Test: `src/utils/__tests__/essRetention.test.js`

**Interfaces:**
- Consumes: `STATUS_INDEX_MAP` from `src/utils/stageUtils.js` (an object mapping uppercase sheet status strings to stage indices: `ENGINEERING:0, 'CHECK ENG.':1, PAPERWORK:2, CHECK:3, NESTING:4, INSTALL:5, COMPLETED:5`).
- Produces: `hasReachedNesting(project) → boolean`, where `project` is a row from `data.priorityAnalysis` with at least a `status` string.

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/essRetention.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { hasReachedNesting } from '../essRetention';

describe('hasReachedNesting', () => {
  it('is true at NESTING, the moment the PDFs stop being needed', () => {
    expect(hasReachedNesting({ status: 'NESTING' })).toBe(true);
  });

  it('is true past nesting, at INSTALL and COMPLETED', () => {
    expect(hasReachedNesting({ status: 'INSTALL' })).toBe(true);
    expect(hasReachedNesting({ status: 'COMPLETED' })).toBe(true);
  });

  it('is false while the project is still being engineered', () => {
    expect(hasReachedNesting({ status: 'ENGINEERING' })).toBe(false);
    expect(hasReachedNesting({ status: 'CHECK ENG.' })).toBe(false);
    expect(hasReachedNesting({ status: 'PAPERWORK' })).toBe(false);
    expect(hasReachedNesting({ status: 'CHECK' })).toBe(false);
  });

  it('ignores casing and surrounding whitespace, which the sheet is full of', () => {
    expect(hasReachedNesting({ status: '  nesting  ' })).toBe(true);
  });

  it('is false for a status the sheet uses but the stage map does not know', () => {
    expect(hasReachedNesting({ status: 'ON HOLD' })).toBe(false);
  });

  it('is false rather than throwing when status is missing entirely', () => {
    expect(hasReachedNesting({ status: '' })).toBe(false);
    expect(hasReachedNesting({ status: null })).toBe(false);
    expect(hasReachedNesting({})).toBe(false);
    expect(hasReachedNesting(null)).toBe(false);
    expect(hasReachedNesting(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js`
Expected: FAIL — `Failed to resolve import "../essRetention"` (the module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/essRetention.js`:

```js
import { STATUS_INDEX_MAP } from './stageUtils';

// The PDFs exist to produce the ESS. Once the project is checked and nesting
// starts, the sheet has been generated, reviewed and taken to the floor, so the
// source documents are dead weight — see the design doc for the full rationale.
const NESTING_INDEX = STATUS_INDEX_MAP.NESTING;

export function hasReachedNesting(project) {
  const status = (project?.status || '').toUpperCase().trim();
  const index = STATUS_INDEX_MAP[status];
  return index !== undefined && index >= NESTING_INDEX;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/utils/essRetention.js src/utils/__tests__/essRetention.test.js
git commit -m "feat(ess): add nesting-threshold predicate for file retention"
```

---

### Task 2: The retention plan

**Files:**
- Modify: `src/utils/essRetention.js` (append to the file created in Task 1)
- Test: `src/utils/__tests__/essRetention.test.js` (append)

**Interfaces:**
- Consumes: `hasReachedNesting(project)` from Task 1.
- Produces:
  - `DEFAULT_GRACE_MS` — number, 7 days in ms.
  - `planRetention({ projects, fileIndex, now, graceMs }) → { toMark, toUnmark, toPurge, orphans }`, each value an array of SO strings.
    - `projects`: `[{ so, status }]`, from `data.priorityAnalysis`.
    - `fileIndex`: `{ [so]: { contract?: {name, uploadedAt}, quote?: {...}, drawings?: {...}, purgeMarkedAt?: string } }`, the whole `ess_file_index` subtree.
    - `now`: number, `Date.now()`.
    - `graceMs`: number, optional, defaults to `DEFAULT_GRACE_MS`.

- [ ] **Step 1: Write the failing test**

Append to `src/utils/__tests__/essRetention.test.js`. Also extend the import on line 2 to `import { hasReachedNesting, planRetention, DEFAULT_GRACE_MS } from '../essRetention';`

```js
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-08-11T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

// One uploaded file, old enough never to be the thing that triggers an unmark.
const file = (uploadedAt = iso(NOW - 90 * DAY)) => ({ name: 'x.pdf', uploadedAt });

describe('DEFAULT_GRACE_MS', () => {
  it('is 7 days', () => {
    expect(DEFAULT_GRACE_MS).toBe(7 * DAY);
  });
});

describe('planRetention', () => {
  const nesting = { so: '100', status: 'NESTING' };
  const paperwork = { so: '100', status: 'PAPERWORK' };

  it('marks a project that reached nesting and has files', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file() } },
      now: NOW,
    });
    expect(plan.toMark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
    expect(plan.toUnmark).toEqual([]);
  });

  it('does not mark a project still short of nesting', () => {
    const plan = planRetention({
      projects: [paperwork],
      fileIndex: { 100: { contract: file() } },
      now: NOW,
    });
    expect(plan.toMark).toEqual([]);
  });

  it('does not mark a project that has no files at all', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: {} },
      now: NOW,
    });
    expect(plan.toMark).toEqual([]);
    expect(plan.orphans).toEqual([]);
  });

  it('does not re-mark a project that is already marked', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - DAY) } },
      now: NOW,
    });
    expect(plan.toMark).toEqual([]);
  });

  it('unmarks when the project fell back before nesting, the sheet-flicker guard', () => {
    const plan = planRetention({
      projects: [paperwork],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 30 * DAY) } },
      now: NOW,
    });
    expect(plan.toUnmark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
  });

  it('unmarks when a file was re-uploaded after the mark', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: {
        100: { contract: file(iso(NOW - DAY)), purgeMarkedAt: iso(NOW - 30 * DAY) },
      },
      now: NOW,
    });
    expect(plan.toUnmark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
  });

  it('does not purge before the grace window elapses', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 6 * DAY) } },
      now: NOW,
    });
    expect(plan.toPurge).toEqual([]);
  });

  it('purges exactly at the grace boundary', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 7 * DAY) } },
      now: NOW,
    });
    expect(plan.toPurge).toEqual(['100']);
  });

  it('purges once the grace window is well past', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 30 * DAY) } },
      now: NOW,
    });
    expect(plan.toPurge).toEqual(['100']);
  });

  it('honours a custom grace window', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: iso(NOW - 2 * DAY) } },
      now: NOW,
      graceMs: DAY,
    });
    expect(plan.toPurge).toEqual(['100']);
  });

  it('reports a project absent from the sheet as an orphan, touching nothing', () => {
    const plan = planRetention({
      projects: [],
      fileIndex: { 999: { contract: file() } },
      now: NOW,
    });
    expect(plan.orphans).toEqual(['999']);
    expect(plan.toMark).toEqual([]);
    expect(plan.toUnmark).toEqual([]);
    expect(plan.toPurge).toEqual([]);
  });

  it('re-marks over an unparseable purgeMarkedAt instead of trusting it', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { contract: file(), purgeMarkedAt: 'not a date' } },
      now: NOW,
    });
    expect(plan.toMark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
  });

  it('matches numeric and string SOs, which the sheet mixes', () => {
    const plan = planRetention({
      projects: [{ so: 100, status: 'NESTING' }],
      fileIndex: { 100: { contract: file() } },
      now: NOW,
    });
    expect(plan.toMark).toEqual(['100']);
    expect(plan.orphans).toEqual([]);
  });

  it('survives missing inputs without throwing', () => {
    expect(() => planRetention({ projects: null, fileIndex: null, now: NOW })).not.toThrow();
    const plan = planRetention({ projects: null, fileIndex: null, now: NOW });
    expect(plan).toEqual({ toMark: [], toUnmark: [], toPurge: [], orphans: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js`
Expected: FAIL — `planRetention is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/utils/essRetention.js`:

```js
export const DEFAULT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const DOC_TYPES = ['contract', 'quote', 'drawings'];

function hasAnyFile(entry) {
  return DOC_TYPES.some(docType => entry?.[docType]);
}

function parseTime(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function latestUploadAt(entry) {
  const times = DOC_TYPES
    .map(docType => parseTime(entry?.[docType]?.uploadedAt))
    .filter(ms => ms !== null);
  return times.length > 0 ? Math.max(...times) : null;
}

// Decides the three transitions for every project that has files, in one pass.
// Pure on purpose: the whole retention policy is testable without Firebase.
export function planRetention({ projects, fileIndex, now, graceMs = DEFAULT_GRACE_MS }) {
  const toMark = [];
  const toUnmark = [];
  const toPurge = [];
  const orphans = [];

  // The sheet is inconsistent about whether an SO is a string or a number.
  const bySo = new Map((projects || []).map(project => [String(project.so), project]));

  Object.entries(fileIndex || {}).forEach(([so, entry]) => {
    if (!hasAnyFile(entry)) return;

    const project = bySo.get(String(so));
    // No row on the sheet means the stage can't be evaluated. Deleting on a
    // guess is exactly what this feature exists to avoid, so surface it and
    // let a human decide.
    if (!project) {
      orphans.push(so);
      return;
    }

    const reached = hasReachedNesting(project);
    const markedAt = parseTime(entry.purgeMarkedAt);

    if (markedAt === null) {
      if (reached) toMark.push(so);
      return;
    }

    // The sheet moved back — a correction, or a flicker. Either way the files
    // are needed again.
    if (!reached) {
      toUnmark.push(so);
      return;
    }

    // Someone re-uploaded after the mark, so the countdown is stale.
    const latest = latestUploadAt(entry);
    if (latest !== null && latest > markedAt) {
      toUnmark.push(so);
      return;
    }

    if (now - markedAt >= graceMs) toPurge.push(so);
  });

  return { toMark, toUnmark, toPurge, orphans };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/utils/essRetention.js src/utils/__tests__/essRetention.test.js
git commit -m "feat(ess): add mark/unmark/purge retention policy"
```

---

### Task 3: Countdown helper for the UI

**Files:**
- Modify: `src/utils/essRetention.js` (append)
- Test: `src/utils/__tests__/essRetention.test.js` (append)

**Interfaces:**
- Consumes: `DEFAULT_GRACE_MS` from Task 2.
- Produces: `daysUntilPurge(entry, now, graceMs) → number | null`. Returns `null` when the entry carries no valid mark. Returns `0` when the window has already elapsed. Rounds **up**, so "1 day left" means the purge has not happened yet.

- [ ] **Step 1: Write the failing test**

Extend the import to include `daysUntilPurge`, then append:

```js
describe('daysUntilPurge', () => {
  it('is null when the entry has no mark', () => {
    expect(daysUntilPurge({ contract: file() }, NOW)).toBeNull();
  });

  it('is null when the mark is unparseable', () => {
    expect(daysUntilPurge({ purgeMarkedAt: 'nope' }, NOW)).toBeNull();
  });

  it('counts the full window down from a fresh mark', () => {
    expect(daysUntilPurge({ purgeMarkedAt: iso(NOW) }, NOW)).toBe(7);
  });

  it('rounds up, so a partial day still reads as a day left', () => {
    expect(daysUntilPurge({ purgeMarkedAt: iso(NOW - 6.5 * DAY) }, NOW)).toBe(1);
  });

  it('is 0 once the window has elapsed', () => {
    expect(daysUntilPurge({ purgeMarkedAt: iso(NOW - 7 * DAY) }, NOW)).toBe(0);
    expect(daysUntilPurge({ purgeMarkedAt: iso(NOW - 30 * DAY) }, NOW)).toBe(0);
  });

  it('honours a custom grace window', () => {
    expect(daysUntilPurge({ purgeMarkedAt: iso(NOW) }, NOW, DAY)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js`
Expected: FAIL — `daysUntilPurge is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/utils/essRetention.js`:

```js
// Rounds up so the label never says "0 days left" for a file that is still
// there — 0 is reserved for "the next sweep will take it".
export function daysUntilPurge(entry, now, graceMs = DEFAULT_GRACE_MS) {
  const markedAt = parseTime(entry?.purgeMarkedAt);
  if (markedAt === null) return null;
  const remaining = markedAt + graceMs - now;
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/essRetention.js src/utils/__tests__/essRetention.test.js
git commit -m "feat(ess): add purge countdown helper"
```

---

### Task 4: RTDB execution layer

**Files:**
- Modify: `src/utils/essFiles.js` (line 1 import, then append three functions)
- Test: `src/utils/__tests__/essFiles.test.js` (extend the `vi.mock` factory, then append)

**Interfaces:**
- Consumes: `db, ref, update, remove, isConfigured` from `src/utils/firebase.js` (`remove` is already exported there — verified).
- Produces:
  - `markForPurge(so, markedAt) → Promise<void>`
  - `clearPurgeMark(so) → Promise<void>`
  - `purgeEssFiles(so) → Promise<void>`

- [ ] **Step 1: Write the failing test**

In `src/utils/__tests__/essFiles.test.js`, add `remove` to the mock. Replace lines 5–13 with:

```js
const get = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock('../firebase', () => ({
  db: {},                       // truthy → module proceeds
  isConfigured: true,
  ref: (_db, path) => ({ path: path ?? null }),
  get: (...a) => get(...a),
  update: (...a) => update(...a),
  remove: (...a) => remove(...a),
}));
```

Extend the import on line 15 to add `markForPurge, clearPurgeMark, purgeEssFiles`.

Add `remove.mockReset();` inside the existing `beforeEach` block.

Then append:

```js
describe('markForPurge', () => {
  it('writes the mark inside the existing index node, creating no new node', async () => {
    update.mockResolvedValue(undefined);
    await markForPurge('12485', '2026-08-11T12:00:00.000Z');

    expect(update).toHaveBeenCalledTimes(1);
    const [refArg, payload] = update.mock.calls[0];
    expect(refArg).toEqual({ path: 'ess_file_index/12485' });
    expect(payload).toEqual({ purgeMarkedAt: '2026-08-11T12:00:00.000Z' });
  });
});

describe('clearPurgeMark', () => {
  it('removes only the mark field, leaving the file metadata intact', async () => {
    remove.mockResolvedValue(undefined);
    await clearPurgeMark('12485');

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ path: 'ess_file_index/12485/purgeMarkedAt' });
  });
});

describe('purgeEssFiles', () => {
  it('deletes the heavy node before the index, so a mid-failure stays retryable', async () => {
    remove.mockResolvedValue(undefined);
    await purgeEssFiles('12485');

    expect(remove.mock.calls.map(([r]) => r.path)).toEqual([
      'ess_files/12485',
      'ess_file_index/12485',
    ]);
  });

  it('leaves the index in place when deleting the files node fails', async () => {
    // The index is what makes the project visible to the next sweep. Losing it
    // first would strand megabytes of Base64 that nothing references.
    remove.mockRejectedValueOnce(new Error('permission denied'));
    await expect(purgeEssFiles('12485')).rejects.toThrow('permission denied');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0][0]).toEqual({ path: 'ess_files/12485' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essFiles.test.js`
Expected: FAIL — `markForPurge is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/utils/essFiles.js`, change line 1 to:

```js
import { db, ref, get, update, remove, isConfigured } from './firebase';
```

Then append:

```js
// The purge mark lives inside the index node rather than in a node of its own,
// so this feature needs no new RTDB rule block. Consumers read named docType
// keys (loadEssFileIndexEntry, EssView's statusFor), so the extra sibling key
// is inert to them.
export async function markForPurge(so, markedAt) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await update(ref(db, `ess_file_index/${so}`), { purgeMarkedAt: markedAt });
}

export async function clearPurgeMark(so) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await remove(ref(db, `ess_file_index/${so}/purgeMarkedAt`));
}

// Order is load-bearing: the heavy node first, the index (carrying the mark)
// second. A failure in between leaves the index and its mark intact, so the
// next sweep retries. The reverse would leave megabytes of Base64 with nothing
// referencing them — invisible to the UI and to this sweep, so unreachable.
export async function purgeEssFiles(so) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await remove(ref(db, `ess_files/${so}`));
  await remove(ref(db, `ess_file_index/${so}`));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essFiles.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/essFiles.js src/utils/__tests__/essFiles.test.js
git commit -m "feat(ess): add RTDB mark/unmark/purge operations"
```

---

### Task 5: Run the sweep from the ESS tab

**Files:**
- Modify: `src/views/EssView.jsx` (imports line 1–5; `statusFor` line 7–12; add a sweep `useEffect` after the existing one ending line 38; `statusLabel` line 55–59; the table body around line 85–98)

**Interfaces:**
- Consumes: `planRetention`, `daysUntilPurge` from `src/utils/essRetention.js`; `markForPurge`, `clearPurgeMark`, `purgeEssFiles` from `src/utils/essFiles.js`.
- Produces: no exports. Terminal task.

**Ruling (human partner, pre-flight):** an earlier draft of this plan declared a component harness out of scope. That was overruled — the reviewer governs, and this task ships with component tests. Steps 1–2 below are the failing-test half of the cycle; do not skip them.

**On the effect re-running:** `data` is `mergedData` from `App.jsx`, which gets a fresh object identity on many renders, and writing a mark changes `filesBySo` through the `onValue` subscription. The sweep will therefore run repeatedly. That is safe because every transition is idempotent and self-terminating: after a mark, the project is seen as already marked and within grace, so nothing happens; after an unmark, it no longer qualifies; after a purge, the entry is gone. Each pass over a settled state is a pure computation across a small metadata object with zero writes. Do not add memoisation to "fix" this — the convergence is the point, and a stale memo would be the actual bug.

- [ ] **Step 1: Write the failing component test**

Create `src/views/__tests__/EssView.test.jsx`. The repo has no global vitest
environment config, so the `// @vitest-environment jsdom` pragma on line 1 is
required — without it the render throws `document is not defined`. This mirrors
`src/views/__tests__/MaterialsView.test.jsx`, which uses the real
`LanguageProvider` rather than mocking it.

```jsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const markForPurge = vi.fn();
const clearPurgeMark = vi.fn();
const purgeEssFiles = vi.fn();
vi.mock('../../utils/essFiles', () => ({
  markForPurge: (...a) => markForPurge(...a),
  clearPurgeMark: (...a) => clearPurgeMark(...a),
  purgeEssFiles: (...a) => purgeEssFiles(...a),
}));

// onValue fires its callback synchronously with whichever snapshot the test
// set up, dispatching on the node path EssView subscribed to.
let indexSnapshot = {};
let autoDataSnapshot = {};
vi.mock('../../utils/firebase', () => ({
  db: {},
  ref: (_db, path) => ({ path }),
  onValue: (refArg, cb) => {
    cb({ val: () => (refArg.path === 'ess_file_index' ? indexSnapshot : autoDataSnapshot) });
    return () => {};
  },
}));

// The detail screen drags in the whole pdfjs stack; this suite is about the list.
vi.mock('../EssProjectDetail', () => ({ default: () => null }));

import { LanguageProvider } from '../../utils/LanguageContext';
import EssView from '../EssView';

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const withFile = (extra = {}) => ({
  contract: { name: 'c.pdf', uploadedAt: ago(90 * DAY) },
  ...extra,
});

const renderView = (projects) =>
  render(
    <LanguageProvider>
      <EssView data={{ priorityAnalysis: projects }} />
    </LanguageProvider>,
  );

beforeEach(() => {
  markForPurge.mockReset();
  clearPurgeMark.mockReset();
  purgeEssFiles.mockReset();
  indexSnapshot = {};
  autoDataSnapshot = {};
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('EssView retention sweep', () => {
  it('marks a project that reached nesting', async () => {
    indexSnapshot = { 100: withFile() };
    renderView([{ so: '100', name: 'P', status: 'NESTING' }]);
    await waitFor(() => expect(markForPurge).toHaveBeenCalledWith('100', expect.any(String)));
    expect(purgeEssFiles).not.toHaveBeenCalled();
  });

  it('purges a marked project once the grace window elapsed', async () => {
    indexSnapshot = { 100: withFile({ purgeMarkedAt: ago(8 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'NESTING' }]);
    await waitFor(() => expect(purgeEssFiles).toHaveBeenCalledWith('100'));
  });

  it('clears the mark instead of purging when the project fell back', async () => {
    // The sheet-flicker guard, end to end.
    indexSnapshot = { 100: withFile({ purgeMarkedAt: ago(8 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'PAPERWORK' }]);
    await waitFor(() => expect(clearPurgeMark).toHaveBeenCalledWith('100'));
    expect(purgeEssFiles).not.toHaveBeenCalled();
  });

  it('shows the countdown on a marked row', async () => {
    indexSnapshot = { 100: withFile({ purgeMarkedAt: ago(3 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'NESTING' }]);
    await waitFor(() => expect(screen.getByText('Deletes in 4 days')).toBeTruthy());
  });

  it('leaves a project absent from the sheet alone and reports it', async () => {
    indexSnapshot = { 999: withFile({ purgeMarkedAt: ago(8 * DAY) }) };
    renderView([{ so: '100', name: 'P', status: 'ENGINEERING' }]);
    await waitFor(() => expect(screen.getByText(/absent from the sheet/)).toBeTruthy());
    expect(purgeEssFiles).not.toHaveBeenCalled();
    expect(markForPurge).not.toHaveBeenCalled();
  });

  it('does not sweep before both sides of the data have landed', async () => {
    indexSnapshot = {};
    renderView([]);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(markForPurge).not.toHaveBeenCalled();
    expect(clearPurgeMark).not.toHaveBeenCalled();
    expect(purgeEssFiles).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/EssView.test.jsx`
Expected: FAIL — no sweep exists yet, so `markForPurge` is never called and
`Deletes in 4 days` is not in the document.

- [ ] **Step 3: Add the imports**

In `src/views/EssView.jsx`, after line 5 (`import EssProjectDetail from './EssProjectDetail';`) add:

```js
import { planRetention, daysUntilPurge } from '../utils/essRetention';
import { markForPurge, clearPurgeMark, purgeEssFiles } from '../utils/essFiles';
```

- [ ] **Step 4: Teach `statusFor` about the mark**

Replace the `statusFor` function (lines 7–12) with:

```js
function statusFor(so, filesBySo, autoDataBySo) {
  const files = filesBySo?.[so];
  const hasFiles = Boolean(files && (files.contract || files.quote || files.drawings));
  // The countdown outranks 'generated': it is the only state that is about to
  // change on its own, so it is the one worth surfacing.
  if (hasFiles && files.purgeMarkedAt) return 'purging';
  if (autoDataBySo?.[so]) return 'generated';
  if (hasFiles) return 'uploaded';
  return 'none';
}
```

- [ ] **Step 5: Add sweep state**

After line 19 (`const [autoDataBySo, setAutoDataBySo] = useState({});`) add:

```js
const [sweepSummary, setSweepSummary] = useState(null);
```

- [ ] **Step 6: Add the sweep effect**

After the closing of the existing subscription `useEffect` (line 38, `}, []);`) add:

```js
  // Retention sweep. Runs only here, because only a super admin can open this
  // tab — which is also the only role the RTDB rules let delete these nodes.
  useEffect(() => {
    const projects = data?.priorityAnalysis || [];
    // An empty side means a subscription hasn't landed yet. Acting on that
    // would read as "every project is an orphan" or "there is nothing to do".
    if (projects.length === 0 || Object.keys(filesBySo).length === 0) return;

    let cancelled = false;
    (async () => {
      const { toMark, toUnmark, toPurge, orphans } = planRetention({
        projects,
        fileIndex: filesBySo,
        now: Date.now(),
      });

      const markedAt = new Date().toISOString();
      const purged = [];

      // Each project is independent: one failure must not abort the sweep or
      // leave another half-deleted.
      for (const so of toMark) {
        try { await markForPurge(so, markedAt); }
        catch (error) { console.error(`Failed to mark ${so} for purge:`, error); }
      }
      for (const so of toUnmark) {
        try { await clearPurgeMark(so); }
        catch (error) { console.error(`Failed to clear purge mark on ${so}:`, error); }
      }
      for (const so of toPurge) {
        try { await purgeEssFiles(so); purged.push(so); }
        catch (error) { console.error(`Failed to purge ESS files for ${so}:`, error); }
      }

      if (!cancelled && (purged.length > 0 || orphans.length > 0)) {
        setSweepSummary({ purged, orphans });
      }
    })();
    return () => { cancelled = true; };
  }, [data, filesBySo]);
```

- [ ] **Step 7: Add the countdown label**

Replace `statusLabel` (lines 55–59) with:

```js
  const statusLabel = (status, so) => {
    if (status === 'purging') {
      const days = daysUntilPurge(filesBySo[so], Date.now());
      if (days === 0) return language === 'es' ? 'Se borra en breve' : 'Deleting shortly';
      return language === 'es' ? `Se borra en ${days} días` : `Deletes in ${days} days`;
    }
    if (status === 'generated') return language === 'es' ? 'ESS generada' : 'ESS generated';
    if (status === 'uploaded') return language === 'es' ? 'PDFs cargados' : 'PDFs uploaded';
    return language === 'es' ? 'Sin PDFs' : 'No PDFs';
  };
```

- [ ] **Step 8: Pass the SO to the label**

In the table body, change the status cell from `{statusLabel(status)}` to `{statusLabel(status, project.so)}`.

- [ ] **Step 9: Render the sweep summary**

Immediately before the closing `</div>` of the component's returned JSX (after the `</table>`), add:

```jsx
      {sweepSummary && (
        <div className="glass-card" style={{ padding: '12px', marginTop: '16px' }}>
          {sweepSummary.purged.length > 0 && (
            <p>
              {language === 'es'
                ? `Se liberaron los PDFs de ${sweepSummary.purged.length} proyecto(s) ya en nesteo: ${sweepSummary.purged.join(', ')}`
                : `Freed the source PDFs of ${sweepSummary.purged.length} project(s) already in nesting: ${sweepSummary.purged.join(', ')}`}
            </p>
          )}
          {sweepSummary.orphans.length > 0 && (
            <p>
              {language === 'es'
                ? `Estos SO tienen PDFs pero no figuran en el sheet, así que no se tocaron: ${sweepSummary.orphans.join(', ')}`
                : `These SOs have PDFs but are absent from the sheet, so they were left alone: ${sweepSummary.orphans.join(', ')}`}
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 10: Verify the suite and the build**

Run: `npm test`
Expected: PASS, no regressions.

Run: `npm run build`
Expected: build succeeds.

Run: `npm run lint 2>&1 | grep -iE "essRetention|essFiles|EssView"`
Expected: no output (the repo has a large pre-existing lint baseline; only the touched files must be clean).

- [ ] **Step 11: Commit**

```bash
git add src/views/EssView.jsx
git commit -m "feat(ess): run the retention sweep from the ESS tab"
```

---

## Manual verification

Automated tests cover the policy but never exercise real RTDB. After Task 5, verify by hand:

1. Open the ESS tab as super admin. Upload the three PDFs to a project whose sheet status is `PAPERWORK`. Confirm it reads `PDFs cargados` and that no mark appears in `ess_file_index/{SO}` in the Firebase Console.
2. In the Console, temporarily set that project's mark by hand: `ess_file_index/{SO}/purgeMarkedAt` = an ISO timestamp 8 days old. Reload the tab. Because the project is at `PAPERWORK`, the mark must be **removed**, not honoured — this is the sheet-flicker guard.
3. Move the project to `NESTING` on the sheet. Reload. Confirm the row reads `Se borra en 7 días` and the mark exists.
4. Hand-edit the mark to 8 days old. Reload. Confirm `ess_files/{SO}` and `ess_file_index/{SO}` are gone, `essAutoData/{SO}` survives, and the summary lists the SO.
