import Papa from 'papaparse';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1qENXOvlEEY70LQ4i4EQBA0rGpuDr9L1sQIPtEL-Rm1I/export?format=csv';
const QUALITY_CSV_URL = 'https://docs.google.com/spreadsheets/d/1qENXOvlEEY70LQ4i4EQBA0rGpuDr9L1sQIPtEL-Rm1I/export?format=csv&gid=1762634268';

// Helper function to map header titles to column indices
const createHeaderMap = (row) => {
  const map = {};
  row.forEach((cell, index) => {
    const cleanCell = cell.trim().toLowerCase();
    if (cleanCell) {
      // Map exact name
      map[cleanCell] = index;
      // Also map simplified name for partial matching
      const simpleName = cleanCell.replace(/[^a-z0-9]/g, '');
      if (simpleName) {
        map[simpleName] = index;
      }
    }
  });
  return map;
};

// Helper function to get an index safely, falling back to a default
const getIdx = (map, keys, fallback) => {
  for (const key of keys) {
    if (map[key] !== undefined) return map[key];
  }
  return fallback;
};

// Parses one "• Name:[SO] FullName | Designer: X | Material: Y | Install: Z | Finals: W"
// bullet line from an alert banner cell into a structured project entry.
const parseAlertBulletLine = (line) => {
  const trimmed = line.replace(/^[•\s]+/, '').trim();
  if (!trimmed) return null;

  const segments = trimmed.split('|').map(s => s.trim());
  const titlePart = segments[0] || '';
  const soMatch = titlePart.match(/\[(\d+)\]/);

  const getField = (label) => {
    const seg = segments.find(s => s.toLowerCase().startsWith(label.toLowerCase()));
    if (!seg) return '';
    const value = seg.slice(seg.indexOf(':') + 1).trim();
    return value.toUpperCase() === 'N/A' ? '' : value;
  };

  return {
    so: soMatch ? soMatch[1] : '',
    name: titlePart,
    designer: getField('Designer'),
    material: getField('Material'),
    install: getField('Install'),
    finals: getField('Finals'),
  };
};

// Both alert banners are a single cell: a header line ("... N project(s) ...")
// followed by "• ..." bullet lines, one per affected project.
const parseAlertBannerCell = (cellText) => {
  const lines = cellText.split('\n').map(l => l.trim()).filter(Boolean);
  const header = lines.find(l => !l.startsWith('•')) || '';
  const countMatch = header.match(/(\d+)\s*project/i);
  const projects = lines
    .filter(l => l.startsWith('•'))
    .map(parseAlertBulletLine)
    .filter(Boolean);
  return {
    message: header,
    count: countMatch ? parseInt(countMatch[1], 10) : projects.length,
    projects,
  };
};

const parseDateStringOrNumber = (val) => {
  if (!val) return '0';
  const cleanVal = val.trim();
  if (cleanVal.includes('/')) {
    const parts = cleanVal.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) {
          const epoch = new Date(1899, 11, 30);
          const diffTime = d.getTime() - epoch.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          return diffDays.toString();
        }
      }
    }
  }
  return cleanVal;
};

