# Native App→Sheets Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the n8n webhook workflow with a Vercel serverless function (`/api/sync`) that writes app events to the `copy testing` tab of the Google Sheet via a service account, matched by SO#.

**Architecture:** The React app calls `sendXEvent()` helpers in a new `src/utils/sheetSync.js`, which POST a typed payload to same-origin `/api/sync`. The endpoint authenticates with a Google service account (`googleapis`), finds the row by SO#, and writes only the relevant column(s). The status→text mapping lives entirely in the client; the endpoint just writes what it receives.

**Tech Stack:** Node (Vercel serverless functions, `export default async function handler(req,res)`), `googleapis`, React + Vite, Vitest.

## Global Constraints

- Env vars `GOOGLE_SERVICE_ACCOUNT_KEY` and `SYNC_SHEET_ID` are **server-only** — NO `VITE_` prefix (must never enter the client bundle).
- `SYNC_SHEET_ID` value: `1rzZn9J2p6Plz7Xxy9-JwgdijFkqGg7WC2rFpNnxUreY`. Tab name: `copy testing`. Header row 1, data from row 2.
- Column map (0-indexed letter): B=SO# (match key, never rewritten), I=ENG, J=START DATE, K=Check Date 1, L=Check Date 2, M=COMPLETION DATE, N=STATUS, O=`OBS / ACCESSORIES / NOTES`. C/D/E/F/G/H never written.
- Valid STATUS dropdown values (col N): `Review`, `Engineering`, `Check`, `Paperwork`, `Nesting`, `ON HOLD`, `✓`.
- Stage→STATUS mapping (client-side): ingeniería→`Engineering`; check_eng/check1→`Check`; check_eng2/check2→`Check`; paperwork→`Paperwork`; nesting→`Nesting`.
- All Sheets writes use per-cell ranges (e.g. `copy testing!J5`), never whole-row writes, so one event never blanks another column.
- Client is fire-and-forget: failures log via `console.debug/warn`, never throw to the UI.
- Existing serverless pattern (copy it): `api/chat.js`, `api/translate.js` — method guard, `process.env` secret check, `req.body` destructure, try/catch with `console.error` + 502/500.

---

### Task 1: Column-mapping pure function (`api/lib/syncMapping.js`)

Extract the eventType→cells decision as a pure, unit-testable function with no I/O. This is the brain of the endpoint.

**Files:**
- Create: `api/lib/syncMapping.js`
- Test: `api/lib/syncMapping.test.js`

**Interfaces:**
- Produces: `mapEventToCells(body) -> { writes: Array<{ col: string, value: string }>, needsObsRead: boolean }` where `col` is a column letter (`'I'`, `'J'`, …) and `value` is the string to write. `needsObsRead: true` only for OBS notes (endpoint must read col O first). Returns `{ writes: [], needsObsRead: false }` for skipped events.

- [ ] **Step 1: Write the failing test**

