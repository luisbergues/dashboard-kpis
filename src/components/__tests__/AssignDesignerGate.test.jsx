// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../utils/LanguageContext';
import AssignDesignerGate from '../AssignDesignerGate';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

const pending = [
  { so: '12116', name: 'James Aiello:[12116] James Aiello', eng: 'JS' },
  { so: '12117', name: 'Otro Cliente', eng: 'JS' },
];

const renderGate = (props = {}) => {
  const onAssign = props.onAssign ?? vi.fn().mockResolvedValue({});
  const onSignOut = props.onSignOut ?? vi.fn();
  const utils = render(
    <LanguageProvider>
      <AssignDesignerGate pending={props.pending ?? pending} onAssign={onAssign} onSignOut={onSignOut} />
    </LanguageProvider>,
  );
  return { ...utils, onAssign, onSignOut };
};

describe('AssignDesignerGate — no se puede esquivar', () => {
  it('no se cierra al hacer click en el fondo', () => {
    const { container } = renderGate();
    const overlay = container.querySelector('.assign-designer-overlay');
    fireEvent.click(overlay);
    expect(container.querySelector('.assign-designer-overlay')).toBeTruthy();
  });

  it('no se cierra con Escape', () => {
    const { container } = renderGate();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(container.querySelector('.assign-designer-overlay')).toBeTruthy();
  });

  it('no ofrece ningun boton de cerrar ni cancelar', () => {
    renderGate();
    expect(screen.queryByLabelText(/close|cerrar/i)).toBeNull();
    expect(screen.queryByText(/^cancel$/i)).toBeNull();
  });

  it('el boton de guardar arranca deshabilitado hasta elegir un disenador', () => {
    renderGate();
    const save = screen.getByRole('button', { name: /save and continue/i });
    expect(save.disabled).toBe(true);
  });
});

describe('AssignDesignerGate — asignacion', () => {
  it('muestra el primer proyecto de la cola', () => {
    renderGate();
    expect(screen.getByText('#12116')).toBeTruthy();
  });

  it('avisa cuantos quedan cuando hay mas de uno', () => {
    const { container } = renderGate();
    expect(container.textContent).toContain('2');
  });

  it('no muestra el contador con un solo proyecto', () => {
    const { container } = renderGate({ pending: [pending[0]] });
    expect(container.querySelector('.assign-designer-queue')).toBeNull();
  });

  it('guarda el SO y el disenador elegido', async () => {
    const { onAssign } = renderGate();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Iris Lopes' } });
    fireEvent.click(screen.getByRole('button', { name: /save and continue/i }));
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith('12116', 'Iris Lopes'));
  });

  it('muestra el error devuelto y no deja el formulario colgado', async () => {
    const onAssign = vi.fn().mockResolvedValue({ error: 'Could not save.' });
    renderGate({ onAssign });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Iris Lopes' } });
    fireEvent.click(screen.getByRole('button', { name: /save and continue/i }));
    await waitFor(() => expect(screen.getByText('Could not save.')).toBeTruthy());
    // El select conserva el valor: se puede reintentar sin volver a elegir.
    expect(screen.getByRole('combobox').value).toBe('Iris Lopes');
  });

  it('la unica salida es cerrar sesion', () => {
    const { onSignOut } = renderGate();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('con la cola vacia no renderiza nada', () => {
    const { container } = renderGate({ pending: [] });
    expect(container.firstChild).toBeNull();
  });
});
