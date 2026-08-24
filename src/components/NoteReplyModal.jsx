import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import TagSelector from './TagSelector';
import NoteTagChips from './NoteTagChips';
import './NoteReplyModal.css';

/**
 * Caja de respuesta que se abre al entrar por una notificacion de tag.
 *
 * Responder es OPCIONAL y no bloqueante: el tag ya quedo marcado como leido
 * antes de abrir esto, asi que cerrar sin escribir nada es un final valido del
 * flujo, no una cancelacion.
 *
 * Si el envio falla no cierra: cerrar despues de un error haria desaparecer el
 * texto que la persona acaba de escribir.
 */
export default function NoteReplyModal({
  note, tags = [], directory, currentUserUid, language = 'es', onReply, onClose,
}) {
  const isES = language === 'es';
  const [text, setText] = useState('');
  const [taggedUids, setTaggedUids] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  if (!note) return null;

  const send = async () => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setError(null);
    try {
      await onReply({ text: clean, taggedUids });
      onClose();
    } catch (err) {
      console.error('Failed to send reply:', err);
      setError(isES
        ? 'No se pudo enviar la respuesta. Intentá de nuevo.'
        : 'The reply could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="note-reply-overlay" onClick={onClose}>
      <div className="note-reply-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="note-reply-header">
          <h3>{isES ? 'Te taggearon en una nota' : 'You were tagged in a note'}</h3>
        </div>

        <div className="note-reply-original">
          <div className="note-reply-meta">
            <span><strong>{note.createdBy || 'Unknown'}</strong></span>
            <span>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}</span>
          </div>
          <p className="note-reply-text">{note.text}</p>
          <NoteTagChips tags={tags} language={language} />
        </div>

        <textarea
          className="note-reply-input"
          placeholder={isES ? 'Responder (opcional)...' : 'Reply (optional)...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          disabled={sending}
        />

        {error && <p className="note-reply-error" role="alert">{error}</p>}

        <div className="note-reply-actions">
          <TagSelector
            directory={directory}
            selectedUids={taggedUids}
            onChange={setTaggedUids}
            excludeUid={currentUserUid}
            language={language}
          />
          <div className="note-reply-buttons">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
              {isES ? 'Cerrar' : 'Close'}
            </button>
            <button type="button" className="btn-primary" onClick={send} disabled={!text.trim() || sending}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : null}
              {isES ? 'Responder' : 'Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
