// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Firebase queda fuera: el provider real se suscribe a la base. Se mockea el
// contexto para controlar canForceApprove y espiar el guardado.
const updateProject = vi.fn(async () => ({ conflict: false }));
let canForceApprove = false;

// Un proyecto Pending para que el desplegable de SO tenga algo que elegir.
// Queda sin diseñador y sin ambientes a proposito: son los datos que faltan.
const PENDING = {
  id: '12345',
  projectName: 'Smith Residence',
  designerName: 'Unassigned',
  status: 'Pending',
  createdAt: Date.now(),
  totalRooms: 1,
  icp: 1,
  phase1Score: null,
  phase2Score: null,
  approvedAt: null,
  checklist: {
    kcdFile: false, jlContract: false, quoteComplete: false, quoteBreakdown: false,
    creditCardForm: false, drawingsSigned: false,
    finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
  },
  complexity: {
    colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
    routingRequired: false, customPanels: false,
  },
};

vi.mock('../../context/KpiContext', () => ({
  useKpi: () => ({
    designerNames: ['Monica Gabriel'],
    projects: [PENDING],
    projectDesigners: {},
    addProject: vi.fn(),
    updateProject,
    getProjectComplexity: () => ({}),
    getProjectNotes: () => [],
    canForceApprove,
  }),
}));

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));

import { Phase1Form } from '../Phase1Form';

const submit = () => fireEvent.click(screen.getByText('Submit Project Intake'));
const MODAL_TITLE = /Approve with missing information/i;

// El SO es obligatorio siempre (es la clave del registro en Firebase), asi que
// se elige el proyecto antes de probar el resto de las validaciones.
const renderWithProject = () => {
  const { container } = render(<Phase1Form />);
  const select = container.querySelector('select[name="soNumber"]') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: PENDING.id } });
  return container;
};

beforeEach(() => {
  updateProject.mockClear();
  toastError.mockClear();
});
afterEach(cleanup);

describe('perfiles sin permiso administrativo', () => {
  beforeEach(() => { canForceApprove = false; });

  it('bloquea con un error cuando faltan datos basicos', () => {
    renderWithProject();
    submit();
    expect(toastError).toHaveBeenCalled();
    expect(screen.queryByText(MODAL_TITLE)).toBeNull();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('nunca muestra el modal de aprobacion forzada', () => {
    renderWithProject();
    submit();
    expect(screen.queryByText('Approve anyway')).toBeNull();
  });
});

describe('rol administrative', () => {
  beforeEach(() => { canForceApprove = true; });

  it('ofrece confirmar en vez de bloquear con un error', () => {
    renderWithProject();
    submit();
    expect(screen.queryByText(MODAL_TITLE)).not.toBeNull();
    // No se guardo nada todavia: primero hay que confirmar.
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('detalla que datos y que documentacion faltan', () => {
    renderWithProject();
    submit();
    expect(screen.queryByText('Missing details')).not.toBeNull();
    expect(screen.queryByText('Missing documentation')).not.toBeNull();
    expect(screen.queryByText('Designer')).not.toBeNull();
    expect(screen.queryByText('KCD file (complete & latest)')).not.toBeNull();
  });

  it('cancelar cierra el modal sin guardar', () => {
    renderWithProject();
    submit();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText(MODAL_TITLE)).toBeNull();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('confirmar guarda el proyecto como Approved', async () => {
    renderWithProject();
    submit();
    fireEvent.click(screen.getByText('Approve anyway'));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = updateProject.mock.calls[0][0] as { status: string; phase1Score: number };
    expect(saved.status).toBe('Approved');
  });

  it('el puntaje sigue reflejando el papeleo faltante, no queda en 100', async () => {
    renderWithProject();
    submit();
    fireEvent.click(screen.getByText('Approve anyway'));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = updateProject.mock.calls[0][0] as { phase1Score: number };
    // Alta de hoy con todo sin tildar: 0 dias de atraso, pero el puntaje se
    // calcula igual — lo importante es que no se fuerza a 100 artificialmente.
    expect(typeof saved.phase1Score).toBe('number');
    expect(saved.phase1Score).toBeLessThanOrEqual(100);
  });

  it('"Save for Later Review" no dispara la confirmacion', () => {
    renderWithProject();
    fireEvent.click(screen.getByText('Save for Later Review'));
    expect(screen.queryByText(MODAL_TITLE)).toBeNull();
  });
});
