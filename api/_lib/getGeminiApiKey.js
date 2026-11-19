// Vercel's env var UI has, in practice, ended up storing GEMINI_API_KEY with
// literal surrounding quotes (e.g. `"AIzaSy..."` instead of `AIzaSy...`) more
// than once for this project — Google then rejects the wrapped value with
// 400 API_KEY_INVALID. Rather than relying on the value always being pasted
// clean, strip a single layer of matching leading/trailing quotes (and
// incidental whitespace) here so the proxy tolerates however it was stored.
export function getGeminiApiKey() {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return raw;

  const trimmed = raw.trim();
  const isWrapped =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  return isWrapped ? trimmed.slice(1, -1).trim() : trimmed;
}
