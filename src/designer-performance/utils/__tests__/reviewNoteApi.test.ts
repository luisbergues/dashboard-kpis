import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateReviewNote } from '../reviewNoteApi';
import { draftReviewNote, type ReviewNoteFacts } from '../reviewNoteDraft';

vi.mock('../../../utils/firebase', () => ({ authHeaders: async () => ({}) }));

const FACTS: ReviewNoteFacts = {
  outcome: 'Deficient',
  soNumber: '12345',
  projectName: 'Smith Residence',
  designerName: 'Monica Gabriel',
  missingDocs: ['KCD file (complete & latest)', 'Quote breakdown'],
  deadline: new Date(2026, 7, 10).getTime(),
};
const FALLBACK = draftReviewNote(FACTS);

const mockFetch = (impl: unknown) => { (globalThis as any).fetch = impl; };

beforeEach(() => vi.restoreAllMocks());
afterEach(() => { delete (globalThis as any).fetch; });

describe('cuando Gemini responde bien', () => {
  it('devuelve el texto redactado por el modelo', async () => {
    const polished = 'Hi Monica Gabriel, SO #12345 needs: - KCD file (complete & latest) - Quote breakdown';
    mockFetch(vi.fn(async () => ({ ok: true, json: async () => ({ text: polished }) })));
    expect(await generateReviewNote(FACTS)).toBe(polished);
  });

  it('manda el texto deterministico como base, no los datos crudos', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ text: FALLBACK }) }));
    mockFetch(fetchMock);
    await generateReviewNote(FACTS);
    const body = JSON.parse((fetchMock.mock.calls[0] as any[])[1].body);
    expect(body.draft).toBe(FALLBACK);
  });
});

describe('nunca deja al usuario sin nota', () => {
  it('endpoint caido: usa el texto deterministico', async () => {
    mockFetch(vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await generateReviewNote(FACTS)).toBe(FALLBACK);
  });

  it('sin API key configurada (503): usa el texto deterministico', async () => {
    mockFetch(vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    expect(await generateReviewNote(FACTS)).toBe(FALLBACK);
  });

  it('error de red: usa el texto deterministico', async () => {
    mockFetch(vi.fn(async () => { throw new Error('network down'); }));
    expect(await generateReviewNote(FACTS)).toBe(FALLBACK);
  });

  it('respuesta vacia: usa el texto deterministico', async () => {
    mockFetch(vi.fn(async () => ({ ok: true, json: async () => ({ text: '   ' }) })));
    expect(await generateReviewNote(FACTS)).toBe(FALLBACK);
  });
});

describe('guarda contra un modelo que pierde documentos', () => {
  it('descarta la version del modelo si se comio un documento', async () => {
    // Redaccion linda pero le falta "Quote breakdown": el disenador nunca se
    // enteraria de que tiene que mandarlo.
    const incompleto = 'Hi Monica, please send the KCD file (complete & latest). Thanks!';
    mockFetch(vi.fn(async () => ({ ok: true, json: async () => ({ text: incompleto }) })));
    expect(await generateReviewNote(FACTS)).toBe(FALLBACK);
  });

  it('acepta la version del modelo si estan todos', async () => {
    const completo = `Rewritten. ${FACTS.missingDocs.join(' and ')}. Due Aug 10, 2026.`;
    mockFetch(vi.fn(async () => ({ ok: true, json: async () => ({ text: completo }) })));
    expect(await generateReviewNote(FACTS)).toBe(completo);
  });

  it('sin documentos faltantes no hay nada que validar', async () => {
    const soloTexto = 'The project is ready for engineering.';
    mockFetch(vi.fn(async () => ({ ok: true, json: async () => ({ text: soloTexto }) })));
    expect(await generateReviewNote({ ...FACTS, outcome: 'Complete', missingDocs: [] })).toBe(soloTexto);
  });
});
