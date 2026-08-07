// Commercial color name -> internal shop melamine/HPL code. Extend this as
// new colors show up in Quotes — see the design doc's "Corrección de
// errores" section for how a missing color gets reported and added.
export const COLOR_MAP = {
  'SNOW WHITE': 'White Classic 300',
  'BLEACHED LINEN': 'Linen Classic 210',
};

export const BORING_PATTERN_MM = 32;

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
