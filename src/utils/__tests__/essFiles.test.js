import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firebase RTDB wiring so saveEssFile/loadEssFileIndexEntry run their
// real logic against a controllable stub.
const get = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock('../firebase', () => ({
  db: {},                       // truthy → module proceeds
  isConfigured: true,
  ref: (_db, path) => ({ path: path ?? null }),
  get: (...a) => get(...a),
  update: (...a) => update(...a),
  remove: (...a) => remove(...a),
}));

import { fileToBase64, base64ToArrayBuffer, validateFileSize, saveEssFile, loadEssFileIndexEntry, MAX_ESS_PDF_BYTES, markForPurge, clearPurgeMark, purgeEssFiles, addEssQuote, removeEssQuote, loadEssQuoteIndex, loadEssQuotes } from '../essFiles';

const snap = (exists, val) => ({ exists: () => exists, val: () => val });

beforeEach(() => {
  get.mockReset();
  update.mockReset();
  remove.mockReset();
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

describe('markForPurge', () => {
  it('writes the mark inside the existing index node, creating no new node', async () => {
    update.mockResolvedValue(undefined);
    await markForPurge('12485', '2026-08-11T12:00:00.000Z');

    expect(update).toHaveBeenCalledTimes(1);
    const [refArg, payload] = update.mock.calls[0];
    expect(refArg).toEqual({ path: 'ess_file_index/12485' });
    expect(payload).toEqual({ purgeMarkedAt: '2026-08-11T12:00:00.000Z' });
  });
});

describe('clearPurgeMark', () => {
  it('removes only the mark field, leaving the file metadata intact', async () => {
    remove.mockResolvedValue(undefined);
    await clearPurgeMark('12485');

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ path: 'ess_file_index/12485/purgeMarkedAt' });
  });
});

describe('purgeEssFiles', () => {
  it('deletes the heavy node before the index, so a mid-failure stays retryable', async () => {
    remove.mockResolvedValue(undefined);
    await purgeEssFiles('12485');

    expect(remove.mock.calls.map(([r]) => r.path)).toEqual([
      'ess_files/12485',
      'ess_file_index/12485',
    ]);
  });

  it('leaves the index in place when deleting the files node fails', async () => {
    // The index is what makes the project visible to the next sweep. Losing it
    // first would strand megabytes of Base64 that nothing references.
    remove.mockRejectedValueOnce(new Error('permission denied'));
    await expect(purgeEssFiles('12485')).rejects.toThrow('permission denied');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0][0]).toEqual({ path: 'ess_files/12485' });
  });
});

const pdf = (name = 'Room 2.pdf') => new File([new Uint8Array([1, 2, 3])], name, { type: 'application/pdf' });

describe('addEssQuote', () => {
  it('writes the heavy node and the index in one atomic update', async () => {
    update.mockResolvedValue();
    const quoteId = await addEssQuote('12116', pdf(), 'Garage');

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][1];
    expect(payload[`ess_files/12116/quotes/${quoteId}`]).toMatchObject({
      name: 'Room 2.pdf', mimeType: 'application/pdf', area: 'Garage',
    });
    expect(payload[`ess_file_index/12116/quotes/${quoteId}`]).toMatchObject({
      name: 'Room 2.pdf', area: 'Garage',
    });
  });

  it('keeps the Base64 out of the index entry', async () => {
    update.mockResolvedValue();
    const quoteId = await addEssQuote('12116', pdf(), 'Garage');
    const payload = update.mock.calls[0][1];
    expect(payload[`ess_files/12116/quotes/${quoteId}`].data).toBeTruthy();
    expect(payload[`ess_file_index/12116/quotes/${quoteId}`].data).toBeUndefined();
  });

  // Sin esto quedan megabytes de Base64 huérfanos del modelo de ranura única
  // hasta que se dispare la retención.
  it('clears the legacy single-quote keys in the same write', async () => {
    update.mockResolvedValue();
    await addEssQuote('12116', pdf(), 'Garage');
    const payload = update.mock.calls[0][1];
    expect(payload['ess_files/12116/quote']).toBeNull();
    expect(payload['ess_file_index/12116/quote']).toBeNull();
  });

  it('gives two quotes different ids', async () => {
    update.mockResolvedValue();
    const first = await addEssQuote('12116', pdf(), 'Garage');
    const second = await addEssQuote('12116', pdf(), 'MWIC');
    expect(first).not.toBe(second);
  });

  it('stores a null area when detection failed', async () => {
    update.mockResolvedValue();
    const quoteId = await addEssQuote('12116', pdf(), null);
    const payload = update.mock.calls[0][1];
    expect(payload[`ess_file_index/12116/quotes/${quoteId}`].area).toBeNull();
  });

  it('rejects an oversized file before touching the database', async () => {
    const huge = { size: MAX_ESS_PDF_BYTES + 1, name: 'big.pdf', type: 'application/pdf' };
    await expect(addEssQuote('12116', huge, 'Garage')).rejects.toThrow('FILE_TOO_LARGE');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('removeEssQuote', () => {
  // Mismo orden que purgeEssFiles: primero el nodo pesado. Si falla en el
  // medio queda el índice apuntando a algo que no está — visible y
  // reintentable — y no Base64 sin nada que lo referencie.
  it('removes the heavy node before the index entry', async () => {
    remove.mockResolvedValue();
    await removeEssQuote('12116', 'q_1');
    expect(remove.mock.calls.map(c => c[0].path)).toEqual([
      'ess_files/12116/quotes/q_1',
      'ess_file_index/12116/quotes/q_1',
    ]);
  });
});

describe('loadEssQuoteIndex', () => {
  it('returns the stored entries', async () => {
    get.mockResolvedValue(snap(true, { q_1: { name: 'a.pdf', area: 'Garage' } }));
    await expect(loadEssQuoteIndex('12116')).resolves.toEqual({ q_1: { name: 'a.pdf', area: 'Garage' } });
  });

  it('returns an empty object when the project has no quotes', async () => {
    get.mockResolvedValue(snap(false, null));
    await expect(loadEssQuoteIndex('12116')).resolves.toEqual({});
  });
});

describe('loadEssQuotes', () => {
  it('returns an array carrying each quote id', async () => {
    get.mockResolvedValue(snap(true, {
      q_1: { name: 'a.pdf', data: 'AAA', area: 'Garage' },
      q_2: { name: 'b.pdf', data: 'BBB', area: 'MWIC' },
    }));
    const quotes = await loadEssQuotes('12116');
    expect(quotes).toHaveLength(2);
    expect(quotes.map(q => q.quoteId)).toEqual(['q_1', 'q_2']);
    expect(quotes[0].data).toBe('AAA');
  });

  it('returns an empty array when the project has no quotes', async () => {
    get.mockResolvedValue(snap(false, null));
    await expect(loadEssQuotes('12116')).resolves.toEqual([]);
  });
});
