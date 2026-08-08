// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LanguageProvider } from '../../utils/LanguageContext';
import MaterialsView from '../MaterialsView';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const makeRows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    so: 10000 + i,
    name: `Project ${i}`,
    installDate: '2026-08-10',
    thermofoil: 'Yes',
    noHoles: 'No',
    dovetail: 'Yes',
    element: 'No',
  }));

const renderView = (data) =>
  render(
    <LanguageProvider>
      <MaterialsView data={data} />
    </LanguageProvider>,
  );

const bodyRowCount = () =>
  document.querySelectorAll('.materials-table tbody tr').length;

describe('MaterialsView — render progresivo', () => {
  it('pinta como mucho 100 filas aunque la matriz traiga muchas mas', () => {
    renderView({ materialRequirements: makeRows(350) });
    expect(bodyRowCount()).toBe(100);
    expect(screen.getByText('100 / 350')).toBeTruthy();
  });

  it('"Show more" suma una tanda sin perder las filas ya pintadas', () => {
    renderView({ materialRequirements: makeRows(350) });
    fireEvent.click(screen.getByText('Show more'));
    expect(bodyRowCount()).toBe(200);
    expect(screen.getByText('200 / 350')).toBeTruthy();
  });

  it('"Show all" pinta el resto y esconde los controles', () => {
    renderView({ materialRequirements: makeRows(350) });
    fireEvent.click(screen.getByText('Show all'));
    expect(bodyRowCount()).toBe(350);
    expect(screen.queryByText('Show more')).toBeNull();
    expect(screen.queryByText('Show all')).toBeNull();
  });

  it('con menos filas que una tanda no muestra los controles', () => {
    renderView({ materialRequirements: makeRows(12) });
    expect(bodyRowCount()).toBe(12);
    expect(screen.queryByText('Show more')).toBeNull();
    expect(screen.getByText('12 / 12')).toBeTruthy();
  });

  // Este era el crash: `data` presente pero sin la seccion (por ejemplo si el
  // CSV cambia de forma) hacia `.map` sobre undefined y tumbaba la vista.
  it('no crashea si data llega sin materialRequirements', () => {
    expect(() => renderView({})).not.toThrow();
    expect(screen.getByText('No material requirements to show.')).toBeTruthy();
  });

  it('sin data no renderiza nada', () => {
    const { container } = renderView(null);
    expect(container.firstChild).toBeNull();
  });
});
