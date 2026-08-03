import { describe, it, expect } from 'vitest';
import {
  normalizeNotes,
  normalizeNotesBySo,
  noteStorageKey,
  stripInternalFields,
} from '../projectNotes';

// project_notes paso de "array completo reescrito con set()" a "una nota por
// clave". Lo critico es que el formato VIEJO (que RTDB serializaba como objeto
// indexado {0:…, 1:…}) se siga leyendo igual sin migrar datos, y que una nota
// vieja se siga editando en su indice original en vez de duplicarse.
describe('normalizeNotes', () => {
  it('lee el formato nuevo (mapa por id de nota)', () => {
    const raw = {
      'n1': { id: 'n1', text: 'vieja', createdAt: '2026-01-01T00:00:00.000Z' },
      'n2': { id: 'n2', text: 'nueva', createdAt: '2026-06-01T00:00:00.000Z' },
    };
    const result = normalizeNotes(raw);
    expect(result.map(n => n.text)).toEqual(['nueva', 'vieja']); // mas nueva primero
    expect(result[0]._key).toBe('n2');
  });

  it('lee el formato viejo (array serializado como objeto indexado) sin migracion', () => {
    const legacy = {
      '0': { id: 'a', text: 'primera', createdAt: '2026-06-01T00:00:00.000Z' },
      '1': { id: 'b', text: 'segunda', createdAt: '2026-01-01T00:00:00.000Z' },
    };
    const result = normalizeNotes(legacy);
    expect(result).toHaveLength(2);
    // Conserva el indice real como clave de storage: editarla debe pisar ese
    // indice, no crear una entrada nueva bajo el id.
    expect(result[0]._key).toBe('0');
    expect(result[1]._key).toBe('1');
  });

  it('lee un array literal tal cual viene', () => {
    const arr = [
      { id: 'a', text: 'una', createdAt: '2026-06-01T00:00:00.000Z' },
    ];
    expect(normalizeNotes(arr)).toHaveLength(1);
  });

  it('devuelve [] ante null/undefined en vez de romper', () => {
    expect(normalizeNotes(null)).toEqual([]);
    expect(normalizeNotes(undefined)).toEqual([]);
    expect(normalizeNotes({})).toEqual([]);
  });

  it('descarta entradas nulas (huecos de un array viejo con notas borradas)', () => {
    const raw = { '0': null, '1': { id: 'b', text: 'viva', createdAt: '2026-01-01T00:00:00.000Z' } };
    const result = normalizeNotes(raw);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('viva');
  });

  it('no rompe el orden cuando falta createdAt: esas notas van al final', () => {
    const raw = {
      'sin': { id: 'sin', text: 'sin fecha' },
      'con': { id: 'con', text: 'con fecha', createdAt: '2026-06-01T00:00:00.000Z' },
    };
    const result = normalizeNotes(raw);
    expect(result[0].text).toBe('con fecha');
    expect(result[1].text).toBe('sin fecha');
  });
});

describe('normalizeNotesBySo', () => {
  it('normaliza cada proyecto del nodo completo', () => {
    const raw = {
      '100': { 'n1': { id: 'n1', text: 'a', createdAt: '2026-01-01T00:00:00.000Z' } },
      '200': { '0': { id: 'x', text: 'legacy', createdAt: '2026-01-01T00:00:00.000Z' } },
    };
    const result = normalizeNotesBySo(raw);
    expect(result['100']).toHaveLength(1);
    expect(result['200'][0]._key).toBe('0');
  });

  it('devuelve {} ante null', () => {
    expect(normalizeNotesBySo(null)).toEqual({});
  });
});

describe('noteStorageKey', () => {
  it('usa la clave de storage cuando la nota vino de la base', () => {
    expect(noteStorageKey({ id: 'abc', _key: '0' })).toBe('0');
  });

  it('cae al id cuando la nota es nueva (todavia sin clave)', () => {
    expect(noteStorageKey({ id: 'abc' })).toBe('abc');
  });
});

describe('stripInternalFields', () => {
  it('saca _key para que nunca se persista', () => {
    const clean = stripInternalFields({ id: 'a', text: 'hola', _key: '0' });
    expect(clean).toEqual({ id: 'a', text: 'hola' });
    expect('_key' in clean).toBe(false);
  });

  it('deja intacta una nota que no tiene _key', () => {
    expect(stripInternalFields({ id: 'a', text: 'hola' })).toEqual({ id: 'a', text: 'hola' });
  });
});
