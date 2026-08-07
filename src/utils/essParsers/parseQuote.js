// First-pass heuristics: an area header is a line that's entirely
// uppercase letters/spaces/'/&/- (e.g. "MASTER WIC"); an item line is
// "{description} - {productCode} - Qty: {n}". Expect to recalibrate
// against real Quote PDFs — see the design doc's "Corrección de errores".
const AREA_HEADER_RE = /^[A-Z][A-Z '&-]{2,40}$/;
const ITEM_LINE_RE = /^(.+?)\s*-\s*([A-Z]{1,6}-\d{1,6})\s*-\s*Qty:\s*(\d+)\s*$/i;

export function parseQuoteText(text) {
  if (!text || text.trim().length === 0) {
    return { areas: [], warnings: ['EMPTY_TEXT'] };
  }

  const warnings = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const areas = [];
  let currentArea = null;

  for (const line of lines) {
    const itemMatch = line.match(ITEM_LINE_RE);
    if (itemMatch) {
      if (!currentArea) {
        warnings.push(`ITEM_WITHOUT_AREA: ${line}`);
        continue;
      }
      currentArea.items.push({
        description: itemMatch[1].trim(),
        productCode: itemMatch[2].toUpperCase(),
        qty: parseInt(itemMatch[3], 10),
      });
      continue;
    }
    if (AREA_HEADER_RE.test(line)) {
      currentArea = { name: line, items: [] };
      areas.push(currentArea);
    }
  }

  if (areas.length === 0) warnings.push('NO_AREAS_FOUND');
  return { areas, warnings };
}

export function looksLikeQuote(text) {
  return /Qty:/i.test(text) && /[A-Z]{1,6}-\d{1,6}/i.test(text);
}
