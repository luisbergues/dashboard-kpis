import Papa from 'papaparse';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/1qENXOvlEEY70LQ4i4EQBA0rGpuDr9L1sQIPtEL-Rm1I/export?format=csv';

async function main() {
  const cacheBuster = `&t=${new Date().getTime()}`;
  const response = await fetch(`${CSV_URL}${cacheBuster}`);
  if (!response.ok) throw new Error('Failed to fetch CSV data');
  const csvText = await response.text();

  const { data } = Papa.parse(csvText, { skipEmptyLines: false });
  let foundWow = false;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowString = row.join('').trim();
    if (rowString.includes('Week over Week Comparison')) {
      foundWow = true;
    }
    if (foundWow) {
      if (rowString === '' && i > 0 && data[i-1].join('').trim() === '') {
        // Stop printing if we see double empty rows after the section starts
        break;
      }
      console.log(row.filter(c => c !== '').join(' | '));
    }
  }
}

main().catch(console.error);
