// Shared Gemini caller with transient-failure retry, used by both /api/chat
// and /api/translate.
//
// Gemini intermittently returns 503 UNAVAILABLE ("model is currently
// experiencing high demand") for perfectly valid requests — the same prompt
// succeeds moments later. Surfacing that to the user as a hard error made the
// chatbot look broken, so retry transient failures with exponential backoff
// before giving up. Only 503 (overloaded) and 500 (upstream hiccup) are
// retried; 4xx are the caller's fault and won't improve on retry, and 429 is
// a real quota wall where hammering makes it worse.
const RETRYABLE_STATUSES = new Set([500, 503]);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Calls Gemini, retrying transient upstream failures. Returns the final
// Response (ok or not) so callers keep their existing status handling; only
// throws if every attempt threw at the network level.
//
// `fetchImpl` defaults to the global fetch and exists so tests can inject a
// stub without patching globals.
export async function fetchGeminiWithRetry(url, init, fetchImpl = fetch) {
  let lastRes = null;
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(url, init);
      if (res.ok || !RETRYABLE_STATUSES.has(res.status)) return res;

      lastRes = res;
      if (attempt < MAX_ATTEMPTS) {
        // Drain the body so the connection can be reused, and log why we retry.
        const errText = await res.text().catch(() => '');
        console.warn(`Gemini ${res.status} on attempt ${attempt}/${MAX_ATTEMPTS}, retrying:`, errText.slice(0, 200));
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1)); // 400ms, then 800ms
      }
    } catch (err) {
      // Network-level failure (DNS, socket reset) — also worth retrying.
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`Gemini fetch threw on attempt ${attempt}/${MAX_ATTEMPTS}, retrying:`, err.message);
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }
  }

  if (lastRes) return lastRes;
  throw lastErr;
}
