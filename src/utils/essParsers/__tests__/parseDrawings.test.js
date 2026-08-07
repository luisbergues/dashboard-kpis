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
