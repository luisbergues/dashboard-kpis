import { describe, it, expect } from 'vitest';
import { translateColor, calcPrfvWidth, calcDovetailWidth, calcHangRodLength, calcBackingDepth, BORING_PATTERN_MM, parseInchValue, formatInches, essOptionsFromMaterials } from '../essRules';

describe('translateColor', () => {
  it('translates a known commercial color to its shop code', () => {
    expect(translateColor('Snow White')).toBe('White Classic 300');
  });

  it('is case-insensitive', () => {
    expect(translateColor('snow white')).toBe('White Classic 300');
  });

  it('returns null for an unknown color instead of guessing', () => {
    expect(translateColor('Mystery Color')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(translateColor('')).toBeNull();
    expect(translateColor(null)).toBeNull();
  });
});

describe('cutting formulas', () => {
  it('PRFV = opening - 1"', () => {
    expect(calcPrfvWidth(24)).toBe(23);
  });

  it('Dovetail = opening - 3/8"', () => {
    expect(calcDovetailWidth(24)).toBe(23.625);
  });

  it('hang rod length = vano - 1/4"', () => {
    expect(calcHangRodLength(30)).toBe(29.75);
  });

  it('backing depth = depth - 3/4"', () => {
    expect(calcBackingDepth(14)).toBe(13.25);
  });
});

describe('BORING_PATTERN_MM', () => {
  it('is fixed at 32mm', () => {
    expect(BORING_PATTERN_MM).toBe(32);
  });
});

// This shop writes every dimension as whole inches plus an eighths/sixteenths
// fraction ('23 5/8"'), never as a decimal — see DEFAULT_DRAWERS/DEFAULT_RODS
// in PDFGeneratorModal.jsx, which is the hand-entry precedent the generated
// draft has to be indistinguishable from.
describe('parseInchValue', () => {
  it('parses a whole number', () => {
    expect(parseInchValue('24')).toBe(24);
  });

  it('parses a whole number with an inch mark', () => {
    expect(parseInchValue('24"')).toBe(24);
  });

  it('parses whole plus fraction, the format this shop actually uses', () => {
    expect(parseInchValue('23 5/8"')).toBe(23.625);
  });

  it('parses whole plus fraction written with a hyphen', () => {
    expect(parseInchValue('23-5/8"')).toBe(23.625);
  });

  it('parses a bare fraction', () => {
    expect(parseInchValue('5/8"')).toBe(0.625);
  });

  it('still parses a plain decimal', () => {
    expect(parseInchValue('23.625')).toBe(23.625);
  });

  it('returns null for text that is not a dimension', () => {
    expect(parseInchValue('OPENING')).toBeNull();
    expect(parseInchValue('')).toBeNull();
    expect(parseInchValue(null)).toBeNull();
  });

  it('returns null for a fraction with a zero denominator instead of Infinity', () => {
    expect(parseInchValue('1/0')).toBeNull();
  });
});

describe('formatInches', () => {
  it('renders a whole number with no fraction part', () => {
    expect(formatInches(24)).toBe('24"');
  });

  it('renders eighths the way the shop writes them', () => {
    expect(formatInches(23.625)).toBe('23 5/8"');
  });

  it('reduces the fraction to lowest terms', () => {
    expect(formatInches(22.5)).toBe('22 1/2"');
  });

  it('renders a value below one inch as a bare fraction', () => {
    expect(formatInches(0.625)).toBe('5/8"');
  });

  it('rounds to the nearest 1/8, this shop\'s cutting tolerance', () => {
    expect(formatInches(23.6)).toBe('23 5/8"');
  });

  it('carries into the whole number when rounding reaches 8/8', () => {
    expect(formatInches(23.97)).toBe('24"');
  });

  it('returns an empty string for a missing value rather than "NaN"', () => {
    expect(formatInches(null)).toBe('');
    expect(formatInches(undefined)).toBe('');
  });
});

// The box type and front type are not parsed out of any PDF — they come from
// the materials matrix, the same source the hand-entered ESS modal reads.
// Keeping the mapping here is what stops the generated draft and the manual
// one from disagreeing about the same project.
describe('essOptionsFromMaterials', () => {
  it('selects DOVETAIL when the matrix says dovetail drawers', () => {
    expect(essOptionsFromMaterials({ dovetail: 'Yes' }).boxType).toBe('DOVETAIL');
  });

  it('selects PRFV when the matrix says no dovetail', () => {
    expect(essOptionsFromMaterials({ dovetail: 'No' }).boxType).toBe('PRFV');
  });

  it('selects THERMOFOIL fronts when the matrix says thermofoil', () => {
    expect(essOptionsFromMaterials({ thermofoil: 'Yes' }).fronts).toBe('THERMOFOIL');
  });

  it('selects SLAB fronts otherwise', () => {
    expect(essOptionsFromMaterials({ thermofoil: 'No' }).fronts).toBe('SLAB');
  });

  it('defaults to PRFV/SLAB when no materials row exists for the project', () => {
    expect(essOptionsFromMaterials(undefined)).toEqual({ boxType: 'PRFV', fronts: 'SLAB' });
    expect(essOptionsFromMaterials(null)).toEqual({ boxType: 'PRFV', fronts: 'SLAB' });
  });
});
