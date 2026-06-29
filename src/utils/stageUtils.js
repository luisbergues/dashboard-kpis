export const STAGES = [
  { id: 'ingenieria', label: 'Ingeniería' },
  { id: 'check1', label: 'Check' },
  { id: 'paperwork', label: 'Paperwork' },
  { id: 'check2', label: 'Check' },
  { id: 'nesting', label: 'Nesting' },
  { id: 'install', label: 'Install' }
];

export function calculateAutomaticStages(project) {
  const progress = Array(STAGES.length).fill(false);
  const statusHistory = project.statusHistory || [];
  const currentStatus = (project.status || '').toUpperCase().trim();
  
  const statusIndexMap = {
    'ENGINEERING': 0,
    'CHECK ENG.': 1,
    'PAPERWORK': 2,
    'CHECK': 3,
    'NESTING': 4,
    'INSTALL': 5,
    'COMPLETED': 5
  };
  
  // Track all statuses the project has been in and their earliest date
  const statusDates = {};
  
  statusHistory.forEach(h => {
    const s = (h.status || '').toUpperCase().trim();
    if (s && !statusDates[s] && h.statusDate) {
      statusDates[s] = new Date(h.statusDate).toISOString();
    }
  });
  
  // Also add current status if not already tracked (fallback to current date if missing)
  if (currentStatus && !statusDates[currentStatus]) {
    statusDates[currentStatus] = new Date().toISOString();
  }
  
  // Find the maximum index reached based on the status mapping
  let maxIndex = -1;
  const hitIndices = new Set();
  
  Object.keys(statusDates).forEach(status => {
    if (statusIndexMap[status] !== undefined) {
      hitIndices.add(statusIndexMap[status]);
      if (statusIndexMap[status] > maxIndex) {
        maxIndex = statusIndexMap[status];
      }
    }
  });
  
  // Mark all stages up to the maxIndex as completed
  // Use the specific date for the stage if available, otherwise inherit the max stage date or fallback
  for (let i = 0; i <= maxIndex; i++) {
    // Determine the status string for this index
    const statusForIndex = Object.keys(statusIndexMap).find(key => statusIndexMap[key] === i);
    const dateForStage = statusDates[statusForIndex] || new Date().toISOString();
    
    progress[i] = { completed: true, timestamp: dateForStage };
  }
  
  return progress;
}
