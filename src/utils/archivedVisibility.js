// Quien ve que proyecto archivado.
//
// La regla base es que cada uno ve lo suyo: los archivados se atribuyen por el
// campo `eng`. Tres roles la saltean y ven todo.
//
// El agujero que esto cierra: un proyecto archivado SIN `eng` no era de nadie,
// asi que el filtro personal lo descartaba para todos y quedaba invisible salvo
// para esos tres roles. Pasa con los que se recuperan desde Orphaned Projects,
// que se reconstruyen a partir de restos en la base y muchas veces no tienen de
// donde sacar quien los trabajo.

const SEES_EVERYTHING = ['administrative', 'admin', 'engineer_nester'];

export const seesAllArchived = (userProfile) =>
  Boolean(userProfile && SEES_EVERYTHING.includes(userProfile.role));

const sameName = (a, b) =>
  Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** Sin ingeniero asignado: el proyecto no es de nadie. */
export const isUnownedArchived = (project) =>
  !project?.eng || !String(project.eng).trim();

/**
 * Los que cuentan como trabajo del usuario. Alimenta las METRICAS, asi que
 * deliberadamente NO incluye los que no tienen dueño: un proyecto sin asignar
 * no puede sumarle a todo el mundo.
 */
export const ownedArchivedProjects = (archived, userProfile) => {
  if (!userProfile) return [];
  if (seesAllArchived(userProfile)) return archived || [];
  return (archived || []).filter(p => sameName(p?.eng, userProfile.designerName));
};

/**
 * Los que hay que mostrar en la lista de Completados: los propios mas los que
 * no son de nadie. Es solo para la vista, no para las metricas.
 */
export const visibleArchivedProjects = (archived, userProfile) => {
  if (!userProfile) return [];
  if (seesAllArchived(userProfile)) return archived || [];
  return (archived || []).filter(
    p => sameName(p?.eng, userProfile.designerName) || isUnownedArchived(p)
  );
};