```js
// api/lib/syncMapping.test.js
import { describe, it, expect } from 'vitest';
import { mapEventToCells } from './syncMapping.js';

describe('mapEventToCells', () => {
  it('ENGINEER_ASSIGNED writes ENG (col I)', () => {
    const r = mapEventToCells({ eventType: 'ENGINEER_ASSIGNED', so: '11088', engineer: 'Delfina' });
    expect(r).toEqual({ writes: [{ col: 'I', value: 'Delfina' }], needsObsRead: false });
  });

  it('ON_HOLD writes STATUS (col N)', () => {
    const r = mapEventToCells({ eventType: 'ON_HOLD', so: '11088', sheetStatus: 'ON HOLD' });
    expect(r).toEqual({ writes: [{ col: 'N', value: 'ON HOLD' }], needsObsRead: false });
  });

  it('STAGE_UPDATE with startDate writes START DATE (J) and STATUS (N)', () => {
    const r = mapEventToCells({ eventType: 'STAGE_UPDATE', so: '1', startDate: '07/09/2026', checkDate1: '', checkDate2: '', completionDate: '', sheetStatus: 'Engineering' });
    expect(r.writes).toEqual([{ col: 'J', value: '07/09/2026' }, { col: 'N', value: 'Engineering' }]);
  });

  it('STAGE_UPDATE with checkDate1 writes only Check Date 1 (K) and STATUS, not J/L/M', () => {
    const r = mapEventToCells({ eventType: 'STAGE_UPDATE', so: '1', startDate: '', checkDate1: '07/10/2026', checkDate2: '', completionDate: '', sheetStatus: 'Check' });
    expect(r.writes).toEqual([{ col: 'K', value: '07/10/2026' }, { col: 'N', value: 'Check' }]);
  });

  it('STAGE_UPDATE with empty sheetStatus does not write N', () => {
    const r = mapEventToCells({ eventType: 'STAGE_UPDATE', so: '1', startDate: '', checkDate1: '', checkDate2: '', completionDate: '', sheetStatus: '' });
    expect(r.writes).toEqual([]);
  });

  it('NOTE_ADDED obs flags needsObsRead and carries noteText', () => {
    const r = mapEventToCells({ eventType: 'NOTE_ADDED', so: '1', noteType: 'obs', noteText: 'Falta material' });
    expect(r.needsObsRead).toBe(true);
    expect(r.writes).toEqual([{ col: 'O', value: 'Falta material' }]);
  });

  it('NOTE_ADDED non-obs is skipped', () => {
    const r = mapEventToCells({ eventType: 'NOTE_ADDED', so: '1', noteType: 'normal', noteText: 'x' });
    expect(r).toEqual({ writes: [], needsObsRead: false });
  });

  it('unknown event is skipped', () => {
    expect(mapEventToCells({ eventType: 'RELEASE_HOLD', so: '1' })).toEqual({ writes: [], needsObsRead: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/lib/syncMapping.test.js`
Expected: FAIL — "Failed to resolve import './syncMapping.js'" / `mapEventToCells is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// api/lib/syncMapping.js
// Pure decision function: event payload -> which columns to write.
// The endpoint handles the actual Sheets I/O. STATUS text is decided by the
// client (sheetSync.js) and passed in `sheetStatus`; this function never remaps it.

const push = (writes, col, value) => {
  if (value !== undefined && value !== null && value !== '') writes.push({ col, value: String(value) });
};

export function mapEventToCells(body = {}) {
  const b = body || {};
  const writes = [];

  switch (b.eventType) {
    case 'ENGINEER_ASSIGNED':
      push(writes, 'I', b.engineer);
      return { writes, needsObsRead: false };

    case 'ON_HOLD':
      push(writes, 'N', b.sheetStatus);
      return { writes, needsObsRead: false };

    case 'STAGE_UPDATE':
      push(writes, 'J', b.startDate);
      push(writes, 'K', b.checkDate1);
      push(writes, 'L', b.checkDate2);
      push(writes, 'M', b.completionDate);
      push(writes, 'N', b.sheetStatus);
      return { writes, needsObsRead: false };

    case 'NOTE_ADDED':
      if (b.noteType === 'obs' && b.noteText) {
        return { writes: [{ col: 'O', value: String(b.noteText) }], needsObsRead: true };
      }
      return { writes: [], needsObsRead: false };

    default:
      return { writes: [], needsObsRead: false };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/lib/syncMapping.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add api/lib/syncMapping.js api/lib/syncMapping.test.js
git commit -m "feat: pure eventType->columns mapping for sheet sync"
```

---

### Task 2: The `/api/sync` serverless endpoint

Wire `mapEventToCells` to real Google Sheets I/O: auth, find row by SO#, read col O when needed, batch-write cells.

**Files:**
- Create: `api/sync.js`
- Modify: `package.json` (add `googleapis` dependency)

**Interfaces:**
- Consumes: `mapEventToCells` from `./lib/syncMapping.js`.
- Produces: HTTP endpoint `POST /api/sync`. Request body: `{ eventType, so, ...fields }`. Responses: `200 { ok, so, eventType }` on write; `200 { skipped, reason }` when nothing to write or SO not found; `400` missing so; `500` missing/invalid creds; `502` Sheets API error.

- [ ] **Step 1: Add `googleapis` dependency**

Run: `npm install googleapis`
Expected: `package.json` gains `"googleapis"` under dependencies; `package-lock.json` updated.

- [ ] **Step 2: Write the endpoint**

