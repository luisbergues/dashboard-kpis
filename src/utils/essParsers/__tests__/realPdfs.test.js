import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractPdfPages, pagesToPlainText } from '../../essPdfExtract';
import { parseContractText, looksLikeContract } from '../parseContract';
import { parseQuoteText, looksLikeQuote } from '../parseQuote';
import { parseDrawingPages, looksLikeDrawing } from '../parseDrawings';
import { buildEssPages } from '../../essMatcher';

// Calibration harness. Every other test in this suite feeds the parsers
// synthetic input that was written to match the regexes — which means they can
// all pass while the parsers silently produce an empty draft from a real
// document. This is the only test that can tell those two apart, and it only
// runs once someone drops real PDFs in fixtures/ (see the README there).
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const paths = {
  contract: join(FIXTURES, 'contract.pdf'),
  quote: join(FIXTURES, 'quote.pdf'),
  drawings: join(FIXTURES, 'drawings.pdf'),
};
const hasFixtures = Object.values(paths).every(existsSync);

function toArrayBuffer(path) {
  const buffer = readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe.skipIf(!hasFixtures)('real sample PDFs', () => {
  it('reads text out of all three documents', async () => {
    const contract = await extractPdfPages(toArrayBuffer(paths.contract));
    const quote = await extractPdfPages(toArrayBuffer(paths.quote));
    const drawings = await extractPdfPages(toArrayBuffer(paths.drawings));

    // A scanned PDF has pages but no text items — the app reports this as
    // "is this a scan?" rather than generating a blank draft.
    expect(pagesToPlainText(contract).trim().length).toBeGreaterThan(0);
    expect(pagesToPlainText(quote).trim().length).toBeGreaterThan(0);
    expect(drawings.some(page => page.items.length > 0)).toBe(true);
  });

  it('recognises each document as the type it is', async () => {
    const contract = await extractPdfPages(toArrayBuffer(paths.contract));
    const quote = await extractPdfPages(toArrayBuffer(paths.quote));
    const drawings = await extractPdfPages(toArrayBuffer(paths.drawings));

    expect(looksLikeContract(pagesToPlainText(contract))).toBe(true);
    expect(looksLikeQuote(pagesToPlainText(quote))).toBe(true);
    expect(looksLikeDrawing(drawings)).toBe(true);
  });

  it('finds areas in the Quote', async () => {
    const pages = await extractPdfPages(toArrayBuffer(paths.quote));
    const quote = parseQuoteText(pagesToPlainText(pages));
    expect(quote.warnings).not.toContain('NO_AREAS_FOUND');
    expect(quote.areas.length).toBeGreaterThan(0);
    expect(quote.areas.some(area => area.items.length > 0)).toBe(true);
  });

  it('finds openings with real dimensions in the Drawings', async () => {
    const pages = await extractPdfPages(toArrayBuffer(paths.drawings));
    const drawings = parseDrawingPages(pages);
    expect(drawings.warnings).not.toContain('NO_OPENINGS_FOUND');
    const widths = drawings.areas.flatMap(a => a.openings).map(o => o.width).filter(w => w != null);
    expect(widths.length).toBeGreaterThan(0);
    // Closet openings are inches, not millimetres or points. A parse that
    // grabbed the wrong numbers off the page usually shows up here first.
    widths.forEach(width => {
      expect(width).toBeGreaterThan(4);
      expect(width).toBeLessThan(200);
    });
  });

  it('produces a draft whose areas actually matched between Quote and Drawings', async () => {
    const [contractPages, quotePages, drawingPages] = await Promise.all([
      extractPdfPages(toArrayBuffer(paths.contract)),
      extractPdfPages(toArrayBuffer(paths.quote)),
      extractPdfPages(toArrayBuffer(paths.drawings)),
    ]);

    const result = buildEssPages({
      project: { so: '0000', name: 'Fixture Project' },
      contract: parseContractText(pagesToPlainText(contractPages)),
      quote: parseQuoteText(pagesToPlainText(quotePages)),
      drawings: parseDrawingPages(drawingPages),
    });

    // Printed on failure so a miscalibration is diagnosable from the run
    // itself rather than needing a debugger.
    const diagnostics = JSON.stringify({
      pages: result.pages.length,
      drawersPerPage: result.pages.map(p => p.drawers.length),
      unmatchedQuoteItems: result.unmatchedQuoteItems.length,
      unmatchedDrawingOpenings: result.unmatchedDrawingOpenings.length,
      warnings: result.warnings,
    }, null, 2);

    expect(result.pages.length, diagnostics).toBeGreaterThan(0);
    expect(result.pages.some(page => page.drawers.length > 0), diagnostics).toBe(true);
  });
});
