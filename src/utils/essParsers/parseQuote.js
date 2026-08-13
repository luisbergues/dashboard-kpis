// First-pass heuristics: an area header is a line that's entirely
// uppercase letters/spaces/'/&/- (e.g. "MASTER WIC"); an item line is
// "{description} - {productCode} - Qty: {n}". Expect to recalibrate
// against real Quote PDFs — see the design doc's "Corrección de errores".
import { COLOR_MAP } from '../essRules';

const AREA_HEADER_RE = /^[A-Z][A-Z '&-]{2,40}$/;
const ITEM_LINE_RE = /^(.+?)\s*-\s*([A-Z]{1,6}-\d{1,6})\s*-\s*Qty:\s*(\d+)\s*$/i;
const COLOR_LABEL_RE = /^(?:colou?r|finish|material)\s*[:-]\s*(.+)$/i;
const AREA_LABEL_RE = /^area\s*:\s*$/i;

// The project record built from the Google Sheet carries no color, so the
// Quote is the only document the commercial color can come from. A labelled
// line wins; failing that, a line that is itself a color we already know.
// Anything else is left null and warned about rather than guessed at.
function findColorLine(lines) {
  for (const line of lines) {
    const labelled = line.match(COLOR_LABEL_RE);
    if (labelled && labelled[1].trim()) return { color: labelled[1].trim(), line };
  }
  for (const line of lines) {
    if (COLOR_MAP[line.trim().toUpperCase()]) return { color: line.trim(), line };
  }
  return { color: null, line: null };
}

// El ambiente sale del renglón siguiente a una etiqueta 'Area:'. Es la única
// señal verificada contra los tres Quotes reales; AREA_HEADER_RE, que exige un
// renglón entero en mayúsculas, matchea MWIC y RIC por casualidad (son siglas)
// y falla con 'Garage'. El Summary trae 'Area' como encabezado de tabla, sin
// dos puntos, y por eso devuelve null — que es justo lo que lo distingue.
export function detectQuoteArea(text) {
  if (!text) return null;
  const lines = String(text).split('\n').map(l => l.trim()).filter(Boolean);
  const labelIndex = lines.findIndex(line => AREA_LABEL_RE.test(line));
  if (labelIndex === -1) return null;
  return lines[labelIndex + 1] ?? null;
}

export function parseQuoteText(text) {
  if (!text || text.trim().length === 0) {
    return { areas: [], warnings: ['EMPTY_TEXT'] };
  }

  const warnings = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const areas = [];
  let currentArea = null;
  const { color, line: colorLine } = findColorLine(lines);

  for (const line of lines) {
    // A bare color line ('BLEACHED LINEN') is shaped exactly like an area
    // header, and would otherwise open an area that never gets any items.
    if (colorLine && line === colorLine) continue;
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
  if (!color) warnings.push('COLOR_NOT_FOUND');
  return { areas, color, warnings };
}

export function looksLikeQuote(text) {
  return /Qty:/i.test(text) && /[A-Z]{1,6}-\d{1,6}/i.test(text);
}
