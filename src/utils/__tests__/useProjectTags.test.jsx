// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

let emit = null;
const defaultOnValue = (_r, cb) => { emit = cb; return () => {}; };
const onValue = vi.fn(defaultOnValue);
const markTagRead = vi.fn(async () => {});

vi.mock('../firebase', () => ({
  db: {},
  ref: (_db, path) => ({ path }),
  onValue: (...a) => onValue(...a),
}));
vi.mock('../noteTags', () => ({ markTagRead: (...a) => markTagRead(...a) }));

import { useProjectTags } from '../useProjectTags';

const tag = (over = {}) => ({
  noteId: 'n1', taggedUid: 'u-santi', taggedName: 'Santiago',
  taggedByUid: 'u-luis', taggedByName: 'Luis',
  createdAt: '2026-08-24T10:00:00.000Z', readAt: null, ...over,
});

const notes = { '100': [{ id: 'n1', _key: 'n1' }] };
const user = { uid: 'u-santi' };

beforeEach(() => {
  emit = null;
  onValue.mockReset().mockImplementation(defaultOnValue);
  markTagRead.mockReset().mockImplementation(async () => {});
});

describe('useProjectTags', () => {
  it('se suscribe a project_tags UNA sola vez', () => {
    renderHook(() => useProjectTags(user, notes));
    expect(onValue).toHaveBeenCalledTimes(1);
    expect(onValue.mock.calls[0][0].path).toBe('project_tags');
  });

  it('expone las tres proyecciones cuando llega el snapshot', async () => {
    const { result } = renderHook(() => useProjectTags(user, notes));
    emit({ val: () => ({ '100': { t1: tag() } }) });

    await waitFor(() => expect(result.current.unreadByProject).toEqual({ '100': 1 }));
    expect(result.current.unreadForMe.map(t => t.id)).toEqual(['t1']);
    expect(result.current.tagsByNote['100::n1']).toHaveLength(1);
  });

  it('no cuenta como propio un tag dirigido a otro', async () => {
    const { result } = renderHook(() => useProjectTags(user, notes));
    emit({ val: () => ({ '100': { t1: tag({ taggedUid: 'u-juli' }) } }) });

    await waitFor(() => expect(result.current.unreadByProject).toEqual({ '100': 1 }));
    expect(result.current.unreadForMe).toEqual([]);
  });

  it('descarta el tag cuya nota ya no existe', async () => {
    const { result } = renderHook(() => useProjectTags(user, {}));
    emit({ val: () => ({ '100': { t1: tag() } }) });

    await waitFor(() => expect(result.current.unreadByProject).toEqual({}));
  });

  it('arranca vacio, sin romper antes del primer snapshot', () => {
    const { result } = renderHook(() => useProjectTags(user, notes));
    expect(result.current.unreadByProject).toEqual({});
    expect(result.current.unreadForMe).toEqual([]);
    expect(result.current.tagsByNote).toEqual({});
  });

  it('markRead delega en noteTags', async () => {
    const { result } = renderHook(() => useProjectTags(user, notes));
    await result.current.markRead('100', 't1');
    expect(markTagRead).toHaveBeenCalledWith({ so: '100', tagId: 't1' });
  });

  it('no re-suscribe cuando cambian las notas', () => {
    const { rerender } = renderHook(({ n }) => useProjectTags(user, n), {
      initialProps: { n: notes },
    });
    rerender({ n: { '100': [{ id: 'n1', _key: 'n1' }, { id: 'n2', _key: 'n2' }] } });
    expect(onValue).toHaveBeenCalledTimes(1);
  });
});
