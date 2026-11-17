import Papa from 'papaparse';

import { fetchSheetRows } from './fetchSheet';

// Las URLs de docs.google.com se fueron de aca a proposito: obligaban a tener
// la planilla publicada en la web y viajaban en el bundle. Ahora la lectura
// pasa por /api/sheet. Ver fetchSheet.js y api/sheet.js.

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
    // Sin cacheBuster: /api/sheet responde `Cache-Control: private, max-age=60`
    // y lee la planilla en vivo en cada invocacion, asi que no hay CDN que
    // enganar.
    const data = await fetchSheetRows('main');
    
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
      } else if (currentSection !== 'onHoldNotes' && row.some(c => String(c || '').trim().toLowerCase() === 'designer & email')) {
        // Misma tabla sin su fila de titulo: la hoja la perdio en noviembre de
        // 2026 y sus filas caian dentro de priorityAnalysis como proyectos
        // con SO "Designer & Email" y SO "<nombre>\n<email>".
        currentSection = 'onHoldNotes';
        headers = createHeaderMap(row);
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
      } else if (normalize(row[1]) === 'status' && normalize(row[2]) === 'value') {
        // Misma tabla sin su fila de titulo "Financial Impact Analysis" (la hoja
        // la perdio en noviembre de 2026): se reconoce por su encabezado, y la
        // descripcion es el texto de la fila de arriba.
        currentSection = 'financialImpact';
        if (!parsedData.financialImpact.description) {
          let k = i - 1;
          while (k >= 0 && isBlankRow(data[k])) k--;
          if (k >= 0) parsedData.financialImpact.description = data[k].join('').trim();
        }
        continue;
      } else if (rowString.includes('Performance Improvement Recommendations')) {
        // Ninguna vista la usa; solo cierra la seccion anterior para que su
        // texto no se cuele en ella.
        currentSection = null;
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

        // La tabla termina en la primera fila sin SO numerico. Sin este corte,
        // cuando la hoja perdio el titulo "Financial Impact Analysis", el texto
        // de ON HOLD, la tabla Status/Value y las recomendaciones aparecian en
        // Materials como proyectos con SO "#Status", "#Total"...
        const soCell = String(row[soIdx] ?? '').trim();
        if (soCell && !/^\d+$/.test(soCell) && soCell.toUpperCase() !== 'SO#') {
          currentSection = null;
        } else if (soCell && soCell.toUpperCase() !== 'SO#') {
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
//
// La columna del % se busca por encabezado: en noviembre de 2026 la hoja metio
// "KPI (30 Days)" en la B y el % paso a la C, y leerlo fijo en la B dejo la
// tabla vacia (Team Stats mostraba "No data found").
function parsePercentTable(data) {
  let percentCol = -1;
  const headerIndex = data.findIndex(row => {
    if (normalize(row?.[0]) !== 'engineer') return false;
    percentCol = (row || []).findIndex(cell => normalize(cell).includes('% of total'));
    return percentCol !== -1;
  });
  if (headerIndex === -1) return [];

  const rows = [];
  for (let i = headerIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (isBlankRow(row)) break;

    const engineer = String(row[0] ?? '').trim();
    if (!engineer) break;
    if (['total', 'so.team', 'team'].some(kw => normalize(engineer).includes(kw))) break;

    rows.push({ engineer, percent: parsePercentCell(row[percentCol]) });
  }
  return rows;
}

// "39.5%" -> 39.5. Sin signo de % la hoja trae la fraccion con formato de
// moneda ("$0.22" = 22%), asi que un valor <= 1 se escala.
const parsePercentCell = (value) => {
  const n = parseNumericCell(value);
  if (String(value ?? '').includes('%')) return n;
  return Math.abs(n) <= 1 ? n * 100 : n;
};

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
  // Proyectos y explicacion se ubican por encabezado: la tabla mensual de
  // noviembre 2026 metio "Previous Month KPI" en la F y los corrio a G/H.
  // Sin encabezado se cae a las posiciones historicas (F y G).
  let projectsCol = 5;
  let explanationCol = 6;
  const header = data[cursor];
  if (normalize(header?.[0]) === 'engineer') {
    const find = (label) => header.findIndex(cell => normalize(cell).includes(label));
    if (find('projects') !== -1) projectsCol = find('projects');
    if (find('explanation') !== -1) explanationCol = find('explanation');
    cursor++;
  }

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
      projects: String(row[projectsCol] ?? '').trim(),
      explanation: String(row[explanationCol] ?? '').trim(),
    });
  }

  // La hoja no trae columna de % en estas tablas (solo la tiene el bloque
  // acumulado "% of Total"), asi que se deriva aca: cuanto del Total KPI del
  // periodo puso cada uno. Se calcula sobre las filas de esta tabla, no sobre
  // el acumulado, para que cada periodo cierre en 100% por su cuenta.
  //
  // Ojo con leerlo como "% del monto facturado": son puntos KPI. El nesting
  // suma un 30% aparte del valor del proyecto y los multiplicadores (No Holes
  // 1.25x, Strip Lights, Multicolor) lo inflan mas, asi que la base de cada
  // periodo es mayor que la suma de los contratos.
  const periodTotal = rows.reduce((sum, row) => sum + row.totalKPI, 0);
  rows.forEach(row => {
    row.percentOfTotal = periodTotal > 0 ? (row.totalKPI / periodTotal) * 100 : 0;
  });

  return { title, rows, periodTotal };
}

