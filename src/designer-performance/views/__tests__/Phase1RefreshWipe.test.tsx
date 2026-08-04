// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// El bug reportado: al ir tildando el checklist en "Update Project" se
// destildaban casillas solas y la fecha corregida volvia a la guardada.
//
// La causa no estaba en el checklist sino en el refresco de datos. App.jsx
// refetchea cada 30 s (refetchInterval: 30000), KpiContext rehace el array
// `projects` con cada refetch, y el efecto de carga de Phase1Form tenia
// `projects` en sus dependencias: volvia a hidratar el formulario desde la
// base y pisaba todo lo editado que aun no se habia guardado.
//
// Estos tests simulan ese refresco: mismos datos, array nuevo.

const emptyChecklist = {
  kcdFile: false, jlContract: false, quoteComplete: false, quoteBreakdown: false,
  creditCardForm: false, drawingsSigned: false,
  finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
};
const emptyComplexity = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};

// Fecha guardada en la base. El usuario reporto que su correccion volvia a
// "Jul 02, 2026": es este valor el que reaparecia.
const SAVED_DATE = new Date(2026, 6, 2, 10, 0, 0).getTime();

const SAVED = {
  id: '12575',
  projectName: 'Saved Residence',
  designerName: 'Monica Gabriel',
  status: 'Approved',
  createdAt: new Date(2026, 5, 1).getTime(),
  approvedAt: null,
  totalRooms: 3,
  icp: 1,
  phase1Score: 80,
  phase2Score: null,
  checklist: { ...emptyChecklist, kcdFile: SAVED_DATE },
  complexity: emptyComplexity,
};

// `projects` se reemplaza por un array nuevo con el mismo contenido, tal como
// hace KpiContext en cada refetch.
let projects: any[] = [SAVED];
const simulateRefetch = () => { projects = projects.map(p => ({ ...p, checklist: { ...p.checklist } })); };

// Referencias estables fuera del factory: el contexto real devuelve el mismo
// objeto entre renders salvo que el dato subyacente cambie. Un literal nuevo
// en cada llamada a useKpi() (como projectDesigners: {}) rompe la comparacion
// por referencia del efecto de auto-carga y lo deja re-disparandose sin fin,
// como paso al escribir este test la primera vez.
const stableDesignerNames = ['Monica Gabriel', 'Natalie Ball'];
const stableProjectDesigners = {};
const stableAddProject = vi.fn();
const stableUpdateProject = vi.fn(async () => ({ conflict: false }));
const stableGetProjectComplexity = () => ({});
const stableGetProjectNotes = () => [];

