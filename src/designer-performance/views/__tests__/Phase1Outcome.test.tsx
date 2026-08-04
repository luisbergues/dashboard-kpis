// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import type { Phase1OutcomeRecord } from '../../types';

// La revision manual (Complete / Deficient / Deferred) es lo que aprueba la
// Fase 1. Deficient y Deferred no se pueden registrar sin dejar por escrito el
// motivo y la fecha limite para subsanarlo.

const updateProject = vi.fn(async () => ({ conflict: false }));

const emptyChecklist = {
  kcdFile: false, jlContract: false, quoteComplete: false, quoteBreakdown: false,
  creditCardForm: false, drawingsSigned: false,
  finalMeasurementsApplies: false, finalMeasurementsDelivered: false,
};
const emptyComplexity = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};

const PENDING = {
  id: '1001', projectName: 'Alpha Residence', designerName: 'Monica Gabriel',
  status: 'Pending', createdAt: Date.now(), approvedAt: null,
  totalRooms: 1, icp: 1, phase1Score: null, phase2Score: null,
  checklist: emptyChecklist, complexity: emptyComplexity,
};

// Plazo del 10-ago-2026, ya vencido y sin subsanar.
const DEADLINE = new Date(2026, 7, 10).getTime();
const SAVED_OUTCOME: Phase1OutcomeRecord = {
  result: 'Deficient', reason: 'faltan medidas de la pared 3',
  deadline: DEADLINE, setAt: new Date(2026, 7, 3).getTime(), resolvedAt: null,
};
const DEFICIENT = {
  ...PENDING, id: '2002', projectName: 'Beta Residence',
  status: 'Deficient', phase1Score: 90, outcome: SAVED_OUTCOME,
};

const KPI_VALUE = {
  designerNames: ['Monica Gabriel'],
  projects: [PENDING, DEFICIENT],
  projectDesigners: { '1001': 'Monica Gabriel', '2002': 'Monica Gabriel' },
  addProject: vi.fn(),
  updateProject,
  getProjectComplexity: () => ({}),
  getProjectNotes: () => [],
  getProjectHistory: () => [],
  actor: { uid: 'u1', name: 'Monica Gabriel' },
  canForceApprove: false,
};

vi.mock('../../context/KpiContext', () => ({ useKpi: () => KPI_VALUE }));

const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));

// La redaccion automatica se prueba aparte (reviewNoteApi.test.ts); aca solo
// interesa que rellene la nota, asi que devuelve un texto fijo.
const AUTO_DRAFT = 'Auto-drafted note for the designer.';
const generateReviewNote = vi.fn(async () => AUTO_DRAFT);
vi.mock('../../utils/reviewNoteApi', () => ({
  generateReviewNote: (...a: unknown[]) => generateReviewNote(...(a as [])),
}));

import { Phase1Form } from '../Phase1Form';

const REQUIRED_DOCS = [
  'KCD file (complete & latest)',
  'JL Contract (complete & signed)',
  'Quote (complete by room)',
  'Quote breakdown',
  'Credit Card Form',
  'Drawings (signed by client)',
];

const chooseOutcome = (container: HTMLElement, value: string) =>
  fireEvent.click(container.querySelector(`input[name="phase1Outcome"][value="${value}"]`) as HTMLInputElement);

const typeReason = (container: HTMLElement, text: string) =>
  fireEvent.change(container.querySelector('textarea[name="outcomeReason"]') as HTMLTextAreaElement,
    { target: { value: text } });

// El plazo usa el MiniDatePicker: se abre la pildora y se elige un dia.
const pickDeadline = (dayNumber = 28) => {
  fireEvent.click(screen.getByText(/Pick a deadline/));
  const popover = document.querySelector('[role="dialog"]') as HTMLElement;
  const btn = Array.from(popover.querySelectorAll('button'))
    .find(b => b.textContent === String(dayNumber)) as HTMLButtonElement;
  fireEvent.click(btn);
};

const checkAllDocs = () => REQUIRED_DOCS.forEach(label =>
  fireEvent.click(screen.getByText(label).closest('label')!
    .querySelector('input[type="checkbox"]') as HTMLInputElement));

const renderNew = () => {
  const { container } = render(<Phase1Form />);
  fireEvent.change(container.querySelector('select[name="soNumber"]') as HTMLSelectElement,
    { target: { value: PENDING.id } });
  fireEvent.change(container.querySelector('input[name="totalRooms"]') as HTMLInputElement,
    { target: { value: '3' } });
  return container;
};

const submit = () => fireEvent.click(screen.getByText('Submit Project Intake'));
const savedArg = () => updateProject.mock.calls[0][0] as unknown as {
  status: string; outcome: Phase1OutcomeRecord; phase1Score: number;
};

describe('un rechazo de las reglas no pasa desapercibido', () => {
  it('avisa cuando la base niega el guardado, en vez de quedarse mudo', async () => {
    updateProject.mockResolvedValueOnce({
      conflict: false, error: 'The database rejected this change — you may not have permission for it.',
    } as never);

    const c = renderNew();
    checkAllDocs();
    chooseOutcome(c, 'Complete');
    submit();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining('rejected')));
  });
});

