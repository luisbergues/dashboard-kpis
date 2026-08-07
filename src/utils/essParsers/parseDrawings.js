// This is the least certain parser in the pipeline: it has to tell an
// opening width apart from a drawer width or a height callout using only
// their position relative to a label on the drawing page. This first pass
// assumes a label word (OPENING/HEIGHT/DEPTH) sits near the number it
// describes, within MAX_LABEL_DISTANCE points. Expect to recalibrate
// against real Drawings PDFs — see the design doc's "Corrección de
// errores" section. Numbers with no nearby label are surfaced as
// `unclassified` instead of guessed, so the UI can flag them for review.
const NUMBER_RE = /^(\d+(?:\.\d+)?)"?$/;
const AREA_NAME_RE = /^[A-Z][A-Z ]{2,40}$/;
const LABEL_KEYWORDS = [
  { type: 'opening', re: /OPENING/i },
  { type: 'height', re: /HEIGHT/i },
  { type: 'depth', re: /DEPTH/i },
];
const MAX_LABEL_DISTANCE = 60;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isLabelKeyword(text) {
  return LABEL_KEYWORDS.some(k => k.re.test(text));
}

function classifyLabels(items) {
  return items
    .map(item => {
      const match = LABEL_KEYWORDS.find(k => k.re.test(item.text));
      return match ? { ...item, labelType: match.type } : null;
    })
    .filter(Boolean);
}

function findAreaName(items) {
  const candidates = items
    .filter(item => AREA_NAME_RE.test(item.text.trim()) && !isLabelKeyword(item.text))
    .sort((a, b) => b.y - a.y);
  return candidates.length > 0 ? candidates[0].text.trim() : null;
}

function nearestUnclaimed(numbers, claimed, target) {
  return numbers
    .filter(n => !claimed.has(n))
    .map(n => ({ n, d: distance(n, target) }))
    .filter(x => x.d <= MAX_LABEL_DISTANCE)
    .sort((a, b) => a.d - b.d)[0];
}

export function parseDrawingPages(pages) {
  if (!pages || pages.length === 0 || pages.every(p => p.items.length === 0)) {
    return { areas: [], warnings: ['EMPTY_TEXT'] };
  }

  const warnings = [];
  const areas = pages.map(page => {
    const areaName = findAreaName(page.items) || `Page ${page.pageNumber}`;
    const labels = classifyLabels(page.items);
    const numbers = page.items.filter(item => NUMBER_RE.test(item.text.trim()));
    const claimed = new Set();
    // HEIGHT/DEPTH labels are consumed one-per-opening, same as the numbers
    // are: two openings sitting within MAX_LABEL_DISTANCE of the same HEIGHT
    // label would otherwise both bind to it and silently take the same
    // dimension.
    const claimedLabels = new Set();

    const openings = labels
      .filter(l => l.labelType === 'opening')
      .map(openingLabel => {
        const opening = { width: null, height: null, depth: null };
        ['opening', 'height', 'depth'].forEach(type => {
          const labelForType = type === 'opening'
            ? openingLabel
            : labels.find(l => l.labelType === type && !claimedLabels.has(l) && distance(l, openingLabel) <= MAX_LABEL_DISTANCE);
          if (!labelForType) return;
          const nearest = nearestUnclaimed(numbers, claimed, labelForType);
          if (!nearest) return;
          claimed.add(nearest.n);
          claimedLabels.add(labelForType);
          const value = parseFloat(nearest.n.text);
          if (type === 'opening') opening.width = value;
          if (type === 'height') opening.height = value;
          if (type === 'depth') opening.depth = value;
        });
        return opening;
      });

    const unclassified = numbers.filter(n => !claimed.has(n)).map(n => n.text);
    if (unclassified.length > 0) {
      warnings.push(`UNCLASSIFIED_NUMBERS_${areaName}: ${unclassified.join(', ')}`);
    }

    return { name: areaName, openings, unclassified };
  });

  if (areas.every(a => a.openings.length === 0)) warnings.push('NO_OPENINGS_FOUND');
  return { areas, warnings };
}

// Light, non-blocking sanity check so the UI can warn "this doesn't look
// like a Drawings file" if it's uploaded into the wrong slot.
export function looksLikeDrawing(pages) {
  return pages.some(page => classifyLabels(page.items).length > 0);
}