```js
// api/sync.js
// Vercel serverless function — writes app events into the 'copy testing' tab
// of the project Sheet, matched by SO#. Replaces the former n8n webhook.
// Secrets (GOOGLE_SERVICE_ACCOUNT_KEY, SYNC_SHEET_ID) stay server-side.
import { google } from 'googleapis';
import { mapEventToCells } from './lib/syncMapping.js';

const TAB = 'copy testing';

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  let creds;
  try { creds = JSON.parse(raw); } catch { return null; }
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const spreadsheetId = process.env.SYNC_SHEET_ID;
  const auth = getAuth();
  if (!spreadsheetId || !auth) {
    res.status(500).json({ error: 'Sheets sync not configured (SYNC_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_KEY)' });
    return;
  }

  const body = req.body || {};
  const so = body.so != null ? String(body.so).trim() : '';
  if (!so) { res.status(400).json({ error: 'Missing "so"' }); return; }

  const { writes, needsObsRead } = mapEventToCells(body);
  if (writes.length === 0) { res.status(200).json({ skipped: 'no mapped columns', eventType: body.eventType }); return; }

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Find the row number by SO# (column B), data starts at row 2.
    const colB = await sheets.spreadsheets.values.get({
      spreadsheetId, range: `${TAB}!B2:B`,
    });
    const rows = colB.data.values || [];
    let rowNumber = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] != null && String(rows[i][0]).trim() === so) { rowNumber = i + 2; break; }
    }
    if (rowNumber === -1) { res.status(200).json({ skipped: 'SO not found', so }); return; }

    // 2. OBS append: read current col O, prepend it with ' - '.
    let finalWrites = writes;
    if (needsObsRead) {
      const cur = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!O${rowNumber}` });
      const prev = (cur.data.values && cur.data.values[0] && cur.data.values[0][0]) ? String(cur.data.values[0][0]) : '';
      const note = writes[0].value;
      finalWrites = [{ col: 'O', value: prev ? `${prev} - ${note}` : note }];
    }

    // 3. Batch-write each cell to its exact range.
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: finalWrites.map(w => ({ range: `${TAB}!${w.col}${rowNumber}`, values: [[w.value]] })),
      },
    });

    res.status(200).json({ ok: true, so, eventType: body.eventType });
  } catch (err) {
    console.error('Sheet sync error:', err?.message || err);
    res.status(502).json({ error: 'Sheets write failed' });
  }
}
```

- [ ] **Step 3: Verify the endpoint imports and parses (smoke test)**

Run: `node -e "import('./api/sync.js').then(()=>console.log('import OK')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `import OK` (module loads; googleapis resolves). If it errors on ESM, that's fine to note — Vercel runs these as ESM; the import check confirms syntax.

- [ ] **Step 4: Commit**

```bash
git add api/sync.js package.json package-lock.json
git commit -m "feat: /api/sync serverless endpoint writing to copy testing by SO#"
```

---

### Task 3: Client `src/utils/sheetSync.js` (replaces n8nService.js)

New client module with the same 9 helper signatures, POSTing to `/api/sync`. Extends `sendStageEvent` to send `sheetStatus` on `started` too (stage→STATUS map).

**Files:**
- Create: `src/utils/sheetSync.js`
- Test: `src/utils/__tests__/sheetSync.test.js`

**Interfaces:**
- Produces (same signatures as old n8nService): `sendOnHoldEvent(project, reason, changedBy)`, `sendReleaseHoldEvent(project, changedBy)`, `sendStageEvent(so, stageName, action, engineer)`, `sendQAChecklistEvent(so, stageId, qaType, checkedBy)`, `sendNoteEvent(so, noteText, createdBy, project?, noteType?)`, `sendEngineerAssignEvent(so, engineerName, project?)`, `sendCalendarNoteEvent(noteData, isEdit?)`, `sendInstallDateChangeEvent(so, oldDate, newDate, project?)`, `testSync()`. Also exports pure `stageToStatus(stageName, action) -> string` for testing.

- [ ] **Step 1: Write the failing test**

