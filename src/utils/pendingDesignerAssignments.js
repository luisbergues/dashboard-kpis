import { isSuperAdminRole } from './adminConfig';

/**
 * Roles que NUNCA quedan bloqueados por el gate de asignación de diseñador.
 *
 * Los tres primeros ven TODOS los proyectos de la empresa en My Projects (ver
 * `myProjectsRaw` en MyProjectsView), no solo los suyos: bloquearlos los
 * dejaría trabados por proyectos ajenos, potencialmente decenas. Un `designer`
 * directamente no tiene My Projects.
 *
 * El super admin NO va acá: `myProjectsRaw` no le hace bypass, así que su My
 * Projects sale filtrado por la columna ENG igual que el de cualquier
 * ingeniero. Exentarlo dejaba sin pedido justo a la cuenta que más proyectos
 * propios tiene.
 */
const EXEMPT_ROLES = new Set([
  'admin',
  'administrative',
  'engineer_nester',
  'designer',
]);

const norm = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Proyectos del ingeniero que todavía no tienen diseñador asignado.
 *
 * Es toda la decisión de "¿hay que bloquear?" en una función pura, para poder
 * probarla sin React ni Firebase. El componente solo pregunta si la cola está
 * vacía.
 *
 * Un proyecto entra en la cola cuando la columna ENG de la planilla coincide
 * con el nombre del usuario y `project_designers/{so}` está vacío. La
 * comparación normaliza mayúsculas y espacios porque esa columna se carga a
 * mano.
 *
 * Limitación conocida y deliberada: un proyecto con la columna ENG vacía o mal
 * escrita no cae en el My Projects de nadie, así que nunca se le va a pedir
 * diseñador. Esto completa lo que ya está asignado a un ingeniero, no todo el
 * universo de proyectos.
 *
 * @returns {Array<{so: string, name?: string}>} en el orden de la planilla, sin
 *   SO repetidos. Vacío = no hay nada que bloquear.
 */
export function pendingDesignerAssignments({
  userProfile,
  projects = [],
  projectDesigners = {},
} = {}) {
  if (!userProfile) return [];
  // Una cuenta sin aprobar ya la frena el gate de aprobación de App.jsx; no
  // tiene sentido pedirle nada antes de eso. El super admin se saltea ese gate
  // (App.jsx lo deja entrar con cualquier status, porque su rol se asigna a
  // mano desde la Console y puede no traer `status`), así que exigirle
  // 'approved' acá lo dejaba afuera por la puerta de atrás.
  const puedeOperar = userProfile.status === 'approved'
    || isSuperAdminRole(userProfile.role);
  if (!puedeOperar) return [];
  if (EXEMPT_ROLES.has(userProfile.role)) return [];

  const myName = norm(userProfile.designerName);
  // Sin nombre configurado no hay con qué matchear la columna ENG: bloquear
  // seria trabarlo por proyectos que no se puede saber si son suyos.
  if (!myName) return [];

  const seen = new Set();
  const pending = [];

  for (const project of projects || []) {
    const so = String(project?.so ?? '').trim();
    if (!so || seen.has(so)) continue;
    if (norm(project.eng) !== myName) continue;
    // Un valor en blanco cuenta como sin asignar: Firebase puede tener la clave
    // con string vacio si alguien la limpio.
    if (norm(projectDesigners?.[so])) continue;

    seen.add(so);
    pending.push(project);
  }

  return pending;
}
