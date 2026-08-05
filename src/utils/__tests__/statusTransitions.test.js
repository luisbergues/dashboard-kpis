import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: (_db, path) => ({ path }),
  get: vi.fn(),
  update: vi.fn(),
}));

import {
  pendingStatusTransitions,
  lastRecordedStatus,
  normalizeStatus,
  STAGE_EVENT_TYPE,
} from '../statusTransitions';

const stageEvent = (status, timestamp) => ({ type: STAGE_EVENT_TYPE, status, timestamp });

describe('normalizeStatus', () => {
  it('normaliza mayusculas y espacios del texto del sheet', () => {
    expect(normalizeStatus(' nesting ')).toBe('NESTING');
    expect(normalizeStatus('Completed')).toBe('COMPLETED');
  });

  it('no explota con null/undefined', () => {
    expect(normalizeStatus(null)).toBe('');
    expect(normalizeStatus(undefined)).toBe('');
  });
});

describe('lastRecordedStatus', () => {
  it('devuelve el ultimo estado de etapa registrado', () => {
    const history = [stageEvent('ENGINEERING', '2026-01-01'), stageEvent('NESTING', '2026-02-01')];
    expect(lastRecordedStatus(history)).toBe('NESTING');
  });

  it('devuelve null cuando no hay historial', () => {
    expect(lastRecordedStatus([])).toBeNull();
    expect(lastRecordedStatus(undefined)).toBeNull();
  });

  // project_history ya tenia eventos ON HOLD / ACTIVE escritos a mano desde
  // MyProjectsView. Usan otro vocabulario de estados: si se mezclaran, al
  // liberar un hold el ultimo estado seria 'ACTIVE' y se registraria una
  // transicion falsa a la etapa en la que el proyecto ya estaba.
  it('ignora los eventos de ON HOLD / ACTIVE preexistentes', () => {
    const history = [
      stageEvent('NESTING', '2026-02-01'),
      { type: 'status_change', status: 'ON HOLD', timestamp: '2026-03-01' },
      { type: 'status_change', status: 'ACTIVE', timestamp: '2026-03-05' },
    ];
    expect(lastRecordedStatus(history)).toBe('NESTING');
  });
});

describe('pendingStatusTransitions', () => {
  const TS = '2026-08-05T12:00:00.000Z';

  it('registra un proyecto que todavia no tiene historial', () => {
    const pending = pendingStatusTransitions([{ so: '100', status: 'Engineering' }], {}, TS);
    expect(pending).toHaveLength(1);
    expect(pending[0].so).toBe('100');
    expect(pending[0].event).toEqual({ type: STAGE_EVENT_TYPE, status: 'ENGINEERING', timestamp: TS });
  });

  it('registra un cambio de etapa real', () => {
    const history = { '100': [stageEvent('ENGINEERING', '2026-01-01')] };
    const pending = pendingStatusTransitions([{ so: '100', status: 'Nesting' }], history, TS);
    expect(pending).toHaveLength(1);
    expect(pending[0].event.status).toBe('NESTING');
  });

  // Esto corre cada 30s: sin este corte, cada lectura agregaria un evento y el
  // historial creceria sin limite con el mismo estado repetido.
  it('NO registra nada cuando el estado no cambio', () => {
    const history = { '100': [stageEvent('NESTING', '2026-01-01')] };
    const pending = pendingStatusTransitions([{ so: '100', status: 'Nesting' }], history, TS);
    expect(pending).toEqual([]);
  });

  it('ignora estados que no son una etapa del proceso', () => {
    const projects = [
      { so: '100', status: 'ON HOLD' },
      { so: '200', status: '' },
      { so: '300', status: 'TBD' },
    ];
    expect(pendingStatusTransitions(projects, {}, TS)).toEqual([]);
  });

  it('ignora filas sin SO', () => {
    expect(pendingStatusTransitions([{ status: 'Nesting' }], {}, TS)).toEqual([]);
  });

  it('detecta varios proyectos en una sola pasada', () => {
    const history = { '100': [stageEvent('ENGINEERING', '2026-01-01')] };
    const projects = [
      { so: '100', status: 'Engineering' }, // sin cambio
      { so: '200', status: 'Nesting' },     // nuevo
      { so: '300', status: 'Completed' },   // nuevo
    ];
    const pending = pendingStatusTransitions(projects, history, TS);
    expect(pending.map(p => p.so)).toEqual(['200', '300']);
  });
});