```js
// src/utils/__tests__/sheetSync.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stageToStatus, sendStageEvent, sendEngineerAssignEvent } from '../sheetSync.js';

describe('stageToStatus', () => {
  it('ingeniería started -> Engineering', () => expect(stageToStatus('ingenieria', 'started')).toBe('Engineering'));
  it('check_eng started -> Check', () => expect(stageToStatus('check_eng', 'started')).toBe('Check'));
  it('check_eng2 started -> Check', () => expect(stageToStatus('check_eng2', 'started')).toBe('Check'));
  it('paperwork finished -> Paperwork', () => expect(stageToStatus('paperwork', 'finished')).toBe('Paperwork'));
  it('nesting -> Nesting', () => expect(stageToStatus('nesting', 'started')).toBe('Nesting'));
});

describe('sheetSync POST', () => {
  beforeEach(() => { global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('sendEngineerAssignEvent POSTs to /api/sync with ENGINEER_ASSIGNED', async () => {
    await sendEngineerAssignEvent('11088', 'Delfina', { name: 'x' });
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/sync');
    const payload = JSON.parse(opts.body);
    expect(payload.eventType).toBe('ENGINEER_ASSIGNED');
    expect(payload.so).toBe('11088');
    expect(payload.engineer).toBe('Delfina');
  });

  it('sendStageEvent sends sheetStatus on started (check_eng -> Check)', async () => {
    await sendStageEvent('11088', 'check_eng', 'started', 'Luis');
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.eventType).toBe('STAGE_UPDATE');
    expect(payload.sheetStatus).toBe('Check');
    expect(payload.checkDate1).not.toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/sheetSync.test.js`
Expected: FAIL — cannot resolve `../sheetSync.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/utils/sheetSync.js
// Sends app change-events to the native /api/sync serverless endpoint,
// which writes them into the 'copy testing' Google Sheet tab (match by SO#).
// Fire-and-forget: never throws to the UI; logs and moves on.

const ENDPOINT = '/api/sync';

// Exact dropdown values in the Sheet's STATUS column.
const APP_STATUS_TO_SHEET = {
  'REVIEW': 'Review', 'ENGINEERING': 'Engineering', 'CHECK ENG.': 'Check', 'CHECK ENG': 'Check',
  'PAPERWORK': 'Paperwork', 'CHECK': 'Check', 'NESTING': 'Nesting', 'STAND BY': 'StandBy',
  'STANDBY': 'StandBy', 'ON HOLD': 'ON HOLD', 'COMPLETED': '✓', 'CANCELLED': '✓',
};

function toSheetStatus(appStatus) {
  if (!appStatus) return '';
  const key = String(appStatus).toUpperCase().trim();
  return APP_STATUS_TO_SHEET[key] || appStatus;
}

// Stage + action -> exact STATUS text for column N. Client is the source of truth.
export function stageToStatus(stageName, action) {
  const s = String(stageName || '').toLowerCase();
  if (s === 'ingenieria' || s === 'engineering') return 'Engineering';
  if (s === 'check_eng' || s === 'check1' || s === 'check_eng2' || s === 'check2') return 'Check';
  if (s === 'paperwork') return 'Paperwork';
  if (s === 'nesting') return 'Nesting';
  return '';
}

async function post(eventType, payload) {
  const body = { eventType, timestamp: new Date().toISOString(), source: 'jlclosets-dashboard', ...payload };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) console.debug(`[sync] ✅ ${eventType} (SO ${payload.so || 'N/A'})`);
    else console.warn(`[sync] ⚠️ ${eventType} HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[sync] ⚠️ ${eventType} network error:`, err.message);
  }
}

export function sendOnHoldEvent(project, reason, changedBy) {
  return post('ON_HOLD', {
    so: project.so, projectName: project.name || '', engineer: project.eng || '',
    installDate: project.install || '', onHoldReason: reason, changedBy, sheetStatus: 'ON HOLD',
  });
}

export function sendReleaseHoldEvent(project, changedBy) {
  return post('RELEASE_HOLD', { so: project.so, projectName: project.name || '', engineer: project.eng || '', changedBy, sheetStatus: '' });
}

export function sendStageEvent(so, stageName, action, engineer) {
  const sheetStatus = stageToStatus(stageName, action);
  let startDate = '', checkDate1 = '', checkDate2 = '', completionDate = '';
  const today = new Date().toLocaleDateString('en-US'); // MM/DD/YYYY
  if (action === 'started') {
    if (stageName === 'ingenieria') startDate = today;
    if (stageName === 'check_eng' || stageName === 'check1') checkDate1 = today;
    if (stageName === 'check_eng2' || stageName === 'check2') checkDate2 = today;
  } else if (action === 'finished') {
    if (stageName === 'paperwork') completionDate = today;
  }
  return post('STAGE_UPDATE', { so, stage: stageName, action, engineer, sheetStatus, startDate, checkDate1, checkDate2, completionDate });
}

export function sendQAChecklistEvent(so, stageId, qaType, checkedBy) {
  return post('QA_CHECKLIST', { so, stage: stageId, checklistType: qaType, checkedBy, sheetStatus: '' });
}

export function sendNoteEvent(so, noteText, createdBy, project = {}, noteType = 'normal') {
  return post('NOTE_ADDED', {
    so, projectName: project.name || '', engineer: project.eng || '',
    noteText: (noteText || '').slice(0, 500), createdBy, noteType, sheetStatus: '',
  });
}

export function sendEngineerAssignEvent(so, engineerName, project = {}) {
  return post('ENGINEER_ASSIGNED', { so, projectName: project.name || '', engineer: engineerName, sheetStatus: '' });
}

export function sendCalendarNoteEvent(noteData, isEdit = false) {
  return post(isEdit ? 'CALENDAR_NOTE_UPDATED' : 'CALENDAR_NOTE_ADDED', {
    so: noteData.so || '', noteText: (noteData.text || '').slice(0, 500),
    noteDate: noteData.date || '', createdBy: noteData.authorName || '', sheetStatus: '',
  });
}

export function sendInstallDateChangeEvent(so, oldDate, newDate, project = {}) {
  return post('INSTALL_DATE_CHANGED', { so, projectName: project.name || '', engineer: project.eng || '', oldDate, newDate, sheetStatus: '' });
}

export async function testSync() {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'WEBHOOK_TEST', so: 'TEST-001', source: 'jlclosets-dashboard' }),
    });
    return { success: res.ok, status: res.status };
  } catch (err) { return { success: false, error: err.message }; }
}

export { toSheetStatus };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/sheetSync.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/sheetSync.js src/utils/__tests__/sheetSync.test.js
git commit -m "feat: sheetSync.js client posting to /api/sync (replaces n8nService)"
```

