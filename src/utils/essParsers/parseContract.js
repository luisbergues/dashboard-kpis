// First-pass heuristics based on the field descriptions given for this
// project's Contracts. Expect to recalibrate these regexes against real
// Contract PDFs — see the design doc's "Corrección de errores" section.
// El depósito no viene pegado a la palabra: el Summary real dice 'Deposit of
// 50% required to Secure price', y los Contracts suelen usar puntos de relleno
// ('Deposit Required ..... 50%'). Se permite cualquier relleno corto entre la
// palabra y el porcentaje, pero no un salto de renglón, para no cruzar de una
// cláusula a otra y tomar un porcentaje ajeno.
const DEPOSIT_RE = /DEPOSIT[^\n%]{0,40}?(\d{1,3})\s*%/i;
const TEAROUT_RE = /TEAROUT[^\n]{0,40}?(INCLUDED|YES|NOT INCLUDED|NO)/i;
const BASEBOARDS_RE = /BASEBOARDS?[^\n]{0,40}?(INCLUDED|YES|NOT INCLUDED|NO)/i;

function toBoolean(matchWord) {
  if (!matchWord) return null;
  return /^(INCLUDED|YES)$/i.test(matchWord);
}

export function parseContractText(text) {
  if (!text || text.trim().length === 0) {
    return { depositPercent: null, tearoutIncluded: null, baseboardsIncluded: null, warnings: ['EMPTY_TEXT'] };
  }

  const warnings = [];
  const depositMatch = text.match(DEPOSIT_RE);
  const tearoutMatch = text.match(TEAROUT_RE);
  const baseboardsMatch = text.match(BASEBOARDS_RE);

  if (!depositMatch) warnings.push('DEPOSIT_NOT_FOUND');
  if (!tearoutMatch) warnings.push('TEAROUT_NOT_FOUND');
  if (!baseboardsMatch) warnings.push('BASEBOARDS_NOT_FOUND');

  return {
    depositPercent: depositMatch ? parseInt(depositMatch[1], 10) : null,
    tearoutIncluded: toBoolean(tearoutMatch?.[1]),
    baseboardsIncluded: toBoolean(baseboardsMatch?.[1]),
    warnings,
  };
}

// Light, non-blocking sanity check so the UI can warn "this doesn't look
// like a Contract" if it's uploaded into the wrong slot.
export function looksLikeContract(text) {
  return /DEPOSIT/i.test(text) || /CANCELLATION/i.test(text);
}
