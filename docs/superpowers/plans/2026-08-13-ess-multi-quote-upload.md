# Carga de varios Quotes por proyecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cargar un Quote por ambiente, detectar el ambiente y su color desde cada PDF, y generar la ESS agrupando las páginas por conjunto de colores.

**Architecture:** Los tres documentos singulares (Contract, Summary, Drawings) siguen en claves fijas de RTDB; los Quotes pasan a una colección `quotes/{quoteId}` bajo el mismo nodo del SO. El ambiente sale del renglón `Area:` de cada Quote y el color de la tabla `Area Price`, leída por coordenada x en vez de por regex sobre texto aplanado. `buildEssPages` deja de producir una página por área y pasa a producir una página por conjunto de colores.

**Tech Stack:** React 19, Vite 8, Vitest 4, Firebase Realtime Database, pdfjs-dist (legacy build), Testing Library.

**Spec:** [docs/superpowers/specs/2026-08-13-ess-multi-quote-upload-design.md](../specs/2026-08-13-ess-multi-quote-upload-design.md)

## Global Constraints

- **Comando de tests:** `npx vitest run --exclude "**/.claude/**"`. Sin el `--exclude`, vitest levanta también los tests de `.claude/worktrees/` e infla el conteo.
- **Nunca `git push`.** Los pasos de commit están listados porque el repo trabaja con commits atómicos por tarea, pero sólo ejecutarlos si Luis autorizó commitear en esta sesión. Si no, dejar los cambios en el working tree y avisar. `origin/main` despliega a Vercel automáticamente.
- **No hace falta republicar reglas de RTDB.** `database.rules.json:161-168` da `.read`/`.write` sobre los nodos raíz `ess_files` y `ess_file_index` completos. Cualquier anidamiento debajo ya está cubierto.
- **Sin migración de datos.** Los archivos del modelo viejo se vuelven a subir a mano.
- **Idioma de la UI:** todo string visible va en español e inglés vía el helper `t(es, en)` que ya usa `EssProjectDetail.jsx`.
- **Tamaño máximo de PDF:** 7MB, ya validado por `validateFileSize`. No cambia.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/utils/essParsers/parseQuote.js` (modificar) | Suma `detectQuoteArea`. El resto del archivo queda intacto — su rewrite es un trabajo aparte. |
| `src/utils/essParsers/parseAreaPrice.js` (crear) | Lee la fila de la tabla `Area Price` por coordenada x. Archivo propio porque es el único parser posicional del Quote y no comparte nada con el parseo de texto. |
| `src/utils/essColorGroups.js` (crear) | Normaliza colores y agrupa ambientes por conjunto de colores. Puro y sin dependencias, para poder probar la regla sola. |
| `src/utils/essFiles.js` (modificar) | Suma la colección de Quotes al lado de los tres singulares. |
| `src/utils/essRetention.js` (modificar) | Que la política de borrado vea la colección. |
| `src/utils/essMatcher.js` (modificar) | `buildEssPages` pasa de una página por área a una página por grupo de colores. |
| `src/views/EssProjectDetail.jsx` (modificar) | Pantalla: tres ranuras fijas + sección de ambientes. |

## Orden y dependencias

Las tareas 1 a 4 no dependen de nada externo y son verificables solas. **Al terminar la tarea 4 el pedido original está cumplido**: se pueden subir varios Quotes y ver cuántos ambientes tiene el trabajo.

Las tareas 5 a 7 agregan color y agrupación. La tarea 5 tiene un riesgo declarado: se construye contra fixtures posicionales sintéticos porque todavía no hay volcados `--pos` de los PDFs reales. La tarea 8 es la validación contra los reales y está bloqueada hasta que Luis los genere.

---

### Task 1: Detección del ambiente

**Files:**
- Modify: `src/utils/essParsers/parseQuote.js`
- Test: `src/utils/essParsers/__tests__/parseQuote.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `detectQuoteArea(text: string): string | null`

**Contexto para quien implementa:** el regex actual `AREA_HEADER_RE` busca un renglón entero en mayúsculas. Matchea `MWIC` y `RIC` de casualidad porque son siglas, y falla con `Garage`. Los Quotes reales traen un renglón literal `Area:` y el nombre en el renglón siguiente. Los cuatro fixtures de `__tests__/fixtures/quotes/` son texto extraído de PDFs reales, con los datos del cliente redactados.

- [ ] **Step 1: Write the failing test**

En `src/utils/essParsers/__tests__/parseQuote.test.js`, agregar al final del archivo:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'quotes');
const fixture = (name) => readFileSync(join(fixtureDir, name), 'utf8');

describe('detectQuoteArea', () => {
  // El nombre sale del renglón siguiente a 'Area:', no de un renglón en
  // mayúsculas: 'Garage' es minúscula y el regex viejo no lo veía.
  it('reads the area from the Area: label of a real quote', () => {
    expect(detectQuoteArea(fixture('area-garage.txt'))).toBe('Garage');
    expect(detectQuoteArea(fixture('area-mwic.txt'))).toBe('MWIC');
    expect(detectQuoteArea(fixture('area-ric.txt'))).toBe('RIC');
  });

  // El Summary tiene un encabezado de tabla 'Area' sin dos puntos. Que no
  // matchee es lo que permite distinguirlo de un Quote de ambiente.
  it('returns null for the Summary, which has no Area: label', () => {
    expect(detectQuoteArea(fixture('summary.txt'))).toBeNull();
  });

  it('returns null rather than throwing on empty or missing input', () => {
    expect(detectQuoteArea('')).toBeNull();
    expect(detectQuoteArea(null)).toBeNull();
    expect(detectQuoteArea(undefined)).toBeNull();
  });

  it('ignores case and trailing spaces on the label', () => {
    expect(detectQuoteArea('AREA:  \n  Guest Closet  \n')).toBe('Guest Closet');
  });

  it('returns null when Area: is the last line with nothing after it', () => {
    expect(detectQuoteArea('Bill To:\nArea:')).toBeNull();
  });
});
```

Y agregar `detectQuoteArea` al import existente de la línea 2:

```js
import { parseQuoteText, looksLikeQuote, detectQuoteArea } from '../parseQuote';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/essParsers/__tests__/parseQuote.test.js --exclude "**/.claude/**"`
Expected: FAIL — `detectQuoteArea is not a function`

- [ ] **Step 3: Write minimal implementation**

En `src/utils/essParsers/parseQuote.js`, agregar después de la declaración de `COLOR_LABEL_RE`:

```js
const AREA_LABEL_RE = /^area\s*:\s*$/i;

