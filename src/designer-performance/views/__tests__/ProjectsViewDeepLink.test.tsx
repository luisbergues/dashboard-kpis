// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// Regresion: abrir un link compartido (?so=12575) mostraba la ficha vacia
// —Pending, checklist 0%, fecha de hoy— y no se actualizaba nunca.
//
// Causa: los proyectos salen de la planilla apenas carga, pero sus datos
// guardados llegan despues por Firebase. La ficha guardaba el OBJETO del
// proyecto, asi que quedaba congelada en esa primera version vacia.

const EMPTY_CHECKLIST = {
  kcdFile: false, jlContract: false, quoteComplete: false, quoteBreakdown: false,
  creditCardForm: false, drawingsSigned: false,
  finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
};
const COMPLEXITY = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};

// Antes de que responda Firebase: solo lo que aporta la planilla.
const PLACEHOLDER = {
  id: '12575', projectName: 'Leslie Fenton', designerName: 'Unassigned',
  status: 'Pending', createdAt: Date.now(), approvedAt: null,
  totalRooms: 1, icp: 1, phase1Score: null, phase2Score: null,
  checklist: EMPTY_CHECKLIST, complexity: COMPLEXITY,
};

// Lo mismo, ya con los datos guardados.
const LOADED = {
  ...PLACEHOLDER,
  status: 'Approved', phase1Score: 94, totalRooms: 3,
  designerName: 'Malanie Dalfrey',
  checklist: { ...EMPTY_CHECKLIST, kcdFile: Date.now(), jlContract: Date.now() },
};

let projects: unknown[] = [PLACEHOLDER];

vi.mock('../../context/KpiContext', () => ({
  useKpi: () => ({ projects, getProjectHistory: () => [] }),
}));
vi.mock('../../../utils/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('../../../utils/LanguageContext', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));

// El link compartido apunta a este SO.
vi.mock('../../../utils/projectDeepLink', () => ({ getSharedProjectSo: () => '12575' }));

import { ProjectsView } from '../ProjectsView';

afterEach(() => { cleanup(); projects = [PLACEHOLDER]; });

// El mock de useLanguage devuelve la clave, asi que el boton de cerrar se
// identifica por su clave de traduccion y no por el texto final.
const CLOSE_KEY = 'designerPerf.modal.closeDetails';
const modalIsOpen = () => screen.queryByText(CLOSE_KEY) !== null;

describe('ficha abierta desde un link compartido', () => {
  it('se abre sola con el proyecto del link', () => {
    render(<ProjectsView />);
    expect(modalIsOpen()).toBe(true);
    expect(screen.getAllByText(/Leslie Fenton/).length).toBeGreaterThan(0);
  });

  it('se actualiza cuando llegan los datos guardados, en vez de quedar vacia', () => {
    // El porcentaje del checklist se dibuja SOLO dentro de la ficha. La fila de
    // la tabla usa datos vivos siempre, asi que mirar el puntaje ahi no probaba
    // nada sobre el modal.
    const { rerender } = render(<ProjectsView />);
    expect(screen.getByText('0%')).toBeTruthy();

    // Llegan los datos guardados y la lista se rehace.
    projects = [LOADED];
    rerender(<ProjectsView />);

    // La ficha sigue abierta y ahora refleja el checklist real (2 de 6).
    expect(modalIsOpen()).toBe(true);
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('cerrarla la cierra de verdad y no se reabre al llegar datos nuevos', () => {
    const { rerender } = render(<ProjectsView />);
    fireEvent.click(screen.getByText(CLOSE_KEY));
    expect(modalIsOpen()).toBe(false);

    projects = [LOADED];
    rerender(<ProjectsView />);
    expect(modalIsOpen()).toBe(false);
  });
});