// Tablas "WEEKLY KPI - NOVEMBER 2026 (CURRENT MONTH)" / "(PREVIOUS MONTH)":
// puntos de cada ingeniero semana por semana. Son la fuente de los graficos de
// Team Stats. Las columnas se ubican por encabezado ("Week N", "Month Total").
function parseWeeklyKpiTable(data, which) {
  const titlePattern = new RegExp(`^weekly\\s+kpi\\s*-\\s*(.+?)\\s*\\(${which}\\s+month\\)`, 'i');
  const titleIndex = data.findIndex(row => titlePattern.test(String(row?.[0] ?? '').trim()));
  if (titleIndex === -1) return null;

  const title = String(data[titleIndex][0]).trim();
  const month = title.match(titlePattern)[1]
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

  const header = data[titleIndex + 1] || [];
  const weekCols = [];
  let totalCol = -1;
  header.forEach((cell, i) => {
    const h = normalize(cell);
    if (/^week\s*\d+$/.test(h)) weekCols.push(i);
    else if (h === 'month total') totalCol = i;
  });
  if (weekCols.length === 0) return null;

  const rows = [];
  for (let i = titleIndex + 2; i < data.length; i++) {
    const row = data[i];
    if (isBlankRow(row)) break;
    const engineer = String(row[0] ?? '').trim();
    if (!engineer || normalize(engineer) === 'total') break;
    rows.push({
      engineer,
      weeks: weekCols.map(c => parseNumericCell(row[c])),
      monthTotal: totalCol !== -1 ? parseNumericCell(row[totalCol]) : 0,
    });
  }

  return {
    title,
    month,
    weeks: weekCols.map(c => String(header[c]).trim()),
    rows,
  };
}

/**
 * Igual que parseQualityCsv pero partiendo de filas ya parseadas, que es lo
 * que devuelve /api/sheet. El wrapper de CSV queda abajo porque los tests
 * (y cualquier pegado manual de un CSV) siguen entrando por ahi.
 */
export function parseQualityRows(data) {
  return {
    kpiData: parsePercentTable(data),
    weeklyCurrent: parseWeeklyKpiTable(data, 'current'),
    weeklyPrevious: parseWeeklyKpiTable(data, 'previous'),
    // "KPI (11/01 - 11/30)": la tabla del mes en curso que reemplazo a las
    // ventanas de 30/60/90/120 dias.
    currentMonth: parsePeriodTable(data, /^kpi\s*\(\s*\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\s*\)\s*$/i),
    last30Days: parsePeriodTable(data, /^kpi\s+last\s+30\s+days/i),
    days31to60: parsePeriodTable(data, /^kpi\s+31\s*-\s*60\s+days/i),
    days61to90: parsePeriodTable(data, /^kpi\s+61\s*-\s*90\s+days/i),
    days91to120: parsePeriodTable(data, /^kpi\s+91\s*-\s*120\s+days/i),
  };
}

export function parseQualityCsv(csvText) {
  const { data } = Papa.parse(csvText, { skipEmptyLines: false });
  return parseQualityRows(data);
}

export async function fetchAndParseQualityData() {
  try {
    return parseQualityRows(await fetchSheetRows('quality'));
  } catch (error) {
    console.error('Error parsing Quality sheet:', error);
    throw error;
  }
}

export async function fetchAndParseProjectMaterials() {
  try {
    const data = await fetchSheetRows('projectMaterials');
    
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
