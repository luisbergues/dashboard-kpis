import { shortProjectName } from './projectName';
import { ownsProject } from './projectOwnership';

const PREVIEW_MAX = 60;

const preview = (text) => {
  const clean = String(text ?? '').trim().replace(/\s+/g, ' ');
  return clean.length > PREVIEW_MAX ? `${clean.slice(0, PREVIEW_MAX)}…` : clean;
};

/**
 * Alertas de tag para la campana, UNA por proyecto.
 *
 * Se agrupa por proyecto y no por tag por el mismo motivo que la alerta de
 * notas nuevas que ya existe: cinco tags del mismo proyecto son un solo asunto
 * y cinco lineas serian ruido. La alerta apunta al tag mas reciente, que es el
 * que abre el modal.
 */
export function buildTagAlerts(unreadForMe, projects, language) {
  const isES = language === 'es';
  const bySo = new Map();

  (unreadForMe || []).forEach(tag => {
    const list = bySo.get(tag.so) || [];
    list.push(tag);
    bySo.set(tag.so, list);
  });

  const alerts = [];
  bySo.forEach((tagsForSo, so) => {
    const project = (projects || []).find(p => String(p.so) === String(so));
    // Un tag de un proyecto que ya no esta en el sheet no tiene a donde
    // navegar: se lo omite en vez de ofrecer un click que no lleva a nada.
    if (!project) return;

    // No asumir el orden de llegada: buildTagAlerts es una funcion pura y
    // tiene que encontrar el mas reciente por createdAt aunque el llamador
    // no los mande ordenados (unreadForMe normalmente viene del mas nuevo al
    // mas viejo, ver projectTags.js, pero apoyarse en eso a ciegas rompe en
    // silencio si esa garantia cambia).
    const latest = tagsForSo.reduce((newest, t) =>
      new Date(t.createdAt) > new Date(newest.createdAt) ? t : newest
    );
    const count = tagsForSo.length;
    const name = shortProjectName(project.name);
    const extra = count > 1
      ? (isES ? ` (${count} tags sin leer)` : ` (${count} unread tags)`)
      : '';

    alerts.push({
      so: String(so),
      type: 'tag',
      tagId: latest.id,
      noteId: latest.noteId,
      text: isES
        ? `${latest.taggedByName} te taggeó en SO #${so} ${name}: "${preview(latest.notePreview)}"${extra}`
        : `${latest.taggedByName} tagged you on SO #${so} ${name}: "${preview(latest.notePreview)}"${extra}`,
    });
  });

  return alerts;
}

/**
 * A donde lleva el click.
 *
 * My Projects solo muestra proyectos propios, asi que un tag sobre un proyecto
 * ajeno tiene que ir a Pipeline — si no, aterrizaria en una vista que no lo
 * contiene y no habria nada que enfocar.
 */
export function tagAlertDestination(alert, projects, userProfile) {
  const project = (projects || []).find(p => String(p.so) === String(alert.so));
  return project && ownsProject(userProfile, project) ? 'my-projects' : 'pipeline';
}