export async function fetchAndParseData() {
  try {
    // Append a unique timestamp to prevent browser and CDN caching
    const cacheBuster = `&t=${new Date().getTime()}`;
    const response = await fetch(`${CSV_URL}${cacheBuster}`);
    if (!response.ok) throw new Error('Failed to fetch CSV data');
    const csvText = await response.text();

    const { data } = Papa.parse(csvText, { skipEmptyLines: false });
    
    // Data structures to hold parsed sections
    const parsedData = {
      priorityAnalysis: [],
      onHoldNotes: [],
      weekOverWeek: [],
      insights: {
        executive: '',
        weekly: '',
        actionPlan: ''
      },
      meetingPoints: [],
      topCostProjects: [],
      materialRequirements: [],
      statusHistory: [],
      weekLabels: { previous: 'Previous Week', current: 'Current Week' },
      financialImpact: {
        description: '',
        rows: []
      },
      alerts: {
        unassignedEngineer: null,
        pendingCheckReview: null
      }
    };

    let currentSection = null;
    let headers = {};

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Sometimes rows have leading empty columns, let's get the first non-empty cell as a heuristic, 
      // or join the row to find keywords
      const rowString = row.join('').trim();
      if (!rowString) continue;

      // Alert banners live in a single cell each (header line + "• ..."
      // bullets), independent of the currentSection state machine below.
      if (rowString.includes('ACTION REQUIRED') && rowString.includes('without an assigned engineer')) {
        const cellText = row.find(c => c && c.includes('ACTION REQUIRED')) || '';
        parsedData.alerts.unassignedEngineer = parseAlertBannerCell(cellText);
        continue;
      } else if (rowString.includes('ACTION REQUIRED') && rowString.includes("'Check' status")) {
        const cellText = row.find(c => c && c.includes('ACTION REQUIRED')) || '';
        parsedData.alerts.pendingCheckReview = parseAlertBannerCell(cellText);
        continue;
      }

      // Detect Section Headers
      if (rowString.includes('Priority Analysis (Action Required)')) {
        currentSection = 'priorityAnalysis';
        if (data[i + 1]) headers = createHeaderMap(data[i + 1]);
        i++; // skip header row
        continue;
      } else if (rowString.includes('ON HOLD Projects - Detailed Notes')) {
        currentSection = 'onHoldNotes';
        if (data[i + 1]) headers = createHeaderMap(data[i + 1]);
        i++; // skip header row
        continue;
      } else if (rowString.includes('Week over Week Comparison')) {
        currentSection = 'weekOverWeek';
        // The NEXT row is the header with date labels - parse it
        if (data[i + 1]) {
          headers = createHeaderMap(data[i + 1]);
          const headerRow = data[i + 1];
          const headerString = headerRow.join(',');
          // Extract previous week label e.g. "Previous Week (June 1, 2026)"
          const prevMatch = headerString.match(/Previous\s+Week\s*\(([^)]+)\)/i);
          const currMatch = headerString.match(/Current\s+Week\s*\(([^)]+)\)/i);
          parsedData.weekLabels = {
            previous: prevMatch ? prevMatch[1].trim() : 'Previous Week',
            current: currMatch ? currMatch[1].trim() : 'Current Week'
          };
        }
        i++; // skip header row
        continue;
      } else if (rowString.includes('Weekly Review & Insights')) {
        currentSection = 'insights';
        continue;
      } else if (rowString.includes('Meeting Talking Points')) {
        currentSection = 'meetingPoints';
        continue;
      } else if (rowString.includes('Financial Impact Analysis')) {
        currentSection = 'financialImpact';
        // Next row is the description text
        if (data[i + 1]) {
          parsedData.financialImpact.description = data[i + 1].join('').trim();
        }
        i++; // skip description row
        continue;
      } else if (rowString.includes('Top Active Projects by Cost')) {
        currentSection = 'topCostProjects';
        if (data[i + 1]) headers = createHeaderMap(data[i + 1]);
        i++; // skip header row
        continue;
      } else if (rowString.includes('Active Projects Material Requirements')) {
        currentSection = 'materialRequirements';
        if (data[i + 1]) headers = createHeaderMap(data[i + 1]);
        i++; // skip header row
        continue;
      } else if (rowString.includes('Status History') && rowString.includes('SO#')) {
        currentSection = 'statusHistory';
        headers = createHeaderMap(row);
        continue; 
      }

      // If we are in a section, parse rows dynamically
      if (currentSection === 'priorityAnalysis') {
        if (rowString.includes('ON HOLD Projects') || rowString.includes('Week over Week')) {
            // we hit next section accidentally, though handled above
        } else {
           const soIdx = getIdx(headers, ['so#', 'so'], 1);
           const nameIdx = getIdx(headers, ['name', 'projectname'], 2);
           const installIdx = getIdx(headers, ['install', 'installdate'], 3);
           const engIdx = getIdx(headers, ['eng', 'engineering'], 4);
           const statusIdx = getIdx(headers, ['status'], 5);
           const finalsScheduledIdx = getIdx(headers, ['finalsscheduled', 'finalscheduled'], 6);
           const finalTakenIdx = getIdx(headers, ['finaltaken', 'finalstaken'], 7);

           if (row[soIdx] && row[soIdx].toUpperCase() !== 'SO#') {
             parsedData.priorityAnalysis.push({
               so: row[soIdx],
               name: row[nameIdx],
               install: row[installIdx],
               eng: row[engIdx],
               status: row[statusIdx],
               finalsScheduled: row[finalsScheduledIdx],
               finalTaken: row[finalTakenIdx]
             });
           }
        }
      } 
      else if (currentSection === 'onHoldNotes') {
        const designerIdx = getIdx(headers, ['designeremail', 'designer'], 1);
        const projectIdx = getIdx(headers, ['projectname', 'project'], 2);
        const notesIdx = getIdx(headers, ['onholdnotes', 'notes'], 3);

        if (row[designerIdx] && !row[designerIdx].includes('Designer & Email')) {
          parsedData.onHoldNotes.push({
            designer: row[designerIdx],
            project: row[projectIdx],
            notes: row[notesIdx]
          });
        }
      }
      else if (currentSection === 'weekOverWeek') {
        const metricIdx = getIdx(headers, ['metric'], 1);
        // Find previous and current columns based on partial matching since they include dates
        let prevIdx = 5, currIdx = 7, varIdx = 9;
        Object.keys(headers).forEach(k => {
          if (k.includes('previous')) prevIdx = headers[k];
          if (k.includes('current')) currIdx = headers[k];
          if (k.includes('variance')) varIdx = headers[k];
        });

        if (row[metricIdx] && row[metricIdx].toLowerCase() !== 'metric') {
          parsedData.weekOverWeek.push({
            metric: row[metricIdx],
            previous: parseDateStringOrNumber(row[prevIdx]),
            current: parseDateStringOrNumber(row[currIdx]),
            variance: parseDateStringOrNumber(row[varIdx])
          });
        }
      }
      else if (currentSection === 'insights') {
        if (rowString.includes('Executive Summary')) {
            if (data[i+1]) parsedData.insights.executive = data[i+1].join('').trim();
        } else if (rowString.includes('Weekly Summary')) {
            if (data[i+1]) parsedData.insights.weekly = data[i+1].join('').trim();
        } else if (rowString.includes('Action Plan & Key Takeaways')) {
            if (data[i+1]) parsedData.insights.actionPlan = data[i+1].join('').trim();
        }
      }
      else if (currentSection === 'meetingPoints') {
        // Fallback to checking any cell in the row since meeting points might be in column 1 or 2
        const pointCell = row.find(cell => cell && cell.trim().startsWith('-'));
        if (pointCell) {
          parsedData.meetingPoints.push(pointCell);
        }
      }
      else if (currentSection === 'financialImpact') {
        // Parse rows like: ,ON HOLD,"$170,195.00",,,,,,, or ,Status,Value
        const statusIdx = 1;
        const valueIdx = 2;
        if (row[statusIdx] && row[statusIdx] !== 'Status' && row[valueIdx] && row[valueIdx].includes('$')) {
          parsedData.financialImpact.rows.push({
            status: row[statusIdx].trim(),
            value: row[valueIdx].trim()
          });
        }
      }
      else if (currentSection === 'topCostProjects') {
        const nameIdx = getIdx(headers, ['projectname', 'project'], 1);
        
        if (row[nameIdx] && row[nameIdx].toLowerCase() !== 'project name') {
          // cost might not be in a specific header if it changes, let's keep the fallback
          let cost = row.find(cell => cell.includes('$'));
          if (!cost) {
             const costIdx = getIdx(headers, ['totalcost', 'cost'], 2);
             cost = row[costIdx];
          }
          parsedData.topCostProjects.push({
            name: row[nameIdx],
            cost: cost || '0'
          });
        }
      }
      else if (currentSection === 'materialRequirements') {
        const soIdx = getIdx(headers, ['so#', 'so'], 1);
        const nameIdx = getIdx(headers, ['name', 'projectname'], 2);
        const thermIdx = getIdx(headers, ['thermofoilrequirements', 'thermofoil'], 3);
        const noHolesIdx = getIdx(headers, ['noholesdoors', 'noholes'], 4);
        const dovetailIdx = getIdx(headers, ['dovetaildrawers', 'dovetail'], 5);
        const elementIdx = getIdx(headers, ['elementdoors', 'element'], 6);
        const installIdx = getIdx(headers, ['installdate', 'install'], 7);

        if (row[soIdx] && row[soIdx].toUpperCase() !== 'SO#') {
          parsedData.materialRequirements.push({
            so: row[soIdx],
            name: row[nameIdx],
            thermofoil: row[thermIdx],
            noHoles: row[noHolesIdx],
            dovetail: row[dovetailIdx],
            element: row[elementIdx],
            installDate: row[installIdx]
          });
        }
      }
      else if (currentSection === 'statusHistory') {
        const soIdx = getIdx(headers, ['so#', 'so'], 1);
        const nameIdx = getIdx(headers, ['name', 'projectname'], 2);
        const statusIdx = getIdx(headers, ['status'], 3);
        const dateIdx = getIdx(headers, ['statusdate', 'date'], 4);
        const histIdx = getIdx(headers, ['history', 'notes'], 5);

        if (row[soIdx] && row[soIdx].toUpperCase() !== 'SO#') {
          parsedData.statusHistory.push({
            so: row[soIdx],
            name: row[nameIdx],
            status: row[statusIdx],
            statusDate: row[dateIdx],
            history: row[histIdx]
          });
        }
      }
    }

    // Un 200 no garantiza que el cuerpo sea la planilla: Google puede devolver
    // un interstitial de permisos, una pagina de rate limit, o un CSV cortado a
    // la mitad. En ese caso ninguna cabecera de seccion matchea y esto retorna
    // un parsedData perfectamente formado pero vacio, sin lanzar nada — y
    // App.jsx lo escribe en firebase_cache/data, que es un nodo COMPARTIDO por
    // todos los clientes, pisando el cache bueno de todo el mundo.
    // Si no se reconocio ni una sola seccion, es un cuerpo invalido, no una
    // planilla legitimamente vacia: lanzar para que App.jsx caiga a su
    // fallback de cache expirado en vez de propagar el vacio.
    const recognizedAnySection =
      parsedData.priorityAnalysis.length > 0 ||
      parsedData.materialRequirements.length > 0 ||
      parsedData.statusHistory.length > 0 ||
      parsedData.weekOverWeek.length > 0 ||
      parsedData.topCostProjects.length > 0 ||
      parsedData.onHoldNotes.length > 0 ||
      parsedData.meetingPoints.length > 0;

    if (!recognizedAnySection) {
      throw new Error(
        'Sheet parsed but no known section was recognized — the CSV response is probably not the spreadsheet (permissions interstitial, rate limit, or truncated body).'
      );
    }

    return parsedData;

  } catch (error) {
    console.error('Error parsing sheet:', error);
    throw error;
  }
}

