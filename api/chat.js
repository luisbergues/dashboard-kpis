// Vercel serverless function — proxies chat requests to Google Gemini.
// Keeps GEMINI_API_KEY server-side only (never exposed to the client bundle).
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    return;
  }

  const { message, language, context, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Missing "message" string' });
    return;
  }

  const isES = language === 'es';
  const systemInstruction = isES
    ? 'Eres el asistente virtual de JL Closets, una empresa de closets a medida. Respondé de forma breve, clara y profesional en español. El contexto provisto puede incluir varias secciones (proyectos, manual técnico de ingeniería, matriz de materiales, contactos de diseñadores) — usá únicamente esos datos para responder; si el contexto no alcanza, decilo honestamente en vez de inventar datos.'
    : 'You are the virtual assistant for JL Closets, a custom closet company. Reply briefly, clearly, and professionally in English. The provided context may include several sections (projects, technical engineering manual, materials matrix, designer contacts) — use only that data to answer; if the context is insufficient, say so honestly instead of making things up.';

  const contextBlock = context && String(context).trim().length > 0
    ? `\n\n${isES ? 'Contexto relevante' : 'Relevant context'}:\n${String(context).slice(0, 6000)}`
    : '';

  const validHistory = Array.isArray(history)
    ? history.filter(h => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
    : [];

  const body = {
    system_instruction: { parts: [{ text: systemInstruction + contextBlock }] },
    contents: [
      ...validHistory.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] },
    ],
    generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
  };

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      res.status(502).json({ error: 'Upstream Gemini API error' });
      return;
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    res.status(200).json({ text });
  } catch (err) {
    console.error('Chat proxy error:', err);
    res.status(500).json({ error: 'Internal error contacting LLM' });
  }
}
