// Aprobar un proyecto de Fase 1 con documentacion faltante es una decision de
// negocio, no tecnica: la toma el area administrativa. Deliberadamente NO
// incluye 'admin' ni el super admin 'engineer-admin' — se pidio que sea
// exclusivo del rol 'administrative'.
export const canForceApproveIntake = (userProfile) =>
  Boolean(userProfile && userProfile.role === 'administrative');
