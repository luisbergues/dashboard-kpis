import { describe, it, expect } from 'vitest';
import { hasReachedNesting } from '../essRetention';

describe('hasReachedNesting', () => {
  it('is true at NESTING, the moment the PDFs stop being needed', () => {
    expect(hasReachedNesting({ status: 'NESTING' })).toBe(true);
  });

  it('is true past nesting, at INSTALL and COMPLETED', () => {
    expect(hasReachedNesting({ status: 'INSTALL' })).toBe(true);
    expect(hasReachedNesting({ status: 'COMPLETED' })).toBe(true);
  });

  it('is false while the project is still being engineered', () => {
    expect(hasReachedNesting({ status: 'ENGINEERING' })).toBe(false);
    expect(hasReachedNesting({ status: 'CHECK ENG.' })).toBe(false);
    expect(hasReachedNesting({ status: 'PAPERWORK' })).toBe(false);
    expect(hasReachedNesting({ status: 'CHECK' })).toBe(false);
  });

  it('ignores casing and surrounding whitespace, which the sheet is full of', () => {
    expect(hasReachedNesting({ status: '  nesting  ' })).toBe(true);
  });

  it('is false for a status the sheet uses but the stage map does not know', () => {
    expect(hasReachedNesting({ status: 'ON HOLD' })).toBe(false);
  });

  it('is false rather than throwing when status is missing entirely', () => {
    expect(hasReachedNesting({ status: '' })).toBe(false);
    expect(hasReachedNesting({ status: null })).toBe(false);
    expect(hasReachedNesting({})).toBe(false);
    expect(hasReachedNesting(null)).toBe(false);
    expect(hasReachedNesting(undefined)).toBe(false);
  });
});
