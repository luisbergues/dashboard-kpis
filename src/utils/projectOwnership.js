// Roles que ven TODOS los proyectos, no solo los suyos.
const GLOBAL_ROLES = ['administrative', 'admin', 'engineer_nester'];

/**
 * Si `project` le pertenece a `userProfile`.
 *
 * Extraido literal de myProjectsRaw (MyProjectsView.jsx) porque ahora lo
 * necesitan dos consumidores: la vista, para filtrar su lista, y el click en
 * la notificacion de un tag, para decidir a donde navegar. My Projects solo
 * muestra proyectos propios, asi que mandar ahi un tag sobre un proyecto ajeno
 * aterrizaria en una vista que no lo contiene — de ahi que las dos decisiones
 * tengan que salir del mismo predicado.
 */
export function ownsProject(userProfile, project) {
  if (!userProfile) return false;
  if (GLOBAL_ROLES.includes(userProfile.role)) return true;
  const mine = String(userProfile.designerName ?? '').trim().toLowerCase();
  if (!mine) return false;
  const theirs = String(project?.eng ?? '').trim().toLowerCase();
  return Boolean(theirs) && theirs === mine;
}
