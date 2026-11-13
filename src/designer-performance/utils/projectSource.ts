// La fuente del modulo (Master Schedule Mirror) solo trae proyectos ACTIVOS:
// en cuanto se carga la Completion Date, la fila sale de la lista. Sin esto,
// cada proyecto cerrado en Fase 2 desaparecia del Leaderboard junto con su
// puntaje de Fase 2, asi que "Completed" daba siempre 0, AVG P2 quedaba vacio
// y los diseñadores cuyos proyectos ya habian terminado salian todos en "—".
//
// Se suman los proyectos con evaluacion guardada (status distinto de Pending)
// que ya no estan en la fuente. El nombre sale de lo que se guardo al evaluar.
export function withEvaluatedProjects(
  source: Array<{ so: string | number; name?: string }>,
  performanceProjects: Record<string, { status?: string; projectName?: string }>,
): Array<{ so: string; name: string }> {
  const list = (source || []).map(p => ({ ...p, so: String(p.so), name: p.name ?? '' }));
  const present = new Set(list.map(p => p.so));

  Object.entries(performanceProjects || {}).forEach(([so, perf]) => {
    if (present.has(so)) return;
    if (!perf?.status || perf.status === 'Pending') return;
    list.push({ so, name: perf.projectName || '' });
  });

  return list;
}
