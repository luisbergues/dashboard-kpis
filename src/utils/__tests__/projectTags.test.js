import { describe, it, expect } from 'vitest';
import {
  noteTagKey,
  normalizeTags,
  buildNoteIndex,
  liveTags,
  unreadByProject,
  unreadForMe,
  tagsByNote,
} from '../projectTags';

const tag = (over = {}) => ({
  id: 't1', noteId: 'n1', so: '100',
  taggedUid: 'u-santi', taggedName: 'Santiago',
  taggedByUid: 'u-luis', taggedByName: 'Luis',
  createdAt: '2026-08-24T10:00:00.000Z', readAt: null,
  ...over,
});

// Nodo project_tags tal como lo devuelve RTDB: mapa SO -> mapa tagId -> tag.
const raw = {
  '100': { t1: tag(), t2: tag({ id: 't2', noteId: 'n2', readAt: '2026-08-24T11:00:00.000Z' }) },
  '200': { t3: tag({ id: 't3', so: '200', noteId: 'n3', taggedUid: 'u-juli', taggedName: 'Julieta' }) },
};

const notes = {
  '100': [{ id: 'n1', _key: 'n1' }, { id: 'n2', _key: 'n2' }],
  '200': [{ id: 'n3', _key: 'n3' }],
};

describe('normalizeTags', () => {
  it('aplana el nodo a un array', () => {
    expect(normalizeTags(raw)).toHaveLength(3);
  });

  it('devuelve [] con el nodo vacio o ausente', () => {
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags({})).toEqual([]);
  });

  it('usa la clave de storage como id, aunque el campo id diga otra cosa', () => {
    const [t] = normalizeTags({ '100': { claveReal: tag({ id: 'viejo' }) } });
    expect(t.id).toBe('claveReal');
  });

  it('deriva el so de la clave del padre, no del campo', () => {
    const [t] = normalizeTags({ '999': { t1: tag({ so: '111' }) } });
    expect(t.so).toBe('999');
  });

  it('descarta entradas que no son objetos', () => {
    expect(normalizeTags({ '100': { t1: 'basura', t2: tag() } })).toHaveLength(1);
  });
});

describe('liveTags — descarta huerfanos', () => {
  it('deja pasar los tags cuya nota existe', () => {
    expect(liveTags(normalizeTags(raw), buildNoteIndex(notes))).toHaveLength(3);
  });

  it('descarta el tag cuya nota se borro', () => {
    const index = buildNoteIndex({ '100': [{ id: 'n1', _key: 'n1' }], '200': [] });
    const live = liveTags(normalizeTags(raw), index);
    expect(live.map(t => t.id)).toEqual(['t1']);
  });

  it('un tag y una nota con el mismo id en proyectos distintos no se confunden', () => {
    const index = buildNoteIndex({ '100': [{ id: 'n1', _key: 'n1' }] });
    const tags = normalizeTags({ '200': { t9: tag({ so: '200', noteId: 'n1' }) } });
    expect(liveTags(tags, index)).toEqual([]);
  });
});

describe('unreadByProject', () => {
  it('cuenta solo los no leidos, de cualquier usuario', () => {
    const live = liveTags(normalizeTags(raw), buildNoteIndex(notes));
    expect(unreadByProject(live)).toEqual({ '100': 1, '200': 1 });
  });

  it('no deja la clave del proyecto cuyos tags estan todos leidos', () => {
    const live = liveTags(normalizeTags({ '100': { t2: tag({ readAt: 'x' }) } }), buildNoteIndex(notes));
    expect(unreadByProject(live)).toEqual({});
  });
});

describe('unreadForMe', () => {
  it('devuelve solo los no leidos dirigidos a ese uid', () => {
    const live = liveTags(normalizeTags(raw), buildNoteIndex(notes));
    expect(unreadForMe(live, 'u-santi').map(t => t.id)).toEqual(['t1']);
  });

  it('devuelve [] sin uid', () => {
    const live = liveTags(normalizeTags(raw), buildNoteIndex(notes));
    expect(unreadForMe(live, null)).toEqual([]);
  });

  it('ordena del mas nuevo al mas viejo', () => {
    const live = normalizeTags({
      '100': {
        viejo: tag({ id: 'viejo', createdAt: '2026-08-01T00:00:00.000Z' }),
        nuevo: tag({ id: 'nuevo', createdAt: '2026-08-20T00:00:00.000Z' }),
      },
    });
    expect(unreadForMe(live, 'u-santi').map(t => t.id)).toEqual(['nuevo', 'viejo']);
  });

  it('un createdAt invalido no reordena el resto', () => {
    const live = normalizeTags({
      '100': {
        roto: tag({ id: 'roto', createdAt: 'no-es-fecha' }),
        ok: tag({ id: 'ok', createdAt: '2026-08-20T00:00:00.000Z' }),
      },
    });
    expect(unreadForMe(live, 'u-santi').map(t => t.id)).toEqual(['ok', 'roto']);
  });
});

describe('tagsByNote', () => {
  it('agrupa por proyecto+nota, leidos y no leidos', () => {
    const live = liveTags(normalizeTags(raw), buildNoteIndex(notes));
    const byNote = tagsByNote(live);
    expect(byNote[noteTagKey('100', 'n1')].map(t => t.taggedName)).toEqual(['Santiago']);
    expect(byNote[noteTagKey('200', 'n3')].map(t => t.taggedName)).toEqual(['Julieta']);
  });
});
