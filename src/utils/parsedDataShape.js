// Forma canonica de `parsedData` (la salida de sheetParser.js).
//
// Por que existe: el parser SIEMPRE arranca de este esqueleto, asi que una
// vista puede escribir `data.onHoldNotes.find(...)` sin guard y funcionar
// perfecto contra datos recien parseados. Pero ese objeto se guarda en
// `firebase_cache/data`, y **Firebase RTDB borra la clave cuando el valor es un
// array u objeto vacio**. Una semana sin notas de On Hold guarda
// `onHoldNotes: []`, RTDB tira la clave, y al leer el cache la vista recibe
// `undefined` y revienta con "Cannot read properties of undefined".
//
// No es hipotetico: es exactamente el crash de PipelineView, y el mismo
// mecanismo que ya habia roto el generador de ESS (ver restoreEmptyArrays en
// usePagedModal.js). La diferencia es que aca el dato lo consume media app, asi
// que se repara en el borde de lectura del cache y no en cada vista.
//
// `alerts` es el caso mas silencioso: sus dos campos nacen en null, y un objeto
// con todos los valores null tambien desaparece entero del nodo.

// Campos que el parser garantiza como array.
export const PARSED_ARRAY_FIELDS = [
  'priorityAnalysis',
  'onHoldNotes',
  'weekOverWeek',
  'meetingPoints',
  'topCostProjects',
  'materialRequirements',
  'statusHistory',
];

// RTDB devuelve un array como objeto indexado ({0:..., 1:...}) si las claves
// dejaron de ser contiguas (pasa cuando algun elemento se guardo como null).
const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
};

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

/** El esqueleto vacio, identico al que arma sheetParser.js antes de parsear. */
export const emptyParsedData = () => ({
  priorityAnalysis: [],
  onHoldNotes: [],
  weekOverWeek: [],
  insights: { executive: '', weekly: '', actionPlan: '' },
  meetingPoints: [],
  topCostProjects: [],
  materialRequirements: [],
  statusHistory: [],
  weekLabels: { previous: 'Previous Week', current: 'Current Week' },
  financialImpact: { description: '', rows: [] },
  alerts: { unassignedEngineer: null, pendingCheckReview: null },
});

/**
 * Devuelve `parsed` con todas las claves que el parser garantiza, rellenando
 * las que el viaje por RTDB haya borrado. No inventa datos: lo que falta vuelve
 * vacio, que es exactamente lo que se habia guardado.
 *
 * @param {Object|null} parsed - parsedData tal como vuelve del cache
 * @returns {Object|null} null solo si la entrada no era un objeto
 */
export function normalizeParsedData(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const base = emptyParsedData();
  const out = { ...base, ...parsed };

  for (const field of PARSED_ARRAY_FIELDS) {
    out[field] = asArray(parsed[field]);
  }

  out.insights = { ...base.insights, ...asObject(parsed.insights) };
  out.weekLabels = { ...base.weekLabels, ...asObject(parsed.weekLabels) };
  out.alerts = { ...base.alerts, ...asObject(parsed.alerts) };
  out.financialImpact = {
    ...base.financialImpact,
    ...asObject(parsed.financialImpact),
    rows: asArray(asObject(parsed.financialImpact).rows),
  };

  return out;
}
