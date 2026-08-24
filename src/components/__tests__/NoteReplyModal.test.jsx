// @vitest-environment jsdom
// src/components/__tests__/NoteReplyModal.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import NoteReplyModal from '../NoteReplyModal';

const note = {
  id: 'n1', text: 'revisar las medidas', createdBy: 'Luis',
  createdAt: '2026-08-24T10:00:00.000Z',
};
const directory = { 'u-santi': { name: 'Santiago' }, 'u-luis': { name: 'Luis' } };

afterEach(cleanup);

const setup = (props = {}) => {
  const onReply = vi.fn(async () => {});
  const onClose = vi.fn();
  render(
    <NoteReplyModal
      note={note}
      tags={[{ id: 't1', taggedName: 'Santiago', readAt: null }]}
      directory={directory}
      currentUserUid="u-santi"
      language="es"
      onReply={onReply}
      onClose={onClose}
      {...props}
    />
  );
  return { onReply, onClose };
};

describe('NoteReplyModal', () => {
  it('muestra el contexto de la nota original', () => {
    setup();
    expect(screen.getByText(/revisar las medidas/)).toBeInTheDocument();
    expect(screen.getByText(/Luis/)).toBeInTheDocument();
  });

  it('responder es opcional: se puede cerrar sin escribir nada', () => {
    const { onClose, onReply } = setup();
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onReply).not.toHaveBeenCalled();
  });

  it('el boton de responder esta deshabilitado sin texto', () => {
    setup();
    expect(screen.getByRole('button', { name: /responder/i })).toBeDisabled();
  });

  it('envia la respuesta con su texto', async () => {
    const { onReply } = setup();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ya lo miro' } });
    fireEvent.click(screen.getByRole('button', { name: /responder/i }));
    await waitFor(() => expect(onReply).toHaveBeenCalledWith({ text: 'ya lo miro', taggedUids: [] }));
  });

  it('la respuesta puede taggear a otra persona', async () => {
    const { onReply } = setup();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'preguntale a Luis' } });
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    fireEvent.click(screen.getByText('Luis'));
    fireEvent.click(screen.getByRole('button', { name: /responder/i }));
    await waitFor(() => expect(onReply).toHaveBeenCalledWith({ text: 'preguntale a Luis', taggedUids: ['u-luis'] }));
  });

  it('cierra despues de responder bien', async () => {
    const { onClose } = setup();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: /responder/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('si responder falla, NO cierra y avisa', async () => {
    const onReply = vi.fn().mockRejectedValue(new Error('permission_denied'));
    const onClose = vi.fn();
    render(
      <NoteReplyModal note={note} tags={[]} directory={directory} currentUserUid="u-santi"
        language="es" onReply={onReply} onClose={onClose} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: /responder/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('muestra a quien tagea la nota original y si ya se leyo', () => {
    setup({ tags: [{ id: 't1', taggedName: 'Santiago', readAt: '2026-08-24T12:00:00.000Z' }] });
    const chip = screen.getByText('Santiago').closest('.note-tag-chip');
    expect(chip).toHaveClass('read');
  });

  it('no ofrece taggearse a uno mismo', () => {
    // tags vacio a proposito: el setup por defecto renderiza un chip con el
    // texto "Santiago", y queryByText lo encontraria — el test fallaria por el
    // chip, no por el selector, que es lo que se quiere probar aca.
    setup({ tags: [] });
    fireEvent.click(screen.getByRole('button', { name: /taggear/i }));
    expect(screen.queryByText('Santiago')).not.toBeInTheDocument();
  });
});
