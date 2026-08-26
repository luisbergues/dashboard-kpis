import { describe, it, expect } from 'vitest';
import { buildFinalsAlert } from '../finalsAlerts';

// Medianoche local, igual que el `today` que arma App.jsx con setHours(0,0,0,0).
const TODAY = new Date(2026, 7, 26); // 26 ago 2026

const project = (over = {}) => ({
  so: '1234',
  name: 'Chris Jaensch:[1234] Chris Jaensch',
  eng: 'Santiago',
  status: 'IN PROGRESS',
  install: '9/15/2026',
  finalsScheduled: '8/28/2026',
  finalTaken: 'NA',
  ...over,
});

describe('buildFinalsAlert — ventana de aviso', () => {
  it('avisa cuando el finals cae dentro de los 3 dias', () => {
    const alert = buildFinalsAlert(project(), TODAY, 'es');
    expect(alert.type).toBe('finals');
    expect(alert.so).toBe('1234');
    expect(alert.text).toContain('2 días');
  });

  it('avisa el mismo dia del finals sin tratarlo como vencido', () => {
    const alert = buildFinalsAlert(project({ finalsScheduled: '8/26/2026' }), TODAY, 'es');
    expect(alert.type).toBe('finals');
    expect(alert.text).toContain('hoy');
  });

  it('usa singular cuando falta un solo dia', () => {
    const alert = buildFinalsAlert(project({ finalsScheduled: '8/27/2026' }), TODAY, 'es');
    expect(alert.text).toContain('1 día');
    expect(alert.text).not.toContain('1 días');
  });

  it('no avisa cuando el finals esta fuera de la ventana', () => {
    expect(buildFinalsAlert(project({ finalsScheduled: '8/30/2026' }), TODAY, 'es')).toBeNull();
  });
});

describe('buildFinalsAlert — vencidos', () => {
  it('avisa cuando la fecha paso y el finals no se tomo', () => {
    const alert = buildFinalsAlert(project({ finalsScheduled: '8/21/2026' }), TODAY, 'es');
    expect(alert.type).toBe('finals_overdue');
    expect(alert.text).toContain('5 días');
  });

  it('no avisa de un vencido que ya se tomo', () => {
    const p = project({ finalsScheduled: '8/21/2026', finalTaken: '8/22/2026' });
    expect(buildFinalsAlert(p, TODAY, 'es')).toBeNull();
  });
});

describe('buildFinalsAlert — cuando no corresponde avisar', () => {
  it('ignora el proyecto cuyo finals ya se tomo', () => {
    const p = project({ finalTaken: '8/25/2026' });
    expect(buildFinalsAlert(p, TODAY, 'es')).toBeNull();
  });

  // El sheet escribe el literal "NA" (o deja la celda vacia) cuando todavia
  // no se agendo el finals; ninguno de los dos es una fecha parseable.
  it.each(['NA', 'na', '  ', '', null, undefined])(
    'ignora el finals sin agendar (%s)',
    (val) => {
      expect(buildFinalsAlert(project({ finalsScheduled: val }), TODAY, 'es')).toBeNull();
    }
  );

  it.each(['COMPLETED', 'Completed', 'CANCELLED', 'ON HOLD'])(
    'ignora el proyecto en estado %s',
    (status) => {
      expect(buildFinalsAlert(project({ status }), TODAY, 'es')).toBeNull();
    }
  );

  it('ignora una fecha que no se puede parsear', () => {
    expect(buildFinalsAlert(project({ finalsScheduled: 'pendiente' }), TODAY, 'es')).toBeNull();
  });
});

describe('buildFinalsAlert — formato del texto', () => {
  it('muestra el nombre corto del proyecto, no la celda cruda', () => {
    const alert = buildFinalsAlert(project(), TODAY, 'es');
    expect(alert.text).toContain('Chris Jaensch');
    expect(alert.text).not.toContain('[1234]');
  });

  it('traduce al ingles', () => {
    const alert = buildFinalsAlert(project(), TODAY, 'en');
    expect(alert.text).toContain('2 days');
    expect(alert.text).not.toContain('días');
  });

  it('traduce el vencido al ingles', () => {
    const alert = buildFinalsAlert(project({ finalsScheduled: '8/21/2026' }), TODAY, 'en');
    expect(alert.text).toContain('overdue');
  });
});

describe('buildFinalsAlert — fechas ISO', () => {
  // parseInstallDateLocal existe justamente porque `new Date('2026-08-28')`
  // es medianoche UTC y en las Americas cae el dia anterior en hora local.
  it('parsea YYYY-MM-DD sin correrse un dia', () => {
    const alert = buildFinalsAlert(project({ finalsScheduled: '2026-08-26' }), TODAY, 'es');
    expect(alert.type).toBe('finals');
    expect(alert.text).toContain('hoy');
  });
});
