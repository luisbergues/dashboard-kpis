// Vercel serverless function — translates free-text content (e.g. the
// spreadsheet-sourced Executive/Weekly Summary) to Spanish via Gemini.
// Keeps GEMINI_API_KEY server-side only (never exposed to the client bundle).
import { requireAuth } from './lib/verifyAuth.js';
import { getGeminiApiKey } from './lib/getGeminiApiKey.js';

// gemini-flash-latest always points at the current Flash model (currently
// gemini-3.5-flash). The old pinned gemini-2.0-flash is retired and returns
// 429 limit:0 on this project, so use the rolling alias instead.
const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!(await requireAuth(req, res))) return;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  const { text, targetLanguage } = req.body || {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing "text" string' });
    return;
  }

  const target = targetLanguage === 'es' ? 'Spanish' : 'English';
  const systemInstruction = `Translate the given business text to ${target}. Keep names, SO numbers, dates, and figures exactly as-is. Return ONLY the translated text, no preamble, no quotes.`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: text.slice(0, 4000) }] }],
    // thinkingBudget: 0 disables the model's internal reasoning pass —
    // translation is a direct transform that doesn't need it, and it avoids
    // reasoning tokens eating into maxOutputTokens (see api/chat.js).
    generationConfig: { maxOutputTokens: 800, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
  };

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini translate error:', geminiRes.status, errText);
      res.status(502).json({ error: 'Upstream Gemini API error' });
      return;
    }

    const data = await geminiRes.json();
    const translated = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    res.status(200).json({ text: translated.trim() });
  } catch (err) {
    console.error('Translate proxy error:', err);
    res.status(500).json({ error: 'Internal error contacting LLM' });
  }
}
