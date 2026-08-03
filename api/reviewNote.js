// Vercel serverless function — reescribe en prosa la nota que el diseñador
// recibe cuando su proyecto queda en Complete / Deficient / Deferred.
//
// IMPORTANTE: este endpoint NO decide el contenido. El cliente arma el texto
// con los datos reales del checklist (src/designer-performance/utils/
// reviewNoteDraft.ts) y lo manda ya redactado; acá solo se lo pule. La lista de
// documentos faltantes es lo que el diseñador va a usar para saber qué
// corregir, así que no puede salir de un modelo que puede inventar u omitir.
//
// Si esto falla, el cliente guarda el texto determinístico sin pasar por acá.
import { requireApprovedUser } from './lib/requireApprovedUser.js';
import { getGeminiApiKey } from './lib/getGeminiApiKey.js';
import { fetchGeminiWithRetry } from './lib/fetchGeminiWithRetry.js';

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Los diseñadores son los destinatarios de la nota, no quienes la emiten, y no
// pueden escribir el intake (ver database.rules.json).
const ALLOWED_ROLES = ['engineer', 'engineer_nester', 'administrative', 'admin', 'engineer-admin'];

const SYSTEM_INSTRUCTION = [
  'You rewrite an internal engineering review note that will be sent to an interior designer.',
  'Rules you must follow exactly:',
  '- Write in English, in a professional, neutral, courteous tone. Never blame the designer.',
  '- Preserve EVERY fact from the draft: the SO number, the project name, the review result',
  '  (Complete, Deficient or Deferred), every listed document, and the deadline.',
  '- Never invent, remove, merge or rename a document. Keep the document names verbatim.',
  '- Keep the list of documents as a bulleted list, one per line, using "- " as the bullet.',
  '- Do not add greetings or sign-offs that are not in the draft.',
  '- Keep it under 140 words.',
  'Return ONLY the rewritten note: no preamble, no quotes, no markdown headings.',
].join('\n');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!(await requireApprovedUser(req, res, { allowedRoles: ALLOWED_ROLES }))) return;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    // 503 y no 500: el cliente lo trata como "no disponible" y usa su propio
    // texto, que es perfectamente publicable.
    res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  const { draft } = req.body || {};
  if (!draft || typeof draft !== 'string') {
    res.status(400).json({ error: 'Missing "draft" string' });
    return;
  }

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: draft.slice(0, 4000) }] }],
    // Igual que en api/translate.js: es una reescritura directa, no necesita
    // pasada de razonamiento, y así los tokens no se comen maxOutputTokens.
    generationConfig: { maxOutputTokens: 600, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
  };

  try {
    const geminiRes = await fetchGeminiWithRetry(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      console.error('Gemini reviewNote error:', geminiRes.status, errText);
      res.status(502).json({ error: 'Upstream Gemini API error' });
      return;
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    res.status(200).json({ text: text.trim() });
  } catch (err) {
    console.error('reviewNote proxy error:', err);
    res.status(500).json({ error: 'Internal error contacting LLM' });
  }
}
