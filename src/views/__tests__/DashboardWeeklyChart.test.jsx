// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../utils/LanguageContext';
import { ThemeProvider } from '../../utils/ThemeContext';
import { normalizeParsedData } from '../../utils/parsedDataShape';

// Chart.js necesita canvas, que jsdom no tiene.
vi.mock('react-chartjs-2', () => ({ Chart: () => <div data-testid="wow-chart" />, Bar: () => null, Line: () => null, Doughnut: () => null }));

const { default: DashboardView } = await import('../DashboardView');

const renderDashboard = (weeklyCompleted) => render(
  <LanguageProvider>
    <ThemeProvider>
      <DashboardView data={normalizeParsedData({ priorityAnalysis: [] })} weeklyCompleted={weeklyCompleted} />
    </ThemeProvider>
  </LanguageProvider>
);

describe('DashboardView — grafico Completed', () => {
  it('antes de la fecha de inicio muestra el aviso en vez del grafico', () => {
    renderDashboard([{ weekDate: new Date(2026, 10, 9), completedTotal: 140 }]);
    expect(screen.queryByTestId('wow-chart')).toBeNull();
    expect(screen.getByText(/starts the week of/i)).toBeTruthy();
  });

  it('desde la fecha de inicio dibuja el grafico', () => {
    renderDashboard([
      { weekDate: new Date(2026, 10, 9), completedTotal: 140 },
      { weekDate: new Date(2026, 10, 16), completedTotal: 146 },
    ]);
    expect(screen.getByTestId('wow-chart')).toBeTruthy();
  });
});
