// Commercial color name -> internal shop melamine/HPL code. Extend this as
// new colors show up in Quotes — see the design doc's "Corrección de
// errores" section for how a missing color gets reported and added.
export const COLOR_MAP = {
  'SNOW WHITE': 'White Classic 300',
  'BLEACHED LINEN': 'Linen Classic 210',
};

export const BORING_PATTERN_MM = 32;

// Box type and front type come from the materials matrix, never from the
// PDFs. Both the hand-entered ESS modal and the auto-generator read them
// through here so the same project can't come out DOVETAIL one way and PRFV
// the other.
export function essOptionsFromMaterials(materials) {
  return {
    boxType: materials?.dovetail === 'Yes' ? 'DOVETAIL' : 'PRFV',
    fronts: materials?.thermofoil === 'Yes' ? 'THERMOFOIL' : 'SLAB',
  };
}

export function translateColor(commercialName) {
  if (!commercialName) return null;
  const key = commercialName.trim().toUpperCase();
  return COLOR_MAP[key] || null;
}

// All cutting formulas round to the nearest 1/8" — this shop's normal
// cutting tolerance — and take/return inches as decimal numbers.
function roundToEighth(value) {
  return Math.round(value * 8) / 8;
}

export function calcPrfvWidth(openingInches) {
  return roundToEighth(openingInches - 1);
}

export function calcDovetailWidth(openingInches) {
  return roundToEighth(openingInches - 0.375);
}

export function calcHangRodLength(vanoInches) {
  return roundToEighth(vanoInches - 0.25);
}

export function calcBackingDepth(depthInches) {
  return roundToEighth(depthInches - 0.75);
}

// Dimensions in this shop are always written as whole inches plus a fraction
// ('23 5/8"'), never as a decimal — DEFAULT_DRAWERS/DEFAULT_RODS in
// PDFGeneratorModal.jsx is the hand-entry precedent a generated draft has to
// match. Everything between the PDF and the printed sheet works in decimal
// inches; these two functions are the only boundary where that shows.
export function parseInchValue(text) {
  if (text == null) return null;
  const cleaned = String(text).trim().replace(/["″]\s*$/, '').trim();
  if (!cleaned) return null;

  const mixed = cleaned.match(/^(\d+)\s*[-\s]\s*(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  const fraction = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  if (/^\d+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned);

  return null;
}

function greatestCommonDivisor(a, b) {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

export function formatInches(value) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const eighths = Math.round(Number(value) * 8);
  const whole = Math.floor(eighths / 8);
  const remainder = eighths % 8;
  if (remainder === 0) return `${whole}"`;
  const divisor = greatestCommonDivisor(remainder, 8);
  const fraction = `${remainder / divisor}/${8 / divisor}`;
  return whole === 0 ? `${fraction}"` : `${whole} ${fraction}"`;
}
