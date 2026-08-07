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
  }).catch(() => {
    // Ignore import errors in dev/test environments
  });
}

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
