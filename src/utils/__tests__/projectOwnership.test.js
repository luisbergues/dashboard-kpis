import { describe, it, expect } from 'vitest';
import { ownsProject } from '../projectOwnership';

const eng = { role: 'engineer', designerName: 'Santiago' };

describe('ownsProject', () => {
  it('un ingeniero es dueño de los proyectos donde figura como ENG', () => {
    expect(ownsProject(eng, { so: '1', eng: 'Santiago' })).toBe(true);
  });

  it('ignora mayusculas y espacios, como hace la vista hoy', () => {
    expect(ownsProject(eng, { so: '1', eng: '  santiago ' })).toBe(true);
  });

  it('no es dueño de un proyecto de otro', () => {
    expect(ownsProject(eng, { so: '1', eng: 'Julieta' })).toBe(false);
  });

  it('los roles globales son duenos de todo', () => {
    ['administrative', 'admin', 'engineer_nester'].forEach(role => {
      expect(ownsProject({ role, designerName: 'X' }, { so: '1', eng: 'Julieta' })).toBe(true);
    });
  });

  it('sin perfil no es dueno de nada', () => {
    expect(ownsProject(null, { so: '1', eng: 'Santiago' })).toBe(false);
  });

  it('un proyecto sin ENG no es de nadie en particular', () => {
    expect(ownsProject(eng, { so: '1', eng: '' })).toBe(false);
  });

  it('no explota si el perfil no tiene designerName', () => {
    expect(ownsProject({ role: 'engineer' }, { so: '1', eng: 'Santiago' })).toBe(false);
  });
});