// El ambiente sale del renglón siguiente a una etiqueta 'Area:'. Es la única
// señal verificada contra los tres Quotes reales; AREA_HEADER_RE, que exige un
// renglón entero en mayúsculas, matchea MWIC y RIC por casualidad (son siglas)
// y falla con 'Garage'. El Summary trae 'Area' como encabezado de tabla, sin
// dos puntos, y por eso devuelve null — que es justo lo que lo distingue.
export function detectQuoteArea(text) {
  if (!text) return null;
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  const labelIndex = lines.findIndex(line => AREA_LABEL_RE.test(line));
  if (labelIndex === -1) return null;
  return lines[labelIndex + 1] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/essParsers/__tests__/parseQuote.test.js --exclude "**/.claude/**"`
Expected: PASS, todos.

- [ ] **Step 5: Commit**

```bash
git add src/utils/essParsers/parseQuote.js src/utils/essParsers/__tests__/parseQuote.test.js
git commit -m "feat(ess): detect the room name from a quote's Area: label"
```

---

### Task 2: Colección de Quotes en el almacenamiento

**Files:**
- Modify: `src/utils/essFiles.js`
- Test: `src/utils/__tests__/essFiles.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `addEssQuote(so: string, file: File, area: string | null): Promise<string>` — devuelve el `quoteId`
  - `removeEssQuote(so: string, quoteId: string): Promise<void>`
  - `loadEssQuoteIndex(so: string): Promise<Record<string, { name, uploadedAt, area }>>`
  - `loadEssQuotes(so: string): Promise<Array<{ quoteId, name, mimeType, data, uploadedAt, area }>>`

**Contexto:** `saveEssFile` ya escribe las dos rutas (`ess_files` con el Base64, `ess_file_index` sin él) en un solo `update()` atómico para que el índice nunca describa un archivo que no está. Las funciones nuevas mantienen esa propiedad. El test mockea `../firebase` y verifica el objeto que se le pasa a `update`.

- [ ] **Step 1: Write the failing test**

En `src/utils/__tests__/essFiles.test.js`, agregar `addEssQuote, removeEssQuote, loadEssQuoteIndex, loadEssQuotes` al import de `../essFiles` y agregar al final:

```js
const pdf = (name = 'Room 2.pdf') => new File([new Uint8Array([1, 2, 3])], name, { type: 'application/pdf' });

describe('addEssQuote', () => {
  it('writes the heavy node and the index in one atomic update', async () => {
    update.mockResolvedValue();
    const quoteId = await addEssQuote('12116', pdf(), 'Garage');

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][1];
    expect(payload[`ess_files/12116/quotes/${quoteId}`]).toMatchObject({
      name: 'Room 2.pdf', mimeType: 'application/pdf', area: 'Garage',
    });
    expect(payload[`ess_file_index/12116/quotes/${quoteId}`]).toMatchObject({
      name: 'Room 2.pdf', area: 'Garage',
    });
  });

  it('keeps the Base64 out of the index entry', async () => {
    update.mockResolvedValue();
    const quoteId = await addEssQuote('12116', pdf(), 'Garage');
    const payload = update.mock.calls[0][1];
    expect(payload[`ess_files/12116/quotes/${quoteId}`].data).toBeTruthy();
    expect(payload[`ess_file_index/12116/quotes/${quoteId}`].data).toBeUndefined();
  });

  // Sin esto quedan megabytes de Base64 huérfanos del modelo de ranura única
  // hasta que se dispare la retención.
  it('clears the legacy single-quote keys in the same write', async () => {
    update.mockResolvedValue();
    await addEssQuote('12116', pdf(), 'Garage');
    const payload = update.mock.calls[0][1];
    expect(payload['ess_files/12116/quote']).toBeNull();
    expect(payload['ess_file_index/12116/quote']).toBeNull();
  });

  it('gives two quotes different ids', async () => {
    update.mockResolvedValue();
    const first = await addEssQuote('12116', pdf(), 'Garage');
    const second = await addEssQuote('12116', pdf(), 'MWIC');
    expect(first).not.toBe(second);
  });

  it('stores a null area when detection failed', async () => {
    update.mockResolvedValue();
    const quoteId = await addEssQuote('12116', pdf(), null);
    const payload = update.mock.calls[0][1];
    expect(payload[`ess_file_index/12116/quotes/${quoteId}`].area).toBeNull();
  });

  it('rejects an oversized file before touching the database', async () => {
    const huge = { size: MAX_ESS_PDF_BYTES + 1, name: 'big.pdf', type: 'application/pdf' };
    await expect(addEssQuote('12116', huge, 'Garage')).rejects.toThrow('FILE_TOO_LARGE');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('removeEssQuote', () => {
  // Mismo orden que purgeEssFiles: primero el nodo pesado. Si falla en el
  // medio queda el índice apuntando a algo que no está — visible y
  // reintentable — y no Base64 sin nada que lo referencie.
  it('removes the heavy node before the index entry', async () => {
    remove.mockResolvedValue();
    await removeEssQuote('12116', 'q_1');
    expect(remove.mock.calls.map(c => c[0].path)).toEqual([
      'ess_files/12116/quotes/q_1',
      'ess_file_index/12116/quotes/q_1',
    ]);
  });
});

describe('loadEssQuoteIndex', () => {
  it('returns the stored entries', async () => {
    get.mockResolvedValue(snap(true, { q_1: { name: 'a.pdf', area: 'Garage' } }));
    await expect(loadEssQuoteIndex('12116')).resolves.toEqual({ q_1: { name: 'a.pdf', area: 'Garage' } });
  });

  it('returns an empty object when the project has no quotes', async () => {
    get.mockResolvedValue(snap(false, null));
    await expect(loadEssQuoteIndex('12116')).resolves.toEqual({});
  });
});

describe('loadEssQuotes', () => {
  it('returns an array carrying each quote id', async () => {
    get.mockResolvedValue(snap(true, {
      q_1: { name: 'a.pdf', data: 'AAA', area: 'Garage' },
      q_2: { name: 'b.pdf', data: 'BBB', area: 'MWIC' },
    }));
    const quotes = await loadEssQuotes('12116');
    expect(quotes).toHaveLength(2);
    expect(quotes.map(q => q.quoteId)).toEqual(['q_1', 'q_2']);
    expect(quotes[0].data).toBe('AAA');
  });

  it('returns an empty array when the project has no quotes', async () => {
    get.mockResolvedValue(snap(false, null));
    await expect(loadEssQuotes('12116')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essFiles.test.js --exclude "**/.claude/**"`
Expected: FAIL — `addEssQuote is not a function`

- [ ] **Step 3: Write minimal implementation**

En `src/utils/essFiles.js`, agregar al final:

```js
// El id no puede salir del nombre del archivo: se repiten entre proyectos
// ('Room 2.pdf') y el ambiente no se conoce hasta parsear el PDF, así que no
// hay identidad natural en el momento de escribir.
function newQuoteId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Mismo contrato atómico que saveEssFile: el nodo pesado y el índice salen en
// un solo update, así el índice nunca describe un archivo que no está.
// De paso borra el Quote singular del modelo viejo — una línea en vez de
// código de migración, sin la cual quedan megabytes de Base64 huérfanos.
export async function addEssQuote(so, file, area) {
  const sizeCheck = validateFileSize(file);
  if (!sizeCheck.valid) {
    throw new Error(sizeCheck.reason);
  }
  const data = await fileToBase64(file);
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  const quoteId = newQuoteId();
  const name = file.name;
  const uploadedAt = new Date().toISOString();
  const areaValue = area ?? null;
  await update(ref(db), {
    [`ess_files/${so}/quotes/${quoteId}`]: { name, mimeType: file.type, data, uploadedAt, area: areaValue },
    [`ess_file_index/${so}/quotes/${quoteId}`]: { name, uploadedAt, area: areaValue },
    [`ess_files/${so}/quote`]: null,
    [`ess_file_index/${so}/quote`]: null,
  });
  return quoteId;
}

// Orden load-bearing, igual que purgeEssFiles: el nodo pesado primero.
export async function removeEssQuote(so, quoteId) {
  if (!isConfigured || !db) throw new Error('FIREBASE_NOT_CONFIGURED');
  await remove(ref(db, `ess_files/${so}/quotes/${quoteId}`));
  await remove(ref(db, `ess_file_index/${so}/quotes/${quoteId}`));
}

export async function loadEssQuoteIndex(so) {
  if (!isConfigured || !db) return {};
  const snapshot = await get(ref(db, `ess_file_index/${so}/quotes`));
  return snapshot.exists() ? snapshot.val() : {};
}

export async function loadEssQuotes(so) {
  if (!isConfigured || !db) return [];
  const snapshot = await get(ref(db, `ess_files/${so}/quotes`));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([quoteId, value]) => ({ quoteId, ...value }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essFiles.test.js --exclude "**/.claude/**"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/essFiles.js src/utils/__tests__/essFiles.test.js
git commit -m "feat(ess): store one quote per room as a collection"
```

---

### Task 3: La retención ve la colección

**Files:**
- Modify: `src/utils/essRetention.js:18-35`
- Test: `src/utils/__tests__/essRetention.test.js`

**Interfaces:**
- Consumes: la forma `entry.quotes = { [quoteId]: { name, uploadedAt, area } }` de la tarea 2.
- Produces: nada nuevo. `planRetention` y `daysUntilPurge` conservan su firma.

**Contexto — este es un bug latente, no una mejora.** `hasAnyFile` y `latestUploadAt` recorren un `DOC_TYPES` fijo de entradas escalares. Con la colección nueva:

- un SO con sólo Quotes cargados daría `hasAnyFile === false` y quedaría **fuera de la retención por completo**: sus PDFs no se borrarían nunca;
- `latestUploadAt` no vería la subida de un Quote posterior a la marca, así que no cancelaría un borrado ya programado.

- [ ] **Step 1: Write the failing test**

En `src/utils/__tests__/essRetention.test.js`, dentro del `describe('planRetention', ...)` existente, agregar:

```js
  // Un SO cuyos únicos archivos son Quotes tiene que entrar a la retención
  // igual. Con la lista fija de docTypes daba 'sin archivos' y sus PDFs no se
  // borraban nunca.
  it('marks a project whose only files are quotes', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { quotes: { q_1: file() } } },
      now: NOW,
    });
    expect(plan.toMark).toEqual(['100']);
  });

  it('still ignores a project with no files at all', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: { 100: { quotes: {} } },
      now: NOW,
    });
    expect(plan.toMark).toEqual([]);
  });

  // Subir un Quote después de la marca significa que los archivos volvieron a
  // hacer falta; el borrado programado se cancela.
  it('unmarks when a quote was uploaded after the purge mark', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: {
        100: {
          contract: file(),
          quotes: { q_1: file(iso(NOW - 1 * DAY)) },
          purgeMarkedAt: iso(NOW - 8 * DAY),
        },
      },
      now: NOW,
    });
    expect(plan.toUnmark).toEqual(['100']);
    expect(plan.toPurge).toEqual([]);
  });

  it('purges when every quote predates the mark', () => {
    const plan = planRetention({
      projects: [nesting],
      fileIndex: {
        100: {
          contract: file(),
          quotes: { q_1: file(iso(NOW - 30 * DAY)) },
          purgeMarkedAt: iso(NOW - 8 * DAY),
        },
      },
      now: NOW,
    });
    expect(plan.toPurge).toEqual(['100']);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js --exclude "**/.claude/**"`
Expected: FAIL — el primero da `toMark: []` en vez de `['100']`, y el de unmark da `toPurge: ['100']`.

- [ ] **Step 3: Write minimal implementation**

En `src/utils/essRetention.js`, reemplazar las líneas 18-35 por:

```js
const DOC_TYPES = ['contract', 'summary', 'drawings'];

// Los Quotes son una colección, no una clave fija: un proyecto puede tener uno
// por ambiente. Recorrer sólo DOC_TYPES dejaba un SO con únicamente Quotes
// fuera de la retención entera, o sea con sus PDFs guardados para siempre.
function quoteEntries(entry) {
  return Object.values(entry?.quotes || {});
}

function hasAnyFile(entry) {
  return DOC_TYPES.some(docType => entry?.[docType]) || quoteEntries(entry).length > 0;
}

function parseTime(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function latestUploadAt(entry) {
  const times = [
    ...DOC_TYPES.map(docType => entry?.[docType]?.uploadedAt),
    ...quoteEntries(entry).map(quote => quote?.uploadedAt),
  ]
    .map(parseTime)
    .filter(ms => ms !== null);
  return times.length > 0 ? Math.max(...times) : null;
}
```

Nota: `DOC_TYPES` pasa de `['contract', 'quote', 'drawings']` a `['contract', 'summary', 'drawings']`. El `quote` singular ya no existe en el modelo nuevo y `summary` es obligatorio.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essRetention.test.js --exclude "**/.claude/**"`
Expected: PASS, incluidos los tests viejos.

- [ ] **Step 5: Commit**

```bash
git add src/utils/essRetention.js src/utils/__tests__/essRetention.test.js
git commit -m "fix(ess): count quote collection in the retention sweep"
```

---

### Task 4: Pantalla de carga múltiple

**Files:**
- Modify: `src/views/EssProjectDetail.jsx`
- Test: `src/views/__tests__/EssProjectDetail.test.jsx` (crear)

**Interfaces:**
- Consumes: `detectQuoteArea` (tarea 1); `addEssQuote`, `removeEssQuote`, `loadEssQuoteIndex` (tarea 2).
- Produces: la pantalla. Nada que consuman tareas posteriores salvo `handleGenerate`, que la tarea 7 reescribe.

**Contexto:** hoy el archivo tiene `const DOC_TYPES = ['contract', 'quote', 'drawings']` y mapea tres tarjetas iguales. Pasa a `['contract', 'summary', 'drawings']` más una sección aparte para los Quotes. **Acá se arreglan los dos puntos de accesibilidad diferidos en la auditoría del 2026-08-13**: el `<input type="file">` con `display: none` dentro de un `<label>` no es alcanzable por teclado, y las ranuras no tienen `aria-label` que las distinga.

El patrón accesible es un `<input>` visualmente oculto pero enfocable (clase `.visually-hidden`, no `display: none`) asociado a un `<label>` por `htmlFor`/`id`.

- [ ] **Step 1: Write the failing test**

Crear `src/views/__tests__/EssProjectDetail.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

const addEssQuote = vi.fn();
const removeEssQuote = vi.fn();
const loadEssQuoteIndex = vi.fn();
vi.mock('../../utils/essFiles', () => ({
  saveEssFile: vi.fn().mockResolvedValue(undefined),
  loadEssFile: vi.fn().mockResolvedValue(null),
  loadEssFileIndexEntry: vi.fn().mockResolvedValue(null),
  validateFileSize: () => ({ valid: true }),
  base64ToArrayBuffer: () => new ArrayBuffer(0),
  addEssQuote: (...a) => addEssQuote(...a),
  removeEssQuote: (...a) => removeEssQuote(...a),
  loadEssQuoteIndex: (...a) => loadEssQuoteIndex(...a),
}));
vi.mock('../../utils/essPdfExtract', () => ({
  extractPdfPages: vi.fn().mockResolvedValue([{ pageNumber: 1, items: [] }]),
  pagesToPlainText: () => 'Area:\nGarage',
}));
vi.mock('../../utils/essAutoData', () => ({
  saveEssAutoData: vi.fn(),
  hasEssAutoData: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../components/EssAutoGeneratorModal', () => ({ default: () => null }));

import { LanguageProvider } from '../../utils/LanguageContext';
import EssProjectDetail from '../EssProjectDetail';

const project = { so: '12116', name: 'James Aiello:[12116] James Aiello' };
const renderView = () =>
  render(
    <LanguageProvider>
      <EssProjectDetail project={project} materials={null} onBack={() => {}} />
    </LanguageProvider>,
  );

beforeEach(() => {
  addEssQuote.mockReset().mockResolvedValue('q_1');
  removeEssQuote.mockReset().mockResolvedValue(undefined);
  loadEssQuoteIndex.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('EssProjectDetail quote collection', () => {
  it('shows how many rooms the job has', async () => {
    loadEssQuoteIndex.mockResolvedValue({
      q_1: { name: 'a.pdf', area: 'Garage' },
      q_2: { name: 'b.pdf', area: 'MWIC' },
    });
    renderView();
    await waitFor(() => expect(screen.getByText(/2 rooms/i)).toBeTruthy());
    expect(screen.getByText('Garage')).toBeTruthy();
    expect(screen.getByText('MWIC')).toBeTruthy();
  });

  it('says there are no rooms yet when nothing is uploaded', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText(/no rooms yet/i)).toBeTruthy());
  });

  // Un ambiente sin detectar no rechaza el archivo ni inventa un nombre.
  it('flags a quote whose area could not be detected', async () => {
    loadEssQuoteIndex.mockResolvedValue({ q_1: { name: 'a.pdf', area: null } });
    renderView();
    await waitFor(() => expect(screen.getByText(/room not detected/i)).toBeTruthy());
  });

  it('marks two quotes claiming the same room as duplicates', async () => {
    loadEssQuoteIndex.mockResolvedValue({
      q_1: { name: 'a.pdf', area: 'Garage' },
      q_2: { name: 'b.pdf', area: 'Garage' },
    });
    renderView();
    await waitFor(() => expect(screen.getAllByText(/duplicate/i)).toHaveLength(2));
  });

  it('removes a quote from the list', async () => {
    loadEssQuoteIndex.mockResolvedValue({ q_1: { name: 'a.pdf', area: 'Garage' } });
    renderView();
    await waitFor(() => expect(screen.getByText('Garage')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /remove Garage/i }));
    await waitFor(() => expect(removeEssQuote).toHaveBeenCalledWith('12116', 'q_1'));
  });

  // El input de archivo tiene que ser enfocable: con display:none no hay forma
  // de subir un PDF con teclado.
  it('gives every file input a reachable, distinguishable label', async () => {
    renderView();
    await waitFor(() => expect(screen.getByLabelText(/contract/i)).toBeTruthy());
    expect(screen.getByLabelText(/summary/i)).toBeTruthy();
    expect(screen.getByLabelText(/drawings/i)).toBeTruthy();
    expect(screen.getByLabelText(/contract/i).style.display).not.toBe('none');
  });

  it('keeps generation disabled until all four requirements are met', async () => {
    loadEssQuoteIndex.mockResolvedValue({ q_1: { name: 'a.pdf', area: 'Garage' } });
    renderView();
    await waitFor(() => expect(screen.getByText('Garage')).toBeTruthy());
    // Contract, Summary y Drawings siguen vacíos.
    expect(screen.getByRole('button', { name: /generate ess/i }).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/views/__tests__/EssProjectDetail.test.jsx --exclude "**/.claude/**"`
Expected: FAIL — no existe la sección de ambientes ni el conteo.

- [ ] **Step 3: Write the implementation**

En `src/views/EssProjectDetail.jsx`:

1. Cambiar la constante de la línea 14:

```js
const DOC_TYPES = ['contract', 'summary', 'drawings'];
```

2. Agregar al import de `../utils/essFiles`: `addEssQuote, removeEssQuote, loadEssQuoteIndex`.
   Agregar `import { detectQuoteArea } from '../utils/essParsers/parseQuote';`

3. Agregar estado y carga junto a los existentes:

```js
  const [quotes, setQuotes] = useState({});
  const [isAddingQuote, setIsAddingQuote] = useState(false);

  const refreshQuotes = useCallback(async () => {
    try {
      setQuotes(await loadEssQuoteIndex(project.so));
    } catch (error) {
      console.error('Failed to load quotes:', error);
    }
  }, [project.so]);

  useEffect(() => { refreshQuotes(); }, [refreshQuotes]);
```

(agregar `useCallback` al import de `react`)

4. Handler de alta:

```js
  const handleQuoteSelect = async (file) => {
    if (!file) return;
    const sizeCheck = validateFileSize(file);
    if (!sizeCheck.valid) {
      setUploadErrors(prev => ({ ...prev, quotes: t('Este archivo es demasiado grande (máx 7MB).', 'This file is too large (max 7MB).') }));
      return;
    }
    setUploadErrors(prev => ({ ...prev, quotes: null }));
    setIsAddingQuote(true);
    try {
      // El ambiente se detecta antes de guardar para que la fila lo muestre sin
      // volver a abrir el PDF. Si la lectura falla, el archivo se sube igual con
      // area null: preferimos un hueco visible a una adivinanza.
      let area = null;
      try {
        const pages = await extractPdfPages(await file.arrayBuffer());
        area = detectQuoteArea(pagesToPlainText(pages));
      } catch (error) {
        console.error('Could not read the area from this quote:', error);
      }
      await addEssQuote(project.so, file, area);
      await refreshQuotes();
    } catch (error) {
      console.error('Failed to add quote:', error);
      setUploadErrors(prev => ({ ...prev, quotes: t('No se pudo subir este Quote.', 'Failed to upload this quote.') }));
    } finally {
      setIsAddingQuote(false);
    }
  };

  const handleQuoteRemove = async (quoteId) => {
    try {
      await removeEssQuote(project.so, quoteId);
      await refreshQuotes();
    } catch (error) {
      console.error('Failed to remove quote:', error);
    }
  };
```

5. Derivados, antes del `return`:

```js
  const quoteList = Object.entries(quotes).map(([quoteId, entry]) => ({ quoteId, ...entry }));
  const areaCounts = quoteList.reduce((counts, quote) => {
    const key = (quote.area || '').trim().toUpperCase();
    if (key) counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const isDuplicate = (area) => Boolean(area) && areaCounts[area.trim().toUpperCase()] > 1;
  const allUploaded = DOC_TYPES.every(docType => uploadedNames[docType]) && quoteList.length > 0;
```

(borrar la definición vieja de `allUploaded` de la línea 111)

6. Reemplazar el `<label>` de cada ranura por la versión enfocable:

```jsx
              <label className="btn-secondary btn-sm" htmlFor={`ess-file-${docType}`} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {isUploading[docType] ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadedNames[docType] ? t('Reemplazar', 'Replace') : t('Elegir PDF...', 'Choose PDF...')}
              </label>
              <input
                id={`ess-file-${docType}`}
                type="file"
                accept="application/pdf"
                aria-label={`${slotLabel(docType)} PDF`}
                className="visually-hidden"
                onChange={e => handleFileSelect(docType, e.target.files?.[0])}
                disabled={isUploading[docType]}
              />
```

7. Agregar `summary` a `slotLabel`:

```js
  const slotLabel = (docType) => ({ contract: 'Contract', summary: 'Summary', quote: 'Quote', drawings: 'Drawings' }[docType]);
```

8. Insertar la sección de ambientes justo después del `</div>` que cierra la grilla de ranuras:

```jsx
      <div className="glass-card" style={{ padding: '12px', margin: '16px 0' }}>
        <strong>
          {quoteList.length === 0
            ? t('Todavía no hay ambientes', 'No rooms yet')
            : t(`${quoteList.length} ambiente${quoteList.length === 1 ? '' : 's'}`, `${quoteList.length} room${quoteList.length === 1 ? '' : 's'}`)}
        </strong>

        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
          {quoteList.map(quote => (
            <li key={quote.quoteId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
              <strong>{quote.area || t('Ambiente sin detectar', 'Room not detected')}</strong>
              <span className="text-muted" style={{ fontSize: '0.85em' }}>{quote.name}</span>
              {isDuplicate(quote.area) && (
                <span style={{ color: 'var(--color-warning, orange)', fontSize: '0.85em' }}>
                  {t('duplicado', 'duplicate')}
                </span>
              )}
              <button
                className="btn-secondary btn-sm"
                type="button"
                onClick={() => handleQuoteRemove(quote.quoteId)}
                aria-label={t(`Quitar ${quote.area || quote.name}`, `Remove ${quote.area || quote.name}`)}
              >
                {t('Quitar', 'Remove')}
              </button>
            </li>
          ))}
        </ul>

        <label className="btn-secondary btn-sm" htmlFor="ess-file-quote" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {isAddingQuote ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {t('Agregar Quote', 'Add quote')}
        </label>
        <input
          id="ess-file-quote"
          type="file"
          accept="application/pdf"
          aria-label={t('Quote de un ambiente', 'Room quote PDF')}
          className="visually-hidden"
          onChange={e => { handleQuoteSelect(e.target.files?.[0]); e.target.value = ''; }}
          disabled={isAddingQuote}
        />
        {uploadErrors.quotes && (
          <div style={{ fontSize: '0.85em', color: 'var(--color-danger, red)', marginTop: '4px' }}>{uploadErrors.quotes}</div>
        )}
      </div>
```

9. Cambiar la grilla de ranuras de flex a grid, que era el otro hallazgo de la auditoría:

```jsx
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'stretch', margin: '16px 0' }}>
```

10. Actualizar el texto del aviso bajo el botón:

```jsx
          {t('Subí Contract, Summary, Drawings y al menos un Quote para poder generar.', 'Upload Contract, Summary, Drawings and at least one quote to generate.')}
```

- [ ] **Step 4: Add the visually-hidden helper**

En `src/index.css`, agregar al final:

```css
/* Oculta visualmente sin sacar del orden de foco. display:none y
   visibility:hidden hacen el elemento inalcanzable por teclado, que es
   exactamente lo que rompía la carga de PDFs. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --exclude "**/.claude/**"`
Expected: PASS. Verificar además que no rompió `src/views/__tests__/EssView.test.jsx`.

- [ ] **Step 6: Lint**

Run: `npx eslint src/views/EssProjectDetail.jsx src/views/__tests__/EssProjectDetail.test.jsx`
Expected: sin salida.

- [ ] **Step 7: Commit**

```bash
git add src/views/EssProjectDetail.jsx src/views/__tests__/EssProjectDetail.test.jsx src/index.css
git commit -m "feat(ess): upload one quote per room and show the room count"
```

**🏁 Hito: acá el pedido original está cumplido.** Se pueden subir varios Quotes y la pantalla dice cuántos ambientes tiene el trabajo. Vale la pena probarlo en el navegador antes de seguir.

---

### Task 5: Lectura de la tabla Area Price por coordenada

**Files:**
- Create: `src/utils/essParsers/parseAreaPrice.js`
- Create: `src/utils/essParsers/__tests__/parseAreaPrice.test.js`
- Create: `src/utils/essParsers/__tests__/fixtures/quotes/area-garage-positions.json`

**Interfaces:**
- Consumes: la forma `pages[].items[] = { text, x, y, width, height }` de `extractPdfPages`.
- Produces: `parseAreaPriceRow(pages): { description, color, secondColor, fronts, warnings }`

**⚠️ Riesgo declarado:** este fixture posicional es **sintético**, construido a mano a partir del layout conocido del PDF de Garage. Todavía no hay volcado `--pos` del PDF real. Ya pasó una vez en este proyecto que un fixture inventado produjera un hallazgo falso (ver la nota metodológica del documento de hallazgos). La tarea 8 valida contra los reales y hasta entonces esta lectura **no está confirmada**.

**Contexto:** la tabla tiene encabezado `Description | color | 2nd color where | Fronts | Selection | Amt.` y una única fila de datos debajo. La descripción contiene comas y puntos (`Uppers, Lowers, 1 set of drawers, 5 Tall Cabinets with Doors, 2 Open Tall Cabinets.`), así que separar por texto es frágil. Se usa la x de cada título de columna como borde.

- [ ] **Step 1: Create the positional fixture**

Crear `src/utils/essParsers/__tests__/fixtures/quotes/area-garage-positions.json`:

```json
{
  "note": "SINTÉTICO. Reconstruido del layout del PDF de Garage, no volcado de un PDF real. Reemplazar por la salida de `node dump-pdf.mjs <quote.pdf> --pos` en la tarea 8.",
  "pageNumber": 1,
  "items": [
    { "text": "Area Price", "x": 240, "y": 400, "width": 60, "height": 11 },
    { "text": "Description", "x": 40, "y": 380, "width": 55, "height": 9 },
    { "text": "color", "x": 300, "y": 380, "width": 25, "height": 9 },
    { "text": "2nd color where", "x": 340, "y": 380, "width": 70, "height": 9 },
    { "text": "Fronts", "x": 425, "y": 380, "width": 30, "height": 9 },
    { "text": "Selection", "x": 465, "y": 380, "width": 40, "height": 9 },
    { "text": "Amt.", "x": 520, "y": 380, "width": 20, "height": 9 },
    { "text": "Uppers, Lowers, 1 set of drawers, 5 Tall Cabinets with Doors, 2 Open Tall Cabinets.", "x": 40, "y": 365, "width": 250, "height": 9 },
    { "text": "White", "x": 300, "y": 365, "width": 25, "height": 9 },
    { "text": "Silver Drift (Ctop)", "x": 340, "y": 365, "width": 70, "height": 9 },
    { "text": "Flat", "x": 425, "y": 365, "width": 18, "height": 9 },
    { "text": "Included", "x": 465, "y": 365, "width": 38, "height": 9 },
    { "text": "10900.00", "x": 520, "y": 365, "width": 40, "height": 9 }
  ]
}
```

- [ ] **Step 2: Write the failing test**

Crear `src/utils/essParsers/__tests__/parseAreaPrice.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseAreaPriceRow } from '../parseAreaPrice';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'quotes');
const garagePage = JSON.parse(readFileSync(join(fixtureDir, 'area-garage-positions.json'), 'utf8'));

describe('parseAreaPriceRow', () => {
  it('reads each column of the Area Price row by position', () => {
    const result = parseAreaPriceRow([garagePage]);
    expect(result.color).toBe('White');
    expect(result.secondColor).toBe('Silver Drift (Ctop)');
    expect(result.fronts).toBe('Flat');
  });

  // Separar por texto rompería acá: la descripción tiene comas y puntos.
  it('keeps a description full of commas in one piece', () => {
    const result = parseAreaPriceRow([garagePage]);
    expect(result.description).toBe('Uppers, Lowers, 1 set of drawers, 5 Tall Cabinets with Doors, 2 Open Tall Cabinets.');
  });

  it('warns instead of guessing when the table is not there', () => {
    const result = parseAreaPriceRow([{ pageNumber: 1, items: [{ text: 'Bill To:', x: 40, y: 700, width: 30, height: 9 }] }]);
    expect(result.warnings).toContain('AREA_PRICE_NOT_FOUND');
    expect(result.color).toBeNull();
  });

  it('returns nulls rather than throwing on empty input', () => {
    const result = parseAreaPriceRow([]);
    expect(result.color).toBeNull();
    expect(result.warnings).toContain('AREA_PRICE_NOT_FOUND');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/essParsers/__tests__/parseAreaPrice.test.js --exclude "**/.claude/**"`
Expected: FAIL — no existe el módulo.

- [ ] **Step 4: Write the implementation**

Crear `src/utils/essParsers/parseAreaPrice.js`:

```js
// La tabla 'Area Price' del Quote trae el color de cada ambiente. Se lee por
// coordenada y no por regex sobre texto aplanado porque la columna Description
// contiene comas, puntos y espacios ('Uppers, Lowers, 1 set of drawers, ...'):
// cualquier separación por texto se parte en el lugar equivocado. Las x de los
// títulos del encabezado hacen de bordes de columna.
const HEADERS = ['Description', 'color', '2nd color where', 'Fronts', 'Selection', 'Amt.'];
const ROW_TOLERANCE = 3;

function rowsOf(items) {
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const rows = [];
  let current = null;
  for (const item of sorted) {
    if (current && Math.abs(item.y - current.y) <= ROW_TOLERANCE) {
      current.items.push(item);
    } else {
      current = { y: item.y, items: [item] };
      rows.push(current);
    }
  }
  return rows;
}

function isHeaderRow(row) {
  const texts = row.items.map(item => item.text.trim());
  return HEADERS.every(header => texts.includes(header));
}

// El borde derecho de una columna es el izquierdo de la siguiente; la última
// se extiende hasta el infinito para no perder un valor que sobresalga.
function columnBounds(headerRow) {
  const ordered = HEADERS
    .map(header => headerRow.items.find(item => item.text.trim() === header))
    .sort((a, b) => a.x - b.x);
  return ordered.map((item, index) => ({
    name: HEADERS.find(h => h === item.text.trim()),
    from: item.x - 2,
    to: index + 1 < ordered.length ? ordered[index + 1].x - 2 : Infinity,
  }));
}

function cellText(row, bound) {
  return row.items
    .filter(item => item.x >= bound.from && item.x < bound.to)
    .sort((a, b) => a.x - b.x)
    .map(item => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const empty = (warnings) => ({ description: '', color: null, secondColor: null, fronts: null, warnings });

export function parseAreaPriceRow(pages) {
  for (const page of pages || []) {
    const rows = rowsOf(page.items || []);
    const headerIndex = rows.findIndex(isHeaderRow);
    if (headerIndex === -1) continue;

    const dataRow = rows[headerIndex + 1];
    if (!dataRow) continue;

    const bounds = columnBounds(rows[headerIndex]);
    const cell = (name) => cellText(dataRow, bounds.find(b => b.name === name));
    return {
      description: cell('Description'),
      color: cell('color') || null,
      secondColor: cell('2nd color where') || null,
      fronts: cell('Fronts') || null,
      warnings: [],
    };
  }
  return empty(['AREA_PRICE_NOT_FOUND']);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/essParsers/__tests__/parseAreaPrice.test.js --exclude "**/.claude/**"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/essParsers/parseAreaPrice.js src/utils/essParsers/__tests__/parseAreaPrice.test.js src/utils/essParsers/__tests__/fixtures/quotes/area-garage-positions.json
git commit -m "feat(ess): read the Area Price columns by x position"
```

---

### Task 6: Agrupación por conjunto de colores

**Files:**
- Create: `src/utils/essColorGroups.js`
- Create: `src/utils/__tests__/essColorGroups.test.js`

**Interfaces:**
- Consumes: objetos con forma `{ area, color, secondColor }`.
- Produces:
  - `normalizeColor(value: string | null): string | null`
  - `colorSetOf(quote): string[]`
  - `groupQuotesByColor(quotes): Array<{ colors: string[], quotes: [] }>`

**Contexto — la regla, tal como la definió Luis:** dos ambientes comparten hoja si y sólo si su **conjunto completo** de colores coincide. Solaparse en uno no alcanza.

| Ambiente A | Ambiente B | ¿Misma página? |
|---|---|---|
| `{White}` | `{White}` | sí |
| `{White, Sand Linen}` | `{White, Sand Linen}` | sí |
| `{White}` | `{White, Sand Linen}` | no |
| `{White, Silver Drift (Ctop)}` | `{White, —}` | no |

- [ ] **Step 1: Write the failing test**

Crear `src/utils/__tests__/essColorGroups.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeColor, colorSetOf, groupQuotesByColor } from '../essColorGroups';

const quote = (area, color, secondColor = null) => ({ area, color, secondColor });

describe('normalizeColor', () => {
  it('treats the ways a quote says "none" as the same absence', () => {
    expect(normalizeColor('n/a')).toBeNull();
    expect(normalizeColor('N/A')).toBeNull();
    expect(normalizeColor('-')).toBeNull();
    expect(normalizeColor('—')).toBeNull();
    expect(normalizeColor('')).toBeNull();
    expect(normalizeColor('   ')).toBeNull();
    expect(normalizeColor(null)).toBeNull();
  });

  it('keeps a real color verbatim', () => {
    expect(normalizeColor(' Silver Drift (Ctop) ')).toBe('Silver Drift (Ctop)');
  });
});

describe('groupQuotesByColor', () => {
  it('puts two rooms with the same single color on one page', () => {
    const groups = groupQuotesByColor([quote('MWIC', 'White'), quote('RIC', 'White')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].quotes.map(q => q.area)).toEqual(['MWIC', 'RIC']);
    expect(groups[0].colors).toEqual(['White']);
  });

  it('puts two rooms with the same pair of colors on one page', () => {
    const groups = groupQuotesByColor([
      quote('MWIC', 'White', 'Sand Linen'),
      quote('RIC', 'White', 'Sand Linen'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].colors).toEqual(['White', 'Sand Linen']);
  });

  // Solaparse en uno no alcanza: el conjunto completo tiene que coincidir.
  it('separates a one-color room from a two-color room that shares the first', () => {
    const groups = groupQuotesByColor([quote('MWIC', 'White'), quote('RIC', 'White', 'Sand Linen')]);
    expect(groups).toHaveLength(2);
  });

  // El caso real de los fixtures: Garage y RIC comparten White pero no el 2do.
  it('separates rooms whose second colors differ', () => {
    const groups = groupQuotesByColor([
      quote('Garage', 'White', 'Silver Drift (Ctop)'),
      quote('RIC', 'White', '-'),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('ignores casing when comparing, but keeps the first spelling seen', () => {
    const groups = groupQuotesByColor([quote('MWIC', 'White'), quote('RIC', 'WHITE')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].colors).toEqual(['White']);
  });

  it('groups rooms with no color at all together', () => {
    const groups = groupQuotesByColor([quote('MWIC', null), quote('RIC', 'n/a')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].colors).toEqual([]);
  });

  it('returns nothing for no quotes', () => {
    expect(groupQuotesByColor([])).toEqual([]);
  });
});

describe('colorSetOf', () => {
  it('drops the absent second color', () => {
    expect(colorSetOf(quote('MWIC', 'White', 'n/a'))).toEqual(['White']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essColorGroups.test.js --exclude "**/.claude/**"`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Write the implementation**

Crear `src/utils/essColorGroups.js`:

```js
// Una página de ESS no es un ambiente: es un conjunto de colores. Los ambientes
// que comparten exactamente los mismos colores se generan juntos en una hoja, y
// por eso el campo del encabezado dice ROOM(S) en plural.
//
// El criterio es el conjunto completo, no el solapamiento: un ambiente en
// {White} y otro en {White, Sand Linen} van a hojas distintas.

// El Quote escribe la ausencia de varias maneras según quién lo cargó.
// Sin normalizarlas, dos ambientes idénticos escritos distinto quedarían
// separados.
const ABSENT_RE = /^(n\/a|na|none|-|—|–)$/i;

export function normalizeColor(value) {
  const text = String(value ?? '').trim();
  if (!text || ABSENT_RE.test(text)) return null;
  return text;
}

export function colorSetOf(quote) {
  return [normalizeColor(quote?.color), normalizeColor(quote?.secondColor)].filter(Boolean);
}

function groupKey(quote) {
  return colorSetOf(quote).map(color => color.toUpperCase()).join(' | ');
}

// Map preserva el orden de inserción, así que las páginas salen en el orden en
// que se cargaron los Quotes en vez de en un orden arbitrario.
export function groupQuotesByColor(quotes) {
  const groups = new Map();
  for (const quote of quotes || []) {
    const key = groupKey(quote);
    if (!groups.has(key)) groups.set(key, { colors: colorSetOf(quote), quotes: [] });
    groups.get(key).quotes.push(quote);
  }
  return [...groups.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essColorGroups.test.js --exclude "**/.claude/**"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/essColorGroups.js src/utils/__tests__/essColorGroups.test.js
git commit -m "feat(ess): group rooms into pages by their full color set"
```

---

### Task 7: `buildEssPages` produce una página por grupo de colores

**Files:**
- Modify: `src/utils/essMatcher.js`
- Modify: `src/views/EssProjectDetail.jsx` (`handleGenerate`)
- Test: `src/utils/__tests__/essMatcher.test.js`

**Interfaces:**
- Consumes: `groupQuotesByColor` (tarea 6); `parseAreaPriceRow` (tarea 5); `detectQuoteArea` (tarea 1); `loadEssQuotes` (tarea 2).
- Produces: `buildEssPages({ project, contract, quotes, drawings, boxType, fronts })` — **`quote` singular pasa a `quotes` plural**, un arreglo de `{ area, color, secondColor, fronts, description, items }`.

**Contexto:** hoy `buildEssPages` hace `quoteAreas.map(...)`, una página por área, y resuelve un color único para todo el Quote con `resolveColor(quote, project)`. Pasa a agrupar primero y mapear los grupos. Los cajones y barrales de todos los ambientes de un grupo se concatenan; cada fila ya lleva su campo `room`, así que la hoja sigue identificando fila por fila a qué ambiente pertenece.

- [ ] **Step 1: Write the failing test**

En `src/utils/__tests__/essMatcher.test.js`, agregar:

```js
import { describe, it, expect } from 'vitest';
import { buildEssPages } from '../essMatcher';

const drawingsWith = (...areas) => ({
  areas: areas.map(name => ({ name, openings: [{ width: 24, height: null, depth: null }] })),
  warnings: [],
});
const quoteFor = (area, color, secondColor = null) => ({ area, color, secondColor, fronts: 'Flat', description: '', items: [] });

describe('buildEssPages page grouping', () => {
  it('puts two rooms sharing a color set on one page', () => {
    const { pages } = buildEssPages({
      project: { so: '1', name: 'X' },
      contract: { warnings: [] },
      quotes: [quoteFor('MWIC', 'White'), quoteFor('RIC', 'White')],
      drawings: drawingsWith('MWIC', 'RIC'),
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].headerData.rooms).toBe('MWIC, RIC');
  });

  it('splits rooms whose color sets differ', () => {
    const { pages } = buildEssPages({
      project: { so: '1', name: 'X' },
      contract: { warnings: [] },
      quotes: [quoteFor('Garage', 'White', 'Silver Drift (Ctop)'), quoteFor('RIC', 'White')],
      drawings: drawingsWith('Garage', 'RIC'),
    });
    expect(pages).toHaveLength(2);
    expect(pages.map(p => p.headerData.rooms)).toEqual(['Garage', 'RIC']);
  });

  it('shows both colors of the group in the COLOR field', () => {
    const { pages } = buildEssPages({
      project: { so: '1', name: 'X' },
      contract: { warnings: [] },
      quotes: [quoteFor('Garage', 'White', 'Silver Drift (Ctop)')],
      drawings: drawingsWith('Garage'),
    });
    expect(pages[0].headerData.color).toBe('White / Silver Drift (Ctop)');
  });

  // Los cajones de los dos ambientes conviven en la hoja, y cada fila dice de
  // cuál es.
  it('keeps every drawer row tagged with its own room on a shared page', () => {
    const { pages } = buildEssPages({
      project: { so: '1', name: 'X' },
      contract: { warnings: [] },
      quotes: [quoteFor('MWIC', 'White'), quoteFor('RIC', 'White')],
      drawings: drawingsWith('MWIC', 'RIC'),
    });
    expect(pages[0].drawers.map(d => d.room)).toEqual(['MWIC', 'RIC']);
  });

  it('still returns a blank page when there are no quotes', () => {
    const { pages } = buildEssPages({
      project: { so: '1', name: 'X' },
      contract: { warnings: [] },
      quotes: [],
      drawings: drawingsWith(),
    });
    expect(pages).toHaveLength(1);
    expect(pages[0].drawers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/__tests__/essMatcher.test.js --exclude "**/.claude/**"`
Expected: FAIL — `buildEssPages` todavía espera `quote` singular.

- [ ] **Step 3: Rewrite buildEssPages**

En `src/utils/essMatcher.js`:

1. Agregar el import: `import { groupQuotesByColor } from './essColorGroups';`

2. Reemplazar `resolveColor` por una versión que traduce un conjunto:

```js
// Cada color del grupo se traduce a código de taller por separado; los que no
// están en COLOR_MAP viajan verbatim para que el ingeniero vea qué decía el
// Quote y pueda pedir que se agreguen.
function resolveColorSet(colors) {
  const warnings = [];
  const translated = colors.map(raw => {
    const shopCode = translateColor(raw);
    if (shopCode) return shopCode;
    warnings.push(`COLOR_NOT_IN_MAP: ${raw}`);
    return raw;
  });
  return { color: translated.join(' / '), warnings };
}
```

3. Reemplazar el cuerpo de `buildEssPages`:

```js
export function buildEssPages({ project, contract, quotes = [], drawings, boxType = 'PRFV', fronts = 'SLAB' }) {
  const warnings = [
    ...(contract?.warnings || []),
    ...quotes.flatMap(quote => quote?.warnings || []),
    ...(drawings?.warnings || []),
  ];
  const drawingAreas = drawings?.areas || [];
  const unmatchedQuoteItems = [];
  const unmatchedDrawingOpenings = [];
  const drawerOptions = { fronts, box: boxType, slides: 'SOFT CLOSE', handles: 'STD. CHROME' };

  const groups = groupQuotesByColor(quotes);

  const pages = groups.map(group => {
    const { color, warnings: colorWarnings } = resolveColorSet(group.colors);
    warnings.push(...colorWarnings);

    const drawers = [];
    const rods = [];
    const miscCol1Lines = [];

    group.quotes.forEach(quote => {
      const areaName = quote.area || '';
      const drawingArea = drawingAreas.find(d => normalizeAreaName(d.name) === normalizeAreaName(areaName));

      if (!drawingArea) {
        (quote.items || []).forEach(item => unmatchedQuoteItems.push({ area: areaName, ...item }));
      }

      const openings = drawingArea ? drawingArea.openings : [];
      const sizedOpenings = openings.filter(o => o.width != null);

      sizedOpenings.forEach(o => {
        const boxWidth = boxType === 'DOVETAIL' ? calcDovetailWidth(o.width) : calcPrfvWidth(o.width);
        const depthSegment = o.depth != null ? ` x ${formatInches(calcBackingDepth(o.depth))} D` : '';
        drawers.push({
          front: '',
          qty: 1,
          open: formatInches(o.width),
          box: `${formatInches(boxWidth)} W${depthSegment}`,
          room: areaName,
          handles: '',
        });
      });

      // La ambigüedad del barral sigue siendo por ambiente, no por página:
      // agruparla por color la volvería ilegible.
      const rodItems = (quote.items || []).filter(item => /rod/i.test(item.description));
      const rodSize = sizedOpenings.length === 1 ? formatInches(calcHangRodLength(sizedOpenings[0].width)) : '';
      if (rodItems.length > 0 && sizedOpenings.length > 1) {
        warnings.push(`ROD_SIZE_AMBIGUOUS_${areaName}`);
      }
      rodItems.forEach(item => rods.push({ room: areaName, type: item.description, qty: item.qty, size: rodSize }));

      if (contract?.tearoutIncluded) miscCol1Lines.push(areaName, '• Tearout included');
    });

    if (drawers.length > 0) miscCol1Lines.push(BORING_NOTE);

    return {
      headerData: headerFor(project, color, group.quotes.map(q => q.area).filter(Boolean).join(', ')),
      drawerOptions: { ...drawerOptions },
      drawers,
      rods,
      miscCol1: miscCol1Lines.join('\n'),
      miscCol2: contract?.baseboardsIncluded === false ? 'Baseboards NOT included — customer responsible' : '',
    };
  });

  drawingAreas.forEach(d => {
    if (!quotes.find(q => normalizeAreaName(q.area) === normalizeAreaName(d.name))) {
      unmatchedDrawingOpenings.push({ area: d.name, openings: d.openings });
    }
  });

  const blankPage = {
    headerData: headerFor(project, '', ''),
    drawerOptions: { ...drawerOptions },
    drawers: [],
    rods: [],
    miscCol1: '',
    miscCol2: '',
  };

  return {
    pages: pages.length > 0 ? pages : [blankPage],
    unmatchedQuoteItems,
    unmatchedDrawingOpenings,
    warnings,
  };
}
```

4. Borrar la función `resolveColor` vieja, que ya no se usa.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/__tests__/essMatcher.test.js --exclude "**/.claude/**"`
Expected: PASS.

**Migración de los tests viejos.** El archivo tiene ~20 llamadas a
`buildEssPages` con `quote` singular. La conversión es mecánica: cada
`{ name, items }` de `quote.areas` se vuelve un elemento de `quotes` con la
clave `name` renombrada a `area`. Es decir,

```js
    const quote = {
      areas: [{ name: 'MASTER WIC', items: [{ description: 'Valet Rod', productCode: 'VR-100', qty: 2 }] }],
      warnings: [],
    };
    const result = buildEssPages({ project, contract, quote, drawings });
```

pasa a ser

```js
    const quotes = [{
      area: 'MASTER WIC',
      color: 'Snow White',
      secondColor: null,
      items: [{ description: 'Valet Rod', productCode: 'VR-100', qty: 2 }],
      warnings: [],
    }];
    const result = buildEssPages({ project, contract, quotes, drawings });
```

y `quote: { areas: [], warnings: [] }` pasa a ser `quotes: []`.

**⚠️ Un cambio de comportamiento que hay que aceptar explícitamente, no
parchear:** el `project` de esos tests trae `color: 'Snow White'`, y hoy
`resolveColor` cae a `project.color` cuando el Quote no dice nada. Ese fallback
**desaparece**: el color pasa a salir únicamente del Quote, por decisión 3 del
spec. En producción el fallback ya era letra muerta —el registro que arma el
Google Sheet no tiene campo de color, como documenta el comentario de
`resolveColor`— así que sólo lo ejercitaban los tests.

Consecuencia concreta: en cada test que espere
`headerData.color === 'White Classic 300'`, el color tiene que venir ahora del
elemento de `quotes` (`color: 'Snow White'`, que `COLOR_MAP` traduce a
`White Classic 300`). No agregar un fallback a `project.color` para que el test
viejo siga pasando — sería reintroducir la fuente que el spec descartó.

- [ ] **Step 5: Wire handleGenerate**

En `src/views/EssProjectDetail.jsx`, reemplazar el cuerpo del `try` de `handleGenerate`:

```js
      const [contractFile, summaryFile, drawingsFile] = await Promise.all(
        DOC_TYPES.map(docType => loadEssFile(project.so, docType))
      );
      const quoteFiles = await loadEssQuotes(project.so);
      if (!contractFile || !summaryFile || !drawingsFile || quoteFiles.length === 0) {
        throw new Error('MISSING_FILES');
      }

      const [contractPages, drawingPages] = await Promise.all([
        extractPdfPages(base64ToArrayBuffer(contractFile.data)),
        extractPdfPages(base64ToArrayBuffer(drawingsFile.data)),
      ]);

      const parsedQuotes = await Promise.all(quoteFiles.map(async quoteFile => {
        const pages = await extractPdfPages(base64ToArrayBuffer(quoteFile.data));
        const text = pagesToPlainText(pages);
        const areaPrice = parseAreaPriceRow(pages);
        return {
          // El área guardada al subir es un caché; acá se vuelve a leer del PDF
          // para no confiar en un dato que pudo quedar viejo.
          area: detectQuoteArea(text) || quoteFile.area || null,
          color: areaPrice.color,
          secondColor: areaPrice.secondColor,
          fronts: areaPrice.fronts,
          description: areaPrice.description,
          items: [],
          warnings: areaPrice.warnings,
        };
      }));

      const contractText = pagesToPlainText(contractPages);
      const drawingsHaveText = drawingPages.some(p => p.items.length > 0);
      if (!contractText.trim() || !drawingsHaveText) {
        throw new Error('EMPTY_TEXT');
      }

      const contract = parseContractText(contractText);
      const drawings = parseDrawingPages(drawingPages);

      const { boxType, fronts } = essOptionsFromMaterials(materials);
      const { pages, unmatchedQuoteItems, unmatchedDrawingOpenings, warnings } =
        buildEssPages({ project, contract, quotes: parsedQuotes, drawings, boxType, fronts });

      await saveEssAutoData(project.so, pages);
      setEssExists(true);
      setSummary({ unmatchedQuoteItems, unmatchedDrawingOpenings, warnings });
```

Agregar los imports: `loadEssQuotes` desde `../utils/essFiles`, `parseAreaPriceRow` desde `../utils/essParsers/parseAreaPrice`. Borrar el import de `parseQuoteText` y `looksLikeQuote` si quedan sin uso — el chequeo de "¿parece un Quote?" del slot viejo ya no aplica.

Actualizar también el mensaje de `MISSING_FILES`:

```js
        setGenerationError(t('Subí Contract, Summary, Drawings y al menos un Quote antes de generar.', 'Upload Contract, Summary, Drawings and at least one quote before generating.'));
```

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run --exclude "**/.claude/**"`
Expected: PASS

- [ ] **Step 7: Lint**

Run: `npx eslint src/utils/essMatcher.js src/utils/essColorGroups.js src/utils/essParsers/parseAreaPrice.js src/views/EssProjectDetail.jsx`
Expected: sin salida.

- [ ] **Step 8: Commit**

```bash
git add src/utils/essMatcher.js src/utils/__tests__/essMatcher.test.js src/views/EssProjectDetail.jsx
git commit -m "feat(ess): build one ESS page per color group across quotes"
```

---

### Task 8: Validación contra PDFs reales

**🚧 Bloqueada:** necesita que Luis genere los volcados posicionales. No empezar sin ellos.

**Files:**
- Replace: `src/utils/essParsers/__tests__/fixtures/quotes/area-garage-positions.json`
- Create: `src/utils/essParsers/__tests__/fixtures/quotes/area-mwic-positions.json`, `area-ric-positions.json`

**Interfaces:**
- Consumes: `parseAreaPriceRow` (tarea 5).
- Produces: nada de código. Confirma o refuta la tarea 5.

- [ ] **Step 1: Obtener los volcados reales**

Pedirle a Luis que corra, sobre los tres Quotes reales:

```bash
node dump-pdf.mjs "ruta/al/Room 2.pdf" --pos
node dump-pdf.mjs "ruta/al/5_GaragePricing_LF.pdf" --pos
node dump-pdf.mjs "ruta/al/3_Screenshot...pdf" --pos
```

- [ ] **Step 2: Reemplazar el fixture sintético**

Convertir cada salida a la forma `{ pageNumber, items: [{ text, x, y, width, height }] }` y guardarla, **redactando los datos del cliente** igual que en los `.txt`: nombres reemplazados por ficticios con la misma capitalización (`Jane Doe`, no `JANE DOE` — la capitalización equivocada ya produjo un hallazgo falso una vez), direcciones y teléfonos por `[REDACTED ...]`. Borrar el campo `note` que marcaba el fixture como sintético.

- [ ] **Step 3: Correr los tests de la tarea 5 sin cambiarlos**

Run: `npx vitest run src/utils/essParsers/__tests__/parseAreaPrice.test.js --exclude "**/.claude/**"`

Si pasan, la lectura posicional queda confirmada. **Si fallan, el que está mal es el parser, no el test**: los valores esperados (`White`, `Silver Drift (Ctop)`, `Flat`) salen del PDF que Luis mostró en pantalla y son la verdad. Ajustar `parseAreaPrice.js` hasta que pasen.

- [ ] **Step 4: Agregar los otros dos ambientes**

```js
it('reads MWIC, whose second color and fronts are both n/a', () => {
  const result = parseAreaPriceRow([mwicPage]);
  expect(result.color).toBe('dune elm (white tossini elm)');
  expect(result.secondColor).toBe('n/a');
});

it('reads RIC, whose second color is a dash', () => {
  const result = parseAreaPriceRow([ricPage]);
  expect(result.color).toBe('White');
  expect(result.fronts).toBe('Flat');
});
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/essParsers/__tests__/fixtures/quotes/
git commit -m "test(ess): validate Area Price parsing against real quote positions"
```

---

## Verificación final en el navegador

Nada de esto prueba el camino completo contra Firebase real. Después de la tarea 7:

1. `npm run dev`, entrar como super admin, abrir la pestaña ESS.
2. En un SO limpio, subir Contract, Summary, Drawings y **dos** Quotes de ambientes distintos.
3. Confirmar que dice "2 ambientes" y lista los dos nombres.
4. Quitar uno y confirmar que el conteo baja.
5. Generar y abrir la ESS: verificar `ROOM(S)` y `COLOR` en cada página, y que la cantidad de páginas coincida con la cantidad de conjuntos de colores distintos.
6. Confirmar en la Firebase Console que `ess_files/{SO}/quote` (singular, del modelo viejo) ya no existe.

## Lo que este plan deja afuera

- **Los ítems del Quote** (`Accessories`: barrales, herrajes). `ITEM_LINE_RE` busca un formato que no existe en los Quotes reales. Es el rewrite grande del parser, con su propio spec.
- **El cruce contra el Summary** para detectar Quotes faltantes. Necesita un Summary multi-ambiente de muestra.
- **La calibración de `parseContract`** (`DEPOSIT_RE`, `BASEBOARDS_RE`), bloqueada por el volcado del Contract real.
- **`PDFGeneratorModal` e `IPGeneratorModal`**, que comparten CSS con el modal de ESS pero no su flujo de archivos.
