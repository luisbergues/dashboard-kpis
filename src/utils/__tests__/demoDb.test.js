import { describe, it, expect, vi } from 'vitest';
import { createDemoDb, createDemoAuth } from '../demoDb';
import { buildDemoTree, DEMO_USER } from '../demoData';
import { ENGINEERS } from '../engineers';
import { isCacheFresh } from '../dbCache';
import {
  normalizeTags, buildNoteIndex, liveTags, unreadForMe, unreadByProject,
} from '../projectTags';
import { normalizeNotesBySo } from '../projectNotes';

// dbCache y projectTags importan ./firebase; en el entorno de test no hay
// credenciales ni window, asi que el modulo real solo loguearia un warning.
// Se lo apaga para que la salida quede limpia.
vi.mock('../firebase', () => ({
  db: null, auth: null, isConfigured: false,
  ref: () => ({}), get: async () => ({ exists: () => false, val: () => null }),
  set: async () => {}, update: async () => {}, onValue: () => () => {},
}));

const db = () => createDemoDb(buildDemoTree());

describe('createDemoDb — forma de la API de RTDB', () => {
  it('lee lo que escribe, en cualquier profundidad', async () => {
    const d = db();
    await d.set(d.ref(null, 'a/b/c'), { hola: 1 });
    const snap = await d.get(d.ref(null, 'a/b/c'));
    expect(snap.exists()).toBe(true);
    expect(snap.val()).toEqual({ hola: 1 });
  });

  it('un nodo inexistente no existe y vale null', async () => {
    const snap = await db().get({ path: 'no/esta' });
    expect(snap.exists()).toBe(false);
    expect(snap.val()).toBeNull();
  });

  it('devuelve copias: mutar lo leido no toca el arbol', async () => {
    const d = db();
    const first = (await d.get(d.ref(null, 'project_designers'))).val();
    first['12480'] = 'CONTAMINADO';
    const second = (await d.get(d.ref(null, 'project_designers'))).val();
    expect(second['12480']).toBe('Delfina Breton');
  });

  it('un update multi-path desde la raiz escribe todas las rutas de una', async () => {
    const d = db();
    await d.update(d.ref(null, ''), {
      'project_notes/999/n_x': { id: 'n_x', text: 'hola' },
      'project_tags/999/tg_x': { id: 'tg_x', noteId: 'n_x' },
    });
    expect((await d.get(d.ref(null, 'project_notes/999/n_x'))).val().text).toBe('hola');
    expect((await d.get(d.ref(null, 'project_tags/999/tg_x'))).val().id).toBe('tg_x');
  });

  it('null borra, igual que en RTDB', async () => {
    const d = db();
    await d.update(d.ref(null, ''), { 'project_notes/12480/n_1': null });
    expect((await d.get(d.ref(null, 'project_notes/12480/n_1'))).exists()).toBe(false);
    // Los hermanos quedan intactos.
    expect((await d.get(d.ref(null, 'project_notes/12480/n_2'))).exists()).toBe(true);
  });

  it('remove borra el subarbol', async () => {
    const d = db();
    await d.remove(d.ref(null, 'project_notes/12480'));
    expect((await d.get(d.ref(null, 'project_notes/12480'))).exists()).toBe(false);
  });
});

describe('createDemoDb — listeners', () => {
  it('entrega el valor actual apenas se suscribe', () => {
    const d = db();
    const seen = [];
    d.onValue(d.ref(null, 'engineer_directory'), s => seen.push(s.val()));
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0])).toHaveLength(ENGINEERS.length);
  });

  it('vuelve a disparar cuando cambia el nodo observado', async () => {
    const d = db();
    const seen = [];
    d.onValue(d.ref(null, 'project_tags'), s => seen.push(s.val()));
    await d.set(d.ref(null, 'project_tags/12480/tg_1/readAt'), '2026-08-25T10:00:00.000Z');
    expect(seen).toHaveLength(2);
    expect(seen[1]['12480'].tg_1.readAt).toBe('2026-08-25T10:00:00.000Z');
  });

  it('NO dispara si el valor no cambio', async () => {
    const d = db();
    const seen = [];
    d.onValue(d.ref(null, 'project_tags'), s => seen.push(s.val()));
    await d.set(d.ref(null, 'project_notes/12533/n_6/text'), 'otra cosa');
    expect(seen).toHaveLength(1);
  });

  it('desuscribirse corta las notificaciones', async () => {
    const d = db();
    const seen = [];
    const off = d.onValue(d.ref(null, 'project_tags'), s => seen.push(s.val()));
    off();
    await d.set(d.ref(null, 'project_tags/12480/tg_1/readAt'), 'x');
    expect(seen).toHaveLength(1);
  });
});

