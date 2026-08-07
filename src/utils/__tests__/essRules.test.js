import { describe, it, expect } from 'vitest';
import { translateColor, calcPrfvWidth, calcDovetailWidth, calcHangRodLength, calcBackingDepth, BORING_PATTERN_MM } from '../essRules';

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
