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

  it('does not let two openings bind to the same HEIGHT label', () => {
    // Both OPENING labels sit within MAX_LABEL_DISTANCE of the single HEIGHT
    // label. Without claiming labels, the second opening would re-bind that
    // HEIGHT and silently take "31" — a number belonging to the first
    // opening's callout. It must come back with no height, and the leftover
    // number must surface as unclassified instead of being guessed.
    const items = [
      { text: 'MASTER WIC', x: 100, y: 700 },
      { text: 'OPENING', x: 0, y: 100 },
      { text: '24', x: 2, y: 100 },
      { text: 'OPENING', x: 0, y: 80 },
      { text: '20', x: 2, y: 80 },
      { text: 'HEIGHT', x: 0, y: 60 },
      { text: '30', x: 2, y: 60 },
      { text: '31', x: 4, y: 58 },
    ];
    const result = parseDrawingPages([{ pageNumber: 1, items }]);
    expect(result.areas[0].openings).toHaveLength(2);
    expect(result.areas[0].openings[0]).toMatchObject({ width: 24, height: 30 });
    expect(result.areas[0].openings[1]).toMatchObject({ width: 20, height: null });
    expect(result.areas[0].unclassified).toContain('31');
    expect(result.warnings.some(w => w.startsWith('UNCLASSIFIED_NUMBERS'))).toBe(true);
  });

  it('parses dimensions written as whole-plus-fraction, the format this shop uses', () => {
    // The decimal-only NUMBER_RE this parser shipped with skipped these
    // entirely, so a real drawing produced an opening-less area and the draft
    // came out empty with no indication anything had been missed.
    const items = [
      { text: 'MASTER WIC', x: 50, y: 700 },
      { text: 'OPENING', x: 100, y: 500 },
      { text: '23 5/8"', x: 130, y: 498 },
      { text: 'HEIGHT', x: 100, y: 470 },
      { text: '84-1/2"', x: 130, y: 468 },
      { text: 'DEPTH', x: 100, y: 440 },
      { text: '14', x: 130, y: 438 },
    ];
    const result = parseDrawingPages([{ pageNumber: 1, items }]);
    expect(result.areas[0].openings[0]).toEqual({ width: 23.625, height: 84.5, depth: 14 });
    expect(result.areas[0].unclassified).toEqual([]);
  });

  it('surfaces an unparseable dimension verbatim instead of dropping it', () => {
    const items = [
      { text: 'MASTER WIC', x: 50, y: 700 },
      { text: 'OPENING', x: 100, y: 500 },
      { text: '12 3/4"', x: 130, y: 498 },
      { text: '19 7/8"', x: 400, y: 100 },
    ];
    const result = parseDrawingPages([{ pageNumber: 1, items }]);
    expect(result.areas[0].openings[0].width).toBe(12.75);
    expect(result.areas[0].unclassified).toContain('19 7/8"');
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
