// Message-list helpers for ProjectChatbot. Kept out of the component file so
// they're importable from tests without breaking Fast Refresh (which requires
// component files to export only components).

// The whole message list is re-serialized to localStorage on every change, so
// an unbounded log eventually hits the ~5MB quota — at which point the write
// throws, the catch swallows it, and history silently stops persisting. Keep
// only the most recent turns; older ones aren't replayed to Gemini anyway
// (see the viaLLM history slice) and aren't worth the quota.
export const MAX_MESSAGES = 25;

// Appends messages and trims to the cap in one step, so every write path stays
// bounded. Callers use this instead of spreading into setMessages directly.
export function appendCapped(prev, ...newMessages) {
  return [...prev, ...newMessages].slice(-MAX_MESSAGES);
}

// Message ids double as React keys, so collisions silently break list
// reconciliation. Date.now() alone repeats when two messages land in the same
// millisecond (the option-click path appends two at once), so pair it with a
// monotonic counter that can't repeat within a session.
let messageSeq = 0;
export function nextMessageId(suffix = '') {
  messageSeq += 1;
  return `m${Date.now()}_${messageSeq}${suffix}`;
}
