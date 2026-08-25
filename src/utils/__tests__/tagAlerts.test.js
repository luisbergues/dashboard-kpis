import { describe, it, expect } from 'vitest';
import { buildTagAlerts, tagAlertDestination } from '../tagAlerts';

const projects = [
  { so: '100', name: 'Casa Perez', eng: 'Santiago' },
  { so: '200', name: 'Casa Lopez', eng: 'Julieta' },
];

const tag = (over = {}) => ({
  id: 't1', noteId: 'n1', so: '100',
  taggedUid: 'u-santi', taggedName: 'Santiago',
  taggedByUid: 'u-luis', taggedByName: 'Luis',
  createdAt: '2026-08-24T10:00:00.000Z', readAt: null,
  notePreview: 'revisar las medidas del closet principal',
  ...over,
});

describe('buildTagAlerts', () => {
  it('arma una alerta por proyecto, no una por tag', () => {
    const alerts = buildTagAlerts([tag(), tag({ id: 't2', noteId: 'n2' })], projects, 'es');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].so).toBe('100');
  });

  it('nombra a quien tageo y el SO', () => {
    const [alert] = buildTagAlerts([tag()], projects, 'es');
    expect(alert.text).toContain('Luis');
    expect(alert.text).toContain('100');
    expect(alert.type).toBe('tag');
  });

  it('incluye un preview del texto de la nota', () => {
    const [alert] = buildTagAlerts([tag()], projects, 'es');
    expect(alert.text).toContain('revisar las medidas');
  });

  it('recorta un preview largo', () => {
    const largo = 'x'.repeat(200);
    const [alert] = buildTagAlerts([tag({ notePreview: largo })], projects, 'es');
    expect(alert.text.length).toBeLessThan(160);
  });

  it('lleva el tagId y el noteId para poder marcar y navegar', () => {
    const [alert] = buildTagAlerts([tag()], projects, 'es');
    expect(alert.tagId).toBe('t1');
    expect(alert.noteId).toBe('n1');
    expect(alert.tagIds).toEqual(['t1']);
  });

  it('lleva TODOS los tagIds del grupo, para que un solo click los marque juntos', () => {
    // La alerta es una por proyecto: marcar solo el mas reciente la haria
    // reaparecer con N-1 y obligaria a repetir el click N veces.
    const [alert] = buildTagAlerts([
      tag({ id: 't1', createdAt: '2026-08-01T00:00:00.000Z' }),
      tag({ id: 't2', createdAt: '2026-08-20T00:00:00.000Z' }),
      tag({ id: 't3', createdAt: '2026-08-10T00:00:00.000Z' }),
    ], projects, 'es');
    expect(alert.tagIds.sort()).toEqual(['t1', 't2', 't3']);
    expect(alert.tagIds).toContain(alert.tagId);
  });

  it('no mezcla los tagIds de proyectos distintos', () => {
    const alerts = buildTagAlerts([
      tag({ id: 't1', so: '100' }),
      tag({ id: 't2', so: '200' }),
    ], projects, 'es');
    const bySo = Object.fromEntries(alerts.map(a => [a.so, a.tagIds]));
    expect(bySo['100']).toEqual(['t1']);
    expect(bySo['200']).toEqual(['t2']);
  });

  it('con varios tags del mismo proyecto usa el mas reciente y dice cuantos son', () => {
    const alerts = buildTagAlerts([
      tag({ id: 't1', createdAt: '2026-08-01T00:00:00.000Z', taggedByName: 'Viejo' }),
      tag({ id: 't2', createdAt: '2026-08-20T00:00:00.000Z', taggedByName: 'Nuevo' }),
    ], projects, 'es');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].tagId).toBe('t2');
    expect(alerts[0].text).toContain('2');
  });

  it('ignora tags de proyectos que no estan en la lista', () => {
    expect(buildTagAlerts([tag({ so: '999' })], projects, 'es')).toEqual([]);
  });

  it('devuelve [] sin tags', () => {
    expect(buildTagAlerts([], projects, 'es')).toEqual([]);
  });

  it('tambien funciona en ingles', () => {
    const [alert] = buildTagAlerts([tag()], projects, 'en');
    expect(alert.text).toContain('tagged you');
  });
});

describe('tagAlertDestination', () => {
  const santi = { role: 'engineer', designerName: 'Santiago' };

  it('manda a My Projects si el proyecto es del usuario', () => {
    expect(tagAlertDestination({ so: '100' }, projects, santi)).toBe('my-projects');
  });

  it('manda a Pipeline si el proyecto es de otro', () => {
    expect(tagAlertDestination({ so: '200' }, projects, santi)).toBe('pipeline');
  });

  it('manda a Pipeline si el proyecto no aparece', () => {
    expect(tagAlertDestination({ so: '999' }, projects, santi)).toBe('pipeline');
  });
});
