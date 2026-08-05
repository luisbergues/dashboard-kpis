export const STAGES = [
  { id: 'ingenieria', label: 'Ingeniería' },
  { id: 'check1', label: 'Eng. Check' },
  { id: 'paperwork', label: 'Paperwork' },
  { id: 'check2', label: 'PW Check' },
  { id: 'nesting', label: 'Nesting' },
  { id: 'install', label: 'Install' }
];

// statusHistory.statusDate is raw sheet text — it can be empty, "N/A", or an
// otherwise unparseable value. new Date(garbage).toISOString() throws
// RangeError: Invalid time value, which crashed every view that renders a
// project's stage progress (Pipeline, My Projects, Project Detail,
// Dashboard). Returns null instead of throwing so callers can skip the entry.
function toISOStringOrNull(dateInput) {
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export const STATUS_INDEX_MAP = {
  'ENGINEERING': 0,
  'CHECK ENG.': 1,
  'PAPERWORK': 2,
  'CHECK': 3,
  'NESTING': 4,
  'INSTALL': 5,
  'COMPLETED': 5
};

// Varios estados mapean al mismo indice ('INSTALL' y 'COMPLETED' son ambos 5).
// Buscar el estado de un indice con Object.keys().find() devolvia SIEMPRE el
// primero declarado ('INSTALL'), asi que un proyecto en 'Completed' consultaba
// statusDates['INSTALL'] — que no existe — y caia al fallback de hoy, perdiendo
// su fecha real de finalizacion. Devolver todos los estados posibles del indice
// y quedarse con el primero que tenga fecha real.
function statusesForIndex(index) {
  return Object.keys(STATUS_INDEX_MAP).filter(key => STATUS_INDEX_MAP[key] === index);
}

/**
 * @param {Object} project - fila del sheet, con statusHistory adjunto (ver App.jsx getMergedData)
 * @param {Array} recordedHistory - eventos reales de project_history/{so} (ver statusTransitions.js).
 *   Cuando existen, sus timestamps son la fuente de verdad: son transiciones
 *   observadas por la app, no derivadas de la unica fecha que trae el sheet.
 * @returns {Array} una entrada por etapa: false, o { completed, timestamp, estimated }.
 *   `estimated: true` marca una fecha FABRICADA (no se sabe cuando ocurrio esa
 *   etapa, se usa hoy para no romper las barras de progreso). Quien mida
 *   tendencias en el tiempo debe descartarlas — ver calculateWeeklyCompletions.
 */
export function calculateAutomaticStages(project, recordedHistory = []) {
  const progress = Array(STAGES.length).fill(false);
  const statusHistory = project.statusHistory || [];
  const currentStatus = (project.status || '').toUpperCase().trim();

  const statusIndexMap = STATUS_INDEX_MAP;

  // Track all statuses the project has been in and their earliest date
  const statusDates = {};

  statusHistory.forEach(h => {
    const s = (h.status || '').toUpperCase().trim();
    if (s && !statusDates[s] && h.statusDate) {
      const iso = toISOStringOrNull(h.statusDate);
      if (iso) statusDates[s] = iso;
    }
  });

  // Transiciones realmente observadas por la app (project_history). Pisan a la
  // fecha del sheet porque registran el momento exacto en que el proyecto
  // entro a ese estado, mientras que el sheet solo trae una fecha por proyecto.
  const realDates = {};
  (recordedHistory || []).forEach(ev => {
    const s = (ev?.status || '').toUpperCase().trim();
    if (!s || statusIndexMap[s] === undefined || !ev.timestamp) return;
    const iso = toISOStringOrNull(ev.timestamp);
    // El primero gana: los eventos se guardan en orden cronologico, y lo que
    // interesa es cuando ENTRO a la etapa, no la ultima vez que se re-observo.
    if (iso && !realDates[s]) realDates[s] = iso;
  });
  Object.assign(statusDates, realDates);

  // Also add current status if not already tracked (fallback to current date if missing)
  const currentStatusIsEstimated = Boolean(currentStatus) && !statusDates[currentStatus];
  if (currentStatusIsEstimated) {
    statusDates[currentStatus] = new Date().toISOString();
  }

  // Find the maximum index reached based on the status mapping
  let maxIndex = -1;

  Object.keys(statusDates).forEach(status => {
    if (statusIndexMap[status] !== undefined && statusIndexMap[status] > maxIndex) {
      maxIndex = statusIndexMap[status];
    }
  });

  // Mark all stages up to the maxIndex as completed
  for (let i = 0; i <= maxIndex; i++) {
    const candidates = statusesForIndex(i);
    const matched = candidates.find(s => statusDates[s]);
    const isReal = Boolean(matched) && (
      Boolean(realDates[matched]) || !(currentStatusIsEstimated && matched === currentStatus)
    );
    const dateForStage = matched ? statusDates[matched] : new Date().toISOString();

    progress[i] = {
      completed: true,
      timestamp: dateForStage,
      estimated: !isReal,
    };
  }

  return progress;
}
