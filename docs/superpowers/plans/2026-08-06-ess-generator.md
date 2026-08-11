# ESS Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the super admin upload a project's Contract/Quote/Drawings PDFs and auto-generate a pre-filled draft of the ESS (Engineering Shop Sheet), reusing the existing manual ESS form's data shape and print layout instead of building a parallel one.

**Architecture:** 100% client-side (no new backend). `pdfjs-dist` extracts text + x/y position from each PDF in the browser; rule-based parsers (regex + position heuristics, no AI) turn that into structured data; a matcher combines it into `pages[]` in the exact shape `PDFGeneratorModal`/`essData` already use, so the existing `usePagedModal` hook and `PDFPrintLayout` component work unchanged. Everything new is gated to `role === 'engineer-admin'` and lives in RTDB nodes separate from `essData` so the existing manual ESS flow is untouched.

**Tech Stack:** React 19, Firebase Realtime Database, `pdfjs-dist` (new), `jspdf` (existing, used only in tests), Vitest.

## Global Constraints

- No AI/LLM API anywhere in this feature — extraction is 100% regex/position-rule based.
- New feature is visible and writable only by `role === 'engineer-admin'` (`isSuperAdminRole` from `src/utils/adminConfig.js`).
- Nothing in this plan modifies `essData.js` or the `essData/{so}` RTDB node — those back the existing manual ESS flow's data layer and must keep working exactly as they do today. `PDFGeneratorModal.jsx` may be refactored (Task 13) to extract shared UI into `EssFormFields.jsx`, but the refactor must be behavior-preserving — "Completar ESS" in My Projects must look and work identically before and after.
- PDFs are stored as Base64 strings directly in RTDB (no Firebase Storage bucket — see spec's "Storage" section for why), capped at 8MB per file.
- Color map and cutting formulas are hardcoded in `essRules.js`, not editable from the UI.
- Follows the design in `docs/superpowers/specs/2026-08-06-ess-generator-design.md`.

---

### Task 1: PDF text+position extraction (`essPdfExtract.js`)

**Files:**
- Create: `src/utils/essPdfExtract.js`
- Test: `src/utils/__tests__/essPdfExtract.test.js`
- Modify: `package.json` (add `pdfjs-dist` dependency)

**Interfaces:**
- Produces: `extractPdfPages(arrayBuffer: ArrayBuffer): Promise<Array<{ pageNumber: number, items: Array<{ text: string, x: number, y: number }> }>>`, `pagesToPlainText(pages): string`. Both consumed by Task 12 (`EssProjectDetail.jsx`) and by the parser tests in Tasks 5-7.

- [ ] **Step 1: Install the dependency**

Run: `npm install pdfjs-dist`

- [ ] **Step 2: Write the failing test**

Create `src/utils/__tests__/essPdfExtract.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { extractPdfPages, pagesToPlainText } from '../essPdfExtract';

function makeTestPdfArrayBuffer(text) {
  const doc = new jsPDF();
  doc.text(text, 10, 20);
  return doc.output('arraybuffer');
}

describe('extractPdfPages', () => {
  it('extracts each text item with its x/y position', async () => {
    const arrayBuffer = makeTestPdfArrayBuffer('DEPOSIT: 50%');
    const pages = await extractPdfPages(arrayBuffer);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].items.length).toBeGreaterThan(0);
    const combined = pages[0].items.map(i => i.text).join('');
    expect(combined).toContain('DEPOSIT');
    expect(typeof pages[0].items[0].x).toBe('number');
    expect(typeof pages[0].items[0].y).toBe('number');
  });

  it('extracts one entry per page for a multi-page PDF', async () => {
    const doc = new jsPDF();
    doc.text('PAGE ONE', 10, 20);
    doc.addPage();
    doc.text('PAGE TWO', 10, 20);
    const pages = await extractPdfPages(doc.output('arraybuffer'));
    expect(pages).toHaveLength(2);
    expect(pagesToPlainText([pages[0]])).toContain('PAGE ONE');
    expect(pagesToPlainText([pages[1]])).toContain('PAGE TWO');
  });
});

describe('pagesToPlainText', () => {
  it('joins every item across every page into one string', async () => {
    const arrayBuffer = makeTestPdfArrayBuffer('HELLO WORLD');
    const pages = await extractPdfPages(arrayBuffer);
    expect(pagesToPlainText(pages)).toContain('HELLO');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essPdfExtract.test.js`
Expected: FAIL — `essPdfExtract.js` does not exist yet.

- [ ] **Step 4: Implement**

Create `src/utils/essPdfExtract.js`:

```js
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Runs entirely client-side (no server round-trip) so we get each text
// item's x/y position, not just plain text — parseDrawings.js needs that
// position to tell an opening width apart from a drawer width or a height
// callout on the same drawing page. The legacy build works without
// configuring a web worker, unlike the standard pdfjs-dist build.
export async function extractPdfPages(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
    }));
    pages.push({ pageNumber, items });
  }
  return pages;
}

export function pagesToPlainText(pages) {
  return pages.map(page => page.items.map(item => item.text).join(' ')).join('\n');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essPdfExtract.test.js`
Expected: PASS (3 tests). A `Warning: UnknownErrorException: Ensure that the standardFontDataUrl API parameter is provided` message on stderr is expected and harmless — pdfjs still extracts the text correctly, it just can't resolve glyph metrics it doesn't need for text extraction.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/utils/essPdfExtract.js src/utils/__tests__/essPdfExtract.test.js
git commit -m "feat(ess): add client-side PDF text+position extraction"
```

---

### Task 2: PDF file storage helpers (`essFiles.js`)

**Files:**
- Create: `src/utils/essFiles.js`
- Test: `src/utils/__tests__/essFiles.test.js`

**Interfaces:**
- Consumes: `db, ref, set, get, isConfigured` from `src/utils/firebase.js` (existing exports, confirmed in [firebase.js](../../../src/utils/firebase.js)).
- Produces: `MAX_ESS_PDF_BYTES`, `validateFileSize(file): { valid: boolean, reason?: string }`, `fileToBase64(file): Promise<string>`, `base64ToArrayBuffer(base64): ArrayBuffer`, `saveEssFile(so, docType, file): Promise<void>` (throws `Error('FILE_TOO_LARGE')` if oversized), `loadEssFile(so, docType): Promise<{ name, data, mimeType, uploadedAt } | null>`. Consumed by Task 12 (`EssProjectDetail.jsx`).

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/essFiles.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { fileToBase64, base64ToArrayBuffer, validateFileSize, MAX_ESS_PDF_BYTES } from '../essFiles';

describe('fileToBase64 / base64ToArrayBuffer', () => {
  it('round-trips arbitrary bytes without loss', async () => {
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 65, 66, 67]);
    const file = new File([original], 'test.pdf', { type: 'application/pdf' });
    const base64 = await fileToBase64(file);
    const roundTripped = new Uint8Array(base64ToArrayBuffer(base64));
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });
});

describe('validateFileSize', () => {
  it('accepts a file under the limit', () => {
    const file = new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' });
    expect(validateFileSize(file)).toEqual({ valid: true });
  });

  it('rejects a file over the limit', () => {
    const oversized = { size: MAX_ESS_PDF_BYTES + 1 };
    expect(validateFileSize(oversized)).toEqual({ valid: false, reason: 'FILE_TOO_LARGE' });
  });
});

describe('MAX_ESS_PDF_BYTES', () => {
  it('is 8MB', () => {
    expect(MAX_ESS_PDF_BYTES).toBe(8 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essFiles.test.js`
Expected: FAIL — `essFiles.js` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/utils/essFiles.js`:

```js
import { db, ref, set, get, isConfigured } from './firebase';

// PDFs in this flow are text-based Contracts/Quotes/Drawings, not scans, so
// they shouldn't come close to this. It exists to fail loudly instead of
// writing a huge Base64 string into RTDB.
export const MAX_ESS_PDF_BYTES = 8 * 1024 * 1024;

export function validateFileSize(file) {
  if (file.size > MAX_ESS_PDF_BYTES) {
    return { valid: false, reason: 'FILE_TOO_LARGE' };
  }
  return { valid: true };
}

export async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// No Firebase Storage bucket in this repo — see the design doc's "Storage"
// section for why. Files live as Base64 strings in RTDB, same pattern as
// note attachments in src/services/imageService.js.
export async function saveEssFile(so, docType, file) {
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    throw new Error(sizeCheck.reason);
  }
  const data = await fileToBase64(file);
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await set(ref(db, `ess_files/${so}/${docType}`), {
    name: file.name,
    mimeType: file.type,
    data,
    uploadedAt: new Date().toISOString(),
  });
}

export async function loadEssFile(so, docType) {
  if (!isConfigured || !db) return null;
  const snapshot = await get(ref(db, `ess_files/${so}/${docType}`));
  return snapshot.exists() ? snapshot.val() : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essFiles.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/essFiles.js src/utils/__tests__/essFiles.test.js
git commit -m "feat(ess): add Base64 PDF storage helpers"
```

---

### Task 3: RTDB rules for the new nodes

**Files:**
- Modify: `database.rules.json`

**Interfaces:**
- Produces: three new gated RTDB nodes — `ess_files/{so}/{docType}`, `essAutoData/{so}`, `ess_corrections/{so}` — all readable/writable only by `role === 'engineer-admin' && status === 'approved'`. Consumed by Tasks 2, 9.

- [ ] **Step 1: Add the rules**

In `database.rules.json`, insert this block right before the closing `"$other"` block (after the existing `"archive_lock"` block, matching the exact expression style already used by `project_kanban_state` for `engineer-admin`-gated nodes):

```json
    "ess_files": {
      "$so": {
        ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'engineer-admin' && root.child('users').child(auth.uid).child('status').val() === 'approved'",
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'engineer-admin' && root.child('users').child(auth.uid).child('status').val() === 'approved'"
      }
    },
    "essAutoData": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'engineer-admin' && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'engineer-admin' && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },
    "ess_corrections": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'engineer-admin' && root.child('users').child(auth.uid).child('status').val() === 'approved'",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'engineer-admin' && root.child('users').child(auth.uid).child('status').val() === 'approved'"
    },

