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

           if (row[soIdx] && row[soIdx].toUpperCase() !== 'SO#') {
             parsedData.priorityAnalysis.push({
               so: row[soIdx],
               name: row[nameIdx],
               install: row[installIdx],
               eng: row[engIdx],
               status: row[statusIdx]
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

    return parsedData;

  } catch (error) {
    console.error('Error parsing sheet:', error);
    throw error;
  }
}

export async function fetchAndParseQualityData() {
  try {
    const cacheBuster = `&t=${new Date().getTime()}`;
    const response = await fetch(`${QUALITY_CSV_URL}${cacheBuster}`);
    if (!response.ok) throw new Error('Failed to fetch Quality CSV data');
    const csvText = await response.text();

    const { data } = Papa.parse(csvText, { skipEmptyLines: false });

    const result = {
      kpiData: [],
      analysisText: ''
    };

    let readingTable = false;
    let readingAnalysis = false;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowString = row.join('').trim();
      if (!rowString) continue;

      // Detect start of Engineer Table
      if (rowString.toLowerCase().includes('engineer') && rowString.toLowerCase().includes('own points')) {
        readingTable = true;
        readingAnalysis = false;
        continue;
      }

      // Detect KPI Distribution Analysis section
      if (rowString.toLowerCase().includes('kpi distribution analysis')) {
        readingTable = false;
        readingAnalysis = true;
        continue;
      }

      if (readingTable) {
        // If we hit the total row (SO.TEAM or similar), or empty rows, or another header
        if (row[0].toLowerCase().includes('team') || row[0].toLowerCase().includes('total') || row[0] === '') {
          readingTable = false;
          continue;
        }

        const engineer = row[0]?.trim();
        const ownPoints = parseFloat(row[1]?.replace(/[^0-9.-]+/g, "")) || 0;
        const revisionPoints = parseFloat(row[2]?.replace(/[^0-9.-]+/g, "")) || 0;
        const nestingPoints = parseFloat(row[3]?.replace(/[^0-9.-]+/g, "")) || 0;
        const totalKPI = parseFloat(row[4]?.replace(/[^0-9.-]+/g, "")) || 0;
        // Parse % of total which is likely in column index 5 (6th col) or we look at the second table.
        // We can get it from the secondary table or directly if it's there
        const percent = parseFloat(row[5]?.replace(/[^0-9.-]+/g, "")) || 0;

        // Validate that engineer is a real name (only letters and spaces, not a number, and not empty)
        const isNumeric = /^\d+$/.test(engineer.replace(/[\s,$.%]+/g, ''));
        const isHeaderOrTotal = [
          'engineer', 'so.team', 'team', 'total', 'grand total', 
          'reviewer', 'multiplier', 'column', '•'
        ].some(kw => engineer.toLowerCase().includes(kw));
        
        // Also reject names that start with a numbering like "3. " or "4. "
        const isNumbering = /^\d+\.\s*/.test(engineer);

        if (engineer && !isNumeric && !isHeaderOrTotal && !isNumbering && engineer.length > 1) {
          result.kpiData.push({
            engineer,
            ownPoints,
            revisionPoints,
            nestingPoints,
            totalKPI,
            percent: percent || 0
          });
        }
      } else if (readingAnalysis) {
        // Find the paragraph text (Analysis corresponding to...)
        // Typically it is a long text in one of the cells
        const fullRowText = row.join(' ').trim();
        if (fullRowText.toLowerCase().includes('analysis corresponding to')) {
          result.analysisText = fullRowText;
          readingAnalysis = false; // We got the main text, stop reading analysis text
        }
      }
    }

    // Secondary table lookup for percentages if they were not in the first table
    // Sometimes in the sheet they are placed elsewhere. Let's make sure each engineer has a percentage.
    if (result.kpiData.length > 0) {
      let readingPercentTable = false;
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowString = row.join('').trim();
        
        if (rowString.toLowerCase().includes('engineer') && rowString.toLowerCase().includes('% of total')) {
          readingPercentTable = true;
          continue;
        }

        if (readingPercentTable) {
          if (!row[0] || row[0].toLowerCase().includes('total') || row[0] === '') {
            readingPercentTable = false;
            continue;
          }
          const engName = row[0].trim();
          const pct = parseFloat(row[1]?.replace(/[^0-9.-]+/g, "")) || 0;

          const existing = result.kpiData.find(e => e.engineer.toLowerCase() === engName.toLowerCase());
          if (existing) {
            existing.percent = pct;
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing Quality sheet:', error);
    throw error;
  }
}

