// Que cuenta como "vivo" al buscar proyectos huerfanos.
//
// Un huerfano es un proyecto que ya no esta en ningun lado activo pero dejo
// datos sueltos en la base. El riesgo de equivocarse es alto: el panel ofrece
// archivarlo como Completado, asi que un falso positivo marca como terminado un
// proyecto que sigue en curso.
//
// El bug que esto corrige: se miraba SOLO el weekly KPI (priorityAnalysis).
// Cuando Designer Performance paso a leer de "Master Schedule Mirror" —que
// tiene los proyectos en etapas previas, antes de llegar al weekly KPI— todos
// esos quedaron fuera de la definicion de "vivo" y el panel los ofrecia para
// archivar. Caso real: SO 12510, con fecha de instalacion y sin Completion
// Date, aparecio como huerfano.

/**
 * Conjunto de SO que NO deben considerarse huerfanos: los de cualquier fuente
 * activa, mas los ya archivados.
 *
 * @param {object} sources
 * @param {Array}  sources.priorityAnalysis  filas del weekly KPI
 * @param {Array}  sources.masterProjects    activos de Master Schedule Mirror
 * @param {Array}  sources.archivedProjects  ya archivados
 */
export function buildKnownSoSet({ priorityAnalysis, masterProjects, archivedProjects } = {}) {
  const known = new Set();
  const add = (list) => (list || []).forEach(p => {
    const so = String(p?.so ?? '').trim();
    if (so) known.add(so);
  });
  add(priorityAnalysis);
  add(masterProjects);
  add(archivedProjects);
  return known;
}

/** Si un SO con datos sueltos es realmente un huerfano. */
export const isOrphanSo = (so, knownSoSet) => !knownSoSet.has(String(so).trim());
