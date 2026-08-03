import { draftReviewNote, type ReviewNoteFacts } from './reviewNoteDraft';
import { authHeaders } from '../../utils/firebase';

// Un modelo lento no puede trabar el guardado del intake: pasado este tiempo se
// usa el texto determinístico.
const TIMEOUT_MS = 8000;

/**
 * Devuelve la nota para el diseñador, redactada por Gemini cuando se puede.
 *
 * Nunca falla: ante cualquier problema (endpoint caído, sin API key, timeout,
 * respuesta vacía) devuelve el texto determinístico, que ya es publicable.
 *
 * Además descarta la versión del modelo si perdió alguno de los documentos
 * faltantes. Esa lista es el dato accionable de la nota — que el diseñador lea
 * una versión "linda" a la que le falta un documento es peor que leer la
 * versión seca y completa.
 */
export async function generateReviewNote(facts: ReviewNoteFacts): Promise<string> {
  const draft = draftReviewNote(facts);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/reviewNote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ draft }),
      signal: controller.signal,
    });
    if (!res.ok) return draft;

    const data = await res.json();
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) return draft;

    const keptEveryDoc = facts.missingDocs.every(doc => text.includes(doc));
    return keptEveryDoc ? text : draft;
  } catch {
    return draft;
  } finally {
    clearTimeout(timer);
  }
}
