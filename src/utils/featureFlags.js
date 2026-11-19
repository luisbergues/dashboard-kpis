// Interruptores de modulos enteros. Apagar uno no borra codigo ni datos: lo
// deja latente para reactivarlo cambiando la constante.

/**
 * Designer Performance (src/designer-performance/), en pausa desde noviembre
 * de 2026. Con `false`:
 *   - no aparece en el Navbar para ningun rol, y la pestaña no se puede abrir
 *     (ni con active_tab guardado en localStorage ni con el link ?so=);
 *   - el modulo no se monta, asi que no se descarga su chunk ni se le pasan
 *     datos de la app (mergedData, projectDesigners, perfil, masterProjects);
 *   - la pestaña "Master Schedule Mirror" (~450 KB) deja de bajarse cada 30 s
 *     para todos: solo se pide al abrir Admin, que la usa para detectar
 *     proyectos huerfanos;
 *   - se apagan los recordatorios de notas Designer sin resolver y los puntos
 *     de penalizacion que My Projects mostraba en cada nota Designer: ambos
 *     existen para alimentar el KPI de Fase 2 del modulo.
 *
 * Los nodos de Firebase del modulo (designer_performance_projects,
 * designer_performance_history) quedan intactos.
 */
export const DESIGNER_PERFORMANCE_ENABLED = false;

/**
 * Botones "Complete ESS" y "Complete IP" de cada card en My Projects, ocultos
 * por el momento. Con `false` solo dejan de renderizarse los botones: los
 * modales, su logica y sus datos quedan como estaban. Volver a `true` los
 * muestra de nuevo sin otro cambio.
 */
export const COMPLETE_ESS_IP_BUTTONS_ENABLED = false;
