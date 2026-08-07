import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firebase RTDB wiring so saveEssFile/loadEssFileIndexEntry run their
// real logic against a controllable stub.
const get = vi.fn();
const update = vi.fn();
vi.mock('../firebase', () => ({
  db: {},                       // truthy → module proceeds
  isConfigured: true,
  ref: (_db, path) => ({ path: path ?? null }),
  get: (...a) => get(...a),
  update: (...a) => update(...a),
}));

import { fileToBase64, base64ToArrayBuffer, validateFileSize, saveEssFile, loadEssFileIndexEntry, MAX_ESS_PDF_BYTES } from '../essFiles';

const snap = (exists, val) => ({ exists: () => exists, val: () => val });

beforeEach(() => {
  get.mockReset();
  update.mockReset();
});

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
  // 7MB, not 8: Base64 inflates by ~33% and RTDB rejects any single string
  // over 10MB, so an 8MB file (~10.67MB encoded) would pass validation here
  // and then fail the write.
  it('is 7MB, leaving the Base64-encoded payload under RTDB\'s 10MB string limit', () => {
    expect(MAX_ESS_PDF_BYTES).toBe(7 * 1024 * 1024);
    expect(MAX_ESS_PDF_BYTES * 4 / 3).toBeLessThan(10 * 1024 * 1024);
  });
});

describe('saveEssFile', () => {
  it('writes the full record and the metadata index in one atomic multi-path update', async () => {
    update.mockResolvedValue(undefined);
    const file = new File([new Uint8Array([1, 2, 3])], 'contract.pdf', { type: 'application/pdf' });

    await saveEssFile('12485', 'contract', file);

    expect(update).toHaveBeenCalledTimes(1);
    const [refArg, payload] = update.mock.calls[0];
    expect(refArg).toEqual({ path: null });   // root ref: multi-path update
    expect(Object.keys(payload).sort()).toEqual([
      'ess_file_index/12485/contract',
      'ess_files/12485/contract',
    ]);

    const full = payload['ess_files/12485/contract'];
    const index = payload['ess_file_index/12485/contract'];
    expect(full.name).toBe('contract.pdf');
    expect(full.mimeType).toBe('application/pdf');
    expect(typeof full.data).toBe('string');
    expect(full.data.length).toBeGreaterThan(0);

    // The index must never carry the Base64 payload — that is the whole point
    // of having it.
    expect(index).toEqual({ name: 'contract.pdf', uploadedAt: full.uploadedAt });
    expect(index.data).toBeUndefined();
    expect(index.mimeType).toBeUndefined();
  });

  it('rejects an oversized file without writing anything', async () => {
    await expect(saveEssFile('12485', 'quote', { size: MAX_ESS_PDF_BYTES + 1 })).rejects.toThrow('FILE_TOO_LARGE');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('loadEssFileIndexEntry', () => {
  it('reads the metadata index node, not the full-file node', async () => {
    get.mockResolvedValue(snap(true, { name: 'quote.pdf', uploadedAt: '2026-08-06T00:00:00.000Z' }));
    const entry = await loadEssFileIndexEntry('12485', 'quote');
    expect(get).toHaveBeenCalledWith({ path: 'ess_file_index/12485/quote' });
    expect(entry).toEqual({ name: 'quote.pdf', uploadedAt: '2026-08-06T00:00:00.000Z' });
  });

  it('returns null when nothing was uploaded for that slot', async () => {
    get.mockResolvedValue(snap(false, null));
    await expect(loadEssFileIndexEntry('12485', 'drawings')).resolves.toBeNull();
  });
});
