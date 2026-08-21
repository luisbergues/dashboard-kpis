import { useState } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { DESIGNERS } from '../utils/designers';
import { useLanguage } from '../utils/LanguageContext';
import { shortProjectName } from '../utils/projectName';
import './AssignDesignerGate.css';

/**
 * Overlay bloqueante: un proyecto nuevo del sheet no se puede trabajar hasta
 * que su ingeniero diga quién lo diseñó.
 *
 * Deliberadamente NO se cierra con click afuera, ni con Esc, ni tiene botón X:
 * el punto es que no se pueda seguir sin asignar. La única salida es cerrar
 * sesión, que está ahí porque si el diseñador correcto no figura en la lista
 * el usuario quedaría encerrado sin ningún recurso — el mismo criterio que la
 * pantalla de cuenta pendiente de aprobación.
 *
 * Se pide de a uno aunque la cola traiga varios: encadenar formularios es más
 * fácil de completar que una lista larga, y cada guardado ya deja el trabajo
 * hecho aunque el usuario abandone.
 *
 * @param {Array} pending - cola de pendingDesignerAssignments (nunca vacía;
 *   App.jsx no renderiza este componente si no hay nada que pedir).
 * @param {(so: string, designerName: string) => Promise<{error?: string}>} onAssign
 * @param {() => void} onSignOut
 */
export default function AssignDesignerGate({ pending, onAssign, onSignOut }) {
  const { t, language } = useLanguage();
  const [selected, setSelected] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const project = pending[0];
  if (!project) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected || isSaving) return;

    setIsSaving(true);
    setError('');
    try {
      const result = await onAssign(String(project.so), selected);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // El proyecto sale de la cola solo, porque el listener de
      // project_designers actualiza el estado de App.jsx. Aca alcanza con
      // limpiar el select para el siguiente.
      setSelected('');
    } finally {
      setIsSaving(false);
    }
  };

  const remaining = pending.length;

  return (
    <div className="assign-designer-overlay" role="dialog" aria-modal="true" aria-labelledby="assign-designer-title">
      <div className="assign-designer-card glass-card">
        <div className="assign-designer-icon">
          <AlertTriangle size={22} />
        </div>

        <h2 id="assign-designer-title" className="assign-designer-title">
          {t('assignDesigner.title')}
        </h2>
        <p className="assign-designer-body text-muted">
          {t('assignDesigner.body')}
        </p>

        <div className="assign-designer-project">
          <span className="assign-designer-so">#{project.so}</span>
          <span className="assign-designer-name">{shortProjectName(project.name) || ''}</span>
        </div>

        {remaining > 1 && (
          <p className="assign-designer-queue text-muted">
            {t('assignDesigner.remainingPrefix')} {remaining} {t('assignDesigner.remainingSuffix')}
          </p>
        )}

        <form onSubmit={handleSubmit} className="assign-designer-form">
          <label className="form-label" htmlFor="assign-designer-select">
            {t('assignDesigner.label')}
          </label>
          <select
            id="assign-designer-select"
            className="form-input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isSaving}
          >
            <option value="" disabled>{t('assignDesigner.placeholder')}</option>
            {DESIGNERS.map(name => (
              <option key={name} value={name} style={{ color: '#000' }}>{name}</option>
            ))}
          </select>

          {error && <p className="assign-designer-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={!selected || isSaving}>
            {isSaving ? t('assignDesigner.saving') : t('assignDesigner.save')}
          </button>
        </form>

        {/* Unica salida. No saltea la asignacion: cierra la sesion. */}
        <button type="button" className="btn-secondary btn-sm assign-designer-signout" onClick={onSignOut}>
          <LogOut size={14} /> {t('common.signOut')}
        </button>
        <p className="assign-designer-help text-muted">
          {language === 'es'
            ? 'Si el diseñador no aparece en la lista, avisá a un administrador.'
            : 'If the designer is not on the list, contact an administrator.'}
        </p>
      </div>
    </div>
  );
}
