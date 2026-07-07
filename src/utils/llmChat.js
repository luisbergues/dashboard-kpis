// Client-side helper for the Gemini-backed chat proxy (api/chat.js).
// Never calls the LLM provider directly — the API key stays server-side.
import { searchEngineeringManual } from './engineeringManual';

export async function askLLM({ message, language, context, history }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, context, history }),
  });

  if (!res.ok) {
    throw new Error(`LLM proxy error: ${res.status}`);
  }

  const data = await res.json();
  return data.text || '';
}

// Builds a compact text summary of projects relevant to the query, so the
// LLM answers grounded in real data instead of hallucinating specifics.
function buildProjectsSection(projects, words) {
  const relevant = projects.filter(p => {
    const haystack = `${p.name} ${p.so} ${p.designer || ''} ${p.eng || ''} ${p.status || ''}`.toLowerCase();
    return words.some(w => haystack.includes(w));
  }).slice(0, 8);

  const list = relevant.length > 0 ? relevant : projects.slice(0, 5);
  if (list.length === 0) return '';

  return list.map(p =>
    `SO #${p.so} — ${p.name} | Etapa/Stage: ${p.status || 'N/A'} | Diseñador/Designer: ${p.designer || 'N/A'} | Ingeniero/Engineer: ${p.eng || 'N/A'} | Instalación/Install: ${p.install || 'N/A'}`
  ).join('\n');
}

function buildManualSection(query, isES) {
  const matches = searchEngineeringManual(query);
  if (matches.length === 0) return '';

  return matches.slice(0, 2).map(entry =>
    isES
      ? `§${entry.section} ${entry.titleES}\n${entry.answerES}`
      : `§${entry.section} ${entry.titleEN}\n${entry.answerEN}`
  ).join('\n\n');
}

function buildMaterialsSection(materialsMatrix, cleanQuery, words) {
  const matched = (materialsMatrix || []).find(m => {
    const cleanSo = (m.so || '').toLowerCase().trim();
    if (cleanSo && cleanQuery.includes(cleanSo)) return true;

    const nameParts = (m.projectName || '').toLowerCase().trim().split(' ').filter(part => part.length >= 3);
    return nameParts.length > 0 && nameParts.some(part => words.includes(part));
  });

  if (!matched) return '';

  return `${matched.projectName} (SO #${matched.so}) — Thermofoil: ${matched.thermofoil || 'No'} | No Holes: ${matched.noHoles || 'No'} | Dovetail: ${matched.dovetail || 'No'} | Element: ${matched.element || 'No'}`;
}

function buildContactsSection(designerContacts, words) {
  const matched = (designerContacts || []).find(d => {
    const parts = (d.name || '').toLowerCase().split(' ');
    return parts.some(part => part.length >= 3 && words.includes(part));
  });

  if (!matched) return '';

  return `${matched.name} — Tel/Phone: ${matched.phone || 'N/A'} | Email: ${matched.email || 'N/A'} | Ciudad/City: ${matched.city || 'N/A'}`;
}

// Builds the full context block handed to Gemini: a compact, labeled
// concatenation of every data source relevant to the query (projects,
// engineering manual, materials matrix, designer contacts). Each section is
// only included when it actually has a match, so irrelevant queries don't
// inflate the prompt with unrelated data.
export function buildLLMContext({ query, projects = [], materialsMatrix = [], designerContacts = [], isES = true }) {
  const cleanQuery = (query || '').toLowerCase();
  const words = cleanQuery.split(/\s+/).filter(w => w.length >= 3);

  const sections = [
    { label: isES ? 'Proyectos' : 'Projects', text: buildProjectsSection(projects, words) },
    { label: isES ? 'Manual de Ingeniería' : 'Engineering Manual', text: buildManualSection(query, isES) },
    { label: isES ? 'Matriz de Materiales' : 'Materials Matrix', text: buildMaterialsSection(materialsMatrix, cleanQuery, words) },
    { label: isES ? 'Contactos de Diseñadores' : 'Designer Contacts', text: buildContactsSection(designerContacts, words) },
  ].filter(s => s.text.trim().length > 0);

  return sections.map(s => `--- ${s.label} ---\n${s.text}`).join('\n\n');
}