---

### Task 4: Repoint the 3 views to sheetSync, delete n8nService

Update the imports in the 3 views. Signatures are identical, so only import lines change. Then delete the obsolete `n8nService.js`.

**Files:**
- Modify: `src/views/CalendarView.jsx:14`
- Modify: `src/views/MyProjectsView.jsx:4`
- Modify: `src/views/PipelineView.jsx:8`
- Delete: `src/utils/n8nService.js`

**Interfaces:**
- Consumes: `sheetSync.js` exports from Task 3 (same names as old n8nService).

- [ ] **Step 1: Update CalendarView import**

In `src/views/CalendarView.jsx`, change line 14 from:
```js
import { sendCalendarNoteEvent } from '../utils/n8nService';
```
to:
```js
import { sendCalendarNoteEvent } from '../utils/sheetSync';
```

- [ ] **Step 2: Update MyProjectsView import**

In `src/views/MyProjectsView.jsx`, change line 4 from:
```js
import { sendOnHoldEvent, sendReleaseHoldEvent, sendQAChecklistEvent, sendNoteEvent } from '../utils/n8nService';
```
to:
```js
import { sendOnHoldEvent, sendReleaseHoldEvent, sendQAChecklistEvent, sendNoteEvent } from '../utils/sheetSync';
```

- [ ] **Step 3: Update PipelineView import**

In `src/views/PipelineView.jsx`, change line 8 from:
```js
import { sendStageEvent, sendNoteEvent, sendEngineerAssignEvent } from '../utils/n8nService';
```
to:
```js
import { sendStageEvent, sendNoteEvent, sendEngineerAssignEvent } from '../utils/sheetSync';
```

- [ ] **Step 4: Confirm no remaining references to n8nService**

