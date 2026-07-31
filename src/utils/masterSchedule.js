import Papa from 'papaparse';

// Pestaña "Master Schedule Mirror" del mismo documento que el resto del
// dashboard. Es la fuente aguas arriba: los proyectos aparecen acá antes de
// llegar al weekly KPI, que es lo que necesita Designer Performance para
// evaluar el intake (Fase 1) en su etapa real.
export const MASTER_SCHEDULE_CSV_URL =
  'https://docs.google.com/spreadsheets/d/1qENXOvlEEY70LQ4i4EQBA0rGpuDr9L1sQIPtEL-Rm1I/export?format=csv&gid=1648942410';

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Convierte el CSV de la pestaña Master Schedule Mirror en la lista de
 * proyectos activos.
 *
 * Un proyecto se considera activo mientras no tenga `Completion Date`. De las
 * ~1200 filas de la pestaña, la enorme mayoría son trabajos ya terminados de
 * años anteriores; sin este filtro el desplegable de Fase 1 sería inusable.
 *
 * Devuelve `{ so, name, spaces }`. Designer Performance solo consume `so` y
 * `name`; `spaces` queda disponible pero hoy no se usa (Total Rooms se carga a
 * mano a propósito).
 */
export function parseMasterSchedule(csvText) {
  if (!csvText || !csvText.trim()) return [];

  // Papa maneja comillas, comas internas y saltos de línea embebidos, que esta
  // pestaña tiene de sobra en la columna Comments.
  const { data } = Papa.parse(csvText, { skipEmptyLines: false });
  if (!data.length) return [];

  const header = data[0].map(norm);
  const col = (...names) => {
    for (const n of names) {
      const i = header.indexOf(norm(n));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iSo = col('SO', 'SO#');
  const iName = col('Client');
  const iCompletion = col('Completion Date');
  const iSpaces = col('# Of Closets / Spaces');

  // Sin SO no hay clave con la que enlazar nada en Firebase.
  if (iSo === -1) return [];

  const out = [];
  const seen = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const so = String(row[iSo] ?? '').trim();
    // Solo SO numéricos y distintos de 0: descarta la fila "[0] SHOWROOM" y
    // cualquier fila de totales o separador que se cuele.
    if (!/^\d+$/.test(so) || so === '0') continue;

    // Ya terminado: fuera.
    if (iCompletion !== -1 && String(row[iCompletion] ?? '').trim()) continue;

    // El módulo indexa todo por SO en Firebase, así que un SO repetido no puede
    // producir dos proyectos: gana el primero.
    if (seen.has(so)) continue;
    seen.add(so);

    const rawSpaces = iSpaces !== -1 ? String(row[iSpaces] ?? '').replace(/[^0-9.]/g, '') : '';
    out.push({
      so,
      name: iName !== -1 ? String(row[iName] ?? '').trim() : '',
      spaces: rawSpaces ? Number(rawSpaces) : null,
    });
  }

  return out;
}

export async function fetchAndParseMasterSchedule() {
  try {
    const cacheBuster = `&t=${new Date().getTime()}`;
    const response = await fetch(`${MASTER_SCHEDULE_CSV_URL}${cacheBuster}`);
    if (!response.ok) throw new Error('Failed to fetch Master Schedule CSV data');
    return parseMasterSchedule(await response.text());
  } catch (error) {
    console.error('Error fetching Master Schedule Mirror:', error);
    return [];
  }
}
