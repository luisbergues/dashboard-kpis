// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MiniDatePicker } from '../Phase1Form';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// 3-jul-2026 14:30 — la hora importa: al elegir otro dia debe preservarse.
const VALUE = new Date(2026, 6, 3, 14, 30, 0).getTime();

/** Replica la estructura real del checklist: la pildora vive dentro del
 *  <label> que envuelve al checkbox del item. */
const renderInLabel = (onChange = vi.fn()) => {
  render(
    <label>
      <input type="checkbox" defaultChecked data-testid="cb" />
      <MiniDatePicker value={VALUE} onChange={onChange}>
        <span data-testid="pill">✓ Jul 03, 2026</span>
      </MiniDatePicker>
    </label>,
  );
  return { onChange, cb: screen.getByTestId('cb') as HTMLInputElement };
};

describe('control: jsdom simula la activacion del <label>', () => {
  // Sin esto, los tests de abajo podrian pasar solo porque jsdom no implementa
  // el comportamiento del label — un falso positivo.
  it('un click en contenido plano dentro del label SI destilda el checkbox', () => {
    render(
      <label>
        <input type="checkbox" defaultChecked data-testid="cb" />
        <span data-testid="plain">texto suelto</span>
      </label>,
    );
    const cb = screen.getByTestId('cb') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    fireEvent.click(screen.getByTestId('plain'));
    expect(cb.checked).toBe(false); // el label routeo el click al checkbox
  });
});

describe('MiniDatePicker dentro de un <label>', () => {
  it('abre el calendario al clickear la pildora', () => {
    renderInLabel();
    expect(screen.queryByText('July 2026')).toBeNull();
    fireEvent.click(screen.getByTestId('pill'));
    expect(screen.queryByText('July 2026')).not.toBeNull();
  });

  it('NO destilda el item al abrir el calendario', () => {
    const { cb } = renderInLabel();
    expect(cb.checked).toBe(true);
    fireEvent.click(screen.getByTestId('pill'));
    expect(cb.checked).toBe(true);
  });

  it('cierra el calendario al volver a clickear la pildora', () => {
    renderInLabel();
    fireEvent.click(screen.getByTestId('pill'));
    expect(screen.queryByText('July 2026')).not.toBeNull();
    fireEvent.click(screen.getByTestId('pill'));
    expect(screen.queryByText('July 2026')).toBeNull();
  });

  it('elegir un dia reporta el timestamp y preserva la hora original', () => {
    const { onChange, cb } = renderInLabel();
    fireEvent.click(screen.getByTestId('pill'));
    fireEvent.click(screen.getByText('15'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const got = new Date(onChange.mock.calls[0][0] as number);
    expect(got.getFullYear()).toBe(2026);
    expect(got.getMonth()).toBe(6); // julio
    expect(got.getDate()).toBe(15);
    expect(got.getHours()).toBe(14);   // hora original preservada
    expect(got.getMinutes()).toBe(30);
    expect(cb.checked).toBe(true);     // elegir un dia tampoco destilda
  });

  it('navegar de mes no destilda el item ni dispara onChange', () => {
    const { onChange, cb } = renderInLabel();
    fireEvent.click(screen.getByTestId('pill'));
    fireEvent.click(screen.getByText('‹'));
    expect(screen.queryByText('June 2026')).not.toBeNull();
    fireEvent.click(screen.getByText('›'));
    fireEvent.click(screen.getByText('›'));
    expect(screen.queryByText('August 2026')).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(cb.checked).toBe(true);
  });

  it('cierra al clickear fuera del componente', () => {
    renderInLabel();
    fireEvent.click(screen.getByTestId('pill'));
    expect(screen.queryByText('July 2026')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('July 2026')).toBeNull();
  });
});

/* Verificado en el navegador: el calendario se abria hacia la derecha desde una
   pildora ya pegada al borde derecho de la tarjeta (scroll horizontal de toda
   la pagina) y por debajo del chat flotante, que lo tapaba. */
describe('posicion del calendario', () => {
  // jsdom deja innerHeight en 768 y devuelve todo en cero, asi que la posicion
  // del disparador se simula explicitamente.
  const stubTriggerAt = (top: number) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top, bottom: top + 22, left: 0, right: 0, width: 0, height: 22, x: 0, y: top,
      toJSON: () => ({}),
    } as DOMRect);
  };

  // Se busca por selector y no con getByRole: la query por rol pasa por
  // getComputedStyle, que revienta en esta version de jsdom.
  const openPopover = () => {
    renderInLabel();
    fireEvent.click(screen.getByTestId('pill'));
    const el = document.querySelector('[role="dialog"]') as HTMLElement | null;
    expect(el).not.toBeNull();
    return el!;
  };

  it('se ancla a la derecha para no desbordar la tarjeta', () => {
    const popover = openPopover();
    expect(popover.style.right).toBe('0px');
    expect(popover.style.left).toBe('');
  });

  it('queda por encima del chat flotante (z-index 1000)', () => {
    const popover = openPopover();
    expect(Number(popover.style.zIndex)).toBeGreaterThan(1000);
  });

  it('abre hacia abajo cuando hay lugar', () => {
    stubTriggerAt(100); // 122 + 300 < 768
    const popover = openPopover();
    expect(popover.style.top).toBe('calc(100% + 6px)');
    expect(popover.style.bottom).toBe('');
  });

  it('abre hacia arriba cuando abajo no entra', () => {
    stubTriggerAt(700); // 722 + 300 > 768, y 700 > 300
    const popover = openPopover();
    expect(popover.style.bottom).toBe('calc(100% + 6px)');
    expect(popover.style.top).toBe('');
  });

  it('abre hacia abajo si no entra en ningun lado', () => {
    // Viewport bajo: no entra abajo (222+300 > 400) y arriba tampoco (200 < 300).
    const realHeight = window.innerHeight;
    window.innerHeight = 400;
    try {
      stubTriggerAt(200);
      expect(openPopover().style.top).toBe('calc(100% + 6px)');
    } finally {
      window.innerHeight = realHeight;
    }
  });
});