describe('createDemoDb — runTransaction', () => {
  it('commitea lo que devuelve el updater', async () => {
    const d = db();
    const res = await d.runTransaction(d.ref(null, 'archive_lock'), () => ({ owner: 'yo' }));
    expect(res.committed).toBe(true);
    expect((await d.get(d.ref(null, 'archive_lock'))).val()).toEqual({ owner: 'yo' });
  });

  it('undefined aborta y no escribe', async () => {
    const d = db();
    const res = await d.runTransaction(d.ref(null, 'archive_lock'), () => undefined);
    expect(res.committed).toBe(false);
    expect((await d.get(d.ref(null, 'archive_lock'))).exists()).toBe(false);
  });
});

describe('createDemoAuth', () => {
  it('entrega el usuario ya logueado, que es lo que saltea el login', () => {
    const a = createDemoAuth(DEMO_USER);
    const seen = [];
    a.onAuthStateChanged(null, u => seen.push(u));
    expect(seen[0].uid).toBe(DEMO_USER.uid);
  });
});

// Lo que de verdad importa: que el arbol de mentira tenga la forma que el
// codigo REAL espera. Si esto pasa, abrir ?demo en el navegador funciona.
describe('buildDemoTree — compatible con el codigo real', () => {
  const tree = buildDemoTree();

  it('los OCHO ingenieros estan en el directorio y resuelven a un uid', () => {
    const dir = tree.engineer_directory;
    ENGINEERS.forEach(name => {
      const hit = Object.entries(dir).find(([, e]) => e.name === name);
      expect(hit, `falta ${name} en engineer_directory`).toBeTruthy();
    });
    expect(Object.keys(dir)).toHaveLength(ENGINEERS.length);
  });

  it('cada entrada del directorio cumple el .validate de las reglas', () => {
    Object.values(tree.engineer_directory).forEach(e => {
      expect(typeof e.name).toBe('string');
      expect(e.name.length).toBeLessThanOrEqual(40);
      expect(typeof e.updatedAt).toBe('string');
    });
  });

  it('el usuario de la demo es un ingeniero aprobado', () => {
    const me = tree.users[DEMO_USER.uid];
    expect(me.status).toBe('approved');
    expect(me.designerName).toBe('Luis');
    // Su designerName tiene que matchear la lista canonica, o no seria tageable.
    expect(ENGINEERS).toContain(me.designerName);
  });

  it('el cache viene fresco, para que la app no salga a buscar el sheet real', () => {
    expect(isCacheFresh(tree.firebase_cache.data.timestamp)).toBe(true);
  });

  it('parsedData trae las claves que las vistas leen', () => {
    const p = tree.firebase_cache.data.parsedData;
    ['priorityAnalysis','materialRequirements','statusHistory','weekOverWeek',
     'topCostProjects','onHoldNotes','weekLabels','alerts'].forEach(k => {
      expect(p, `falta ${k} en parsedData`).toHaveProperty(k);
    });
    expect(p.priorityAnalysis.length).toBeGreaterThan(0);
  });

  it('ningun tag queda huerfano: todos apuntan a una nota que existe', () => {
    const notes = normalizeNotesBySo(tree.project_notes);
    const all = normalizeTags(tree.project_tags);
    expect(liveTags(all, buildNoteIndex(notes))).toHaveLength(all.length);
  });

  it('el usuario de la demo abre con dos tags sin leer, en dos proyectos', () => {
    const notes = normalizeNotesBySo(tree.project_notes);
    const live = liveTags(normalizeTags(tree.project_tags), buildNoteIndex(notes));
    const mine = unreadForMe(live, DEMO_USER.uid);
    expect(mine).toHaveLength(2);
    expect(new Set(mine.map(t => t.so)).size).toBe(2);
  });

  it('uno de esos proyectos NO es del usuario, para ver el ruteo condicional', () => {
    const notes = normalizeNotesBySo(tree.project_notes);
    const live = liveTags(normalizeTags(tree.project_tags), buildNoteIndex(notes));
    const mine = unreadForMe(live, DEMO_USER.uid);
    const projects = tree.firebase_cache.data.parsedData.priorityAnalysis;
    const engs = mine.map(t => projects.find(p => p.so === t.so)?.eng);
    expect(engs).toContain('Luis');
    expect(engs.some(e => e !== 'Luis')).toBe(true);
  });

  it('hay al menos un tag ya leido, para que se vea el check en el chip', () => {
    const all = normalizeTags(tree.project_tags);
    expect(all.some(t => t.readAt)).toBe(true);
  });

  it('los indicadores por proyecto no salen vacios', () => {
    const notes = normalizeNotesBySo(tree.project_notes);
    const live = liveTags(normalizeTags(tree.project_tags), buildNoteIndex(notes));
    expect(Object.keys(unreadByProject(live)).length).toBeGreaterThan(0);
  });
});