describe('queda registrado quien fijo el resultado', () => {
  it('sella setBy al marcar Deficient', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    typeReason(c, 'faltan medidas');
    pickDeadline();
    submit();

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(savedArg().outcome.setBy).toEqual({ uid: 'u1', name: 'Monica Gabriel' });
  });

  it('sella setBy tambien al aprobar', async () => {
    const c = renderNew();
    checkAllDocs();
    chooseOutcome(c, 'Complete');
    submit();

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(savedArg().outcome.setBy).toEqual({ uid: 'u1', name: 'Monica Gabriel' });
  });
});

beforeEach(() => { updateProject.mockClear(); toastError.mockClear(); generateReviewNote.mockClear(); });
afterEach(cleanup);

describe('redaccion automatica de la nota', () => {
  const reasonValue = (c: HTMLElement) =>
    (c.querySelector('textarea[name="outcomeReason"]') as HTMLTextAreaElement).value;

  it('al elegir un resultado redacta la nota sola', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    await waitFor(() => expect(reasonValue(c)).toBe(AUTO_DRAFT));
  });

  it('le pasa el resultado y los documentos faltantes del checklist', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    await waitFor(() => expect(generateReviewNote).toHaveBeenCalled());
    const arg = generateReviewNote.mock.calls[0][0] as unknown as {
      outcome: string; missingDocs: string[]; soNumber: string;
    };
    expect(arg.outcome).toBe('Deficient');
    expect(arg.soNumber).toBe(PENDING.id);
    // Nada tildado todavia: tienen que ir los 6 obligatorios.
    expect(arg.missingDocs).toEqual(expect.arrayContaining(REQUIRED_DOCS));
  });

  it('solo lista lo que realmente falta', async () => {
    const c = renderNew();
    checkAllDocs();
    chooseOutcome(c, 'Complete');
    await waitFor(() => expect(generateReviewNote).toHaveBeenCalled());
    const arg = generateReviewNote.mock.calls[0][0] as unknown as { missingDocs: string[] };
    expect(arg.missingDocs).toEqual([]);
  });

  it('NO pisa lo que el ingeniero ya habia escrito', async () => {
    const c = renderNew();
    typeReason(c, 'texto propio del ingeniero');
    chooseOutcome(c, 'Deferred');
    await waitFor(() => expect(generateReviewNote).not.toHaveBeenCalled());
    expect(reasonValue(c)).toBe('texto propio del ingeniero');
  });

  it('tampoco pisa lo escrito mientras el modelo redactaba', async () => {
    let resolver: (v: string) => void = () => {};
    generateReviewNote.mockImplementationOnce(() => new Promise(r => { resolver = r; }));

    const c = renderNew();
    chooseOutcome(c, 'Deficient');        // arranca el borrador
    typeReason(c, 'lo escribo yo mismo'); // el ingeniero no espera

    // act(async) vacia microtareas y efectos: sin esto la asercion corria antes
    // de que React procesara la resolucion y pasaba aun sin la guarda.
    await act(async () => { resolver(AUTO_DRAFT); });

    expect(reasonValue(c)).toBe('lo escribo yo mismo');
  });

  it('"Draft again" si pisa lo escrito: es un pedido explicito', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    await waitFor(() => expect(reasonValue(c)).toBe(AUTO_DRAFT));
    typeReason(c, 'algo mio');

    fireEvent.click(screen.getByText('Draft again'));
    await waitFor(() => expect(reasonValue(c)).toBe(AUTO_DRAFT));
  });

  it('elegir el plazo rehace la nota para que incluya la fecha', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    await waitFor(() => expect(generateReviewNote).toHaveBeenCalledTimes(1));
    pickDeadline();
    await waitFor(() => expect(generateReviewNote).toHaveBeenCalledTimes(2));
    const arg = generateReviewNote.mock.calls[1][0] as unknown as { deadline: number | null };
    expect(arg.deadline).toBeGreaterThan(0);
  });
});

describe('la nota escrita esta siempre disponible', () => {
  it('se ve aun sin haber elegido resultado', () => {
    const c = renderNew();
    expect(c.querySelector('textarea[name="outcomeReason"]')).not.toBeNull();
  });

  it('lo escrito sobrevive al cambiar de resultado', () => {
    const c = renderNew();
    typeReason(c, 'falta la firma del cliente');
    chooseOutcome(c, 'Deferred');
    expect((c.querySelector('textarea[name="outcomeReason"]') as HTMLTextAreaElement).value)
      .toBe('falta la firma del cliente');
  });
});

describe('elegir un resultado es obligatorio', () => {
  it('no guarda si no se eligio ninguno', () => {
    renderNew();
    submit();
    expect(updateProject).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Review result'));
  });

  it('"Save for Later Review" no lo exige: no cierra la revision', async () => {
    renderNew();
    fireEvent.click(screen.getByText('Save for Later Review'));
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(savedArg().status).toBe('To review');
  });
});

