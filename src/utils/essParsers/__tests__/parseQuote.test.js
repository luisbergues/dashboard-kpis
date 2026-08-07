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
