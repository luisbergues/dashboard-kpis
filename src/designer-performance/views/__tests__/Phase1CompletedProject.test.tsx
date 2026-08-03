// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Regresion: "Update Project" lista los proyectos ya evaluados, incluidos los
// Completed (cerrados en Fase 2). saveIntake recalculaba el status con
// calculatePhase1ScoreAndStatus, que solo devuelve Approved/Rejected/To review
// — nunca Completed —, asi que corregir un typo del checklist revertia el
// cierre. Peor: Phase2Form lista los Approved como disponibles para cerrar, asi
// que el proyecto quedaba habilitado para un segundo cierre con otro puntaje,
// pisando el phase2Score original.

const updateProject = vi.fn(async () => ({ conflict: false }));

// Proyecto ya cerrado, con todo el checklist tildado para que las validaciones
// de "faltan datos" no interfieran con lo que se esta probando.
const COMPLETED = {
  id: '12345',
  projectName: 'Smith Residence',
  designerName: 'Monica Gabriel',
  status: 'Completed',
  createdAt: Date.now(),
  approvedAt: 1700000000000,
  totalRooms: 3,
  icp: 3,
  phase1Score: 88,
  phase2Score: 91,
  checklist: {
    kcdFile: true, jlContract: true, quoteComplete: true, quoteBreakdown: true,
    creditCardForm: true, drawingsSigned: true,
    finalMeasurementsApplies: true, finalMeasurementsDelivered: true,
  },
  complexity: {
    colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
    routingRequired: false, customPanels: false,
  },
};

// El objeto se arma una sola vez a proposito: el effect que carga el proyecto
// en modo Update depende de [projects, projectDesigners], asi que devolver
// literales nuevos en cada render haria bucle infinito (en la app real esas
// referencias vienen de useState/props y son estables entre renders).
const KPI_VALUE = {
  designerNames: ['Monica Gabriel'],
  projects: [COMPLETED],
  projectDesigners: {},
  addProject: vi.fn(),
  updateProject,
  getProjectComplexity: () => ({}),
  getProjectNotes: () => [],
  canForceApprove: false,
};

vi.mock('../../context/KpiContext', () => ({
  useKpi: () => KPI_VALUE,
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import { Phase1Form } from '../Phase1Form';

// Pasa a modo Update y elige el proyecto cerrado.
const renderInUpdateMode = () => {
  const { container } = render(<Phase1Form />);
  fireEvent.click(screen.getByText('Update Project'));
  const select = container.querySelector('select[name="soNumber"]') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: COMPLETED.id } });
  return container;
};

beforeEach(() => { updateProject.mockClear(); });
afterEach(cleanup);

describe('editar un proyecto ya Completed en Fase 1', () => {
  it('sigue apareciendo en el desplegable de Update (se puede corregir)', () => {
    const container = renderInUpdateMode();
    const select = container.querySelector('select[name="soNumber"]') as HTMLSelectElement;
    expect(select.value).toBe(COMPLETED.id);
  });

  it('NO revierte el status: se guarda como Completed', async () => {
    renderInUpdateMode();
    fireEvent.click(screen.getByText('Save & Validate'));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = updateProject.mock.calls[0][0] as { status: string };
    expect(saved.status).toBe('Completed');
  });

  it('conserva el approvedAt original en vez de re-sellarlo con la fecha de hoy', async () => {
    renderInUpdateMode();
    fireEvent.click(screen.getByText('Save & Validate'));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = updateProject.mock.calls[0][0] as { approvedAt: number };
    expect(saved.approvedAt).toBe(COMPLETED.approvedAt);
  });

  it('conserva el phase2Score ya registrado', async () => {
    renderInUpdateMode();
    fireEvent.click(screen.getByText('Save & Validate'));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = updateProject.mock.calls[0][0] as { phase2Score: number };
    expect(saved.phase2Score).toBe(COMPLETED.phase2Score);
  });

  it('igual actualiza el phase1Score, que es el punto de corregir el checklist', async () => {
    renderInUpdateMode();
    fireEvent.click(screen.getByText('Save & Validate'));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = updateProject.mock.calls[0][0] as { phase1Score: number };
    expect(typeof saved.phase1Score).toBe('number');
  });
});
