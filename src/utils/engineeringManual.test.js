import { describe, it, expect } from 'vitest';
import { searchEngineeringManual } from './engineeringManual';
import { buildManualAnswer } from './llmChat';

// Query -> expected top-matching section (bilingual, realistic phrasings a
// designer or engineer would actually type). Guards the manual matcher against
// regressions and documents its intended coverage.
const MATCH_CASES = [
  ['cual es el reveal de half overlay?', '4.1'],
  ['what is the half overlay reveal?', '4.1'],
  ['tamaño maximo de puerta', '4.1'],
  ['maximum door size', '4.1'],
  ['que talla de cajon uso para joyeria?', 'Anexo'],
  ['drawer size for jewelry', 'Anexo'],
  ['overhang de countertop', '4.3'],
  ['clearance around sprinklers', '4.7'],
  ['espacio alrededor de rociadores', '4.7'],
  ['top molding standard size', '5.5'],
  ['hanging rod size', '1.2'],
  ['tubo de colgar tamaño', '1.2'],
  ['pull out shelf clearance', '4.4'],
  ['lazy susan gap', '5.9'],
];

// Queries that are NOT about the manual — must return no manual match so they
// fall through to entity search / Gemini instead of hijacking the answer.
const NON_MANUAL = [
  'how is russell',
  'natalie contact',
  'hola',
  'proyectos de melissa',
  '¿qué proyectos están on hold?',
];

describe('searchEngineeringManual', () => {
  it.each(MATCH_CASES)('%j matches section %s', (query, section) => {
    const results = searchEngineeringManual(query);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].section).toBe(section);
  });

  it.each(NON_MANUAL)('%j does not match any manual section', (query) => {
    expect(searchEngineeringManual(query)).toHaveLength(0);
  });

  describe('singular/plural matching fix', () => {
    it('"thermofoil minimum door" now matches the thermofoil section (door≈doors)', () => {
      const results = searchEngineeringManual('thermofoil minimum door');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].section).toBe('5.3');
    });

    it('"hanging rod" matches via rod≈rods', () => {
      const results = searchEngineeringManual('hanging rod default');
      expect(results[0]?.section).toBe('1.2');
    });

    it('does not rescue tiny coincidental fragments', () => {
      // "on"/"of" style noise shouldn't create matches on its own.
      expect(searchEngineeringManual('on of an')).toHaveLength(0);
    });
  });
});

describe('buildManualAnswer — local manual replies (no Gemini)', () => {
  it('returns a formatted answer containing the section number and its text', () => {
    const answer = buildManualAnswer('what is the half overlay reveal?', false);
    expect(answer).toContain('§4.1');
    expect(answer).toContain('Engineering Manual');
    expect(answer).toContain('1/2'); // half overlay reveal is 1/2"
  });

  it('returns Spanish formatting when isES is true', () => {
    const answer = buildManualAnswer('tamaño maximo de puerta', true);
    expect(answer).toContain('Manual de Ingeniería');
    expect(answer).toContain('24');
  });

  it('returns null for a non-manual query (so caller falls through to Gemini)', () => {
    expect(buildManualAnswer('how is russell', false)).toBeNull();
    expect(buildManualAnswer('natalie contact', true)).toBeNull();
  });
});
