// Vercel serverless function — translates free-text content (e.g. the
// spreadsheet-sourced Executive/Weekly Summary) to Spanish via Gemini.
// Keeps GEMINI_API_KEY server-side only (never exposed to the client bundle).
import { requireAuth } from './lib/verifyAuth.js';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!(await requireAuth(req, res))) return;

  const apiKey = process.env.GEMINI_API_KEY;
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
    generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
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
