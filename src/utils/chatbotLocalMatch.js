// Pure, dependency-free local-matching logic for ProjectChatbot. Extracted so
// it has a single source of truth that both the component and its tests
// import — a script that reimplements this by hand in a test file silently
// drifts the moment the component's matching logic changes.
import { normalizeText, searchEngineeringManual } from './engineeringManual';

// Trigger phrases that precede an entity name in a status/lookup question.
// Stripped out before entity search so "How is Eindar Khant?" searches for
// "eindar khant" instead of the whole sentence glued together.
export const ENTITY_QUERY_TRIGGERS = [
  'how is', 'hows', 'how are', 'status of', 'what is the status of',
  'projects of', 'project of', 'projects for', 'project for',
  'como esta el proyecto', 'como esta', 'como van', 'estado de',
  'estado del proyecto', 'proyectos de', 'proyecto de', 'que tal',
];

// Intent words the user tacks onto a lookup ("russell CONTACT", "natalie
// TELEFONO") are not part of anyone's name. Left in the token list they cause
// false positives — e.g. "contact" matching a project literally named
// "Contact Center" — and can crowd out the real name match. Strip them so
// only actual name fragments drive matching.
export const INTENT_STOPWORDS = new Set([
  'contact', 'contacto', 'telefono', 'phone', 'email', 'correo', 'mail',
  'info', 'informacion', 'information', 'numero', 'number', 'ciudad', 'city',
  'proyecto', 'project', 'proyectos', 'projects', 'diseñador', 'disenador',
  'designer', 'ingeniero', 'engineer', 'the', 'los', 'las', 'del',
]);

// Extracts the entity name a user is asking about by stripping known
// trigger phrases and punctuation, leaving just the name/SO to search for.
export function extractEntityQuery(rawText) {
  let t = normalizeText(rawText);
  ENTITY_QUERY_TRIGGERS.forEach(trigger => {
    t = t.replace(normalizeText(trigger), ' ');
  });
  return t.replace(/\s+/g, ' ').trim();
}

// Builds a name-matcher bound to a single query's tokens. A query token
// matches a name token when they're equal, or one contains the other AND the
// shorter side is 4+ chars — long enough not to be a coincidental fragment
// ("ana" inside "Susana").
//
// Two separate jobs, deliberately split:
//
// `nameMatches` decides IF a name is a candidate, and only words of 4+ chars
// may trigger that — a bare short word ("Al", "Jo") is admitted only when the
// query has nothing longer to go on. This is the safety property: a 3-char
// token can only ever match a name token exactly, never as a substring, so
// "al" finds "Al Smith" but never drags in "Alberto".
//
// `nameScore` decides HOW WELL it matches, and there every word counts —
// short ones included. That's what correlates the parts of a full name:
// "ana ball" makes both Ana Ball and Bob Ball candidates (only "ball" can
// trigger a match), but Ana Ball hits 2 words to Bob Ball's 1 and outranks it.
// Scoring on the trigger tokens alone would leave the two indistinguishable.
export function buildNameMatcher(entityQuery) {
  const words = entityQuery.split(/\s+/).filter(w => w.length > 0 && !INTENT_STOPWORDS.has(w));
  const substantial = words.filter(w => w.length >= 4);
  const searchTokens = substantial.length > 0 ? substantial : words;

  const toNameTokens = (name) => String(name).toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  // A query token hits a name token when they're equal, or one contains the
  // other AND the shorter side is 4+ chars — long enough not to be a
  // coincidental fragment ("ana" inside "Susana").
  const tokenHits = (token, nameTokens) => nameTokens.some(nt => {
    if (nt === token) return true;
    const shorter = nt.length <= token.length ? nt : token;
    const longer = nt.length <= token.length ? token : nt;
    return shorter.length >= 4 && longer.includes(shorter);
  });

  const nameMatches = (name) => {
    if (!name || searchTokens.length === 0) return false;
    const nameTokens = toNameTokens(name);
    return searchTokens.some(st => tokenHits(st, nameTokens));
  };

  const nameScore = (name) => {
    if (!name) return 0;
    const nameTokens = toNameTokens(name);
    return words.reduce((n, w) => n + (tokenHits(w, nameTokens) ? 1 : 0), 0);
  };

  return { searchTokens, words, nameMatches, nameScore };
}

