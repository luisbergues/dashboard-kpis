// @vitest-environment jsdom
// src/components/__tests__/NoteTagChips.test.jsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NoteTagChips from '../NoteTagChips';

afterEach(cleanup);

describe('NoteTagChips', () => {
  it('no renderiza nada sin tags', () => {
    const { container } = render(<NoteTagChips tags={[]} language="es" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra a cada persona tageada', () => {
    render(<NoteTagChips tags={[
      { id: 't1', taggedName: 'Santiago', readAt: null },
      { id: 't2', taggedName: 'Julieta', readAt: null },
    ]} language="es" />);
    expect(screen.getByText('Santiago')).toBeInTheDocument();
    expect(screen.getByText('Julieta')).toBeInTheDocument();
  });

  it('distingue leido de no leido', () => {
    render(<NoteTagChips tags={[
      { id: 't1', taggedName: 'Santiago', readAt: '2026-08-24T12:00:00.000Z' },
      { id: 't2', taggedName: 'Julieta', readAt: null },
    ]} language="es" />);
    expect(screen.getByText('Santiago').closest('.note-tag-chip')).toHaveClass('read');
    expect(screen.getByText('Julieta').closest('.note-tag-chip')).not.toHaveClass('read');
  });

  it('el title dice el estado en palabras, no solo por color', () => {
    render(<NoteTagChips tags={[{ id: 't1', taggedName: 'Santiago', readAt: null }]} language="es" />);
    expect(screen.getByText('Santiago').closest('.note-tag-chip'))
      .toHaveAttribute('title', expect.stringContaining('sin leer'));
  });
});
