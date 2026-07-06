// Client-side helper for the Gemini-backed chat proxy (api/chat.js).
// Never calls the LLM provider directly — the API key stays server-side.

export async function askLLM({ message, language, context }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, context }),
  });

  if (!res.ok) {
    throw new Error(`LLM proxy error: ${res.status}`);
  }

  const data = await res.json();
  return data.text || '';
}

// Builds a compact text summary of projects relevant to the query, so the
// LLM answers grounded in real data instead of hallucinating specifics.
export function buildProjectContext(projects, query) {
  const cleanQuery = (query || '').toLowerCase();
  const words = cleanQuery.split(/\s+/).filter(w => w.length >= 3);

  const relevant = projects.filter(p => {
    const haystack = `${p.name} ${p.so} ${p.designer || ''} ${p.eng || ''} ${p.status || ''}`.toLowerCase();
    return words.some(w => haystack.includes(w));
  }).slice(0, 8);

  const list = relevant.length > 0 ? relevant : projects.slice(0, 5);

  return list.map(p =>
    `SO #${p.so} — ${p.name} | Etapa/Stage: ${p.status || 'N/A'} | Diseñador/Designer: ${p.designer || 'N/A'} | Ingeniero/Engineer: ${p.eng || 'N/A'} | Instalación/Install: ${p.install || 'N/A'}`
  ).join('\n');
}