// Runs the full local entity search (designers, engineers, projects, designer
// contacts) for a query already known to be in the IDLE state (not a
// cancel/help/note command, and not mid multi-turn flow). Returns the same
// `options` array shape ProjectChatbot builds inline, plus the tokens used,
// so callers/tests can inspect why something did or didn't match.
export function findLocalEntityMatches(text, { projects = [], designerContacts = [] } = {}) {
  const cleanText = text.trim().toLowerCase();
  const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
  const isPlausibleQuery = wordCount > 0 && wordCount <= 12;

  const entityQuery = extractEntityQuery(text);
  const searchWord = entityQuery.replace(/\s+/g, '');
  const { searchTokens, nameMatches, nameScore } = buildNameMatcher(entityQuery);

  if (!isPlausibleQuery || (searchWord.length < 3 && searchTokens.length === 0)) {
    return { options: [], searchTokens, eligible: false };
  }

  // Collected with their match score, then ranked: a name that hits more of
  // the query's words is a better answer than one that hits fewer, so
  // "ana ball" puts Ana Ball ahead of Bob Ball.
  const scored = [];

  const matchedDesigners = [...new Set(projects.filter(p => nameMatches(p.designer)).map(p => p.designer))];
  matchedDesigners.forEach(d => {
    scored.push({ option: { type: 'designer', name: d }, score: nameScore(d) });
  });

  const matchedEngineers = [...new Set(projects.filter(p => nameMatches(p.eng)).map(p => p.eng))];
  matchedEngineers.forEach(e => {
    scored.push({ option: { type: 'engineer', name: e }, score: nameScore(e) });
  });

  projects.forEach(p => {
    const cleanSo = String(p.so || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const soHit = searchWord.length >= 3 && cleanSo.includes(searchWord);
    if (!nameMatches(p.name) && !soHit) return;
    // An SO hit is an explicit identifier — rank it at least as high as a
    // one-word name hit rather than letting it fall to the bottom on a
    // name score of 0.
    scored.push({ option: { type: 'project', data: p }, score: Math.max(nameScore(p.name), soHit ? 1 : 0) });
  });

  designerContacts.forEach(c => {
    const names = [c.name, ...(c.aliases || [])];
    if (!names.some(n => nameMatches(n))) return;
    scored.push({ option: { type: 'contact', data: c }, score: Math.max(...names.map(n => nameScore(n))) });
  });

  // Stable sort by score (Array.sort is stable in modern JS), so equal-scoring
  // options keep the designer/engineer/project/contact order they were added in.
  scored.sort((a, b) => b.score - a.score);

  const options = scored.map((s, i) => ({ id: i + 1, ...s.option, score: s.score }));

  return { options, searchTokens, eligible: true };
}

// True if `text`, evaluated fresh in IDLE state (chatState IDLE, no pending
// note flow), resolves without ever reaching the Gemini fallback: a
// cancel/help/add-note command, or a local entity/contact match (single or
// multiple). False means processInput would fall through to askLLM.
export function resolvesLocallyInIdleState(text, { projects = [], designerContacts = [] } = {}) {
  const cleanText = text.trim().toLowerCase();

  if (cleanText === 'cancelar' || cleanText === 'cancel') return true;
  if (cleanText === 'ayuda' || cleanText === 'help' || cleanText === '?') return true;
  if (cleanText.includes('nota') || cleanText.includes('note') || cleanText.includes('bitacora')) return true;
  if (isOnHoldQuery(text) || isInstallQuery(text)) return true;

  const { options } = findLocalEntityMatches(text, { projects, designerContacts });
  if (options.length > 0) return true;

  // Engineering-manual questions resolve locally when the manual search finds
  // a hit (checked after entity search, matching processInput's order).
  return searchEngineeringManual(text).length > 0;
}

// Scores how well `query` (already lowercased + stripped to alphanumerics)
// identifies a project, from 0 (no match) to 1 (exact). Ranking beats a flat
// "does it contain the substring" test because a query that hits several
// projects usually still has one obvious intended target: an exact SO, or the
// name it's a prefix of. Ties (e.g. "residence" against two ...Residence
// projects) legitimately stay close, which is what keeps the picker showing.
//
// Ordering of the rules matters — earlier rules are stronger evidence:
//   exact SO/name           1
//   SO prefix              0.9
//   name prefix        0.5–0.9  (scaled by how much of the name it covers)
//   name contains      0.2–0.5  (same scaling, weaker since it's mid-word)
//   SO contains            0.2
export function scoreProjectMatch(query, project) {
  if (!query) return 0;
  const cleanName = String(project.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanSo = String(project.so || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (cleanSo && cleanSo === query) return 1;
  if (cleanName && cleanName === query) return 1;
  if (cleanSo && cleanSo.startsWith(query)) return 0.9;
  if (cleanName && cleanName.startsWith(query)) return 0.5 + 0.4 * (query.length / cleanName.length);
  if (cleanName && cleanName.includes(query)) return 0.2 + 0.3 * (query.length / cleanName.length);
  if (cleanSo && cleanSo.includes(query)) return 0.2;
  return 0;
}

// A top match is only auto-selected over the runner-up when it's an exact hit
// or clears it by this much. Picking wrong here writes the user's note onto
// the wrong project, so ambiguity must fall back to asking rather than guess.
const CLEAR_WINNER_MARGIN = 0.25;

// Project matcher used by the AWAITING_PROJECT_FOR_NOTE state (the "which
// project?" step of the add-note flow), distinct from findLocalEntityMatches'
// token-based nameMatches. Always returns synchronously and never touches
// Gemini; this is what makes every branch of that flow (no match / one match
// / many matches / cancel) resolve locally.
//
// Returns matches ranked best-first. Note the empty-query guard: stripping
// non-alphanumerics turns input like "???" into "", and `anything.includes('')`
// is true in JS, so without it every project would match a query that named
// none of them. Scoring can't rescue that case — an empty query scores 0
// against everything, so the "best" match would just be an arbitrary tie.
export function findProjectMatchesForNote(text, projects = []) {
  const query = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!query) return [];

  return projects
    .map(p => ({ project: p, score: scoreProjectMatch(query, p) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.project);
}

// Resolves the add-note project step: `matches` is every candidate ranked
// best-first (for the picker), and `best` is the single project confident
// enough to skip the picker entirely — null when the query is genuinely
// ambiguous and the user should choose.
export function resolveProjectForNote(text, projects = []) {
  const query = text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!query) return { matches: [], best: null };

  const scored = projects
    .map(p => ({ project: p, score: scoreProjectMatch(query, p) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { matches: [], best: null };

  const [top, second] = scored;
  const isClearWinner = top.score === 1 || !second || (top.score - second.score) >= CLEAR_WINNER_MARGIN;

  return {
    matches: scored.map(x => x.project),
    best: isClearWinner ? top.project : null,
  };
}

// --- Aggregate intents (ON HOLD list, upcoming installs) ---
// These back the "ON HOLD" and "Installations" quick-action chips (and the
// equivalent typed questions). Previously the chips sent a generic status
// question that no local guard caught, so they fell through to Gemini; these
// resolve them locally instead.

// A long paragraph that merely mentions "installation" or "hold" in passing
// isn't a request for the aggregate list — it's free text that Gemini should
// reason over. Same 12-word ceiling the entity search uses, so a chip's short
// fixed text passes but a rant falls through to the LLM.
function isShortEnoughForIntent(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length <= 12;
}

// True when the query is asking for the ON HOLD project list. Matches the
// chip's fixed text and common typed variants in both languages.
export function isOnHoldQuery(text) {
  if (!isShortEnoughForIntent(text)) return false;
  const t = normalizeText(text); // lowercase, accent-stripped
  return t.includes('on hold') || t.includes('onhold') || t.includes('en espera') || t.includes('en pausa') || t.includes('pausados');
}

// True when the query is asking for upcoming installations.
export function isInstallQuery(text) {
  if (!isShortEnoughForIntent(text)) return false;
  const t = normalizeText(text);
  return t.includes('instalacion') || t.includes('instalaciones') || t.includes('install') || t.includes('installation');
}

// All projects currently ON HOLD. Uses the same tolerant test the dashboard
// uses (status contains "HOLD"), so "ON HOLD", "on hold", etc. all count.
export function findOnHoldProjects(projects = []) {
  return projects.filter(p => String(p.status || '').toUpperCase().includes('HOLD'));
}

// Parses a project install date into a local-midnight Date. Sheet install
// values are day-granular strings like "2026-06-12"; `new Date("2026-06-12")`
// parses as midnight UTC, which in negative-offset timezones lands on the
// previous local day and would wrongly drop an install dated "today". Split
// the YYYY-MM-DD ourselves and build a local Date so day comparisons are
// timezone-stable. Falls back to Date parsing for other formats.
function parseInstallDateLocal(install) {
  const iso = String(install).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const d = new Date(install);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Projects with an upcoming installation date, excluding completed/cancelled
// and ON HOLD (they aren't actionable installs), sorted soonest-first. A
// reference date is injectable so this is deterministically testable.
export function findUpcomingInstalls(projects = [], referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());

  return projects
    .map(p => {
      const status = String(p.status || '').toUpperCase();
      if (status.includes('COMPLETED') || status.includes('CANCELLED') || status.includes('HOLD')) return null;
      if (!p.install) return null;
      const d = parseInstallDateLocal(p.install);
      if (!d) return null;
      if (d < refDay) return null; // already past
      return { project: p, date: d };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)
    .map(x => x.project);
}