Run: `grep -rn "n8nService" src/`
Expected: no output (zero matches).

- [ ] **Step 5: Delete the obsolete module**

Run: `git rm src/utils/n8nService.js`
Expected: file staged for deletion.

- [ ] **Step 6: Run full test suite + build**

Run: `npx vitest run && npm run build`
Expected: all tests pass; Vite build succeeds with no unresolved-import errors.

- [ ] **Step 7: Commit**

```bash
git add src/views/CalendarView.jsx src/views/MyProjectsView.jsx src/views/PipelineView.jsx
git commit -m "refactor: point views at sheetSync, remove n8nService"
```

---

### Task 5: START DATE trigger for review→engineering

The spec requires START DATE (col J) to be set "when a project leaves review to mark engineering in My Projects." Verify whether the app already fires `sendStageEvent(so, 'ingenieria', 'started', ...)` at that transition; if not, add it.

**Files:**
- Modify: wherever My Projects changes a project's status to engineering (to be located — search below).

**Interfaces:**
- Consumes: `sendStageEvent` from `sheetSync.js`.

- [ ] **Step 1: Locate the review→engineering status change**

Run: `grep -rn "engineering\|Engineering\|status" src/views/MyProjectsView.jsx | grep -i "set\|change\|update\|toggle"`
Also check the pipeline stage-toggle handlers already call sendStageEvent (they do for check/nesting). Identify the exact handler that moves a project INTO engineering / marks the engineering checkbox.

- [ ] **Step 2: Decision point (no code if already wired)**

If a handler already calls `sendStageEvent(so, 'ingenieria', 'started', user)` (or equivalent that sets `startDate`), this task is complete — note it and skip to commit. If NOT, add the call inside that handler, after the existing status persistence, following the pattern in PipelineView (`handleNestingStart` at PipelineView.jsx:229):

```js
// after persisting the engineering status change:
sendStageEvent(so, 'ingenieria', 'started', userName);
```

Ensure `sendStageEvent` is imported in that file (add to the existing sheetSync import if missing).

- [ ] **Step 3: Verify tests + build still pass**

Run: `npx vitest run && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: fire STAGE_UPDATE(ingenieria) so START DATE syncs on review->engineering"
```

---

### Task 6: Env cleanup + docs

Remove the dead `VITE_N8N_WEBHOOK_URL` reference and document the new env vars and manual setup.

**Files:**
- Modify: `.env.local` (add new vars; remove `VITE_N8N_WEBHOOK_URL` if present)
- Modify or create: `N8N_SETUP.md` → note it is superseded; or add a short `SHEETS_SYNC_SETUP.md`.

- [ ] **Step 1: Confirm no code references the old env var**

Run: `grep -rn "VITE_N8N_WEBHOOK_URL" src/ api/`
Expected: no output (Task 4 removed the only consumer with n8nService).

- [ ] **Step 2: Add new env vars to `.env.local`**

Append to `.env.local` (values filled by the user — leave placeholders they replace):
```
SYNC_SHEET_ID=1rzZn9J2p6Plz7Xxy9-JwgdijFkqGg7WC2rFpNnxUreY
GOOGLE_SERVICE_ACCOUNT_KEY=
```

- [ ] **Step 3: Write setup doc**

Create `SHEETS_SYNC_SETUP.md`:
```markdown
# Google Sheets Sync — Setup

The app syncs change-events to the `copy testing` tab via `/api/sync`.

## One-time setup
1. Google Cloud Console → create a **Service Account** → create a JSON key, download it.
2. Enable the **Google Sheets API** for that project.
3. Open the Sheet `APP JL Project Status for app` → Share → add the service account email
   (looks like `name@project.iam.gserviceaccount.com`) with **Editor** access.
4. Set env vars (local `.env.local` + Vercel → Settings → Environment Variables):
   - `SYNC_SHEET_ID` = `1rzZn9J2p6Plz7Xxy9-JwgdijFkqGg7WC2rFpNnxUreY`
   - `GOOGLE_SERVICE_ACCOUNT_KEY` = the full JSON of the service account (one line).
5. Redeploy on Vercel.

## Notes
- These are server-only (no `VITE_` prefix) — never exposed to the browser.
- The old n8n workflow (`N8N_SETUP.md`, `n8n-workflow-app-to-sheet.json`) is obsolete.
```

