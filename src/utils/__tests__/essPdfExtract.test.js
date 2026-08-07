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
