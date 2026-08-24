// @vitest-environment jsdom
// src/components/__tests__/TagSelector.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TagSelector from '../TagSelector';

const directory = {
  'u-santi': { name: 'Santiago' },
  'u-luis': { name: 'Luis' },
};

afterEach(cleanup);

const setup = (props = {}) => {
  const onChange = vi.fn();
  render(
    <TagSelector
      directory={directory}
      selectedUids={[]}
      onChange={onChange}
      language="es"
      {...props}
    />
  );
  return { onChange };
};

describe('TagSelector', () => {
  it('lista a los 8 ingenieros', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    expect(screen.getByText('Santiago')).toBeInTheDocument();
    expect(screen.getByText('Andres')).toBeInTheDocument();
  });

  it('selecciona a alguien registrado', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    fireEvent.click(screen.getByText('Santiago'));
    expect(onChange).toHaveBeenCalledWith(['u-santi']);
  });

  it('permite seleccionar a varios', () => {
    const { onChange } = setup({ selectedUids: ['u-santi'] });
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    fireEvent.click(screen.getByText('Luis'));
    expect(onChange).toHaveBeenCalledWith(['u-santi', 'u-luis']);
  });

  it('deselecciona a quien ya estaba', () => {
    const { onChange } = setup({ selectedUids: ['u-santi', 'u-luis'] });
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    fireEvent.click(screen.getByText('Santiago'));
    expect(onChange).toHaveBeenCalledWith(['u-luis']);
  });

  it('deshabilita a quien no tiene cuenta vinculada y explica por que', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    const andres = screen.getByText('Andres').closest('button');
    expect(andres).toBeDisabled();
    expect(andres).toHaveAttribute('title', expect.stringContaining('sin cuenta vinculada'));
  });

  it('no se ofrece taggear a uno mismo', () => {
    setup({ excludeUid: 'u-luis' });
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    expect(screen.queryByText('Luis')).not.toBeInTheDocument();
  });

  it('muestra cuantos hay seleccionados sin abrir la lista', () => {
    setup({ selectedUids: ['u-santi', 'u-luis'] });
    expect(screen.getByRole('button', { name: /taggear/i })).toHaveTextContent('2');
  });

  it('con el directorio vacio abre igual, con todos deshabilitados', () => {
    setup({ directory: {} });
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    expect(screen.getByText('Santiago').closest('button')).toBeDisabled();
  });
});
