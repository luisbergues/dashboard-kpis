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
 * Extracts and groups File Requests per designer from on-hold notes
 * Calculates percentage based on their total active projects.
 * Keywords scanned: CAD, measure, KCD, file, drawing, inconsistent, error, etc.
 * @param {Array} onHoldNotes - list of { designer, project, notes }
 * @param {Array} projects - priorityAnalysis list to count total active projects
 * @returns {Object} { designerStats: { designerName: { requests, total, percentage } }, totalRequests }
 */
export function calculateFileRequestsPercentage(onHoldNotes, projects = []) {
  const result = {
    designerStats: {},
    totalRequests: 0
  };

  if (!Array.isArray(onHoldNotes)) return result;

  // First, count total active projects per designer
  projects.forEach(p => {
    if (!p.eng) return;
    let designer = p.eng.trim();
    if (!result.designerStats[designer]) {
      result.designerStats[designer] = { requests: 0, total: 0, percentage: 0 };
    }
    result.designerStats[designer].total += 1;
  });

  const cadKeywords = [
    'cad', 'kcd', 'measure', 'file', 'drawing', 'inconsistent', 'error', 
    'medida', 'dibujo', 'plano', 'ajuste', 'archivo', 'falta'
  ];

  onHoldNotes.forEach(note => {
    if (!note || !note.notes) return;
    
    const notesLower = note.notes.toLowerCase();
    const isFileRequest = cadKeywords.some(keyword => notesLower.includes(keyword));

    if (isFileRequest) {
      let designer = 'Unassigned';
      if (note.designer) {
        designer = note.designer.split('\n')[0].split('<')[0].replace(/[^a-zA-Z\s]/g, '').trim();
        if (!designer) designer = note.designer.trim();
      }

      // Try to map to existing designer if names slightly mismatch (simple fallback)
      let matchedDesigner = Object.keys(result.designerStats).find(d => d.toLowerCase() === designer.toLowerCase()) || designer;

      if (!result.designerStats[matchedDesigner]) {
        result.designerStats[matchedDesigner] = { requests: 0, total: 0, percentage: 0 };
      }

      result.designerStats[matchedDesigner].requests += 1;
      result.totalRequests += 1;
    }
  });

  // Calculate percentages
  Object.values(result.designerStats).forEach(stats => {
    if (stats.total > 0) {
      stats.percentage = parseFloat(((stats.requests / stats.total) * 100).toFixed(1));
    } else {
      stats.percentage = stats.requests > 0 ? 100 : 0; // If they have requests but no active projects
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
export function predictBottlenecks(projects, referenceDateStr = new Date().toISOString()) {
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
export function getDelayedProjectsCount(projects, projectHistory = {}, currentDateStr = new Date().toISOString()) {
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

/**
 * Calculates weighted average time per stage based on project price
 * @param {Object} projectStages - map of SO# -> stage array [{completed, timestamp}]
 * @param {Array} projects - priorityAnalysis
 * @param {Object} projectHistory - map of SO# -> list of history events
 * @returns {Array} List of { stageLabel, averageHours, isExternal }
 */
export function calculatePersonalStageAverages(projectStages, projects, projectHistory, engineeringChecks = {}, statusHistory = []) {
  const STAGES_CONFIG = [
    { id: 'check1',   label: 'Engineering Check', isExternal: true },
    { id: 'paperwork',label: 'Paperwork',         isExternal: false },
    { id: 'check2',   label: 'Paperwork Check',   isExternal: true },
    { id: 'nesting',  label: 'Nesting',           isExternal: false },
    { id: 'install',  label: 'Install',           isExternal: true }
  ];

  const stageTotals = STAGES_CONFIG.map(s => ({ ...s, totalWeightedHours: 0, totalWeight: 0 }));

  projects.forEach(p => {
    const price = parseCurrency(p.totalAmt) || 1; // fallback weight of 1 if no price
    
    const durations = {
      ingenieria: 0,
      check1: 0,
      paperwork: 0,
      check2: 0,
      nesting: 0,
      install: 0
    };

    // Engineering Check → mapped to Check 1
    const engCheck = engineeringChecks[p.so];
    if (engCheck && engCheck.started && engCheck.finished) {
      const eStart = new Date(engCheck.started);
      const eEnd = new Date(engCheck.finished);
      if (!isNaN(eStart) && !isNaN(eEnd) && eEnd >= eStart) {
        durations['check1'] = (eEnd - eStart) / (1000 * 60 * 60);
      }
    }

    const stages = projectStages && projectStages[p.so];
    if (stages) {
      const getStageDuration = (idx1, idx2) => {
        if (stages[idx1]?.completed && stages[idx1]?.timestamp && stages[idx2]?.completed && stages[idx2]?.timestamp) {
           const t1 = new Date(stages[idx1].timestamp);
           const t2 = new Date(stages[idx2].timestamp);
           if (!isNaN(t1) && !isNaN(t2) && t2 >= t1) {
             return (t2 - t1) / (1000 * 60 * 60);
           }
        }
        return 0;
      };

      // Paperwork: between Engineering (stage[0]) and Paperwork completed (stage[2])
      durations['paperwork'] = getStageDuration(0, 2);

      // Check 2 (Paperwork Check): between Paperwork completed (stage[2]) and Check 2 completed (stage[3])
      durations['check2'] = getStageDuration(2, 3);

      // Nesting: between Check 2 completed (stage[3]) and Nesting completed (stage[4])
      durations['nesting'] = getStageDuration(3, 4);
    }

      // Assign weighted hours for existing stages (now without ingenieria)
      STAGES_CONFIG.forEach((stage, i) => {
        const hours = durations[stage.id];
        if (hours > 0 && hours < 5000) { // Filter out invalid/massive durations
          stageTotals[i].totalWeightedHours += (hours * price);
          stageTotals[i].totalWeight += price;
        }
      });
  });

  return stageTotals.map(s => ({
    label: s.label,
    isExternal: s.isExternal,
    averageHours: s.totalWeight > 0 ? parseFloat((s.totalWeightedHours / s.totalWeight).toFixed(1)) : 0
  }));
}

/**
 * Groups completed projects by month for Check 2 and Nesting
 * @param {Object} projectStages - map of SO# -> stage array
 * @returns {Object} { labels: ['Jan', ...], datasets: [{label: 'Check 2', data: []}, {label: 'Nesting', data: []}] }
 */
export function calculateMonthlyCompletions(projectStages, myProjects = []) {
  const monthsData = {};

  const myProjectSos = new Set(myProjects.map(p => p.so));

  Object.entries(projectStages).forEach(([so, stages]) => {
    // Only count projects belonging to this engineer
    if (!myProjectSos.has(so)) return;

    // Helper to process a stage and increment its monthly count
    const processStage = (stageObj, stageKey) => {
      if (stageObj && stageObj.completed && stageObj.timestamp) {
        const d = new Date(stageObj.timestamp);
        if (!isNaN(d)) {
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthsData[monthKey]) {
            monthsData[monthKey] = { eng: 0, nesting: 0, complete: 0 };
          }
          if (monthsData[monthKey][stageKey] !== undefined) {
            monthsData[monthKey][stageKey]++;
          }
        }
      }
    };

    // Index 0 is Engineering
    processStage(stages[0], 'eng');

    // Index 4 is Nesting
    processStage(stages[4], 'nesting');

    // Index 5 is Install (Complete)
    processStage(stages[5], 'complete');
  });

  const sortedKeys = Object.keys(monthsData).sort();
  const labels = sortedKeys.map(k => {
    const [y, m] = k.split('-');
    const date = new Date(y, parseInt(m) - 1, 1);
    return date.toLocaleString('default', { month: 'short' });
  });

  const engData = sortedKeys.map(k => monthsData[k].eng);
  const nestingData = sortedKeys.map(k => monthsData[k].nesting);
  const completeData = sortedKeys.map(k => monthsData[k].complete);

  return {
    labels,
    datasets: [
      {
        label: 'Engineering Completed',
        data: engData,
        borderColor: '#09D1C7',
        backgroundColor: 'rgba(9, 209, 199, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Nesting Completed',
        data: nestingData,
        borderColor: '#FF2E93',
        backgroundColor: 'rgba(255, 46, 147, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Fully Completed',
        data: completeData,
        borderColor: '#80EE98',
        backgroundColor: 'rgba(128, 238, 152, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
}

// ISO week key (e.g. "2026-W28") so grouping is stable regardless of which
// day of the week a stage happened to be completed on.
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { key: `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`, weekStart: d };
}

/**
 * Same shape and stage semantics as calculateMonthlyCompletions, but grouped
 * by ISO week instead of calendar month — used for the "recent weekly trend"
 * view where month-level granularity is too coarse.
 * @param {Object} projectStages
 * @param {Array} myProjects
 * @param {number} weekCount - how many of the most recent weeks (with data) to keep
 */
export function calculateWeeklyCompletions(projectStages, myProjects = [], weekCount = 8) {
  const weeksData = {};

  const myProjectSos = new Set(myProjects.map(p => p.so));

  Object.entries(projectStages).forEach(([so, stages]) => {
    if (!myProjectSos.has(so)) return;

    const processStage = (stageObj, stageKey) => {
      if (stageObj && stageObj.completed && stageObj.timestamp) {
        const d = new Date(stageObj.timestamp);
        if (!isNaN(d)) {
          const { key: weekKey, weekStart } = isoWeekKey(d);
          if (!weeksData[weekKey]) {
            weeksData[weekKey] = { eng: 0, nesting: 0, complete: 0, weekStart };
          }
          if (weeksData[weekKey][stageKey] !== undefined) {
            weeksData[weekKey][stageKey]++;
          }
        }
      }
    };

    processStage(stages[0], 'eng');
    processStage(stages[4], 'nesting');
    processStage(stages[5], 'complete');
  });

  const sortedKeys = Object.keys(weeksData).sort().slice(-weekCount);
  const labels = sortedKeys.map(k => {
    const { weekStart } = weeksData[k];
    return weekStart.toLocaleString('default', { month: 'short', day: 'numeric' });
  });

  const engData = sortedKeys.map(k => weeksData[k].eng);
  const nestingData = sortedKeys.map(k => weeksData[k].nesting);
  const completeData = sortedKeys.map(k => weeksData[k].complete);

  return {
    labels,
    datasets: [
      {
        label: 'Engineering Completed',
        data: engData,
        borderColor: '#09D1C7',
        backgroundColor: 'rgba(9, 209, 199, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Nesting Completed',
        data: nestingData,
        borderColor: '#FF2E93',
        backgroundColor: 'rgba(255, 46, 147, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Fully Completed',
        data: completeData,
        borderColor: '#80EE98',
        backgroundColor: 'rgba(128, 238, 152, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };
}

/**
 * Gets upcoming critical deadlines for an engineer
 * @param {Array} projects 
 * @returns {Array} List of projects with upcoming install dates (<= 14 days)
 */
export function getUpcomingDeadlines(projects) {
  const today = new Date();
  const warningWindow = 14 * 24 * 60 * 60 * 1000;

  const deadlines = [];
  projects.forEach(p => {
    if (p.install) {
      const instDate = new Date(p.install);
      if (!isNaN(instDate) && instDate >= today) {
        const diff = instDate.getTime() - today.getTime();
        if (diff <= warningWindow) {
          const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
          deadlines.push({
            so: p.so,
            name: p.name,
            daysLeft,
            date: p.install
          });
        }
      }
    }
  });

  return deadlines.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Calculates total time spent ON HOLD per designer, separating "finals" into a general bucket.
 * @param {Object} projectHistory - map of SO# -> list of history events
 * @param {Array} projects - priorityAnalysis list to map SO# to designer
 * @param {Array} onHoldNotes - current on hold notes from sheet (for current active holds without history reason)
 * @returns {Object} { labels: [], data: [], finalsTimeDays: number }
 */
export function calculateOnHoldTimeByDesigner(projectHistory, projects = [], onHoldNotes = []) {
  const designerTime = {};
  let finalsTimeMs = 0;

  // Map SO# to Designer
  const projectToDesigner = {};
  projects.forEach(p => {
    projectToDesigner[p.so] = p.eng ? p.eng.trim() : 'Unassigned';
  });

  // Helper to check if reason is 'finals'
  const isFinals = (reason) => {
    if (!reason) return false;
    const lower = reason.toLowerCase();
    return lower.includes('final') || lower.includes('finals');
  };

  // Helper to get current sheet note
  const getSheetNote = (so, name) => {
    const note = onHoldNotes.find(n => n.project.includes(so) || name.includes(n.project));
    return note ? note.notes : '';
  };

  const now = new Date().getTime();

  projects.forEach(p => {
    const designer = projectToDesigner[p.so];
    const history = projectHistory[p.so] || [];
    let activeHold = null;

    history.forEach(event => {
      if (event.type === 'status_change') {
        if (event.status === 'ON HOLD') {
          activeHold = {
            start: new Date(event.timestamp).getTime(),
            reason: event.reason || ''
          };
        } else if (activeHold && event.status === 'ACTIVE') {
          const end = new Date(event.timestamp).getTime();
          const duration = end - activeHold.start;
          if (duration > 0) {
            if (isFinals(activeHold.reason)) {
              finalsTimeMs += duration;
            } else {
              designerTime[designer] = (designerTime[designer] || 0) + duration;
            }
          }
          activeHold = null;
        }
      }
    });

    // If currently on hold
    if (activeHold) {
      const duration = now - activeHold.start;
      if (duration > 0) {
        // Try history reason first, fallback to sheet note
        const reason = activeHold.reason || getSheetNote(p.so, p.name);
        if (isFinals(reason)) {
          finalsTimeMs += duration;
        } else {
          designerTime[designer] = (designerTime[designer] || 0) + duration;
        }
      }
    } else if (p.status?.toUpperCase() === 'ON HOLD' && history.length === 0) {
      // If the project is on hold in the sheet but has no history, we can't reliably know when it started.
      // But we could guess it started when install date was missed, or just ignore since we lack start time.
    }
  });

  // Convert MS to Days
  const msToDays = (ms) => parseFloat((ms / (1000 * 60 * 60 * 24)).toFixed(1));

  const sortedDesigners = Object.keys(designerTime).sort((a, b) => designerTime[b] - designerTime[a]);
  const labels = sortedDesigners;
  const data = sortedDesigners.map(d => msToDays(designerTime[d]));

  return {
    labels,
    data,
    finalsTimeDays: msToDays(finalsTimeMs)
  };
}

/**
 * Calculates global validation time: average time between Paperwork completed (entering Check 2)
 * and Check 2 completed (entering Nesting).
 * @param {Object} projectStages - map of SO# -> stage array
 * @param {Array} projects - array of all active/recent projects
 * @returns {number} Average time in hours, rounded to 1 decimal place
 */
export function calculateGlobalValidationTime(projectStages, projects = []) {
  if (!projectStages || Object.keys(projectStages).length === 0) return 0.0;
  
  let totalHours = 0;
  let count = 0;

  projects.forEach(p => {
    const stages = projectStages[p.so];
    if (!stages) return;

    // Stage 2 is Paperwork (when completed, it enters Check 2)
    // Stage 3 is Check 2 (when completed, it enters Nesting)
    const paperwork = stages[2];
    const check2 = stages[3];

    if (paperwork?.completed && paperwork?.timestamp && check2?.completed && check2?.timestamp) {
      const start = new Date(paperwork.timestamp);
      const end = new Date(check2.timestamp);

      if (!isNaN(start) && !isNaN(end) && end >= start) {
        const diffHours = (end - start) / (1000 * 60 * 60);
        if (diffHours > 0 && diffHours < 1000) { // arbitrary sanity check to avoid negative/massive values
          totalHours += diffHours;
          count++;
        }
      }
    }
  });

  if (count === 0) return 0.0;
  return parseFloat((totalHours / count).toFixed(1));
}