```

- [ ] **Step 2: Verify the file is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('valid JSON')"`
Expected: `valid JSON`

- [ ] **Step 3: Commit**

```bash
git add database.rules.json
git commit -m "feat(ess): gate new RTDB nodes to super admin"
```

> Note for whoever deploys: these rules only take effect once published (`npm run deploy:rules` or the Firebase Console), same as any other change to this file — this task only edits the source file.

---

### Task 4: Color map and cutting formulas (`essRules.js`)

**Files:**
- Create: `src/utils/essRules.js`
- Test: `src/utils/__tests__/essRules.test.js`

**Interfaces:**
- Produces: `COLOR_MAP`, `BORING_PATTERN_MM`, `translateColor(commercialName): string | null`, `calcPrfvWidth(openingInches): number`, `calcDovetailWidth(openingInches): number`, `calcHangRodLength(vanoInches): number`, `calcBackingDepth(depthInches): number`. Consumed by Task 8 (`essMatcher.js`).

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/essRules.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { translateColor, calcPrfvWidth, calcDovetailWidth, calcHangRodLength, calcBackingDepth, BORING_PATTERN_MM } from '../essRules';

describe('translateColor', () => {
  it('translates a known commercial color to its shop code', () => {
    expect(translateColor('Snow White')).toBe('White Classic 300');
  });

  it('is case-insensitive', () => {
    expect(translateColor('snow white')).toBe('White Classic 300');
  });

  it('returns null for an unknown color instead of guessing', () => {
    expect(translateColor('Mystery Color')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(translateColor('')).toBeNull();
    expect(translateColor(null)).toBeNull();
  });
});

describe('cutting formulas', () => {
  it('PRFV = opening - 1"', () => {
    expect(calcPrfvWidth(24)).toBe(23);
  });

  it('Dovetail = opening - 3/8"', () => {
    expect(calcDovetailWidth(24)).toBe(23.625);
  });

  it('hang rod length = vano - 1/4"', () => {
    expect(calcHangRodLength(30)).toBe(29.75);
  });

  it('backing depth = depth - 3/4"', () => {
    expect(calcBackingDepth(14)).toBe(13.25);
  });
});

describe('BORING_PATTERN_MM', () => {
  it('is fixed at 32mm', () => {
    expect(BORING_PATTERN_MM).toBe(32);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essRules.test.js`
Expected: FAIL — `essRules.js` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/utils/essRules.js`:

```js
// Commercial color name -> internal shop melamine/HPL code. Extend this as
// new colors show up in Quotes — see the design doc's "Corrección de
// errores" section for how a missing color gets reported and added.
export const COLOR_MAP = {
  'SNOW WHITE': 'White Classic 300',
  'BLEACHED LINEN': 'Linen Classic 210',
};

export const BORING_PATTERN_MM = 32;

export function translateColor(commercialName) {
  if (!commercialName) return null;
  const key = commercialName.trim().toUpperCase();
  return COLOR_MAP[key] || null;
}

// All cutting formulas round to the nearest 1/8" — this shop's normal
// cutting tolerance — and take/return inches as decimal numbers.
function roundToEighth(value) {
  return Math.round(value * 8) / 8;
}

export function calcPrfvWidth(openingInches) {
  return roundToEighth(openingInches - 1);
}

export function calcDovetailWidth(openingInches) {
  return roundToEighth(openingInches - 0.375);
}

export function calcHangRodLength(vanoInches) {
  return roundToEighth(vanoInches - 0.25);
}

export function calcBackingDepth(depthInches) {
  return roundToEighth(depthInches - 0.75);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essRules.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/essRules.js src/utils/__tests__/essRules.test.js
git commit -m "feat(ess): add color map and cutting formula rules"
```

---

### Task 5: Contract parser (`parseContract.js`)

**Files:**
- Create: `src/utils/essParsers/parseContract.js`
- Test: `src/utils/essParsers/__tests__/parseContract.test.js`

**Interfaces:**
- Produces: `parseContractText(text: string): { depositPercent: number|null, tearoutIncluded: boolean|null, baseboardsIncluded: boolean|null, warnings: string[] }`, `looksLikeContract(text): boolean`. Consumed by Task 8 (`essMatcher.js`) and Task 12 (`EssProjectDetail.jsx`).

- [ ] **Step 1: Write the failing test**

Create `src/utils/essParsers/__tests__/parseContract.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseContractText, looksLikeContract } from '../parseContract';

const sampleContract = `
SALES CONTRACT
Client: Ashley Frankel
DEPOSIT: 50% due at signing.
TEAROUT: Included - old closet system removed by JL Closets.
BASEBOARDS: Not Included - customer responsible.
CANCELLATION POLICY: full refund within 3 business days.
`;

describe('parseContractText', () => {
  it('extracts the deposit percent', () => {
    expect(parseContractText(sampleContract).depositPercent).toBe(50);
  });

  it('extracts tearout as included', () => {
    expect(parseContractText(sampleContract).tearoutIncluded).toBe(true);
  });

  it('extracts baseboards as not included', () => {
    expect(parseContractText(sampleContract).baseboardsIncluded).toBe(false);
  });

  it('returns EMPTY_TEXT for blank input instead of guessing', () => {
    const result = parseContractText('');
    expect(result.warnings).toContain('EMPTY_TEXT');
    expect(result.depositPercent).toBeNull();
  });

  it('warns instead of throwing when a field is missing', () => {
    const result = parseContractText('SALES CONTRACT\nNo relevant fields here.');
    expect(result.warnings).toContain('DEPOSIT_NOT_FOUND');
    expect(result.warnings).toContain('TEAROUT_NOT_FOUND');
    expect(result.warnings).toContain('BASEBOARDS_NOT_FOUND');
    expect(result.depositPercent).toBeNull();
    expect(result.tearoutIncluded).toBeNull();
  });
});

describe('looksLikeContract', () => {
  it('is true when DEPOSIT/CANCELLATION language appears', () => {
    expect(looksLikeContract(sampleContract)).toBe(true);
  });

  it('is false for unrelated text', () => {
    expect(looksLikeContract('Valet Rod - VR-100 - Qty: 2')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/essParsers/__tests__/parseContract.test.js`
Expected: FAIL — `parseContract.js` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/utils/essParsers/parseContract.js`:

```js
// First-pass heuristics based on the field descriptions given for this
// project's Contracts. Expect to recalibrate these regexes against real
// Contract PDFs — see the design doc's "Corrección de errores" section.
const DEPOSIT_RE = /DEPOSIT[:\s]+(\d{1,3})\s*%/i;
const TEAROUT_RE = /TEAROUT[^\n]{0,40}?(INCLUDED|YES|NOT INCLUDED|NO)/i;
const BASEBOARDS_RE = /BASEBOARDS?[^\n]{0,40}?(INCLUDED|YES|NOT INCLUDED|NO)/i;

function toBoolean(matchWord) {
  if (!matchWord) return null;
  return /^(INCLUDED|YES)$/i.test(matchWord);
}

export function parseContractText(text) {
  if (!text || text.trim().length === 0) {
    return { depositPercent: null, tearoutIncluded: null, baseboardsIncluded: null, warnings: ['EMPTY_TEXT'] };
  }

  const warnings = [];
  const depositMatch = text.match(DEPOSIT_RE);
  const tearoutMatch = text.match(TEAROUT_RE);
  const baseboardsMatch = text.match(BASEBOARDS_RE);

  if (!depositMatch) warnings.push('DEPOSIT_NOT_FOUND');
  if (!tearoutMatch) warnings.push('TEAROUT_NOT_FOUND');
  if (!baseboardsMatch) warnings.push('BASEBOARDS_NOT_FOUND');

  return {
    depositPercent: depositMatch ? parseInt(depositMatch[1], 10) : null,
    tearoutIncluded: toBoolean(tearoutMatch?.[1]),
    baseboardsIncluded: toBoolean(baseboardsMatch?.[1]),
    warnings,
  };
}

// Light, non-blocking sanity check so the UI can warn "this doesn't look
// like a Contract" if it's uploaded into the wrong slot.
export function looksLikeContract(text) {
  return /DEPOSIT/i.test(text) || /CANCELLATION/i.test(text);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/essParsers/__tests__/parseContract.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/essParsers/parseContract.js src/utils/essParsers/__tests__/parseContract.test.js
git commit -m "feat(ess): add Contract PDF text parser"
```

---

### Task 6: Quote parser (`parseQuote.js`)

**Files:**
- Create: `src/utils/essParsers/parseQuote.js`
- Test: `src/utils/essParsers/__tests__/parseQuote.test.js`

**Interfaces:**
- Produces: `parseQuoteText(text): { areas: Array<{ name: string, items: Array<{ description: string, productCode: string, qty: number }> }>, warnings: string[] }`, `looksLikeQuote(text): boolean`. Consumed by Task 8 and Task 12.

- [ ] **Step 1: Write the failing test**

Create `src/utils/essParsers/__tests__/parseQuote.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseQuoteText, looksLikeQuote } from '../parseQuote';

const sampleQuote = `
JL CLOSETS QUOTE #4521
MASTER WIC
Valet Rod - VR-100 - Qty: 2
Shoe Fence - SF-220 - Qty: 1

GUEST CLOSET
Piano Hinge - PH-050 - Qty: 4
`;

describe('parseQuoteText', () => {
  it('groups items under the area header they follow', () => {
    const result = parseQuoteText(sampleQuote);
    expect(result.areas).toHaveLength(2);
    expect(result.areas[0].name).toBe('MASTER WIC');
    expect(result.areas[0].items).toEqual([
      { description: 'Valet Rod', productCode: 'VR-100', qty: 2 },
      { description: 'Shoe Fence', productCode: 'SF-220', qty: 1 },
    ]);
  });

  it('starts a new area at the next header line', () => {
    const result = parseQuoteText(sampleQuote);
    expect(result.areas[1].name).toBe('GUEST CLOSET');
    expect(result.areas[1].items).toEqual([
      { description: 'Piano Hinge', productCode: 'PH-050', qty: 4 },
    ]);
  });

  it('returns EMPTY_TEXT for blank input', () => {
    expect(parseQuoteText('').warnings).toContain('EMPTY_TEXT');
  });

  it('flags an item line with no preceding area header', () => {
    const result = parseQuoteText('Valet Rod - VR-100 - Qty: 2');
    expect(result.areas).toHaveLength(0);
    expect(result.warnings.some(w => w.startsWith('ITEM_WITHOUT_AREA'))).toBe(true);
  });

  it('flags text with no areas found at all', () => {
    const result = parseQuoteText('just some unrelated text');
    expect(result.warnings).toContain('NO_AREAS_FOUND');
  });
});

describe('looksLikeQuote', () => {
  it('is true for quote-shaped text', () => {
    expect(looksLikeQuote(sampleQuote)).toBe(true);
  });

  it('is false for unrelated text', () => {
    expect(looksLikeQuote('this contract requires a DEPOSIT of 50%')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/essParsers/__tests__/parseQuote.test.js`
Expected: FAIL — `parseQuote.js` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/utils/essParsers/parseQuote.js`:

```js
// First-pass heuristics: an area header is a line that's entirely
// uppercase letters/spaces/'/&/- (e.g. "MASTER WIC"); an item line is
// "{description} - {productCode} - Qty: {n}". Expect to recalibrate
// against real Quote PDFs — see the design doc's "Corrección de errores".
const AREA_HEADER_RE = /^[A-Z][A-Z '&-]{2,40}$/;
const ITEM_LINE_RE = /^(.+?)\s*-\s*([A-Z]{1,6}-\d{1,6})\s*-\s*Qty:\s*(\d+)\s*$/i;

export function parseQuoteText(text) {
  if (!text || text.trim().length === 0) {
    return { areas: [], warnings: ['EMPTY_TEXT'] };
  }

  const warnings = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const areas = [];
  let currentArea = null;

  for (const line of lines) {
    const itemMatch = line.match(ITEM_LINE_RE);
    if (itemMatch) {
      if (!currentArea) {
        warnings.push(`ITEM_WITHOUT_AREA: ${line}`);
        continue;
      }
      currentArea.items.push({
        description: itemMatch[1].trim(),
        productCode: itemMatch[2].toUpperCase(),
        qty: parseInt(itemMatch[3], 10),
      });
      continue;
    }
    if (AREA_HEADER_RE.test(line)) {
      currentArea = { name: line, items: [] };
      areas.push(currentArea);
    }
  }

  if (areas.length === 0) warnings.push('NO_AREAS_FOUND');
  return { areas, warnings };
}

export function looksLikeQuote(text) {
  return /Qty:/i.test(text) && /[A-Z]{1,6}-\d{1,6}/i.test(text);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/essParsers/__tests__/parseQuote.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/essParsers/parseQuote.js src/utils/essParsers/__tests__/parseQuote.test.js
git commit -m "feat(ess): add Quote PDF text parser"
```

---

### Task 7: Drawings parser (`parseDrawings.js`)

**Files:**
- Create: `src/utils/essParsers/parseDrawings.js`
- Test: `src/utils/essParsers/__tests__/parseDrawings.test.js`

**Interfaces:**
- Consumes: the `pages` shape produced by `extractPdfPages` (Task 1): `Array<{ pageNumber, items: Array<{ text, x, y }> }>`.
- Produces: `parseDrawingPages(pages): { areas: Array<{ name: string, openings: Array<{ width: number|null, height: number|null, depth: number|null }>, unclassified: string[] }>, warnings: string[] }`, `looksLikeDrawing(pages): boolean`. Consumed by Task 8 and Task 12.

- [ ] **Step 1: Write the failing test**

Create `src/utils/essParsers/__tests__/parseDrawings.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseDrawingPages, looksLikeDrawing } from '../parseDrawings';

describe('parseDrawingPages', () => {
  it('associates an opening width and height to the nearest OPENING/HEIGHT labels', () => {
    const items = [
      { text: 'MASTER WIC', x: 50, y: 700 },
      { text: 'OPENING', x: 100, y: 500 },
      { text: '24', x: 130, y: 498 },
      { text: 'HEIGHT', x: 100, y: 470 },
      { text: '30', x: 130, y: 468 },
    ];
    const result = parseDrawingPages([{ pageNumber: 1, items }]);
    expect(result.areas).toHaveLength(1);
    expect(result.areas[0].name).toBe('MASTER WIC');
    expect(result.areas[0].openings).toHaveLength(1);
    expect(result.areas[0].openings[0].width).toBe(24);
    expect(result.areas[0].openings[0].height).toBe(30);
    expect(result.areas[0].openings[0].depth).toBeNull();
    expect(result.areas[0].unclassified).toEqual([]);
  });

  it('flags numbers with no nearby label as unclassified', () => {
    const items = [
      { text: 'GUEST CLOSET', x: 50, y: 700 },
      { text: '999', x: 400, y: 100 },
    ];
    const result = parseDrawingPages([{ pageNumber: 1, items }]);
    expect(result.areas[0].unclassified).toContain('999');
    expect(result.warnings.some(w => w.startsWith('UNCLASSIFIED_NUMBERS'))).toBe(true);
  });

  it('falls back to "Page N" when no area name is found', () => {
    const items = [
      { text: 'OPENING', x: 0, y: 0 },
      { text: '20', x: 5, y: 2 },
    ];
    const result = parseDrawingPages([{ pageNumber: 3, items }]);
    expect(result.areas[0].name).toBe('Page 3');
  });

  it('flags pages with no text at all', () => {
    const result = parseDrawingPages([{ pageNumber: 1, items: [] }]);
    expect(result.warnings).toContain('EMPTY_TEXT');
  });

  it('flags when no openings were found on any page', () => {
    const result = parseDrawingPages([{ pageNumber: 1, items: [{ text: 'MASTER WIC', x: 0, y: 0 }] }]);
    expect(result.warnings).toContain('NO_OPENINGS_FOUND');
  });
});

describe('looksLikeDrawing', () => {
  it('is true when a dimension label is present on any page', () => {
    const pages = [{ pageNumber: 1, items: [{ text: 'OPENING', x: 0, y: 0 }] }];
    expect(looksLikeDrawing(pages)).toBe(true);
  });

  it('is false when no dimension labels are present', () => {
    const pages = [{ pageNumber: 1, items: [{ text: 'DEPOSIT: 50%', x: 0, y: 0 }] }];
    expect(looksLikeDrawing(pages)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/essParsers/__tests__/parseDrawings.test.js`
Expected: FAIL — `parseDrawings.js` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/utils/essParsers/parseDrawings.js`:

```js
// This is the least certain parser in the pipeline: it has to tell an
// opening width apart from a drawer width or a height callout using only
// their position relative to a label on the drawing page. This first pass
// assumes a label word (OPENING/HEIGHT/DEPTH) sits near the number it
// describes, within MAX_LABEL_DISTANCE points. Expect to recalibrate
// against real Drawings PDFs — see the design doc's "Corrección de
// errores" section. Numbers with no nearby label are surfaced as
// `unclassified` instead of guessed, so the UI can flag them for review.
const NUMBER_RE = /^(\d+(?:\.\d+)?)"?$/;
const AREA_NAME_RE = /^[A-Z][A-Z ]{2,40}$/;
const LABEL_KEYWORDS = [
  { type: 'opening', re: /OPENING/i },
  { type: 'height', re: /HEIGHT/i },
  { type: 'depth', re: /DEPTH/i },
];
const MAX_LABEL_DISTANCE = 60;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isLabelKeyword(text) {
  return LABEL_KEYWORDS.some(k => k.re.test(text));
}

function classifyLabels(items) {
  return items
    .map(item => {
      const match = LABEL_KEYWORDS.find(k => k.re.test(item.text));
      return match ? { ...item, labelType: match.type } : null;
    })
    .filter(Boolean);
}

function findAreaName(items) {
  const candidates = items
    .filter(item => AREA_NAME_RE.test(item.text.trim()) && !isLabelKeyword(item.text))
    .sort((a, b) => b.y - a.y);
  return candidates.length > 0 ? candidates[0].text.trim() : null;
}

function nearestUnclaimed(numbers, claimed, target) {
  return numbers
    .filter(n => !claimed.has(n))
    .map(n => ({ n, d: distance(n, target) }))
    .filter(x => x.d <= MAX_LABEL_DISTANCE)
    .sort((a, b) => a.d - b.d)[0];
}

export function parseDrawingPages(pages) {
  if (!pages || pages.length === 0 || pages.every(p => p.items.length === 0)) {
    return { areas: [], warnings: ['EMPTY_TEXT'] };
  }

  const warnings = [];
  const areas = pages.map(page => {
    const areaName = findAreaName(page.items) || `Page ${page.pageNumber}`;
    const labels = classifyLabels(page.items);
    const numbers = page.items.filter(item => NUMBER_RE.test(item.text.trim()));
    const claimed = new Set();

    const openings = labels
      .filter(l => l.labelType === 'opening')
      .map(openingLabel => {
        const opening = { width: null, height: null, depth: null };
        ['opening', 'height', 'depth'].forEach(type => {
          const labelForType = type === 'opening'
            ? openingLabel
            : labels.find(l => l.labelType === type && distance(l, openingLabel) <= MAX_LABEL_DISTANCE);
          if (!labelForType) return;
          const nearest = nearestUnclaimed(numbers, claimed, labelForType);
          if (!nearest) return;
          claimed.add(nearest.n);
          const value = parseFloat(nearest.n.text);
          if (type === 'opening') opening.width = value;
          if (type === 'height') opening.height = value;
          if (type === 'depth') opening.depth = value;
        });
        return opening;
      });

    const unclassified = numbers.filter(n => !claimed.has(n)).map(n => n.text);
    if (unclassified.length > 0) {
      warnings.push(`UNCLASSIFIED_NUMBERS_${areaName}: ${unclassified.join(', ')}`);
    }

    return { name: areaName, openings, unclassified };
  });

  if (areas.every(a => a.openings.length === 0)) warnings.push('NO_OPENINGS_FOUND');
  return { areas, warnings };
}

// Light, non-blocking sanity check so the UI can warn "this doesn't look
// like a Drawings file" if it's uploaded into the wrong slot.
export function looksLikeDrawing(pages) {
  return pages.some(page => classifyLabels(page.items).length > 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/essParsers/__tests__/parseDrawings.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/essParsers/parseDrawings.js src/utils/essParsers/__tests__/parseDrawings.test.js
git commit -m "feat(ess): add Drawings PDF position-based parser"
```

---

### Task 8: Matcher — build `pages[]` in the existing ESS shape (`essMatcher.js`)

**Files:**
- Create: `src/utils/essMatcher.js`
- Test: `src/utils/__tests__/essMatcher.test.js`

**Interfaces:**
- Consumes: `translateColor, calcPrfvWidth, calcDovetailWidth` from `essRules.js` (Task 4); the `{ areas, warnings }` shapes from `parseContractText`/`parseQuoteText`/`parseDrawingPages` (Tasks 5-7).
- Produces: `buildEssPages({ project, contract, quote, drawings, boxType? }): { pages: Array<PdfGeneratorPage>, unmatchedQuoteItems: Array, unmatchedDrawingOpenings: Array, warnings: string[] }`, where `PdfGeneratorPage` is exactly the shape `createDefaultPage` returns in [PDFGeneratorModal.jsx:22-40](../../../src/components/PDFGeneratorModal.jsx#L22-L40): `{ headerData: { jobName, color, rooms, designer, engineer }, drawerOptions: { fronts, box, slides, handles }, drawers: [{ front, qty, open, box, room, handles }], rods: [{ room, type, qty, size }], miscCol1, miscCol2 }`. Consumed by Task 12 (`EssProjectDetail.jsx`).

- [ ] **Step 1: Write the failing test**

Create `src/utils/__tests__/essMatcher.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildEssPages } from '../essMatcher';

const project = { so: '12485', name: 'Ashley Frankel', designer: 'Russell', eng: 'JS', color: 'Snow White' };

describe('buildEssPages', () => {
  it('builds one page per quote area, matched to its drawing area by name', () => {
    const contract = { tearoutIncluded: true, baseboardsIncluded: false, warnings: [] };
    const quote = {
      areas: [{ name: 'MASTER WIC', items: [{ description: 'Valet Rod', productCode: 'VR-100', qty: 2 }] }],
      warnings: [],
    };
    const drawings = {
      areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: 30, depth: null }], unclassified: [] }],
      warnings: [],
    };

    const result = buildEssPages({ project, contract, quote, drawings });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].headerData.rooms).toBe('MASTER WIC');
    expect(result.pages[0].headerData.color).toBe('White Classic 300');
    expect(result.pages[0].headerData.designer).toBe('Russell');
    expect(result.pages[0].drawers[0].open).toBe('24"');
    expect(result.pages[0].drawers[0].box).toBe('23" W');
    expect(result.pages[0].rods[0].type).toBe('Valet Rod');
    expect(result.pages[0].miscCol1).toContain('Tearout included');
    expect(result.pages[0].miscCol2).toContain('NOT included');
    expect(result.unmatchedQuoteItems).toHaveLength(0);
    expect(result.unmatchedDrawingOpenings).toHaveLength(0);
  });

  it('flags a quote area with no matching drawing area', () => {
    const quote = { areas: [{ name: 'GUEST CLOSET', items: [{ description: 'Shoe Fence', productCode: 'SF-1', qty: 1 }] }], warnings: [] };
    const drawings = { areas: [], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.unmatchedQuoteItems).toEqual([{ area: 'GUEST CLOSET', description: 'Shoe Fence', productCode: 'SF-1', qty: 1 }]);
  });

  it('flags a drawing area with no matching quote area', () => {
    const quote = { areas: [], warnings: [] };
    const drawings = { areas: [{ name: 'PANTRY', openings: [{ width: 12, height: 20, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings });
    expect(result.unmatchedDrawingOpenings).toEqual([{ area: 'PANTRY', openings: [{ width: 12, height: 20, depth: null }] }]);
  });

  it('falls back to a single blank page when there are no quote areas at all', () => {
    const result = buildEssPages({ project, contract: {}, quote: { areas: [], warnings: [] }, drawings: { areas: [], warnings: [] } });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].drawers).toEqual([]);
    expect(result.pages[0].rods).toEqual([]);
  });

  it('uses the Dovetail formula when boxType is DOVETAIL', () => {
    const quote = { areas: [{ name: 'MASTER WIC', items: [] }], warnings: [] };
    const drawings = { areas: [{ name: 'MASTER WIC', openings: [{ width: 24, height: null, depth: null }], unclassified: [] }], warnings: [] };
    const result = buildEssPages({ project, contract: {}, quote, drawings, boxType: 'DOVETAIL' });
    expect(result.pages[0].drawers[0].box).toBe('23.625" W');
    expect(result.pages[0].drawerOptions.box).toBe('DOVETAIL');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essMatcher.test.js`
Expected: FAIL — `essMatcher.js` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/utils/essMatcher.js`:

```js
import { translateColor, calcPrfvWidth, calcDovetailWidth } from './essRules';

function normalizeAreaName(name) {
  return (name || '').trim().toUpperCase();
}

function blankPage(project) {
  return {
    headerData: {
      jobName: project ? `${project.so} - ${project.name || ''}`.trim() : '',
      color: '',
      rooms: '',
      designer: project?.designer || '',
      engineer: project?.eng || '',
    },
    drawerOptions: { fronts: 'SLAB', box: 'PRFV', slides: 'SOFT CLOSE', handles: 'STD. CHROME' },
    drawers: [],
    rods: [],
    miscCol1: '',
    miscCol2: '',
  };
}

// Combines the three parsed documents into pages[] in the exact shape
// PDFGeneratorModal/essData already use (see createDefaultPage in
// src/components/PDFGeneratorModal.jsx), so the generated draft can be
// edited and printed with the existing usePagedModal + PDFPrintLayout
// infrastructure unchanged.
export function buildEssPages({ project, contract, quote, drawings, boxType = 'PRFV' }) {
  const warnings = [...(contract?.warnings || []), ...(quote?.warnings || []), ...(drawings?.warnings || [])];
  const quoteAreas = quote?.areas || [];
  const drawingAreas = drawings?.areas || [];
  const unmatchedQuoteItems = [];
  const unmatchedDrawingOpenings = [];

  const pages = quoteAreas.map(quoteArea => {
    const drawingArea = drawingAreas.find(d => normalizeAreaName(d.name) === normalizeAreaName(quoteArea.name));

    if (!drawingArea) {
      quoteArea.items.forEach(item => unmatchedQuoteItems.push({ area: quoteArea.name, ...item }));
    }

    const openings = drawingArea ? drawingArea.openings : [];
    const drawers = openings
      .filter(o => o.width != null)
      .map(o => ({
        front: '',
        qty: 1,
        open: `${o.width}"`,
        box: `${boxType === 'DOVETAIL' ? calcDovetailWidth(o.width) : calcPrfvWidth(o.width)}" W`,
        room: quoteArea.name,
        handles: '',
      }));

    const rods = quoteArea.items
      .filter(item => /rod/i.test(item.description))
      .map(item => ({ room: quoteArea.name, type: item.description, qty: item.qty, size: '' }));

    return {
      headerData: {
        jobName: project ? `${project.so} - ${project.name || ''}`.trim() : '',
        color: translateColor(project?.color) || project?.color || '',
        rooms: quoteArea.name,
        designer: project?.designer || '',
        engineer: project?.eng || '',
      },
      drawerOptions: { fronts: 'SLAB', box: boxType, slides: 'SOFT CLOSE', handles: 'STD. CHROME' },
      drawers,
      rods,
      miscCol1: contract?.tearoutIncluded ? `${quoteArea.name}\n• Tearout included` : '',
      miscCol2: contract?.baseboardsIncluded === false ? 'Baseboards NOT included — customer responsible' : '',
    };
  });

  drawingAreas.forEach(d => {
    if (!quoteAreas.find(q => normalizeAreaName(q.name) === normalizeAreaName(d.name))) {
      unmatchedDrawingOpenings.push({ area: d.name, openings: d.openings });
    }
  });

  return {
    pages: pages.length > 0 ? pages : [blankPage(project)],
    unmatchedQuoteItems,
    unmatchedDrawingOpenings,
    warnings,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essMatcher.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/essMatcher.js src/utils/__tests__/essMatcher.test.js
git commit -m "feat(ess): build ESS pages by matching Quote items to Drawing openings"
```

---

### Task 9: Auto-generated ESS data persistence (`essAutoData.js`)

**Files:**
- Create: `src/utils/essAutoData.js`

**Interfaces:**
- Consumes: `db, ref, set, get, push, isConfigured` from `src/utils/firebase.js`.
- Produces: `saveEssAutoData(so, pages): Promise<void>`, `loadEssAutoData(so): Promise<Array|null>`, `hasEssAutoData(so): Promise<boolean>`, `saveEssCorrection(so, note): Promise<void>`. Consumed by Task 12 (`EssProjectDetail.jsx`) and Task 14 (`EssAutoGeneratorModal.jsx`).

No automated test for this task — it's a thin RTDB read/write wrapper with no branching logic to unit test, matching the existing precedent (`essData.js`/`ipData.js` in this repo have no tests either). Task 12's manual verification step exercises it end-to-end against a real (or emulated) Firebase project.

- [ ] **Step 1: Implement**

Create `src/utils/essAutoData.js`:

```js
import { db, ref, set, get, push, isConfigured } from './firebase';

const CACHE_PREFIX = 'ess_auto_data_';

// Deliberately separate from essData.js/`essData/{so}` — this is the
// auto-generated draft, gated to super admin only, and must never be
// confused with (or overwrite) the existing manually-completed ESS.
export const saveEssAutoData = async (so, pages) => {
  localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(pages));
  if (isConfigured && db) {
    try {
      await set(ref(db, `essAutoData/${so}`), pages);
    } catch (error) {
      console.error('Failed to save auto-generated ESS data to Firebase:', error);
    }
  }
};

export const loadEssAutoData = async (so) => {
  if (isConfigured && db) {
    try {
      const snapshot = await get(ref(db, `essAutoData/${so}`));
      if (snapshot.exists()) {
        const data = snapshot.val();
        localStorage.setItem(`${CACHE_PREFIX}${so}`, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.error('Failed to load auto-generated ESS data from Firebase:', error);
    }
  }
  const localData = localStorage.getItem(`${CACHE_PREFIX}${so}`);
  if (!localData) return null;
  try {
    return JSON.parse(localData);
  } catch (error) {
    console.warn(`Corrupt local auto-ESS cache for ${so}, ignoring it:`, error);
    return null;
  }
};

export const hasEssAutoData = async (so) => {
  const data = await loadEssAutoData(so);
  return Array.isArray(data) && data.length > 0;
};

// Coarse-grained error report: one note per generation, not per-field —
// enough to hand the super admin's feedback back as a concrete case to fix
// in essRules.js/essMatcher.js/the parsers. See design doc "Corrección de
// errores".
export const saveEssCorrection = async (so, note) => {
  if (!isConfigured || !db) return;
  try {
    await push(ref(db, `ess_corrections/${so}`), {
      note,
      reportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to save ESS correction report:', error);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/essAutoData.js
git commit -m "feat(ess): add persistence for auto-generated ESS drafts"
```

---

### Task 10: Wire the "ESS" tab into Navbar and App

**Files:**
- Modify: `src/components/Navbar.jsx:1-2,42` (imports and `tabs` array)
- Modify: `src/App.jsx:26,644-645` (import and `switch` case)
- Modify: `src/utils/translations.js` (add `navbar.ess` key to both `en` and `es` blocks)

**Interfaces:**
- Consumes: `EssView` (default export) from `src/views/EssView.jsx` — created in Task 11; `isSuperAdminRole` from `src/utils/adminConfig.js` (existing).
- Produces: a new `'ess'` tab, visible only when `isSuperAdmin` is true, rendering `<EssView data={mergedData} />`.

- [ ] **Step 1: Add the translation key**

In `src/utils/translations.js`, in the `en.navbar` block ([translations.js:22-30](../../../src/utils/translations.js#L22-L30)), add a line after `admin: "Admin"`:

```js
    navbar: {
      dashboard: "Dashboard",
      calendar: "Calendar",
      myProjects: "My Projects",
      pipeline: "Pipeline",
      costs: "Cost Analysis",
      materials: "Materials",
      admin: "Admin",
      ess: "ESS"
    },
```

Do the same in the `es.navbar` block (mirrors the same keys further down the file), setting `ess: "ESS"` there too (the acronym doesn't change between languages).

- [ ] **Step 2: Add the tab entry in Navbar**

In `src/components/Navbar.jsx:2`, add `FileStack` to the `lucide-react` import:

```jsx
import { LayoutDashboard, ListTodo, CircleDollarSign, Hammer, CalendarDays, LogOut, User, Briefcase, ChevronDown, ChevronLeft, ChevronRight, Award, Sun, Moon, Activity, ShieldCheck, FileStack } from 'lucide-react';
```

In `src/components/Navbar.jsx:42`, add the new tab right after the existing `admin` tab entry:

```jsx
    ...(isSuperAdmin ? [{ id: 'admin', label: t('navbar.admin'), icon: ShieldCheck, badge: pendingUsersCount > 0 }] : []),
    ...(isSuperAdmin ? [{ id: 'ess', label: t('navbar.ess'), icon: FileStack }] : [])
```

(replacing the single existing line that ends the `tabs` array at [Navbar.jsx:42](../../../src/components/Navbar.jsx#L42)).

- [ ] **Step 3: Wire the case in App.jsx**

In `src/App.jsx:26`, add the import right after `AdminUsersView`:

```jsx
import AdminUsersView from './views/AdminUsersView'
import EssView from './views/EssView'
```

In `src/App.jsx:644-645`, add a new `case` right after the existing `admin` case:

```jsx
      case 'admin':
        return isSuperAdminRole(userProfile?.role) ? <AdminUsersView userProfile={userProfile} data={mergedData} masterProjects={masterProjects} /> : <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
      case 'ess':
        return isSuperAdminRole(userProfile?.role) ? <EssView data={mergedData} /> : <DashboardView data={mergedData} weeklyHistory={weeklyHistory} />;
```

- [ ] **Step 4: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds (this will fail until Task 11 creates `EssView.jsx` — if running this task standalone, stub `src/views/EssView.jsx` temporarily with `export default function EssView() { return null; }` to verify the wiring compiles, then let Task 11 replace it).

- [ ] **Step 5: Commit**

```bash
git add src/components/Navbar.jsx src/App.jsx src/utils/translations.js
git commit -m "feat(ess): wire ESS tab into Navbar and App, gated to super admin"
```

---

### Task 11: Project list (`EssView.jsx`)

**Files:**
- Create: `src/views/EssView.jsx`

**Interfaces:**
- Consumes: `data.priorityAnalysis` (array of `{ so, name, designer, eng, ... }`, the same shape every other view already reads off `mergedData`); `db, ref, onValue` from `src/utils/firebase.js`; `EssProjectDetail` (default export) from `src/views/EssProjectDetail.jsx` — created in Task 12.
- Produces: default export `EssView({ data })`, self-contained (owns its own "selected project" state, no props needed from `App.jsx` beyond `data`).

- [ ] **Step 1: Implement**

Create `src/views/EssView.jsx`:

```jsx
import { useState, useEffect, useMemo } from 'react';
import { Search, FileStack } from 'lucide-react';
import { db, ref, onValue } from '../utils/firebase';
import { useLanguage } from '../utils/LanguageContext';
import EssProjectDetail from './EssProjectDetail';

function statusFor(so, filesBySo, autoDataBySo) {
  if (autoDataBySo?.[so]) return 'generated';
  const files = filesBySo?.[so];
  if (files && (files.contract || files.quote || files.drawings)) return 'uploaded';
  return 'none';
}

export default function EssView({ data }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedSo, setSelectedSo] = useState(null);
  const [filesBySo, setFilesBySo] = useState({});
  const [autoDataBySo, setAutoDataBySo] = useState({});

  useEffect(() => {
    if (!db) return;
    const unsubFiles = onValue(ref(db, 'ess_files'), snap => setFilesBySo(snap.val() || {}));
    const unsubAuto = onValue(ref(db, 'essAutoData'), snap => setAutoDataBySo(snap.val() || {}));
    return () => { unsubFiles(); unsubAuto(); };
  }, []);

  const projects = useMemo(() => {
    const all = data?.priorityAnalysis || [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? all.filter(p => String(p.so).includes(term) || (p.name || '').toLowerCase().includes(term))
      : all;
    return [...filtered].sort((a, b) => String(a.so).localeCompare(String(b.so)));
  }, [data, search]);

  const selectedProject = selectedSo ? projects.find(p => String(p.so) === String(selectedSo)) || (data?.priorityAnalysis || []).find(p => String(p.so) === String(selectedSo)) : null;

  if (selectedProject) {
    return <EssProjectDetail project={selectedProject} onBack={() => setSelectedSo(null)} />;
  }

  const statusLabel = (status) => {
    if (status === 'generated') return language === 'es' ? 'ESS generada' : 'ESS generated';
    if (status === 'uploaded') return language === 'es' ? 'PDFs cargados' : 'PDFs uploaded';
    return language === 'es' ? 'Sin PDFs' : 'No PDFs';
  };

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileStack size={20} /> {language === 'es' ? 'Generador de ESS' : 'ESS Generator'}
      </h2>
      <div style={{ position: 'relative', margin: '16px 0', maxWidth: '360px' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={language === 'es' ? 'Buscar por SO o nombre...' : 'Search by SO or name...'}
          style={{ width: '100%', padding: '8px 8px 8px 32px' }}
        />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px' }}>SO</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'es' ? 'Proyecto' : 'Project'}</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>{language === 'es' ? 'Estado' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(project => {
            const status = statusFor(project.so, filesBySo, autoDataBySo);
            return (
              <tr
                key={project.so}
                onClick={() => setSelectedSo(project.so)}
                style={{ cursor: 'pointer', borderTop: '1px solid var(--card-border, #333)' }}
              >
                <td style={{ padding: '8px' }}>{project.so}</td>
                <td style={{ padding: '8px' }}>{project.name}</td>
                <td style={{ padding: '8px' }}>{statusLabel(status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify it renders**

Run the dev server (`npm run dev`), sign in as the super admin account, open the new "ESS" tab, and confirm the project list renders with a working search box and a status column (all rows will read "Sin PDFs"/"No PDFs" until Task 12 exists).

- [ ] **Step 3: Commit**

```bash
git add src/views/EssView.jsx
git commit -m "feat(ess): add ESS project list view"
```

---

### Task 12: Upload + generate screen (`EssProjectDetail.jsx`)

**Files:**
- Create: `src/views/EssProjectDetail.jsx`

**Interfaces:**
- Consumes: `saveEssFile, loadEssFile, validateFileSize` (Task 2); `extractPdfPages, pagesToPlainText` (Task 1); `parseContractText, looksLikeContract` (Task 5); `parseQuoteText, looksLikeQuote` (Task 6); `parseDrawingPages, looksLikeDrawing` (Task 7); `buildEssPages` (Task 8); `saveEssAutoData, hasEssAutoData` (Task 9); `EssAutoGeneratorModal` (Task 14); `base64ToArrayBuffer` (Task 2).
- Produces: default export `EssProjectDetail({ project, onBack })`.

- [ ] **Step 1: Implement**

Create `src/views/EssProjectDetail.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';
import { saveEssFile, loadEssFile, validateFileSize, base64ToArrayBuffer } from '../utils/essFiles';
import { extractPdfPages, pagesToPlainText } from '../utils/essPdfExtract';
import { parseContractText, looksLikeContract } from '../utils/essParsers/parseContract';
import { parseQuoteText, looksLikeQuote } from '../utils/essParsers/parseQuote';
import { parseDrawingPages, looksLikeDrawing } from '../utils/essParsers/parseDrawings';
import { buildEssPages } from '../utils/essMatcher';
import { saveEssAutoData, hasEssAutoData } from '../utils/essAutoData';
import EssAutoGeneratorModal from '../components/EssAutoGeneratorModal';

const DOC_TYPES = ['contract', 'quote', 'drawings'];

export default function EssProjectDetail({ project, onBack }) {
  const { language } = useLanguage();
  const t = (es, en) => (language === 'es' ? es : en);

  const [uploadedNames, setUploadedNames] = useState({});
  const [slotWarnings, setSlotWarnings] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [isUploading, setIsUploading] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [essExists, setEssExists] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(DOC_TYPES.map(async docType => {
        const file = await loadEssFile(project.so, docType);
        return [docType, file?.name || null];
      }));
      if (!cancelled) setUploadedNames(Object.fromEntries(entries));
      const exists = await hasEssAutoData(project.so);
      if (!cancelled) setEssExists(exists);
    })();
    return () => { cancelled = true; };
  }, [project.so]);

  const handleFileSelect = async (docType, file) => {
    if (!file) return;
    setUploadErrors(prev => ({ ...prev, [docType]: null }));
    setSlotWarnings(prev => ({ ...prev, [docType]: null }));

    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      setUploadErrors(prev => ({ ...prev, [docType]: t('Este archivo es demasiado grande (máx 8MB).', 'This file is too large (max 8MB).') }));
      return;
    }

    setIsUploading(prev => ({ ...prev, [docType]: true }));
    try {
      await saveEssFile(project.so, docType, file);
      setUploadedNames(prev => ({ ...prev, [docType]: file.name }));

      const arrayBuffer = await file.arrayBuffer();
      const pages = await extractPdfPages(arrayBuffer);
      const text = pagesToPlainText(pages);
      const looksRight = docType === 'contract' ? looksLikeContract(text)
        : docType === 'quote' ? looksLikeQuote(text)
        : looksLikeDrawing(pages);
      if (!looksRight) {
        setSlotWarnings(prev => ({
          ...prev,
          [docType]: t(`Esto no parece un ${docType === 'contract' ? 'Contract' : docType === 'quote' ? 'Quote' : 'Drawings'} — ¿seguro que es el correcto?`, `This doesn't look like a ${docType === 'contract' ? 'Contract' : docType === 'quote' ? 'Quote' : 'Drawings'} file — are you sure it's the right one?`),
        }));
      }
    } catch (error) {
      console.error(`Failed to upload ${docType}:`, error);
      setUploadErrors(prev => ({ ...prev, [docType]: t('No se pudo subir este archivo.', 'Failed to upload this file.') }));
    } finally {
      setIsUploading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const allUploaded = DOC_TYPES.every(docType => uploadedNames[docType]);

  const handleGenerate = async () => {
    if (essExists) {
      const confirmed = window.confirm(t(
        'Ya existe un borrador de ESS generado para este proyecto. Generar uno nuevo lo va a reemplazar. ¿Continuar?',
        'This project already has a generated ESS draft. Generating a new one will replace it. Continue?'
      ));
      if (!confirmed) return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setSummary(null);

    try {
      const [contractFile, quoteFile, drawingsFile] = await Promise.all(
        DOC_TYPES.map(docType => loadEssFile(project.so, docType))
      );
      if (!contractFile || !quoteFile || !drawingsFile) {
        throw new Error('MISSING_FILES');
      }

      const [contractPages, quotePages, drawingPages] = await Promise.all([
        extractPdfPages(base64ToArrayBuffer(contractFile.data)),
        extractPdfPages(base64ToArrayBuffer(quoteFile.data)),
        extractPdfPages(base64ToArrayBuffer(drawingsFile.data)),
      ]);

      const contractText = pagesToPlainText(contractPages);
      const quoteText = pagesToPlainText(quotePages);
      const drawingsHaveText = drawingPages.some(p => p.items.length > 0);

      if (!contractText.trim() || !quoteText.trim() || !drawingsHaveText) {
        throw new Error('EMPTY_TEXT');
      }

      const contract = parseContractText(contractText);
      const quote = parseQuoteText(quoteText);
      const drawings = parseDrawingPages(drawingPages);

      const { pages, unmatchedQuoteItems, unmatchedDrawingOpenings, warnings } = buildEssPages({ project, contract, quote, drawings });

      await saveEssAutoData(project.so, pages);
      setEssExists(true);
      setSummary({ unmatchedQuoteItems, unmatchedDrawingOpenings, warnings });
    } catch (error) {
      console.error('ESS generation failed:', error);
      if (error.message === 'MISSING_FILES') {
        setGenerationError(t('Subí los 3 PDFs (Contract, Quote, Drawings) antes de generar.', 'Upload all 3 PDFs (Contract, Quote, Drawings) before generating.'));
      } else if (error.message === 'EMPTY_TEXT') {
        setGenerationError(t('No pudimos leer texto de uno de estos PDFs. ¿Es un escaneo?', "We couldn't read text from one of these PDFs. Is it a scan?"));
      } else {
        setGenerationError(t('Algo salió mal leyendo estos PDFs. Revisá los archivos e intentá de nuevo.', 'Something went wrong reading these PDFs. Check the files and try again.'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const slotLabel = (docType) => ({ contract: 'Contract', quote: 'Quote', drawings: 'Drawings' }[docType]);

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <button className="btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={14} /> {t('Volver', 'Back')}
      </button>
      <h2>SO #{project.so} — {project.name}</h2>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', margin: '16px 0' }}>
        {DOC_TYPES.map(docType => (
          <div key={docType} className="glass-card" style={{ padding: '12px', minWidth: '220px' }}>
            <strong>{slotLabel(docType)}</strong>
            <div style={{ margin: '8px 0' }}>
              <label className="btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {isUploading[docType] ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadedNames[docType] ? t('Reemplazar', 'Replace') : t('Elegir PDF...', 'Choose PDF...')}
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(docType, e.target.files?.[0])}
                  disabled={isUploading[docType]}
                />
              </label>
            </div>
            {uploadedNames[docType] && (
              <div style={{ fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} color="var(--color-cyan)" /> {uploadedNames[docType]}
              </div>
            )}
            {slotWarnings[docType] && (
              <div style={{ fontSize: '0.85em', color: 'var(--color-warning, orange)', marginTop: '4px' }}>
                <AlertTriangle size={14} /> {slotWarnings[docType]}
              </div>
            )}
            {uploadErrors[docType] && (
              <div style={{ fontSize: '0.85em', color: 'var(--color-danger, red)', marginTop: '4px' }}>
                {uploadErrors[docType]}
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="btn-primary" disabled={!allUploaded || isGenerating} onClick={handleGenerate}>
        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : null}
        {' '}{t('Generar ESS', 'Generate ESS')}
      </button>

      {generationError && (
        <div style={{ color: 'var(--color-danger, red)', marginTop: '12px' }}>{generationError}</div>
      )}

      {summary && (
        <div className="glass-card" style={{ padding: '12px', marginTop: '16px' }}>
          <h3>{t('Resumen de extracción', 'Extraction summary')}</h3>
          {summary.unmatchedQuoteItems.length === 0 && summary.unmatchedDrawingOpenings.length === 0 ? (
            <p>{t('Todo matcheó correctamente.', 'Everything matched cleanly.')}</p>
          ) : (
            <>
              {summary.unmatchedQuoteItems.length > 0 && (
                <div>
                  <strong>{t('Ítems del Quote sin área en el plano:', 'Quote items with no matching drawing area:')}</strong>
                  <ul>
                    {summary.unmatchedQuoteItems.map((item, i) => (
                      <li key={i}>{item.area} — {item.description} ({item.productCode})</li>
                    ))}
                  </ul>
                </div>
              )}
              {summary.unmatchedDrawingOpenings.length > 0 && (
                <div>
                  <strong>{t('Áreas del plano sin ítem en el Quote:', 'Drawing areas with no matching quote item:')}</strong>
                  <ul>
                    {summary.unmatchedDrawingOpenings.map((d, i) => (
                      <li key={i}>{d.area} ({d.openings.length} openings)</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <button className="btn-primary btn-sm" onClick={() => setShowModal(true)} style={{ marginTop: '12px' }}>
            {t('Abrir ESS generada', 'Open generated ESS')}
          </button>
        </div>
      )}

      {essExists && !summary && (
        <button className="btn-secondary btn-sm" onClick={() => setShowModal(true)} style={{ marginTop: '16px' }}>
          {t('Abrir ESS generada', 'Open generated ESS')}
        </button>
      )}

      {showModal && (
        <EssAutoGeneratorModal project={project} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manually verify end-to-end**

With the dev server running and signed in as the super admin: open ESS → pick a project → upload three real (or dummy text-based) PDFs into the three slots → confirm each shows its filename and no upload error → click "Generar ESS" (disabled until all three are present) → confirm the summary panel appears (may show unmatched items — that's expected on a first-pass parse) → confirm a `essAutoData/{so}` node was written (visible in the Firebase Console) and that `essData/{so}` was NOT touched.

- [ ] **Step 3: Commit**

```bash
git add src/views/EssProjectDetail.jsx
git commit -m "feat(ess): add PDF upload + ESS generation screen"
```

---

### Task 13: Extract shared ESS form fields (`EssFormFields.jsx`)

**Files:**
- Create: `src/components/EssFormFields.jsx`
- Modify: `src/components/PDFGeneratorModal.jsx`

**Interfaces:**
- Produces: default export `EssFormFields({ t, pages, currentPageIndex, setCurrentPageIndex, addPage, removePage, headerData, handleHeaderChange, drawerOptions, handleOptionsChange, drawers, updateDrawer, removeDrawer, addDrawer, rods, updateRod, removeRod, addRod, miscCol1, setMiscCol1, miscCol2, setMiscCol2 })` — a purely presentational component (no state, no Firebase access) rendering the tab bar plus the four form sections (header fields, drawer options + table, rods table, misc notes). Consumed by `PDFGeneratorModal.jsx` (this task) and Task 14 (`EssAutoGeneratorModal.jsx`).

Both the existing manual ESS modal and the new auto-generated one need the identical editable form UI. Rather than duplicate ~135 lines of JSX between them, this task extracts it once, out of the already-shipping `PDFGeneratorModal.jsx`, into a shared presentational component. This is a pure "move" refactor — every prop this component receives is exactly the value/handler that already existed as a local variable in `PDFGeneratorModal.jsx`; no logic changes. `essData.js` and the `essData/{so}` RTDB node are not touched — only where the JSX lives changes, not what it does or how it's wired.

- [ ] **Step 1: Create the shared component**

Create `src/components/EssFormFields.jsx` with this exact content — it is `src/components/PDFGeneratorModal.jsx`'s current lines 144-279 (the tab system through the misc-notes section), wrapped in a fragment and driven by props instead of closure variables:

```jsx
import { X, Plus, Trash2 } from 'lucide-react';

export default function EssFormFields({
  t,
  pages,
  currentPageIndex,
  setCurrentPageIndex,
  addPage,
  removePage,
  headerData,
  handleHeaderChange,
  drawerOptions,
  handleOptionsChange,
  drawers,
  updateDrawer,
  removeDrawer,
  addDrawer,
  rods,
  updateRod,
  removeRod,
  addRod,
  miscCol1,
  setMiscCol1,
  miscCol2,
  setMiscCol2,
}) {
  return (
    <>
      <div className="pdf-tabs-container">
        <div className="pdf-tabs">
          {pages.map((p, index) => (
            <div
              key={index}
              className={`pdf-tab ${index === currentPageIndex ? 'active' : ''}`}
              onClick={() => setCurrentPageIndex(index)}
            >
              {t('myProjects.sheet')} {index + 1}
              {pages.length > 1 && (
                <span
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); removePage(index); }}
                  title={t('myProjects.deleteSheet')}
                >
                  <X size={12} />
                </span>
              )}
            </div>
          ))}
          <button className="btn-add-tab" onClick={addPage} title={t('myProjects.addNewSheet')} aria-label={t('myProjects.addNewSheet')}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="pdf-modal-body">
        <div className="form-section">
          <h3>{t('myProjects.headerSheet')} {currentPageIndex + 1}</h3>
          <div className="form-grid">
            <label>JOB NAME: <input type="text" name="jobName" value={headerData.jobName} onChange={handleHeaderChange} /></label>
            <label>COLOR: <input type="text" name="color" value={headerData.color} onChange={handleHeaderChange} /></label>
            <label>ROOM(S): <input type="text" name="rooms" value={headerData.rooms} onChange={handleHeaderChange} /></label>
            <label>DESIGNER: <input type="text" name="designer" value={headerData.designer} onChange={handleHeaderChange} /></label>
            <label>ENGINEER: <input type="text" name="engineer" value={headerData.engineer} onChange={handleHeaderChange} /></label>
          </div>
        </div>

        <div className="form-section">
          <h3>{t('myProjects.drawerOptions')}</h3>
          <div className="form-grid">
            <label>FRONTS:
              <select name="fronts" value={drawerOptions.fronts} onChange={handleOptionsChange}>
                <option value="SLAB">SLAB</option>
                <option value="THERMOFOIL">THERMOFOIL</option>
              </select>
            </label>
            <label>BOX:
              <select name="box" value={drawerOptions.box} onChange={handleOptionsChange}>
                <option value="PRFV">PRFV</option>
                <option value="DOVETAIL">DOVETAIL</option>
              </select>
            </label>
            <label>SLIDES:
              <select name="slides" value={drawerOptions.slides} onChange={handleOptionsChange}>
                <option value="SOFT CLOSE">SOFT CLOSE</option>
                <option value="FULL EXTENSION">FULL EXTENSION</option>
              </select>
            </label>
            <label>HANDLES:
              <select name="handles" value={drawerOptions.handles} onChange={handleOptionsChange}>
                <option value="STD. B. NICKEL">STD. B. NICKEL</option>
                <option value="STD. CHROME">STD. CHROME</option>
                <option value="STD. M. BLACK">STD. M. BLACK</option>
                <option value="NONE">NONE</option>
                <option value="CUSTOMER OWN">CUSTOMER OWN</option>
                <option value="SPECIAL">SPECIAL</option>
              </select>
            </label>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>FRONT (H x W)</th><th>QTY</th><th>OPEN.</th><th>BOX (W x D x H)</th><th>ROOM</th><th>SPECIAL HANDLES</th><th></th>
                </tr>
              </thead>
              <tbody>
                {drawers.map((d, i) => (
                  <tr key={i}>
                    <td><input name={`drawerFront-${i}`} value={d.front} onChange={e => updateDrawer(i, 'front', e.target.value)} /></td>
                    <td><input name={`drawerQty-${i}`} type="number" style={{width: '60px'}} value={d.qty} onChange={e => updateDrawer(i, 'qty', e.target.value)} /></td>
                    <td><input name={`drawerOpen-${i}`} value={d.open} onChange={e => updateDrawer(i, 'open', e.target.value)} /></td>
                    <td><input name={`drawerBox-${i}`} value={d.box} onChange={e => updateDrawer(i, 'box', e.target.value)} /></td>
                    <td><input name={`drawerRoom-${i}`} value={d.room} onChange={e => updateDrawer(i, 'room', e.target.value)} /></td>
                    <td><input name={`drawerHandles-${i}`} value={d.handles} onChange={e => updateDrawer(i, 'handles', e.target.value)} /></td>
                    <td><button className="btn-icon danger" onClick={() => removeDrawer(i)}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-secondary btn-sm" onClick={addDrawer} style={{marginTop: '10px'}}><Plus size={14} /> {t('myProjects.addDrawerRow')}</button>
          </div>
        </div>

        <div className="form-section">
          <h3>{t('myProjects.rodsTitle')}</h3>
          <div className="table-container" style={{maxWidth: '500px'}}>
            <table>
              <thead>
                <tr>
                  <th>ROOM</th><th>TYPE</th><th>QTY</th><th>SIZE</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rods.map((r, i) => (
                  <tr key={i}>
                    <td><input name={`rodRoom-${i}`} value={r.room} onChange={e => updateRod(i, 'room', e.target.value)} /></td>
                    <td><input name={`rodType-${i}`} value={r.type} onChange={e => updateRod(i, 'type', e.target.value)} /></td>
                    <td><input name={`rodQty-${i}`} type="number" style={{width: '60px'}} value={r.qty} onChange={e => updateRod(i, 'qty', e.target.value)} /></td>
                    <td><input name={`rodSize-${i}`} value={r.size} onChange={e => updateRod(i, 'size', e.target.value)} /></td>
                    <td><button className="btn-icon danger" onClick={() => removeRod(i)}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-secondary btn-sm" onClick={addRod} style={{marginTop: '10px'}}><Plus size={14} /> {t('myProjects.addRod')}</button>
          </div>
        </div>

        <div className="form-section">
          <h3>{t('myProjects.miscNotesTitle')}</h3>
          <div className="misc-columns">
            <div style={{flex: 1}}>
              <label>{t('myProjects.leftColumn')}</label>
              <textarea name="miscCol1" value={miscCol1} onChange={e => setMiscCol1(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
            </div>
            <div style={{flex: 1}}>
              <label>{t('myProjects.rightColumn')}</label>
              <textarea name="miscCol2" value={miscCol2} onChange={e => setMiscCol2(e.target.value)} rows={6} style={{width:'100%', padding:'8px'}}></textarea>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Wire it into `PDFGeneratorModal.jsx`**

In `src/components/PDFGeneratorModal.jsx:2`, drop the now-unused `Plus`/`Trash2` icons (they're only used inside the JSX this task removes) and add the new import:

```jsx
import { X, Printer } from 'lucide-react';
import EssFormFields from './EssFormFields';
```

(insert the `EssFormFields` import line right after the existing `import PDFPrintLayout from './PDFPrintLayout';` line).

Then replace `PDFGeneratorModal.jsx`'s lines 144-279 in full — everything from `{/* Tab System for Multiple Pages */}` through the closing `</div>` of the misc-notes `form-section` (i.e. the entire block between the `pdf-modal-header` `</div>` at line 142 and the `pdf-modal-content` closing `</div>` at line 280) — with:

```jsx
        <EssFormFields
          t={t}
          pages={pages}
          currentPageIndex={currentPageIndex}
          setCurrentPageIndex={setCurrentPageIndex}
          addPage={addPage}
          removePage={removePage}
          headerData={headerData}
          handleHeaderChange={handleHeaderChange}
          drawerOptions={drawerOptions}
          handleOptionsChange={handleOptionsChange}
          drawers={drawers}
          updateDrawer={updateDrawer}
          removeDrawer={removeDrawer}
          addDrawer={addDrawer}
          rods={rods}
          updateRod={updateRod}
          removeRod={removeRod}
          addRod={addRod}
          miscCol1={miscCol1}
          setMiscCol1={setMiscCol1}
          miscCol2={miscCol2}
          setMiscCol2={setMiscCol2}
        />
```

Every prop above is an existing local variable/function already in scope in `PDFGeneratorModal.jsx` (defined earlier in the same component) — nothing needs to change besides removing the inline JSX and passing those same values down.

- [ ] **Step 3: Verify no regression**

Run: `npm run build`
Expected: build succeeds with no unused-import warnings for `Plus`/`Trash2` in `PDFGeneratorModal.jsx`.

Run: `npm run dev`, sign in, open My Projects → "Completar ESS" on any project. Confirm the modal looks and behaves exactly as before: header fields editable, drawer/rod rows addable/removable, tabs addable/removable, misc notes editable, auto-save still works, print still works. This view has no automated test coverage in this repo, so this manual pass is the regression check — compare against the behavior before this task if anything looks off.

- [ ] **Step 4: Commit**

```bash
git add src/components/EssFormFields.jsx src/components/PDFGeneratorModal.jsx
git commit -m "refactor(ess): extract shared ESS form UI into EssFormFields"
```

---

### Task 14: Auto-generated ESS editor/print modal (`EssAutoGeneratorModal.jsx`)

**Files:**
- Create: `src/components/EssAutoGeneratorModal.jsx`

**Interfaces:**
- Consumes: `EssFormFields` from `src/components/EssFormFields.jsx` (Task 13); `usePagedModal` from `src/utils/usePagedModal.js` (existing, unchanged); `PDFPrintLayout` from `src/components/PDFPrintLayout.jsx` (existing, unchanged); `saveEssAutoData, loadEssAutoData, saveEssCorrection` from `src/utils/essAutoData.js` (Task 9); `useLanguage`, `useReactToPrint`, `shortProjectName` (all existing).
- Produces: default export `EssAutoGeneratorModal({ project, onClose })`.

Same editable fields and print mechanism as the existing manual ESS modal (via the shared `EssFormFields`), pointed at the new data source instead of `essData`, plus a "Report an error" button. `PDFGeneratorModal.jsx` is not touched by this task (it was already updated in Task 13 to use the same shared component).

- [ ] **Step 1: Implement**

Create `src/components/EssAutoGeneratorModal.jsx`:

```jsx
import { useRef, useState } from 'react';
import { X, Printer, Flag } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import PDFPrintLayout from './PDFPrintLayout';
import EssFormFields from './EssFormFields';
import { saveEssAutoData, loadEssAutoData, saveEssCorrection } from '../utils/essAutoData';
import { usePagedModal } from '../utils/usePagedModal';
import { useLanguage } from '../utils/LanguageContext';
import { shortProjectName } from '../utils/projectName';
import './PDFGeneratorModal.css';

const createDefaultPage = (project) => ({
  headerData: {
    jobName: project ? `${project.so} - ${shortProjectName(project.name)}` : '',
    color: '',
    rooms: '',
    designer: project ? (project.designer || '') : '',
    engineer: project ? (project.eng || '') : ''
  },
  drawerOptions: { fronts: 'SLAB', box: 'PRFV', slides: 'SOFT CLOSE', handles: 'STD. CHROME' },
  drawers: [],
  rods: [],
  miscCol1: '',
  miscCol2: ''
});

export default function EssAutoGeneratorModal({ project, onClose }) {
  const { t, language } = useLanguage();
  const [isReporting, setIsReporting] = useState(false);

  const {
    pages,
    currentPageIndex,
    setCurrentPageIndex,
    isLoading,
    addPage,
    removePage,
    updateCurrentPage,
  } = usePagedModal({
    so: project.so,
    createDefaultPage: () => createDefaultPage(project),
    loadData: loadEssAutoData,
    saveData: saveEssAutoData,
  });

  const setHeaderData = (newData) => updateCurrentPage(p => ({ ...p, headerData: typeof newData === 'function' ? newData(p.headerData) : newData }));
  const setDrawerOptions = (newOpts) => updateCurrentPage(p => ({ ...p, drawerOptions: typeof newOpts === 'function' ? newOpts(p.drawerOptions) : newOpts }));
  const setDrawers = (newDrawers) => updateCurrentPage(p => ({ ...p, drawers: typeof newDrawers === 'function' ? newDrawers(p.drawers) : newDrawers }));
  const setRods = (newRods) => updateCurrentPage(p => ({ ...p, rods: typeof newRods === 'function' ? newRods(p.rods) : newRods }));
  const setMiscCol1 = (val) => updateCurrentPage(p => ({ ...p, miscCol1: val }));
  const setMiscCol2 = (val) => updateCurrentPage(p => ({ ...p, miscCol2: val }));

  const currentPage = pages[currentPageIndex] || pages[0];
  const { headerData, drawerOptions, drawers, rods, miscCol1, miscCol2 } = currentPage;

  const addDrawer = () => setDrawers([...drawers, { front: '', qty: 1, open: '', box: '', room: '', handles: '' }]);
  const removeDrawer = (index) => setDrawers(drawers.filter((_, i) => i !== index));
  const updateDrawer = (index, field, value) => {
    const newDrawers = [...drawers];
    newDrawers[index][field] = value;
    setDrawers(newDrawers);
  };

  const addRod = () => setRods([...rods, { room: '', type: 'Oval Chrome rod', qty: 1, size: '' }]);
  const removeRod = (index) => setRods(rods.filter((_, i) => i !== index));
  const updateRod = (index, field, value) => {
    const newRods = [...rods];
    newRods[index][field] = value;
    setRods(newRods);
  };

  const handleHeaderChange = (e) => setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  const handleOptionsChange = (e) => setDrawerOptions({ ...drawerOptions, [e.target.name]: e.target.value });

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: () => {
      const baseName = shortProjectName(project.name);
      const cleanName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
      return `ESS_AUTO_${cleanName}`;
    },
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 8mm !important;
      }
    `
  });

  const handleReportError = async () => {
    const note = window.prompt(
      language === 'es'
        ? 'Describí qué está mal en esta ESS generada:'
        : "Describe what's wrong with this generated ESS:"
    );
    if (!note) return;
    setIsReporting(true);
    try {
      await saveEssCorrection(project.so, note);
      window.alert(language === 'es' ? 'Reporte guardado.' : 'Report saved.');
    } finally {
      setIsReporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pdf-modal-overlay animate-fade-in">
        <div className="pdf-modal-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <p style={{ color: 'var(--color-cyan)' }}>{t('myProjects.loadingSavedData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-modal-overlay animate-fade-in">
      <div className="pdf-modal-content">
        <div className="pdf-modal-header">
          <h2>{language === 'es' ? 'ESS Auto-generada' : 'Auto-generated ESS'} — {project.so}</h2>
          <div className="pdf-modal-actions">
            <span className="save-status text-muted" style={{ fontSize: '0.8rem', marginRight: '10px' }}>{t('myProjects.autoSaveActive')}</span>
            <button className="btn-secondary btn-sm" onClick={handleReportError} disabled={isReporting}>
              <Flag size={16} /> {language === 'es' ? 'Reportar error' : 'Report error'}
            </button>
            <button className="btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> {t('myProjects.printSavePDF')}
            </button>
            <button className="btn-icon danger" onClick={onClose} aria-label={t('common.close')}>
              <X size={20} />
            </button>
          </div>
        </div>

        <EssFormFields
          t={t}
          pages={pages}
          currentPageIndex={currentPageIndex}
          setCurrentPageIndex={setCurrentPageIndex}
          addPage={addPage}
          removePage={removePage}
          headerData={headerData}
          handleHeaderChange={handleHeaderChange}
          drawerOptions={drawerOptions}
          handleOptionsChange={handleOptionsChange}
          drawers={drawers}
          updateDrawer={updateDrawer}
          removeDrawer={removeDrawer}
          addDrawer={addDrawer}
          rods={rods}
          updateRod={updateRod}
          removeRod={removeRod}
          addRod={addRod}
          miscCol1={miscCol1}
          setMiscCol1={setMiscCol1}
          miscCol2={miscCol2}
          setMiscCol2={setMiscCol2}
        />
      </div>

      {/* Hidden print layout component. Render ALL pages */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          {pages.map((pData, idx) => (
            <div key={idx} className="print-page-wrapper">
              <PDFPrintLayout
                headerData={pData.headerData}
                drawerOptions={pData.drawerOptions}
                drawers={pData.drawers}
                rods={pData.rods}
                miscCol1={pData.miscCol1}
                miscCol2={pData.miscCol2}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

From `EssProjectDetail` (Task 12), after generating a draft, click "Abrir ESS generada" and confirm: the modal opens pre-filled with the generated header/drawers/rods; edits to any field persist (auto-save, same as the existing manual ESS modal); "Reportar error" prompts for a note and writes it under `ess_corrections/{so}` in the Firebase Console; "Imprimir/Guardar PDF" opens the print dialog with a document titled `ESS_AUTO_<project>`; navigating back to My Projects and confirming `essData/{so}` is unaffected — "Completar ESS" still shows whatever was there before this whole feature existed.

- [ ] **Step 3: Commit**

```bash
git add src/components/EssAutoGeneratorModal.jsx
git commit -m "feat(ess): add editable/printable modal for auto-generated ESS drafts"
```

---

## After all tasks

Run the full suite once more to confirm nothing regressed:

```bash
npm test
npm run build
```

Then manually walk the full path end-to-end once (Task 12's, Task 13's, and Task 14's manual verification steps, back to back, on a real project) before considering this feature done.
