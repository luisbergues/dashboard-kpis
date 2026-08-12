import { describe, it, expect } from 'vitest';
import { calculateDesignerStats } from '../scoreCalculator';
import type { Project } from '../../types';

/* Antes las tres metricas eran `number` con 0 de relleno, y `globalKpi` usaba
   `avgPhase1 > 0 && avgPhase2 > 0` para preguntar "hay datos?". Un 0 legitimo
   (promedio real y pesimo) se leia como ausencia, asi que el KPI global
   borraba la fase que estuviera en cero. */

let n = 0;
const proj = (over: Partial<Project>): Project => ({
  id: `so-${n++}`,
  createdAt: Date.now(),
  approvedAt: null,
  projectName: 'x',
  designerName: 'Ana',
  status: 'Completed',
  totalRooms: 1,
  icp: 1,
  phase1Score: null,
  phase2Score: null,
  checklist: {} as Project['checklist'],
  complexity: {} as Project['complexity'],
  ...over,
}) as Project;

const stats = (projects: Project[]) => calculateDesignerStats('Ana', projects);

describe('calculateDesignerStats — cero no es lo mismo que sin datos', () => {
  it('una Fase 2 en cero NO desaparece del KPI global', () => {
    const d = stats([proj({ phase1Score: 90, phase2Score: 0, status: 'Completed' })]);
    expect(d.avgPhase1Score).toBe(90);
    expect(d.avgPhase2Score).toBe(0);
    expect(d.globalKpi).toBe(45); // antes daba 90
  });

  it('una Fase 1 en cero no borra una Fase 2 buena', () => {
    const d = stats([proj({ phase1Score: 0, phase2Score: 90, status: 'Completed' })]);
    expect(d.globalKpi).toBe(45); // antes daba 0
  });

  it('sin proyectos cerrados, Fase 2 es null y el global es solo Fase 1', () => {
    const d = stats([proj({ phase1Score: 90, phase2Score: null, status: 'Approved' })]);
    expect(d.avgPhase2Score).toBeNull();
    expect(d.globalKpi).toBe(90);
  });

  it('sin ningun proyecto evaluado las tres metricas son null', () => {
    const d = stats([proj({ status: 'Pending' })]);
    expect(d.avgPhase1Score).toBeNull();
    expect(d.avgPhase2Score).toBeNull();
    expect(d.globalKpi).toBeNull();
    expect(d.totalProjects).toBe(0);
  });

  it('ambas fases en cero dan 0, no null: es un dato, no una ausencia', () => {
    const d = stats([proj({ phase1Score: 0, phase2Score: 0, status: 'Completed' })]);
    expect(d.avgPhase1Score).toBe(0);
    expect(d.avgPhase2Score).toBe(0);
    expect(d.globalKpi).toBe(0);
  });

  it('promedia bien con varios proyectos', () => {
    const d = stats([
      proj({ phase1Score: 100, phase2Score: 80, status: 'Completed' }),
      proj({ phase1Score: 60,  phase2Score: 40, status: 'Completed' }),
    ]);
    expect(d.avgPhase1Score).toBe(80);
    expect(d.avgPhase2Score).toBe(60);
    expect(d.globalKpi).toBe(70);
    expect(d.totalProjects).toBe(2);
  });

  it('solo cuenta los proyectos del diseñador pedido', () => {
    const d = stats([
      proj({ phase1Score: 100, status: 'Approved' }),
      proj({ phase1Score: 0, status: 'Approved', designerName: 'Otro' }),
    ]);
    expect(d.avgPhase1Score).toBe(100);
  });
});
