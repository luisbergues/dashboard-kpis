import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Firebase RTDB wiring so readArchiveMap/writeArchiveMap run their real
// logic against a controllable stub.
const get = vi.fn();
const set = vi.fn();
vi.mock('../firebase', () => ({
  db: {},                       // truthy → module proceeds
  ref: (_db, path) => ({ path }),
  get: (...a) => get(...a),
  set: (...a) => set(...a),
}));

import { readArchiveMap, writeArchiveMap } from '../archiveStore';

const snap = (exists, val) => ({ exists: () => exists, val: () => val });

beforeEach(() => {
  get.mockReset();
  set.mockReset();
});

describe('archiveStore.readArchiveMap — fail-safe reads (data-loss guard)', () => {
  it('returns {} when the archive node does not exist yet', async () => {
    get.mockResolvedValue(snap(false, null));
    await expect(readArchiveMap('archive/x')).resolves.toEqual({});
  });

  it('returns the stored map when the node exists', async () => {
    get.mockResolvedValue(snap(true, { '100': { so: '100' } }));
    await expect(readArchiveMap('archive/x')).resolves.toEqual({ '100': { so: '100' } });
  });

  it('THROWS on a read error (permission denied / network) so callers do not overwrite', async () => {
    get.mockRejectedValue(new Error('permission_denied'));
    await expect(readArchiveMap('archive/x')).rejects.toThrow('permission_denied');
  });

  it('writeArchiveMap sets the map at the given path', async () => {
    set.mockResolvedValue(undefined);
    await writeArchiveMap('archive/x', { '100': { so: '100' } });
    expect(set).toHaveBeenCalledTimes(1);
    const [refArg, payload] = set.mock.calls[0];
    expect(refArg).toEqual({ path: 'archive/x' });
    expect(payload).toEqual({ '100': { so: '100' } });
  });
});
