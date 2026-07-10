// Excel/Sheets treat a leading =, +, -, or @ as a formula when a CSV is
// opened. Prefix with an apostrophe to force literal text and block
// formula injection from project/note data that may originate externally.
const sanitizeCell = (str) => (/^[=+\-@]/.test(str) ? `'${str}` : str);

export function exportToCSV(data, filename = 'export.csv') {
  if (!data || !data.length) return;

  const keys = Object.keys(data[0]);
  const csvContent = [
    keys.join(','),
    ...data.map(row => keys.map(k => {
      let val = row[k];
      if (val === null || val === undefined) {
        return '';
      }
      if (typeof val === 'string') {
        // escape quotes and wrap in quotes
        val = `"${sanitizeCell(val).replace(/"/g, '""')}"`;
      } else if (typeof val === 'object') {
        // Just serialize to JSON if it's an object/array inside a column
        val = `"${sanitizeCell(JSON.stringify(val)).replace(/"/g, '""')}"`;
      }
      return val;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
