import { describe, it, expect } from 'vitest';
import { sanitizeFirebaseKey } from './firebaseKeys.js';

describe('sanitizeFirebaseKey', () => {
  it('leaves a normal SO number untouched', () => {
    expect(sanitizeFirebaseKey('12345')).toBe('12345');
  });

  it('coerces a numeric SO to a string', () => {
    expect(sanitizeFirebaseKey(12345)).toBe('12345');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeFirebaseKey('  12345  ')).toBe('12345');
  });

  it('replaces a period (RTDB-illegal)', () => {
    expect(sanitizeFirebaseKey('12345.0')).toBe('12345_0');
  });

  it('replaces a forward slash', () => {
    expect(sanitizeFirebaseKey('1234/5')).toBe('1234_5');
  });

  it('replaces a hash, as in a spilled #N/A formula error', () => {
    expect(sanitizeFirebaseKey('#N/A')).toBe('_N_A');
  });

  it('replaces every illegal character in one pass', () => {
    expect(sanitizeFirebaseKey('a.b#c$d[e]f/g')).toBe('a_b_c_d_e_f_g');
  });

  it('returns empty string for null', () => {
    expect(sanitizeFirebaseKey(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeFirebaseKey(undefined)).toBe('');
  });

  it('returns empty string for an empty or whitespace-only value', () => {
    expect(sanitizeFirebaseKey('')).toBe('');
    expect(sanitizeFirebaseKey('   ')).toBe('');
  });
});