- [ ] **Step 4: Commit**

```bash
git add .env.local SHEETS_SYNC_SETUP.md
git commit -m "docs: env vars + service-account setup for sheets sync"
```

---

### Task 7: End-to-end verification against the live Sheet

After the user completes the manual service-account setup, verify the full flow with `vercel dev` against `copy testing` using test SO# 11088.

**Files:** none (verification only).

- [ ] **Step 1: Run the app locally with functions**

Run: `npm run dev:vercel` (i.e. `vercel dev`)
Expected: local server up with `/api/sync` available.

- [ ] **Step 2: Fire each event via curl and check the Sheet**

```bash
BASE=http://localhost:3000   # adjust to vercel dev port
# ON_HOLD -> STATUS
curl -s -X POST $BASE/api/sync -H 'Content-Type: application/json' -d '{"eventType":"ON_HOLD","so":"11088","sheetStatus":"ON HOLD"}'
# ENGINEER_ASSIGNED -> ENG (must not blank STATUS)
curl -s -X POST $BASE/api/sync -H 'Content-Type: application/json' -d '{"eventType":"ENGINEER_ASSIGNED","so":"11088","engineer":"Delfina"}'
# STAGE check1 -> Check Date 1 + STATUS Check (must not blank START DATE)
curl -s -X POST $BASE/api/sync -H 'Content-Type: application/json' -d '{"eventType":"STAGE_UPDATE","so":"11088","startDate":"","checkDate1":"07/10/2026","checkDate2":"","completionDate":"","sheetStatus":"Check"}'
# OBS append (run twice; second must concatenate with ' - ')
curl -s -X POST $BASE/api/sync -H 'Content-Type: application/json' -d '{"eventType":"NOTE_ADDED","so":"11088","noteType":"obs","noteText":"Nota 1"}'
curl -s -X POST $BASE/api/sync -H 'Content-Type: application/json' -d '{"eventType":"NOTE_ADDED","so":"11088","noteType":"obs","noteText":"Nota 2"}'
```
Expected each: `{"ok":true,...}`. In the Sheet row for SO 11088: ENG=Delfina, Check Date 1=07/10/2026, STATUS=Check, OBS=`Nota 1 - Nota 2`, and NAME/INSTALL untouched, and no date column blanked another.

- [ ] **Step 3: Confirm skip paths**

```bash
curl -s -X POST $BASE/api/sync -H 'Content-Type: application/json' -d '{"eventType":"RELEASE_HOLD","so":"11088"}'   # -> {"skipped":...}
curl -s -X POST $BASE/api/sync -H 'Content-Type: application/json' -d '{"eventType":"ON_HOLD","so":"NOPE"}'         # -> {"skipped":"SO not found"} or no-column skip
```
Expected: 200 with `skipped`, no write.

- [ ] **Step 4: Final commit / merge readiness**

No code change. Confirm branch `feat/app-to-sheets-native` is green (`npx vitest run && npm run build`) and ready to open a PR.

---

## Self-Review

**Spec coverage:** endpoint (T2) ✓, client with same signatures (T3) ✓, status decided client-side (T3 `stageToStatus`) ✓, per-column writes / no blanking (T1 mapping + T2 per-cell ranges) ✓, OBS append (T2 read+concat) ✓, match by SO# (T2) ✓, 3 view imports (T4) ✓, env vars + setup (T6) ✓, googleapis dep (T2) ✓, STAGE writes date+status together (T1) ✓, START DATE trigger gap (T5) ✓, E2E verify (T7) ✓. No spec requirement left unmapped.

**Placeholder scan:** every code step has full code; no TBD/TODO. T5 has a conditional (add-only-if-missing) but shows the exact code and how to locate the site — acceptable since it depends on a real codebase fact to be discovered.

**Type consistency:** `mapEventToCells` return shape `{writes:[{col,value}],needsObsRead}` used identically in T1 and T2. `stageToStatus(stageName, action)` defined and tested in T3, used in `sendStageEvent`. Endpoint response shapes consistent across T2/T7. Column letters match the Global Constraints map.
