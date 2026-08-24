import { Check } from 'lucide-react';
import './NoteTagChips.css';

/**
 * A quien tagea una nota y si ya lo leyeron.
 *
 * El estado va en el `title` ademas del color: distinguirlo solo por tono deja
 * afuera a quien no separa esos dos verdes. Mismo criterio que el badge de las
 * notas designer en MyProjectsView.
 *
 * Trae su propio CSS en vez de reusar el de NoteReplyModal aunque el chip sea
 * identico: ProjectDetailView renderiza estos chips y es la pagina standalone
 * del deep link ?so=, que nunca importa My Projects ni Pipeline — o sea que el
 * CSS del modal no esta cargado ahi y los chips saldrian sin estilo justo para
 * el disenador externo que abre ese link.
 */
export default function NoteTagChips({ tags = [], language = 'es' }) {
  if (!tags.length) return null;
  const isES = language === 'es';

  return (
    <div className="note-tag-chips">
      {tags.map(tag => (
        <span
          key={tag.id}
          className={`note-tag-chip ${tag.readAt ? 'read' : ''}`}
          title={tag.readAt
            ? (isES ? `${tag.taggedName} — leído` : `${tag.taggedName} — read`)
            : (isES ? `${tag.taggedName} — sin leer` : `${tag.taggedName} — unread`)}
        >
          {tag.taggedName}
          {tag.readAt && <Check size={11} />}
        </span>
      ))}
    </div>
  );
}
