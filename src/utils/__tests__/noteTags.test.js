import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastUpdate = null;
const defaultUpdate = async (_r, patch) => { lastUpdate = patch; };
const defaultSet = async () => {};
const update = vi.fn(defaultUpdate);
const set = vi.fn(defaultSet);

vi.mock('../firebase', () => ({
  db: {},
  ref: (_db, path) => ({ path }),
  update: (...a) => update(...a),
  set: (...a) => set(...a),
}));

import { buildTags, createNoteWithTags, deleteNoteWithTags, markTagRead } from '../noteTags';

const directory = { 'u-santi': { name: 'Santiago' }, 'u-juli': { name: 'Julieta' } };
const note = { id: 'n1', text: 'revisar esto', createdAt: '2026-08-24T10:00:00.000Z', createdBy: 'Luis' };

beforeEach(() => {
  lastUpdate = null;
  update.mockReset().mockImplementation(defaultUpdate);
  set.mockReset().mockImplementation(defaultSet);
});

describe('buildTags', () => {
  const args = { so: '100', noteKey: 'n1', directory, authorUid: 'u-luis', authorName: 'Luis' };

  it('arma un tag por destinatario, con nombre denormalizado', () => {
    const tags = buildTags({ ...args, taggedUids: ['u-santi', 'u-juli'] });
    expect(tags).toHaveLength(2);
    expect(tags[0]).toMatchObject({
      noteId: 'n1', so: '100',
      taggedUid: 'u-santi', taggedName: 'Santiago',
      taggedByUid: 'u-luis', taggedByName: 'Luis',
      readAt: null,
    });
    expect(tags[0].id).toMatch(/^tg_/);
  });

  it('cada tag tiene un id distinto', () => {
    const tags = buildTags({ ...args, taggedUids: ['u-santi', 'u-juli'] });
    expect(tags[0].id).not.toBe(tags[1].id);
  });

  it('sin destinatarios devuelve []', () => {
    expect(buildTags({ ...args, taggedUids: [] })).toEqual([]);
    expect(buildTags({ ...args, taggedUids: null })).toEqual([]);
  });

  it('descarta uids que no estan en el directorio', () => {
    expect(buildTags({ ...args, taggedUids: ['u-fantasma'] })).toEqual([]);
  });

  it('no permite taggearse a uno mismo', () => {
    expect(buildTags({ ...args, taggedUids: ['u-luis'] })).toEqual([]);
  });

  it('deduplica destinatarios repetidos', () => {
    expect(buildTags({ ...args, taggedUids: ['u-santi', 'u-santi'] })).toHaveLength(1);
  });
});

describe('createNoteWithTags', () => {
  it('escribe nota y tags en UN SOLO update multi-path', async () => {
    const tags = buildTags({ so: '100', noteKey: 'n1', taggedUids: ['u-santi'], directory, authorUid: 'u-luis', authorName: 'Luis' });
    await createNoteWithTags({ so: '100', note, tags });

    expect(update).toHaveBeenCalledTimes(1);
    expect(Object.keys(lastUpdate).sort()).toEqual([
      'project_notes/100/n1',
      `project_tags/100/${tags[0].id}`,
    ]);
  });

  it('una nota sin tags se escribe igual, con una sola ruta', async () => {
    await createNoteWithTags({ so: '100', note, tags: [] });
    expect(Object.keys(lastUpdate)).toEqual(['project_notes/100/n1']);
  });

  it('no persiste el campo interno _key de la nota', async () => {
    await createNoteWithTags({ so: '100', note: { ...note, _key: 'n1' }, tags: [] });
    expect(lastUpdate['project_notes/100/n1']._key).toBeUndefined();
  });

  it('una nota con _key distinto de id se escribe bajo el _key', async () => {
    const tags = buildTags({ so: '100', noteKey: '999', taggedUids: ['u-santi'], directory, authorUid: 'u-luis', authorName: 'Luis' });
    const noteWithKey = { ...note, id: 'n1', _key: '999' };
    await createNoteWithTags({ so: '100', note: noteWithKey, tags });

    expect(Object.keys(lastUpdate).sort()).toEqual([
      'project_notes/100/999',
      `project_tags/100/${tags[0].id}`,
    ]);
    expect(lastUpdate['project_notes/100/999']).toBeDefined();
    expect(lastUpdate['project_notes/100/n1']).toBeUndefined();
    expect(tags[0].noteId).toBe('999');
  });

  it('si el update falla, propaga: el llamador no debe creer que guardo', async () => {
    update.mockRejectedValue(new Error('permission_denied'));
    await expect(createNoteWithTags({ so: '100', note, tags: [] })).rejects.toThrow('permission_denied');
  });
});

describe('deleteNoteWithTags', () => {
  it('borra la nota y sus tags en la misma escritura', async () => {
    await deleteNoteWithTags({ so: '100', noteKey: 'n1', tagIds: ['tg_a', 'tg_b'] });
    expect(update).toHaveBeenCalledTimes(1);
    expect(lastUpdate).toEqual({
      'project_notes/100/n1': null,
      'project_tags/100/tg_a': null,
      'project_tags/100/tg_b': null,
    });
  });

  it('borrar una nota sin tags sigue funcionando', async () => {
    await deleteNoteWithTags({ so: '100', noteKey: 'n1', tagIds: [] });
    expect(lastUpdate).toEqual({ 'project_notes/100/n1': null });
  });
});

describe('markTagRead', () => {
  it('escribe SOLO la hoja readAt, que es lo unico que la regla permite', async () => {
    await markTagRead({ so: '100', tagId: 'tg_a' });
    const [refArg, value] = set.mock.calls[0];
    expect(refArg.path).toBe('project_tags/100/tg_a/readAt');
    expect(value).toBeTypeOf('string');
  });

  it('un fallo no propaga: leer no puede romper la navegacion', async () => {
    set.mockRejectedValue(new Error('permission_denied'));
    await expect(markTagRead({ so: '100', tagId: 'tg_a' })).resolves.toBeUndefined();
  });
});
