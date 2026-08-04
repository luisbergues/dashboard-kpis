import { describe, it, expect } from 'vitest';
import { buildKnownSoSet, isOrphanSo } from '../orphanDetection';

const sources = {
  priorityAnalysis: [{ so: '9001' }],
  masterProjects: [{ so: '12510' }],   // activo, todavia no llego al weekly KPI
  archivedProjects: [{ so: '8000' }],
};

describe('que NO es huerfano', () => {
  const known = buildKnownSoSet(sources);

  it('lo que esta en el weekly KPI', () => {
    expect(isOrphanSo('9001', known)).toBe(false);
  });

  it('lo que esta en Master Schedule Mirror aunque no este en el weekly KPI', () => {
    // El caso real: SO 12510 tenia fecha de instalacion y ningun Completion
    // Date, pero el panel lo ofrecia para archivar como Completado.
    expect(isOrphanSo('12510', known)).toBe(false);
  });

  it('lo ya archivado', () => {
    expect(isOrphanSo('8000', known)).toBe(false);
  });
});

describe('que si es huerfano', () => {
  it('un SO que no esta en ninguna fuente', () => {
    expect(isOrphanSo('7777', buildKnownSoSet(sources))).toBe(true);
  });
});

describe('robustez', () => {
  it('compara como texto: 12510 numerico y "12510" son el mismo', () => {
    const known = buildKnownSoSet({ masterProjects: [{ so: 12510 }] });
    expect(isOrphanSo('12510', known)).toBe(false);
    expect(isOrphanSo(12510, known)).toBe(false);
  });

  it('tolera espacios alrededor', () => {
    const known = buildKnownSoSet({ masterProjects: [{ so: ' 12510 ' }] });
    expect(isOrphanSo('12510', known)).toBe(false);
  });

  it('ignora entradas sin SO', () => {
    const known = buildKnownSoSet({ masterProjects: [{ so: '' }, {}, null] });
    expect(known.size).toBe(0);
  });

  it('sin fuentes, todo es huerfano', () => {
    expect(isOrphanSo('1', buildKnownSoSet())).toBe(true);
    expect(isOrphanSo('1', buildKnownSoSet({}))).toBe(true);
  });

  it('si falta Master Schedule Mirror no rompe, pero deja de proteger', () => {
    // Documenta la dependencia: sin esa fuente vuelve el falso positivo.
    const known = buildKnownSoSet({ priorityAnalysis: [{ so: '9001' }] });
    expect(isOrphanSo('12510', known)).toBe(true);
  });
});
