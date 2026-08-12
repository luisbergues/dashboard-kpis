import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure the real web worker to offload PDF parsing from the main thread.
// Without this, pdf.js falls back to a synchronous fake-worker that freezes
// the UI. We use Vite's ?url import to resolve the worker URL in browser
// builds. This is pdfjs-dist's standard integration pattern for bundler-based
// apps. In Node (test) environments, the worker is force-disabled by pdfjs-dist
// regardless.
// Runs entirely client-side (no server round-trip) so we get each text item's
// x/y position, not just plain text — parseDrawings.js needs that position to
// tell an opening width apart from a drawer width or a height callout on the
// same drawing page. We use the legacy build for broader compatibility with
// bundler-based apps.
if (typeof window !== 'undefined' && !import.meta.env.SSR) {
  import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url').then(({ default: pdfWorkerUrl }) => {
    if (pdfWorkerUrl) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    }
  }).catch((error) => {
    console.error('Failed to load pdf.js worker; PDF parsing will fall back to the main thread and may freeze the UI on large files:', error);
  });
}

export async function extractPdfPages(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    // width/height are what let pagesToPlainText tell "two halves of one word"
    // apart from "two table columns" — pdf.js only volunteers a synthetic
    // space fragment when the content stream happens to run left to right.
    const items = textContent.items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    }));
    pages.push({ pageNumber, items });
  }
  return pages;
}

// pdf.js hands back text fragments in content-stream order and carries no line
// structure of its own, so the page has to be re-assembled from the fragments'
// positions: group them by baseline (y), then read each group left to right
// (x). Fragments on one visual line usually share an exact y; the tolerance
// covers the drift from a font-size change mid-line.
const LINE_TOLERANCE = 3;

// Two fragments belong to the same word when they sit flush against each
// other — a font change mid-word leaves no gap. A gap of about a quarter of
// the font's own height is the narrowest thing a reader would call a space,
// so anything wider gets one. Gluing 'Included' to '1722.00' would destroy
// both the word and the number, so a fragment of unknown extent is treated
// as a separate token rather than risked.
function needsSpace(previous, next) {
  if (/\s$/.test(previous.text) || /^\s/.test(next.text)) return false;
  if (!Number.isFinite(previous.width)) return true;
  const gap = next.x - (previous.x + previous.width);
  const threshold = Number.isFinite(previous.height) ? Math.max(1, previous.height * 0.25) : 1;
  return gap > threshold;
}

function joinRow(items) {
  return items
    .reduce((row, item, index) => {
      if (index > 0 && needsSpace(items[index - 1], item)) row.push(' ');
      row.push(item.text);
      return row;
    }, [])
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageToLines(page) {
  const sorted = [...page.items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  let current = null;
  for (const item of sorted) {
    // The anchor stays the line's first y so a slowly drifting run of
    // fragments can't ratchet its way into swallowing the next line.
    if (current && Math.abs(item.y - current.y) <= LINE_TOLERANCE) {
      current.items.push(item);
    } else {
      current = { y: item.y, items: [item] };
      lines.push(current);
    }
  }
  return lines
    .map(line => joinRow(line.items.sort((a, b) => a.x - b.x)))
    .filter(Boolean);
}

export function pagesToPlainText(pages) {
  return pages.flatMap(pageToLines).join('\n');
}
