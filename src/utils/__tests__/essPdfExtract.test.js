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

function textLines(pages) {
  return pagesToPlainText(pages).split('\n').map(l => l.trim()).filter(Boolean);
}

describe('pagesToPlainText', () => {
  it('joins every item across every page into one string', async () => {
    const arrayBuffer = makeTestPdfArrayBuffer('HELLO WORLD');
    const pages = await extractPdfPages(arrayBuffer);
    expect(pagesToPlainText(pages)).toContain('HELLO');
  });

  // Every regex in parseQuote.js is anchored with ^...$. Collapsing a page
  // into a single line makes all of them structurally unmatchable, which is
  // what NO_AREAS_FOUND on a real Quote turned out to be.
  it('emits one line per row of the page, not one line per page', async () => {
    const doc = new jsPDF();
    doc.text('Area:', 10, 20);
    doc.text('MWIC', 10, 30);
    const pages = await extractPdfPages(doc.output('arraybuffer'));
    expect(textLines(pages)).toEqual(['Area:', 'MWIC']);
  });

  it('reads a row left to right regardless of the order pdf.js emits it', async () => {
    const doc = new jsPDF();
    doc.text('Total', 120, 20);
    doc.text('Product', 10, 20);
    const pages = await extractPdfPages(doc.output('arraybuffer'));
    expect(textLines(pages)).toEqual(['Product Total']);
  });

  // Table columns arrive as separate items with no space of their own; gluing
  // them ('Included1722.00') destroys both the word and the number.
  it('separates adjacent columns that carry no space of their own', async () => {
    const doc = new jsPDF();
    doc.text('Included', 10, 20);
    doc.text('1722.00', 60, 20);
    const pages = await extractPdfPages(doc.output('arraybuffer'));
    expect(textLines(pages)).toEqual(['Included 1722.00']);
  });

  it('keeps rows of different pages apart', async () => {
    const doc = new jsPDF();
    doc.text('Area:', 10, 20);
    doc.addPage();
    doc.text('Garage', 10, 20);
    const pages = await extractPdfPages(doc.output('arraybuffer'));
    expect(textLines(pages)).toEqual(['Area:', 'Garage']);
  });
});
