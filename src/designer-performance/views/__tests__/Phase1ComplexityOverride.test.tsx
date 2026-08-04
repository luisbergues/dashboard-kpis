// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { deriveComplexity } from '../../utils/complexity';

// Reportado en produccion: en Technical Complexity, tildar a mano un campo
// que la planilla marca "No" (Routing/Dovetail, Custom panels) se guardaba
// bien en el momento, pero en cuanto volvia a leerse el proyecto — la
// siguiente vez que se abria, o tras el refetch de 30s — la planilla lo
// volvia a pisar y el tilde manual desaparecia. Motivo: deriveComplexity
// hacia ganar a la planilla en las dos direcciones, sin forma de fijar una
// correccion manual. Ver utils/complexity.ts.

const emptyChecklist = {
  kcdFile: false, jlContract: false, quoteComplete: false, quoteBreakdown: false,
  creditCardForm: false, drawingsSigned: false,
  finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
};
const emptyComplexity = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};

// La planilla dice "Yes" solo para 2 de los 4 campos — como en la captura
// del reporte ("2 synced").
const MAT_REQ = { thermofoil: 'Yes', noHoles: 'Yes', dovetail: 'No', element: 'No' };

const SAVED = {
  id: '12580',
  projectName: 'Complexity Residence',
  designerName: 'Monica Gabriel',
  // No-Pending para que aparezca en el desplegable de "Update Project"
  // (activeProjects de "Register New" solo lista los Pending).
  status: 'To review',
  createdAt: Date.now(),
  approvedAt: null,
  totalRooms: 3,
  icp: 1,
  phase1Score: null,
  phase2Score: null,
  checklist: emptyChecklist,
  // Lo que ya trae la planilla, sin ningun override todavia.
  complexity: deriveComplexity(undefined, MAT_REQ),
  complexityOverrides: undefined as Record<string, boolean> | undefined,
};

let projects: any[] = [];
let lastWrite: any = null;
const updateProjectMock = vi.fn(async (project: any) => {
  lastWrite = project;
  return { conflict: false };
});

// Simula lo que hace KpiContext tras un guardado: releer perfData.complexity +
// perfData.complexityOverrides y re-derivarlos contra la misma planilla.
const applyServerRoundTrip = () => {
  if (!lastWrite) return;
  const recomputed = {
    ...lastWrite,
    complexity: deriveComplexity(lastWrite.complexity, MAT_REQ, lastWrite.complexityOverrides),
  };
  projects = [recomputed];
  lastWrite = recomputed;
};

vi.mock('../../context/KpiContext', () => ({
  useKpi: () => ({
    designerNames: ['Monica Gabriel', 'Natalie Ball'],
    projects,
    projectDesigners: {},
    addProject: vi.fn(),
    updateProject: updateProjectMock,
    getProjectComplexity: (so: string) => (so === SAVED.id ? { thermofoilDoors: true, customBoreHoles: true, routingRequired: false, customPanels: false } : {}),
    getProjectNotes: () => [],
    canForceApprove: false,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import { Phase1Form } from '../Phase1Form';

beforeEach(() => {
  projects = [{ ...SAVED, complexity: deriveComplexity(undefined, MAT_REQ) }];
  lastWrite = null;
  updateProjectMock.mockClear();
});
afterEach(cleanup);

const ROUTING = 'Routing / Dovetail required?';
const THERMOFOIL = 'Thermofoil / Element doors?';

const checkboxFor = (label: string) =>
  screen.getByText(label).closest('label')!
    .querySelector('input[type="checkbox"]') as HTMLInputElement;

const openInUpdateMode = () => {
  const utils = render(<Phase1Form />);
  fireEvent.click(screen.getByText('Update Project'));
  const select = utils.container.querySelector('select[name="soNumber"]') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: SAVED.id } });
  return utils;
};

// Un rerender() del MISMO componente no alcanza para probar "se guardo bien
// y sobrevive a que se vuelva a abrir": el guard de hydratedKey (que evita
// que un refetch pise una edicion en curso) tambien evita que se vuelva a
// leer `projects` sobre el MISMO render. Reabrir de verdad implica desmontar
// y volver a elegir el proyecto, como pasa al reabrir la pagina o volver a
// entrar al formulario.
const reopenInUpdateMode = () => {
  cleanup();
  return openInUpdateMode();
};

describe('tildar a mano un campo que la planilla marca "No"', () => {
  it('sin tocarlo, la planilla sigue ganando (comportamiento previo intacto)', () => {
    openInUpdateMode();
    expect(checkboxFor(ROUTING).checked).toBe(false);
  });

  it('se puede tildar en pantalla', () => {
    openInUpdateMode();
    fireEvent.click(checkboxFor(ROUTING));
    expect(checkboxFor(ROUTING).checked).toBe(true);
  });

  it('sobrevive al guardado y a reabrir el proyecto con la planilla en el mismo "No"', async () => {
    openInUpdateMode();
    fireEvent.click(checkboxFor(ROUTING));
    expect(checkboxFor(ROUTING).checked).toBe(true);

    // "Save for Later Review" no exige haber elegido un resultado de revision
    // (outcome), asi que no hace falta llenar el checklist ni la nota para
    // probar el guardado de complexity.
    await act(async () => {
      fireEvent.click(screen.getByText('Save for Later Review'));
    });

    // El guardado tuvo que marcar el override para este campo.
    expect(lastWrite?.complexityOverrides?.routingRequired).toBe(true);

    // Simula lo que hace KpiContext al releer: recalcula complexity contra
    // la misma planilla (que sigue diciendo "No" para este campo) y lo que
    // pasa al reabrir el formulario (desmontar y volver a elegir el SO).
    applyServerRoundTrip();
    reopenInUpdateMode();

    expect(checkboxFor(ROUTING).checked, 'la planilla volvio a pisar el override').toBe(true);
  });

  it('no afecta a los campos que la planilla ya trae en Yes', async () => {
    openInUpdateMode();
    fireEvent.click(checkboxFor(ROUTING));

    // "Save for Later Review" no exige haber elegido un resultado de revision
    // (outcome), asi que no hace falta llenar el checklist ni la nota para
    // probar el guardado de complexity.
    await act(async () => {
      fireEvent.click(screen.getByText('Save for Later Review'));
    });
    applyServerRoundTrip();
    reopenInUpdateMode();

    // thermofoilDoors nunca se toco: sigue gobernado por la planilla.
    expect(checkboxFor(THERMOFOIL).checked).toBe(true);
    expect(lastWrite?.complexityOverrides?.thermofoilDoors).toBeFalsy();
  });
});
