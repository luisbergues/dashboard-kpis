import { useState } from 'react';
import { AtSign, Check } from 'lucide-react';
import { taggableEngineers } from '../utils/engineerDirectory';
import './TagSelector.css';

/**
 * Selector de personas a taggear en una nota.
 *
 * Es un selector, no texto libre tipo "@": el nombre escrito a mano no se puede
 * resolver a un uid de forma confiable y un tag sin uid valido no lo puede leer
 * nadie.
 *
 * Muestra a los 8 ingenieros SIEMPRE, incluso a los que todavia no se
 * registraron en el directorio — deshabilitados y con el motivo en el title. Si
 * se los ocultara, pareceria que faltan del equipo.
 */
export default function TagSelector({ directory, selectedUids = [], onChange, excludeUid, language = 'es' }) {
  const [isOpen, setIsOpen] = useState(false);
  const isES = language === 'es';

  const people = taggableEngineers(directory)
    .filter(p => !excludeUid || p.uid !== excludeUid);

  const toggle = (uid) => {
    if (!uid) return;
    onChange(
      selectedUids.includes(uid)
        ? selectedUids.filter(u => u !== uid)
        : [...selectedUids, uid]
    );
  };

  const label = isES ? 'Taggear' : 'Tag';

  return (
    <div className="tag-selector">
      <button
        type="button"
        className={`tag-selector-toggle ${selectedUids.length > 0 ? 'has-selection' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={label}
      >
        <AtSign size={14} />
        {selectedUids.length > 0 && (
          <span className="tag-selector-count">{selectedUids.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="tag-selector-menu" role="listbox">
          {people.map(person => {
            const selected = person.uid && selectedUids.includes(person.uid);
            return (
              <button
                key={person.name}
                type="button"
                role="option"
                aria-selected={Boolean(selected)}
                className={`tag-selector-option ${selected ? 'selected' : ''}`}
                disabled={!person.registered}
                title={person.registered
                  ? person.name
                  : (isES
                    ? `${person.name} — sin cuenta vinculada todavía`
                    : `${person.name} — no linked account yet`)}
                onClick={() => toggle(person.uid)}
              >
                <span>{person.name}</span>
                {selected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
