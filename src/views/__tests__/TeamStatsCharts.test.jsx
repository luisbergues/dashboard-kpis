// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import Papa from 'papaparse';
import { LanguageProvider } from '../../utils/LanguageContext';
import { ThemeProvider } from '../../utils/ThemeContext';

// La planilla ya no se baja con fetch: pasa por /api/sheet, que exige sesion
// y devuelve filas ya parseadas (ver fetchSheet.js). Este test mira los
// GRAFICOS, asi que se mockea esa frontera con el mismo CSV de antes vuelto
// filas, que es lo que el endpoint real entrega.
const sheet = vi.hoisted(() => ({ csv: '' }));
vi.mock('../../utils/fetchSheet', () => ({
  fetchSheetRows: vi.fn(async () => Papa.parse(sheet.csv, { skipEmptyLines: false }).data),
}));

// Chart.js necesita canvas, que jsdom no tiene: se captura lo que recibiria.
const charts = [];
vi.mock('react-chartjs-2', () => ({
  Bar: ({ data }) => { charts.push(data); return <div data-testid="bar-chart" />; },
}));

const { default: DesignQualityView } = await import('../DesignQualityView');

// Recorte del tab real (Personal KPI) a noviembre de 2026.
const CSV = [
  'KPI (11/01 - 11/30)',
  'Engineer,Own Points,Revision Points,Nesting Points,Total KPI,Previous Month KPI,Projects that Added,Dynamic Explanation',
  'Luis,"71,665.92",0.00,$0.00,"$71,665.92","141,635.61","12868",x',
  ',,,,,,',
  'WEEKLY KPI - NOVEMBER 2026 (CURRENT MONTH),,,,,,',
  'Engineer,Week 1,Week 2,Week 3,Week 4,Week 5,Month Total',
  'Luis,"85,939.22","4,165.90",0.00,0.00,0.00,"90,105.12"',
  'Andres,"4,636.05","39,786.60",0.00,0.00,0.00,"44,422.65"',
  'Total,"90,575.27","43,952.50",0.00,0.00,0.00,"134,527.77"',
  ',,,,,,',
  'WEEKLY KPI - OCTOBER 2026 (PREVIOUS MONTH),,,,,,',
  'Engineer,Week 1,Week 2,Week 3,Week 4,Week 5,Month Total',
  'Luis,"25,176.90","15,977.50","48,931.65","-50,026.22","101,575.78","141,635.61"',
  'Andres,0.00,0.00,"40,735.88","17,321.05","10,404.80","68,461.73"',
  'Total,"25,176.90","15,977.50","89,667.53","-32,705.17","111,980.58","210,097.34"',
].join('\n');

beforeEach(() => {
  charts.length = 0;
  sheet.csv = CSV;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderView = () => render(
  <LanguageProvider><ThemeProvider><DesignQualityView /></ThemeProvider></LanguageProvider>
);

describe('Team Stats — graficos desde WEEKLY KPI', () => {
  it('el grafico semanal recorre Oct W1..Nov W2, una serie por ingeniero', async () => {
    renderView();
    await waitFor(() => expect(screen.getAllByTestId('bar-chart')).toHaveLength(2));
    const weekly = charts.find(c => c.labels.includes('Oct W1'));
    expect(weekly.labels).toEqual(['Oct W1', 'Oct W2', 'Oct W3', 'Oct W4', 'Oct W5', 'Nov W1', 'Nov W2']);
    expect(weekly.datasets.map(d => d.label)).toEqual(['Luis', 'Andres']);
    expect(weekly.datasets[0].data[5]).toBeCloseTo(85939.22);
  });

  it('el grafico de totales compara el Month Total de cada mes', async () => {
    renderView();
    await waitFor(() => expect(screen.getAllByTestId('bar-chart')).toHaveLength(2));
    const totals = charts.find(c => c.labels.includes('Luis') && !c.labels.includes('Oct W1'));
    expect(totals.datasets.map(d => d.label)).toEqual(['October 2026', 'November 2026']);
    expect(totals.datasets[1].data).toEqual([90105.12, 44422.65]);
  });

  it('no muestra avisos por las ventanas de 30/60/90/120 dias que ya no existen', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('KPI (11/01 - 11/30)')).toBeTruthy());
    expect(screen.queryByText(/has no "KPI/)).toBeNull();
  });
});
