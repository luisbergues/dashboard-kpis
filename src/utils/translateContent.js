// Client-side helper for the Gemini-backed translation proxy (api/translate.js).
// Used for spreadsheet-sourced free text (e.g. Executive/Weekly Summary) that
// isn't a catalogued UI string and so can't go through the static i18n system.

import { authHeaders } from './firebase';

const cache = new Map();

export async function translateText(text, targetLanguage) {
  if (!text || !text.trim()) return text;
  if (targetLanguage !== 'es') return text; // source content is already English

  const cacheKey = `${targetLanguage}::${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ text, targetLanguage }),
    });
    if (!res.ok) throw new Error(`translate proxy error: ${res.status}`);
    const data = await res.json();
    const translated = data.text || text;
    cache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    console.error('Translation failed, showing original text:', err);
    return text;
  }
}
