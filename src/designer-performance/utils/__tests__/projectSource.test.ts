import { describe, it, expect } from 'vitest';
import { withEvaluatedProjects } from '../projectSource';

const source = [
  { so: '100', name: 'Activo:[100] Activo' },
  { so: '200', name: 'Otro:[200] Otro' },
];

describe('withEvaluatedProjects', () => {
  it('devuelve la fuente tal cual si no hay evaluaciones fuera de ella', () => {
    expect(withEvaluatedProjects(source, { '100': { status: 'Approved' } })).toEqual(source);
  });

  it('suma un proyecto evaluado que ya salio del Master Schedule', () => {
    const result = withEvaluatedProjects(source, {
      '300': { status: 'Completed', projectName: 'Cerrado' },
    });
    expect(result.map(p => p.so)).toEqual(['100', '200', '300']);
    expect(result[2].name).toBe('Cerrado');
  });

  it('no resucita proyectos que nunca se evaluaron', () => {
    const result = withEvaluatedProjects(source, { '300': { status: 'Pending' }, '400': {} });
    expect(result).toEqual(source);
  });

  it('no duplica un SO que sigue activo', () => {
    const result = withEvaluatedProjects(source, { '200': { status: 'Completed', projectName: 'X' } });
    expect(result).toHaveLength(2);
  });

  it('tolera una fuente vacia', () => {
    const result = withEvaluatedProjects([], { '300': { status: 'Completed', projectName: 'Cerrado' } });
    expect(result.map(p => p.so)).toEqual(['300']);
  });
});
