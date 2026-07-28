// Crear una nota designer le descuenta puntos del KPI a un disenador, asi que
// queda restringida a los roles de ingenieria. Resolver una nota sigue la
// misma regla que crearla.
const DESIGNER_NOTE_ROLES = ['engineer', 'engineer_nester', 'engineer-admin'];

export const canManageDesignerNotes = (userProfile) =>
  Boolean(userProfile && DESIGNER_NOTE_ROLES.includes(userProfile.role));
