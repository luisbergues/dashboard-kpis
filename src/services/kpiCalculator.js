/**
 * KPI Calculator Service (Clean Architecture)
 * Contains isolated mathematical formulas and business logic for JL Closets metrics.
 */

/**
 * Parses a currency string to a float number
 * @param {string|number} costStr - e.g. "$170,195.00" or 170195
 * @returns {number}
 */
export function parseCurrency(costStr) {
  if (costStr === undefined || costStr === null) return 0;
  if (typeof costStr === 'number') return costStr;
  const cleaned = costStr.replace(/[^0-9.-]+/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Calculates the Design-to-Order Conversion Rate
 * Formula: Completed Projects / (Total Active Projects + Completed Projects) * 100
 * @param {number} completedCount 
 * @param {number} activeCount 
 * @returns {number} Percentage (0-100), rounded to 1 decimal place
 */
export function calculateConversionRate(completedCount, activeCount) {
  const completed = Number(completedCount) || 0;
  const active = Number(activeCount) || 0;
  const total = completed + active;
  if (total === 0) return 0.0;
  return parseFloat(((completed / total) * 100).toFixed(1));
}

/**
 * Calculates the Budget Deviation (percentage of total value represented by ON HOLD projects)
 * Formula: On Hold Value / Total Value * 100
 * @param {string|number} onHoldValue 
 * @param {string|number} totalValue 
 * @returns {number} Percentage (0-100), rounded to 1 decimal place
 */
export function calculateBudgetDeviation(onHoldValue, totalValue) {
  const hold = parseCurrency(onHoldValue);
  const total = parseCurrency(totalValue);
  if (total === 0) return 0.0;
  return parseFloat(((hold / total) * 100).toFixed(1));
}

/**
 * Calculates the average validation time in hours for completed engineering checks
 * @param {Object} engineeringChecks - map of SO# -> { started, finished }
 * @returns {number} Average time in hours, rounded to 1 decimal place
 */
export function calculateAverageValidationTime(engineeringChecks) {
  if (!engineeringChecks || typeof engineeringChecks !== 'object') return 0.0;
  
  let totalHours = 0;
  let completedChecksCount = 0;

  Object.values(engineeringChecks).forEach(check => {
    if (check && check.started && check.finished) {
      const start = new Date(check.started);
      const finish = new Date(check.finished);
      
      if (!isNaN(start) && !isNaN(finish) && finish >= start) {
        const diffMs = finish.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours += diffHours;
        completedChecksCount++;
      }
    }
  });

  if (completedChecksCount === 0) return 0.0;
  return parseFloat((totalHours / completedChecksCount).toFixed(1));
}

/**
 * Extracts and groups CAD errors per designer from on-hold notes
 * Keywords scanned: CAD, measure, KCD, file, drawing, inconsistent, error, etc.
 * @param {Array} onHoldNotes - list of { designer, project, notes }
 * @returns {Object} { errorCounts: { designerName: number }, totalCADErrors: number }
 */
export function calculateCADErrors(onHoldNotes) {
  const result = {
    errorCounts: {},
    totalCADErrors: 0
  };

  if (!Array.isArray(onHoldNotes)) return result;

  const cadKeywords = [
    'cad', 'kcd', 'measure', 'file', 'drawing', 'inconsistent', 'error', 
    'medida', 'dibujo', 'plano', 'ajuste', 'archivo', 'falta'
  ];

  onHoldNotes.forEach(note => {
    if (!note || !note.notes) return;
    
    const notesLower = note.notes.toLowerCase();
    const isCADError = cadKeywords.some(keyword => notesLower.includes(keyword));

    if (isCADError) {
      // Extract designer name (clean up emails/newlines)
      let designer = 'Unassigned';
      if (note.designer) {
        designer = note.designer.split('\n')[0].split('<')[0].replace(/[^a-zA-Z\s]/g, '').trim();
        // default fallback if string cleaning makes it empty
        if (!designer) designer = note.designer.trim();
      }

      result.errorCounts[designer] = (result.errorCounts[designer] || 0) + 1;
      result.totalCADErrors++;
    }
  });

  return result;
}

/**
 * Predicts installation bottlenecks in the upcoming 7 days
 * @param {Array} projects - priorityAnalysis projects
 * @param {string} referenceDateStr - ISO date or date string to count from (default: now)
 * @returns {Array} List of bottleneck alerts { type, message, severity, date, projects: [] }
 */
export function predictBottlenecks(projects, referenceDateStr = '2026-06-11') {
  if (!Array.isArray(projects)) return [];

  const refDate = new Date(referenceDateStr);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const next7DaysEnd = new Date(refDate.getTime() + 7 * oneDayMs);

  const upcomingProjects = [];
  const workloadByDesigner = {};

  projects.forEach(p => {
    if (!p.install) return;
    const installDate = new Date(p.install);
    
    if (!isNaN(installDate)) {
      // 1. Tracks workload by designer for active pre-production projects
      if (p.eng && ['engineering', 'check', 'review'].includes(p.status?.toLowerCase())) {
        workloadByDesigner[p.eng] = (workloadByDesigner[p.eng] || 0) + 1;
      }

      // 2. Track installations in the next 7 days
      if (installDate >= refDate && installDate <= next7DaysEnd) {
        upcomingProjects.push(p);
      }
    }
  });

  const alerts = [];

  // Capacity Warning: Single installation date with > 2 projects
  const installsByDate = {};
  upcomingProjects.forEach(p => {
    installsByDate[p.install] = installsByDate[p.install] || [];
    installsByDate[p.install].push(p);
  });

  Object.entries(installsByDate).forEach(([date, projs]) => {
    if (projs.length > 2) {
      alerts.push({
        type: 'capacity_bottleneck',
        date,
        severity: 'high',
        message: `High installation load on ${date}: ${projs.length} projects scheduled.`,
        projects: projs.map(p => `#${p.so} ${p.name.split(':')[0]}`)
      });
    }
  });

  // Stage Warning: Projects scheduled for install in 7 days but still in pre-production
  upcomingProjects.forEach(p => {
    const status = p.status?.toLowerCase() || '';
    if (['engineering', 'check', 'review', 'on hold'].includes(status)) {
      const isCritical = status === 'on hold';
      alerts.push({
        type: 'delayed_installation_risk',
        date: p.install,
        severity: isCritical ? 'critical' : 'high',
        message: `Project #${p.so} (${p.name.split(':')[0]}) is scheduled for installation on ${p.install} but is currently ${p.status.toUpperCase()}.`,
        projects: [`#${p.so} ${p.name.split(':')[0]}`]
      });
    }
  });

  // Designer Workload Overload Warning
  Object.entries(workloadByDesigner).forEach(([designer, count]) => {
    if (count > 3) {
      alerts.push({
        type: 'designer_overload',
        designer,
        severity: 'medium',
        message: `Designer ${designer} has a high workload: ${count} active projects in pre-production.`,
        projects: []
      });
    }
  });

  return alerts;
}

/**
 * Calculates the number of projects currently ON HOLD that have been on hold for more than 3 days
 * @param {Array} projects - priorityAnalysis list
 * @param {Object} projectHistory - map of SO# -> list of history events
 * @param {string} currentDateStr - current reference date
 * @returns {number}
 */
export function getDelayedProjectsCount(projects, projectHistory = {}, currentDateStr = '2026-06-11T00:00:00.000Z') {
  if (!Array.isArray(projects)) return 0;
  
  const currentDate = new Date(currentDateStr);
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  let delayedCount = 0;

  projects.forEach(p => {
    if (p.status?.toUpperCase() === 'ON HOLD') {
      const history = projectHistory[p.so] || [];
      // Find the latest status change to ON HOLD
      const holdEvents = history.filter(h => h.type === 'status_change' && h.status === 'ON HOLD');
      
      if (holdEvents.length > 0) {
        // Sort by timestamp descending
        holdEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const holdDate = new Date(holdEvents[0].timestamp);
        
        if (!isNaN(holdDate)) {
          const elapsed = currentDate.getTime() - holdDate.getTime();
          if (elapsed > threeDaysMs) {
            delayedCount++;
          }
        }
      } else {
        // Fallback: If no history, see if the install date is past or within 3 days.
        // If so, we assume it has been delayed.
        if (p.install) {
          const installDate = new Date(p.install);
          if (!isNaN(installDate) && installDate.getTime() - currentDate.getTime() < threeDaysMs) {
            delayedCount++;
          }
        }
      }
    }
  });

  return delayedCount;
}

/**
 * Deterministically retrieves a project's location
 * @param {Object} project 
 * @returns {string} Miami, Boca Raton, or Naples
 */
export function getProjectLocation(project) {
  if (!project) return 'Boca Raton';
  const nameLower = (project.name || '').toLowerCase();
  
  if (nameLower.includes('miami')) return 'Miami';
  if (nameLower.includes('boca') || nameLower.includes('raton')) return 'Boca Raton';
  if (nameLower.includes('naples')) return 'Naples';
  
  // Stable hash based on SO#
  const soNum = parseInt(project.so, 10) || 0;
  const locations = ['Miami', 'Boca Raton', 'Naples'];
  return locations[soNum % locations.length];
}

