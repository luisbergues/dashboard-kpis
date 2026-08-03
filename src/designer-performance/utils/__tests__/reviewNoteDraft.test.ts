import { describe, it, expect } from 'vitest';
import { draftReviewNote, type ReviewNoteFacts } from '../reviewNoteDraft';

const facts = (over: Partial<ReviewNoteFacts> = {}): ReviewNoteFacts => ({
  outcome: 'Deficient',
  soNumber: '12345',
  projectName: 'Smith Residence',
  designerName: 'Monica Gabriel',
  missingDocs: ['KCD file (complete & latest)', 'Quote breakdown'],
  deadline: new Date(2026, 7, 10).getTime(),
  ...over,
});

describe('la nota siempre esta en ingles y nombra el proyecto', () => {
  it('incluye SO y nombre del proyecto', () => {
    const t = draftReviewNote(facts());
    expect(t).toContain('SO #12345');
    expect(t).toContain('Smith Residence');
  });

  it('saluda al diseñador cuando hay uno asignado', () => {
    expect(draftReviewNote(facts())).toContain('Hi Monica Gabriel');
  });

  it('no saluda a nadie si esta sin asignar', () => {
    expect(draftReviewNote(facts({ designerName: 'Unassigned' }))).not.toContain('Hi ');
    expect(draftReviewNote(facts({ designerName: undefined }))).not.toContain('Hi ');
  });
});

describe('Deficient', () => {
  const t = draftReviewNote(facts());

  it('dice que se devuelve para correcciones', () => {
    expect(t).toContain('Deficient');
    expect(t.toLowerCase()).toContain('returned');
  });

  it('lista textualmente los documentos que faltan', () => {
    expect(t).toContain('- KCD file (complete & latest)');
    expect(t).toContain('- Quote breakdown');
  });

  it('no menciona documentos que si estan tildados', () => {
    expect(t).not.toContain('Credit Card Form');
  });

  it('incluye la fecha limite', () => {
    expect(t).toContain('Aug 10, 2026');
  });

  it('sin plazo cargado no inventa una fecha', () => {
    const sin = draftReviewNote(facts({ deadline: null }));
    expect(sin).not.toContain('2026');
    expect(sin).not.toContain('Aug');
    expect(sin.toLowerCase()).toContain('as soon as possible');
  });

  it('sin documentos faltantes habla de errores de la revision manual', () => {
    // Deficient tambien aplica a medidas mal, no solo a papeles ausentes.
    const t2 = draftReviewNote(facts({ missingDocs: [] }));
    expect(t2.toLowerCase()).toContain('errors or inconsistencies');
  });
});

describe('Deferred', () => {
  const t = draftReviewNote(facts({ outcome: 'Deferred' }));

  it('dice que quedo en espera y que el proyecto esta vendido', () => {
    expect(t).toContain('Deferred');
    expect(t.toLowerCase()).toContain('on hold');
    expect(t.toLowerCase()).toContain('sold');
  });

  it('lista los documentos faltantes y el plazo', () => {
    expect(t).toContain('- KCD file (complete & latest)');
    expect(t).toContain('Aug 10, 2026');
  });
});

describe('Complete', () => {
  it('sin faltantes confirma que esta listo para ingenieria', () => {
    const t = draftReviewNote(facts({ outcome: 'Complete', missingDocs: [], deadline: null }));
    expect(t).toContain('Complete');
    expect(t.toLowerCase()).toContain('ready for engineering');
  });

  it('aprobado con faltantes lo deja por escrito en vez de decir que estaba todo', () => {
    // Es el caso de la aprobacion administrativa forzada: decir "all required
    // documentation was received" seria falso.
    const t = draftReviewNote(facts({ outcome: 'Complete', deadline: null }));
    expect(t.toLowerCase()).not.toContain('all required documentation was received');
    expect(t.toLowerCase()).toContain('still outstanding');
    expect(t).toContain('- Quote breakdown');
  });
});
