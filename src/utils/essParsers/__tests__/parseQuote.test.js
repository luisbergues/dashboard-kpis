import { describe, it, expect } from 'vitest';
import { parseQuoteText, looksLikeQuote, detectQuoteArea } from '../parseQuote';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

  // The project record coming off the Google Sheet has no color field at all,
  // so the Quote is the only place the commercial color exists. Without this
  // the shop code translation downstream had nothing to translate.
  it('picks up the color from a labelled Color: line', () => {
    const result = parseQuoteText('Color: Snow White\nMASTER WIC\nValet Rod - VR-100 - Qty: 2');
    expect(result.color).toBe('Snow White');
  });

  it('accepts Finish: as the label too', () => {
    const result = parseQuoteText('FINISH: Bleached Linen\nMASTER WIC\nValet Rod - VR-100 - Qty: 2');
    expect(result.color).toBe('Bleached Linen');
  });

  it('recognises a known color on a line of its own, with no label', () => {
    const result = parseQuoteText('JL CLOSETS\nBLEACHED LINEN\nMASTER WIC\nValet Rod - VR-100 - Qty: 2');
    expect(result.color).toBe('BLEACHED LINEN');
  });

  it('does not also count the bare color line as an empty area', () => {
    // 'BLEACHED LINEN' satisfies AREA_HEADER_RE as readily as 'MASTER WIC'
    // does, so without excluding it the draft gains a page with no openings
    // and no items on it.
    const result = parseQuoteText('BLEACHED LINEN\nMASTER WIC\nValet Rod - VR-100 - Qty: 2');
    expect(result.areas.map(a => a.name)).toEqual(['MASTER WIC']);
  });

  it('does not mistake an area header for a color', () => {
    const result = parseQuoteText(sampleQuote);
    expect(result.color).toBeNull();
  });

  it('warns when no color could be found, rather than silently leaving it blank', () => {
    const result = parseQuoteText(sampleQuote);
    expect(result.warnings).toContain('COLOR_NOT_FOUND');
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