// --- Pestaña "Personal KPI" (gid 1762634268) -------------------------------
//
// El tab no es una tabla: es una hoja con bloques apilados. De arriba a abajo
// hay una tabla de totales acumulados, la tabla de proyectos (~29 columnas),
// la tabla "% of Total", una guia de uso, cuatro tablas por periodo (30 /
// 31-60 / 61-90 / 91-120 dias) y tres tablas "... Performance".
//
// Varios de esos bloques arrancan con un encabezado que dice "Engineer", y el
// de proyectos ademas trae las columnas "Eng. Engineering" y "Own Points". Por
// eso cada bloque se busca por su ancla propia y se corta en la primera fila
// vacia, en vez de barrer la hoja preguntando si la fila "parece" un
// encabezado: asi ninguna seccion puede reabrir la tabla de otra.

const normalize = (value) => String(value ?? '').trim().toLowerCase();

// "$41,817.63" -> 41817.63, "23.5%" -> 23.5, "" -> 0.
const parseNumericCell = (value) => {
  const parsed = parseFloat(String(value ?? '').replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const isBlankRow = (row) => !row || row.every(cell => normalize(cell) === '');

// Tabla "Engineer | % of Total" (A139:B146 al momento de escribir esto). Es la
// unica fuente de porcentajes: la tabla de totales de arriba no tiene columna
// de %, y leerla por posicion daba la lista de SOs de "Projects that Added"
// interpretada como numero (porcentajes de 1.2e+49).
function parsePercentTable(data) {
  const headerIndex = data.findIndex(row =>
    normalize(row?.[0]) === 'engineer' && normalize(row?.[1]).includes('% of total')
  );
  if (headerIndex === -1) return [];

  const rows = [];
  for (let i = headerIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (isBlankRow(row)) break;

    const engineer = String(row[0] ?? '').trim();
    if (!engineer) break;
    if (['total', 'so.team', 'team'].some(kw => normalize(engineer).includes(kw))) break;

    rows.push({ engineer, percent: parseNumericCell(row[1]) });
  }
  return rows;
}

// Tablas por periodo: una fila-titulo ("KPI Last 30 Days (07/20 - 08/19)"),
// una fila de encabezado y las filas de ingenieros hasta la primera vacia.
// `titlePattern` tiene que excluir las variantes "... Performance", que se
// llaman igual pero traen Working Days / Labor Hours en las columnas B y C.
function parsePeriodTable(data, titlePattern) {
  const titleIndex = data.findIndex(row => {
    const title = String(row?.[0] ?? '').trim();
    return titlePattern.test(title) && !/performance\s*$/i.test(title);
  });
  if (titleIndex === -1) return null;

  const title = String(data[titleIndex][0]).trim();

  // La fila siguiente deberia ser el encabezado de columnas; si la hoja lo
  // pierde, se arranca igual desde ahi antes que devolver una tabla vacia.
  let cursor = titleIndex + 1;
  if (normalize(data[cursor]?.[0]) === 'engineer') cursor++;

  const rows = [];
  for (let i = cursor; i < data.length; i++) {
    const row = data[i];
    if (isBlankRow(row)) break;

    const engineer = String(row[0] ?? '').trim();
    if (!engineer) break;
    if (/^kpi\b/i.test(engineer)) break;
    if (['total', 'so.team', 'team'].some(kw => normalize(engineer).includes(kw))) break;

    rows.push({
      engineer,
      ownPoints: parseNumericCell(row[1]),
      revisionPoints: parseNumericCell(row[2]),
      nestingPoints: parseNumericCell(row[3]),
      // Columna E de la hoja, no la suma de B+C+D: la hoja calcula con
      // precision completa y redondea al final, asi que en varias filas la
      // suma de lo que se muestra da un centavo mas. Se muestra lo que dice
      // la hoja.
      totalKPI: parseNumericCell(row[4]),
      projects: String(row[5] ?? '').trim(),
      explanation: String(row[6] ?? '').trim(),
    });
  }

  return { title, rows };
}

export function parseQualityCsv(csvText) {
  const { data } = Papa.parse(csvText, { skipEmptyLines: false });

  return {
    kpiData: parsePercentTable(data),
    last30Days: parsePeriodTable(data, /^kpi\s+last\s+30\s+days/i),
    days31to60: parsePeriodTable(data, /^kpi\s+31\s*-\s*60\s+days/i),
    days61to90: parsePeriodTable(data, /^kpi\s+61\s*-\s*90\s+days/i),
    days91to120: parsePeriodTable(data, /^kpi\s+91\s*-\s*120\s+days/i),
  };
}

export async function fetchAndParseQualityData() {
  try {
    const cacheBuster = `&t=${new Date().getTime()}`;
    const response = await fetch(`${QUALITY_CSV_URL}${cacheBuster}`);
    if (!response.ok) throw new Error('Failed to fetch Quality CSV data');
    return parseQualityCsv(await response.text());
  } catch (error) {
    console.error('Error parsing Quality sheet:', error);
    throw error;
  }
}

const PROJECT_MATERIALS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1qENXOvlEEY70LQ4i4EQBA0rGpuDr9L1sQIPtEL-Rm1I/export?format=csv&gid=2135314033';

export async function fetchAndParseProjectMaterials() {
  try {
    const cacheBuster = `&t=${new Date().getTime()}`;
    const response = await fetch(`${PROJECT_MATERIALS_CSV_URL}${cacheBuster}`);
    if (!response.ok) throw new Error('Failed to fetch Project Materials CSV data');
    const csvText = await response.text();

    const { data } = Papa.parse(csvText, { skipEmptyLines: false });
    
    // Group materials by SO
    const materialsBySo = {};
    let currentSo = null;

    // Find headers
    let headerRowIdx = -1;
    let headers = {};
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (row.join('').toLowerCase().includes('so#') && row.join('').toLowerCase().includes('material')) {
        headerRowIdx = i;
        headers = createHeaderMap(row);
        break;
      }
    }

    if (headerRowIdx === -1) {
       console.warn("Could not find headers in project materials sheet");
       return {};
    }

    const soIdx = getIdx(headers, ['so#', 'so'], 0);
    const materialIdx = getIdx(headers, ['material', 'materials'], 2);
    const quantityIdx = getIdx(headers, ['quantity', 'qty'], 3);
    const urgencyIdx = getIdx(headers, ['urgency'], 4);

    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i];
      const rowString = row.join('').trim();
      if (!rowString) continue;

      const soVal = row[soIdx]?.trim();
      if (soVal && soVal.toLowerCase() !== 'so#') {
        currentSo = soVal;
      }

      if (!currentSo) continue;

      const material = row[materialIdx]?.trim();
      const quantity = row[quantityIdx]?.trim();
      const urgency = row[urgencyIdx]?.trim();

      if (material) {
        if (!materialsBySo[currentSo]) {
          materialsBySo[currentSo] = [];
        }
        materialsBySo[currentSo].push({
          material,
          quantity,
          urgency
        });
      }
    }

    return materialsBySo;
  } catch (error) {
    console.error('Error parsing Project Materials sheet:', error);
    return {}; // Return empty object on failure so app doesn't break
  }
}
