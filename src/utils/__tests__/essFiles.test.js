import { describe, it, expect } from 'vitest';
import { fileToBase64, base64ToArrayBuffer, validateFileSize, MAX_ESS_PDF_BYTES } from '../essFiles';

describe('fileToBase64 / base64ToArrayBuffer', () => {
  it('round-trips arbitrary bytes without loss', async () => {
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 65, 66, 67]);
    const file = new File([original], 'test.pdf', { type: 'application/pdf' });
    const base64 = await fileToBase64(file);
    const roundTripped = new Uint8Array(base64ToArrayBuffer(base64));
    expect(Array.from(roundTripped)).toEqual(Array.from(original));
  });
});

describe('validateFileSize', () => {
  it('accepts a file under the limit', () => {
    const file = new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' });
    expect(validateFileSize(file)).toEqual({ valid: true });
  });

  it('rejects a file over the limit', () => {
    const oversized = { size: MAX_ESS_PDF_BYTES + 1 };
    expect(validateFileSize(oversized)).toEqual({ valid: false, reason: 'FILE_TOO_LARGE' });
  });
});

describe('MAX_ESS_PDF_BYTES', () => {
  it('is 8MB', () => {
    expect(MAX_ESS_PDF_BYTES).toBe(8 * 1024 * 1024);
  });
});
