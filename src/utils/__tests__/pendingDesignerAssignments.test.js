import { describe, it, expect } from 'vitest';
import { pendingDesignerAssignments } from '../pendingDesignerAssignments';

const eng = (name = 'JS') => ({ role: 'engineer', designerName: name, status: 'approved' });

const proyectos = [
  { so: '111', name: 'Casa A', eng: 'JS' },
  { so: '222', name: 'Casa B', eng: 'JS' },
  { so: '333', name: 'Casa C', eng: 'MR' },
];

const call = (userProfile, projects = proyectos, projectDesigners = {}) =>
  pendingDesignerAssignments({ userProfile, projects, projectDesigners });

describe('pendingDesignerAssignments — a quien y por que se bloquea', () => {
  it('devuelve los proyectos del ingeniero que no tienen disenador', () => {
    const cola = call(eng('JS'));
    expect(cola.map(p => p.so)).toEqual(['111', '222']);
  });

  it('excluye los que ya tienen disenador asignado', () => {
    const cola = call(eng('JS'), proyectos, { '111': 'Iris Lopes' });
    expect(cola.map(p => p.so)).toEqual(['222']);
  });

  it('no incluye proyectos de otro ingeniero', () => {
    const cola = call(eng('MR'));
    expect(cola.map(p => p.so)).toEqual(['333']);
  });

  it('compara el nombre del ingeniero sin distinguir mayusculas ni espacios', () => {
    // El sheet trae la columna ENG a mano: "  js " y "JS" son la misma persona.
    const cola = pendingDesignerAssignments({
      userProfile: eng(' js '),
      projects: [{ so: '111', eng: 'JS' }],
      projectDesigners: {},
    });
    expect(cola.map(p => p.so)).toEqual(['111']);
  });

  it('un disenador asignado en blanco cuenta como sin asignar', () => {
    const cola = call(eng('JS'), proyectos, { '111': '   ', '222': '' });
    expect(cola.map(p => p.so)).toEqual(['111', '222']);
  });

  it('acepta el SO como numero ademas de string', () => {
    const cola = pendingDesignerAssignments({
      userProfile: eng('JS'),
      projects: [{ so: 111, eng: 'JS' }],
      projectDesigners: { 111: 'Iris Lopes' },
    });
    expect(cola).toEqual([]);
  });

  it('no repite un SO que aparece dos veces en la planilla', () => {
    const cola = pendingDesignerAssignments({
      userProfile: eng('JS'),
      projects: [{ so: '111', eng: 'JS' }, { so: '111', eng: 'JS' }],
      projectDesigners: {},
    });
    expect(cola.map(p => p.so)).toEqual(['111']);
  });
});

describe('pendingDesignerAssignments — roles exentos', () => {
  // Estos tres ven TODOS los proyectos de la empresa en My Projects (ver
  // myProjectsRaw). Bloquearlos los dejaria trabados por proyectos ajenos.
  it.each(['admin', 'administrative', 'engineer_nester', 'engineer-admin', 'designer'])(
    'el rol %s nunca se bloquea',
    (role) => {
      const cola = call({ role, designerName: 'JS', status: 'approved' });
      expect(cola).toEqual([]);
    },
  );

  it('sin perfil todavia cargado no bloquea', () => {
    expect(call(null)).toEqual([]);
    expect(call(undefined)).toEqual([]);
  });

  it('un ingeniero sin nombre configurado no bloquea', () => {
    // Sin designerName no hay con que matchear la columna ENG: bloquearlo
    // seria trabarlo por proyectos que no se puede saber si son suyos.
    expect(call({ role: 'engineer', designerName: '', status: 'approved' })).toEqual([]);
    expect(call({ role: 'engineer', status: 'approved' })).toEqual([]);
  });

  it('una cuenta no aprobada no bloquea: ya la frena el gate de aprobacion', () => {
    expect(call({ role: 'engineer', designerName: 'JS', status: 'pending' })).toEqual([]);
  });
});

describe('pendingDesignerAssignments — entradas degeneradas', () => {
  it('tolera listas ausentes', () => {
    expect(pendingDesignerAssignments({ userProfile: eng('JS') })).toEqual([]);
    expect(pendingDesignerAssignments({})).toEqual([]);
    expect(pendingDesignerAssignments()).toEqual([]);
  });

  it('descarta filas sin SO', () => {
    const cola = pendingDesignerAssignments({
      userProfile: eng('JS'),
      projects: [{ so: '', eng: 'JS' }, { eng: 'JS' }, { so: '111', eng: 'JS' }],
      projectDesigners: {},
    });
    expect(cola.map(p => p.so)).toEqual(['111']);
  });

  it('descarta filas con ENG vacio', () => {
    const cola = pendingDesignerAssignments({
      userProfile: eng('JS'),
      projects: [{ so: '111', eng: '' }, { so: '222' }],
      projectDesigners: {},
    });
    expect(cola).toEqual([]);
  });
});
