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
