import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firebase wiring so readArchiveMap/writeArchiveMap run their real
// logic against controllable stubs.
const getDownloadURL = vi.fn();
vi.mock('../firebase', () => ({
  storage: {},                    // truthy → module proceeds
  storageRef: vi.fn(() => ({})),
  getDownloadURL: (...a) => getDownloadURL(...a),
}));
const uploadString = vi.fn();
vi.mock('firebase/storage', () => ({
  uploadString: (...a) => uploadString(...a),
}));

import { readArchiveMap, writeArchiveMap } from '../storageArchive';

describe('storageArchive.readArchiveMap — fail-safe reads (data-loss guard)', () => {
  beforeEach(() => {
    getDownloadURL.mockReset();
    uploadString.mockReset();
    vi.unstubAllGlobals();
  });

  it('returns {} when the archive file does not exist yet (first run)', async () => {
    getDownloadURL.mockRejectedValue({ code: 'storage/object-not-found' });
    await expect(readArchiveMap('archive/x.json')).resolves.toEqual({});
  });

  it('returns the parsed archive when the file exists', async () => {
    getDownloadURL.mockResolvedValue('https://download/url');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ '100': { so: '100' } }) })));
    await expect(readArchiveMap('archive/x.json')).resolves.toEqual({ '100': { so: '100' } });
  });

  it('THROWS on a transient HTTP error (so callers do NOT overwrite with empty)', async () => {
    getDownloadURL.mockResolvedValue('https://download/url');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(readArchiveMap('archive/x.json')).rejects.toThrow();
  });

  it('THROWS on a network error during fetch', async () => {
    getDownloadURL.mockResolvedValue('https://download/url');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(readArchiveMap('archive/x.json')).rejects.toThrow('network down');
  });

  it('THROWS on a generic getDownloadURL failure (not treated as empty)', async () => {
    getDownloadURL.mockRejectedValue({ code: 'storage/retry-limit-exceeded' });
    await expect(readArchiveMap('archive/x.json')).rejects.toBeDefined();
  });

  it('writeArchiveMap serializes the map to the given path as JSON', async () => {
    uploadString.mockResolvedValue(undefined);
    await writeArchiveMap('archive/x.json', { '100': { so: '100' } });
    expect(uploadString).toHaveBeenCalledTimes(1);
    const [, payload, format, meta] = uploadString.mock.calls[0];
    expect(JSON.parse(payload)).toEqual({ '100': { so: '100' } });
    expect(format).toBe('raw');
    expect(meta).toEqual({ contentType: 'application/json' });
  });
});