describe('Deficient exige aviso escrito y plazo de subsanacion', () => {
  it('no guarda si el ingeniero borra el aviso redactado', () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    typeReason(c, ''); // borra el borrador automatico
    submit();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('no guarda con el aviso pero sin plazo', () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    typeReason(c, 'hay errores en las medidas');
    submit();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('no acepta un aviso en blanco', () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    typeReason(c, '   ');
    pickDeadline();
    submit();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('guarda con aviso y plazo, y deja el proyecto en Deficient', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    typeReason(c, 'hay errores en las medidas');
    pickDeadline();
    submit();

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = savedArg();
    expect(saved.status).toBe('Deficient');
    expect(saved.outcome.result).toBe('Deficient');
    expect(saved.outcome.reason).toBe('hay errores en las medidas');
    expect(saved.outcome.deadline).toBeGreaterThan(0);
    expect(saved.outcome.resolvedAt).toBeNull();
  });

  it('NO exige el checklist completo: registrar que falta papeleo es su proposito', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deficient');
    typeReason(c, 'faltan firmas');
    pickDeadline();
    submit();
    // El checklist quedo entero sin tildar y aun asi se guardo.
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
  });
});

describe('Deferred exige razon escrita y plazo', () => {
  it('no guarda si se borra la razon', () => {
    const c = renderNew();
    chooseOutcome(c, 'Deferred');
    pickDeadline();
    typeReason(c, '');
    submit();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('guarda y deja el proyecto en Deferred', async () => {
    const c = renderNew();
    chooseOutcome(c, 'Deferred');
    typeReason(c, 'falta el contrato firmado');
    pickDeadline();
    submit();

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = savedArg();
    expect(saved.status).toBe('Deferred');
    expect(saved.outcome.reason).toBe('falta el contrato firmado');
  });
});

describe('Complete', () => {
  it('no pide plazo', () => {
    const c = renderNew();
    chooseOutcome(c, 'Complete');
    expect(screen.queryByText(/Pick a deadline/)).toBeNull();
  });

  it('igual ofrece la nota, para que el diseñador sepa como cerro', () => {
    const c = renderNew();
    chooseOutcome(c, 'Complete');
    expect(c.querySelector('textarea[name="outcomeReason"]')).not.toBeNull();
  });

  it('guarda la nota escrita en vez de descartarla', async () => {
    const c = renderNew();
    checkAllDocs();
    chooseOutcome(c, 'Complete');
    typeReason(c, 'aprobado tal cual, la elevacion revisada llego a tiempo');
    submit();

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(savedArg().outcome.reason).toBe('aprobado tal cual, la elevacion revisada llego a tiempo');
  });

  it('la nota es opcional: sin escribir nada igual se aprueba', async () => {
    const c = renderNew();
    checkAllDocs();
    chooseOutcome(c, 'Complete');
    submit();
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(savedArg().status).toBe('Approved');
  });

  it('se bloquea si falta documentacion', () => {
    const c = renderNew();
    chooseOutcome(c, 'Complete');
    submit();
    expect(updateProject).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Complete'));
  });

  it('con el checklist entero aprueba y habilita Fase 2', async () => {
    const c = renderNew();
    checkAllDocs();
    chooseOutcome(c, 'Complete');
    submit();

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    // 'Approved' es el estado interno de Complete, el que Fase 2 acepta.
    expect(savedArg().status).toBe('Approved');
  });
});

describe('subsanar un Deficient', () => {
  const renderUpdateDeficient = () => {
    const { container } = render(<Phase1Form />);
    fireEvent.click(screen.getByText('Update Project'));
    fireEvent.change(container.querySelector('select[name="soNumber"]') as HTMLSelectElement,
      { target: { value: DEFICIENT.id } });
    return container;
  };

  it('precarga el resultado y el aviso ya registrados', () => {
    const c = renderUpdateDeficient();
    const radio = c.querySelector('input[name="phase1Outcome"][value="Deficient"]') as HTMLInputElement;
    expect(radio.checked).toBe(true);
    expect((c.querySelector('textarea[name="outcomeReason"]') as HTMLTextAreaElement).value)
      .toBe(SAVED_OUTCOME.reason);
  });

  it('al pasar a Complete conserva el plazo y lo sella, en vez de borrarlo', async () => {
    const c = renderUpdateDeficient();
    checkAllDocs();
    chooseOutcome(c, 'Complete');
    fireEvent.click(screen.getByText('Save & Validate'));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const saved = savedArg();
    expect(saved.status).toBe('Approved');
    expect(saved.outcome.result).toBe('Complete');
    // El plazo sobrevive: lo acumulado por llegar tarde se sigue descontando.
    expect(saved.outcome.deadline).toBe(DEADLINE);
    expect(saved.outcome.resolvedAt).not.toBeNull();
  });
});
