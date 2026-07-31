// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Detectado verificando en el navegador: al cambiar de proyecto en el
// desplegable de "Register New", el checklist tildado del proyecto anterior
// quedaba puesto. Como el intake se guarda con el SO seleccionado, eso
// significaba escribir el papeleo de un proyecto en el registro de otro.

const emptyChecklist = {
  kcdFile: false, jlContract: false, quoteComplete: false, quoteBreakdown: false,
  creditCardForm: false, drawingsSigned: false,
  finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
};
const emptyComplexity = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};
const baseProject = {
  status: 'Pending', createdAt: Date.now(), totalRooms: 1, icp: 1,
  phase1Score: null, phase2Score: null, approvedAt: null,
  checklist: emptyChecklist, complexity: emptyComplexity,
};

const ALPHA = {
  ...baseProject,
  id: '1001', projectName: 'Alpha Residence', designerName: 'Monica Gabriel',
  // Complejidad guardada: KpiContext ya la entrega derivada de la planilla.
  complexity: { ...emptyComplexity, customPanels: true },
};
const BETA = {
  ...baseProject,
  id: '1002', projectName: 'Beta Residence', designerName: 'Unassigned',
};

vi.mock('../../context/KpiContext', () => ({
  useKpi: () => ({
    designerNames: ['Monica Gabriel', 'Natalie Ball'],
    projects: [ALPHA, BETA],
    projectDesigners: {},
    addProject: vi.fn(),
    updateProject: vi.fn(async () => ({ conflict: false })),
    getProjectComplexity: () => ({}),
    getProjectNotes: () => [],
    canForceApprove: false,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import { Phase1Form } from '../Phase1Form';

afterEach(cleanup);

const KCD = 'KCD file (complete & latest)';
const PANELS = 'Custom panels / Elements?';
const COLORS = 'Colors per room defined?';

const checkboxFor = (label: string) =>
  screen.getByText(label).closest('label')!
    .querySelector('input[type="checkbox"]') as HTMLInputElement;

const renderForm = () => {
  const { container } = render(<Phase1Form />);
  const select = container.querySelector('select[name="soNumber"]') as HTMLSelectElement;
  const designer = container.querySelector('select[name="designerName"]') as HTMLSelectElement;
  return { select, designer, pick: (so: string) => fireEvent.change(select, { target: { value: so } }) };
};

describe('cambiar de proyecto en Register New', () => {
  it('no arrastra el checklist tildado al proyecto siguiente', () => {
    const { pick } = renderForm();

    pick(ALPHA.id);
    fireEvent.click(checkboxFor(KCD));
    expect(checkboxFor(KCD).checked).toBe(true);

    pick(BETA.id);
    expect(checkboxFor(KCD).checked).toBe(false);
  });

  it('no arrastra la fecha registrada del proyecto anterior', () => {
    const { pick } = renderForm();

    pick(ALPHA.id);
    fireEvent.click(checkboxFor(KCD));
    // La pildora de fecha solo se dibuja cuando el item esta tildado.
    expect(screen.queryByTitle('Click to correct the date')).not.toBeNull();

    pick(BETA.id);
    expect(screen.queryByTitle('Click to correct the date')).toBeNull();
  });

  it('carga la complejidad guardada del proyecto elegido', () => {
    const { pick } = renderForm();
    pick(ALPHA.id);
    expect(checkboxFor(PANELS).checked).toBe(true);
  });

  it('no arrastra la complejidad guardada al proyecto siguiente', () => {
    const { pick } = renderForm();
    pick(ALPHA.id);
    expect(checkboxFor(PANELS).checked).toBe(true);

    pick(BETA.id);
    expect(checkboxFor(PANELS).checked).toBe(false);
  });

  it('no arrastra una complejidad marcada a mano', () => {
    const { pick } = renderForm();

    pick(ALPHA.id);
    fireEvent.click(checkboxFor(COLORS)); // manual: no sale de la planilla
    expect(checkboxFor(COLORS).checked).toBe(true);

    pick(BETA.id);
    expect(checkboxFor(COLORS).checked).toBe(false);
  });

  it('no arrastra el diseñador del proyecto anterior', () => {
    const { designer, pick } = renderForm();

    pick(ALPHA.id);
    expect(designer.value).toBe('Monica Gabriel');

    // BETA esta Unassigned: el desplegable tiene que quedar vacio, no con el
    // diseñador de ALPHA.
    pick(BETA.id);
    expect(designer.value).toBe('');
  });

  it('volver a la opcion vacia limpia el formulario', () => {
    const { pick } = renderForm();

    pick(ALPHA.id);
    fireEvent.click(checkboxFor(KCD));

    pick('');
    expect(checkboxFor(KCD).checked).toBe(false);
    expect(checkboxFor(PANELS).checked).toBe(false);
  });
});
