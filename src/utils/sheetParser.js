import Papa from 'papaparse';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1qENXOvlEEY70LQ4i4EQBA0rGpuDr9L1sQIPtEL-Rm1I/export?format=csv';

export async function fetchAndParseData() {
  try {
    const response = await fetch(CSV_URL);
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
      statusHistory: []
    };

    let currentSection = null;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      // Sometimes rows have leading empty columns, let's get the first non-empty cell as a heuristic, 
      // or join the row to find keywords
      const rowString = row.join('').trim();
      if (!rowString) continue;

      // Detect Section Headers
      if (rowString.includes('Priority Analysis (Action Required)')) {
        currentSection = 'priorityAnalysis';
        i++; // skip header row (SO#,NAME...) next line
        continue;
      } else if (rowString.includes('ON HOLD Projects - Detailed Notes')) {
        currentSection = 'onHoldNotes';
        i++; // skip header row
        continue;
      } else if (rowString.includes('Week over Week Comparison')) {
        currentSection = 'weekOverWeek';
        i++; // skip header row
        continue;
      } else if (rowString.includes('Weekly Review & Insights')) {
        currentSection = 'insights';
        continue;
      } else if (rowString.includes('Meeting Talking Points')) {
        currentSection = 'meetingPoints';
        continue;
      } else if (rowString.includes('Top Active Projects by Cost')) {
        currentSection = 'topCostProjects';
        i++; // skip header row
        continue;
      } else if (rowString.includes('Active Projects Material Requirements')) {
        currentSection = 'materialRequirements';
        i++; // skip header row
        continue;
      } else if (rowString.includes('Status History') && rowString.includes('SO#')) {
        currentSection = 'statusHistory';
        continue; // The header was this row, but wait, the title is usually above.
      }

      // Check if we hit a Status History title
      if (row.includes('Status History') && row.includes('SO#')) {
        currentSection = 'statusHistory';
        continue;
      }

      // If we are in a section, parse rows
      if (currentSection === 'priorityAnalysis') {
        if (rowString.includes('ON HOLD Projects') || rowString.includes('Week over Week')) {
            // we hit next section accidentally, though handled above
        } else if (row[1] && row[1] !== 'SO#') { // valid row
           parsedData.priorityAnalysis.push({
             so: row[1],
             name: row[2],
             install: row[3],
             eng: row[4],
             status: row[5]
           });
        }
      } 
      else if (currentSection === 'onHoldNotes') {
        if (row[1] && row[1] !== 'Designer & Email') {
          parsedData.onHoldNotes.push({
            designer: row[1],
            project: row[2],
            notes: row[3]
          });
        }
      }
      else if (currentSection === 'weekOverWeek') {
        if (row[1] && row[1] !== 'Metric') {
          parsedData.weekOverWeek.push({
            metric: row[1],
            previous: row[5],
            current: row[7],
            variance: row[9]
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
        if (row[1] && row[1].startsWith('-')) {
          parsedData.meetingPoints.push(row[1]);
        }
      }
      else if (currentSection === 'topCostProjects') {
        if (row[1] && row[1] !== 'Project Name') {
          // find cost in the row
          const cost = row.find(cell => cell.includes('$'));
          parsedData.topCostProjects.push({
            name: row[1],
            cost: cost || '0'
          });
        }
      }
      else if (currentSection === 'materialRequirements') {
        if (row[1] && row[1] !== 'SO#') {
          parsedData.materialRequirements.push({
            so: row[1],
            name: row[2],
            thermofoil: row[3],
            noHoles: row[4],
            dovetail: row[5],
            element: row[6],
            installDate: row[7]
          });
        }
      }
      else if (currentSection === 'statusHistory') {
        if (row[1] && row[1] !== 'SO#') {
          parsedData.statusHistory.push({
            so: row[1],
            name: row[2],
            status: row[3],
            statusDate: row[4],
            history: row[5]
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
