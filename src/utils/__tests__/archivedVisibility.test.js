import { describe, it, expect } from 'vitest';
import {
  seesAllArchived, isUnownedArchived, ownedArchivedProjects, visibleArchivedProjects,
} from '../archivedVisibility';

const ENG = { role: 'engineer', designerName: 'Monica Gabriel' };
const NESTER = { role: 'engineer_nester', designerName: 'Otro' };
const ADMIN = { role: 'administrative', designerName: 'Otro' };

const MINE   = { so: '1', eng: 'Monica Gabriel' };
const OTHERS = { so: '2', eng: 'Natalie Ball' };
const ORPHAN = { so: '3', eng: null };          // recuperado de Orphaned Projects
const BLANK  = { so: '4', eng: '   ' };
const ALL = [MINE, OTHERS, ORPHAN, BLANK];

describe('quien saltea el filtro personal', () => {
  it('administrative, admin y engineer_nester ven todo', () => {
    expect(seesAllArchived(ADMIN)).toBe(true);
    expect(seesAllArchived(NESTER)).toBe(true);
    expect(seesAllArchived({ role: 'admin' })).toBe(true);
  });

  it('un engineer comun no', () => {
    expect(seesAllArchived(ENG)).toBe(false);
    expect(seesAllArchived(null)).toBe(false);
  });
});

describe('proyecto sin dueño', () => {
  it('detecta eng nulo, ausente o en blanco', () => {
    expect(isUnownedArchived(ORPHAN)).toBe(true);
    expect(isUnownedArchived(BLANK)).toBe(true);
    expect(isUnownedArchived({ so: '9' })).toBe(true);
  });

  it('un proyecto con ingeniero tiene dueño', () => {
    expect(isUnownedArchived(MINE)).toBe(false);
  });
});

describe('lo que cuenta como trabajo propio (metricas)', () => {
  it('solo los asignados a uno', () => {
    expect(ownedArchivedProjects(ALL, ENG).map(p => p.so)).toEqual(['1']);
  });

  it('NO incluye los que no son de nadie', () => {
    // Si entraran aca, un proyecto sin asignar le sumaria a todo el mundo.
    const sos = ownedArchivedProjects(ALL, ENG).map(p => p.so);
    expect(sos).not.toContain('3');
    expect(sos).not.toContain('4');
  });

  it('los roles que ven todo reciben todo', () => {
    expect(ownedArchivedProjects(ALL, ADMIN)).toHaveLength(4);
  });

  it('sin perfil no devuelve nada', () => {
    expect(ownedArchivedProjects(ALL, null)).toEqual([]);
  });
});

describe('lo que se muestra en Completados (vista)', () => {
  it('los propios mas los que no son de nadie', () => {
    expect(visibleArchivedProjects(ALL, ENG).map(p => p.so)).toEqual(['1', '3', '4']);
  });

  it('sigue sin mostrar los de otro ingeniero', () => {
    expect(visibleArchivedProjects(ALL, ENG).map(p => p.so)).not.toContain('2');
  });

  it('los roles que ven todo siguen viendo todo', () => {
    expect(visibleArchivedProjects(ALL, ADMIN)).toHaveLength(4);
  });

  it('compara nombres sin importar mayusculas ni espacios', () => {
    const raro = [{ so: '5', eng: '  mOnIcA gAbRiEl ' }];
    expect(visibleArchivedProjects(raro, ENG)).toHaveLength(1);
  });

  it('tolera lista vacia o ausente', () => {
    expect(visibleArchivedProjects([], ENG)).toEqual([]);
    expect(visibleArchivedProjects(undefined, ENG)).toEqual([]);
  });
});