vi.mock('../../context/KpiContext', () => ({
  useKpi: () => ({
    designerNames: stableDesignerNames,
    projects,
    projectDesigners: stableProjectDesigners,
    addProject: stableAddProject,
    updateProject: stableUpdateProject,
    getProjectComplexity: stableGetProjectComplexity,
    getProjectNotes: stableGetProjectNotes,
    canForceApprove: false,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import { Phase1Form } from '../Phase1Form';

beforeEach(() => { projects = [SAVED]; });
afterEach(cleanup);

const KCD = 'KCD file (complete & latest)';
const CONTRACT = 'JL Contract (complete & signed)';

const checkboxFor = (label: string) =>
  screen.getByText(label).closest('label')!
    .querySelector('input[type="checkbox"]') as HTMLInputElement;

/** Abre el proyecto guardado en modo Update, listo para editar. */
const openInUpdateMode = () => {
  const utils = render(<Phase1Form />);
  fireEvent.click(screen.getByText('Update Project'));
  const select = utils.container.querySelector('select[name="soNumber"]') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: SAVED.id } });
  // Un refetch redibuja el arbol entero: es asi como llegaba el pisotazo.
  const refetch = () => { simulateRefetch(); utils.rerender(<Phase1Form />); };
  return { ...utils, refetch };
};

describe('un refresco de datos no puede pisar la edicion en curso', () => {
  it('conserva una casilla recien tildada', () => {
    const { refetch } = openInUpdateMode();

    fireEvent.click(checkboxFor(CONTRACT));
    expect(checkboxFor(CONTRACT).checked).toBe(true);

    refetch();

    expect(checkboxFor(CONTRACT).checked).toBe(true);
  });

  it('conserva una casilla recien destildada', () => {
    const { refetch } = openInUpdateMode();

    // kcdFile viene tildado de la base; destildarlo es una edicion valida.
    expect(checkboxFor(KCD).checked).toBe(true);
    fireEvent.click(checkboxFor(KCD));
    expect(checkboxFor(KCD).checked).toBe(false);

    refetch();

    expect(checkboxFor(KCD).checked).toBe(false);
  });

  it('conserva varias casillas tildadas seguidas', () => {
    // El escenario exacto del reporte: llenar todo el checklist de una.
    const { refetch } = openInUpdateMode();
    const items = [CONTRACT, 'Quote (complete by room)', 'Quote breakdown', 'Credit Card Form'];

    items.forEach(label => fireEvent.click(checkboxFor(label)));
    refetch();

    items.forEach(label => {
      expect(checkboxFor(label).checked, `${label} se destildo solo`).toBe(true);
    });
  });

  it('conserva la fecha corregida a mano', () => {
    const { refetch, container } = openInUpdateMode();

    fireEvent.click(screen.getByTitle('Click to correct the date'));
    const dialog = container.querySelector('[role="dialog"]')!;
    // Cualquier dia distinto al guardado sirve: se elige el 15.
    fireEvent.click(screen.getByText('15'));
    expect(screen.getByTitle('Click to correct the date').textContent).toContain('15');

    refetch();

    const pill = screen.getByTitle('Click to correct the date').textContent!;
    expect(pill, 'la fecha volvio a la guardada').toContain('15');
    expect(pill).not.toContain('Jul 02');
    expect(dialog).toBeTruthy();
  });

  it('conserva el total de ambientes escrito a medias', () => {
    const { refetch, container } = openInUpdateMode();
    const rooms = container.querySelector('input[name="totalRooms"]') as HTMLInputElement;

    fireEvent.change(rooms, { target: { value: '7' } });
    refetch();

    expect(rooms.value).toBe('7');
  });

  it('conserva la nota de revision que se esta escribiendo', () => {
    const { refetch, container } = openInUpdateMode();
    const note = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.change(note, { target: { value: 'Falta el credit card form.' } });
    refetch();

    expect(note.value).toBe('Falta el credit card form.');
  });
});

describe('lo que el refresco si tiene que seguir haciendo', () => {
  it('carga el proyecto al elegirlo', () => {
    openInUpdateMode();
    expect(checkboxFor(KCD).checked).toBe(true);
    expect(screen.getByTitle('Click to correct the date').textContent).toContain('Jul 02');
  });

  it('recarga al cambiar a otro proyecto y al volver', () => {
    const OTHER = { ...SAVED, id: '12576', projectName: 'Other Residence', checklist: emptyChecklist };
    projects = [SAVED, OTHER];

    const utils = render(<Phase1Form />);
    fireEvent.click(screen.getByText('Update Project'));
    const select = utils.container.querySelector('select[name="soNumber"]') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: SAVED.id } });
    expect(checkboxFor(KCD).checked).toBe(true);

    fireEvent.change(select, { target: { value: OTHER.id } });
    expect(checkboxFor(KCD).checked).toBe(false);

    // Volver tiene que traer de nuevo lo guardado, no dejar el estado del otro.
    fireEvent.change(select, { target: { value: SAVED.id } });
    expect(checkboxFor(KCD).checked).toBe(true);
  });

  it('hidrata cuando el proyecto llega despues de seleccionarlo', () => {
    // Al abrir un link compartido el SO se fija antes de que Firebase responda.
    projects = [];
    const utils = render(<Phase1Form />);
    fireEvent.click(screen.getByText('Update Project'));

    projects = [SAVED];
    utils.rerender(<Phase1Form />);
    const select = utils.container.querySelector('select[name="soNumber"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: SAVED.id } });

    expect(checkboxFor(KCD).checked).toBe(true);
  });
});
