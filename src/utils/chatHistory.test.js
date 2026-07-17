import { describe, it, expect } from 'vitest';
import { appendCapped, nextMessageId, MAX_MESSAGES } from './chatHistory';

const msg = (n) => ({ id: `id${n}`, sender: 'user', text: `m${n}` });

describe('chatHistory — message history cap', () => {
  // The full list is re-serialized to localStorage on every change; unbounded
  // growth eventually throws on the ~5MB quota, and the catch around the write
  // means history would then stop persisting with no visible symptom.
  it('keeps the list at the cap once it is full', () => {
    const full = Array.from({ length: MAX_MESSAGES }, (_, i) => msg(i));
    const result = appendCapped(full, msg(999));
    expect(result).toHaveLength(MAX_MESSAGES);
  });

  it('drops the oldest messages, keeping the newest', () => {
    const full = Array.from({ length: MAX_MESSAGES }, (_, i) => msg(i));
    const result = appendCapped(full, msg(999));
    expect(result[result.length - 1].text).toBe('m999');
    expect(result[0].text).toBe('m1'); // m0 evicted
  });

  it('stays bounded when several messages are appended at once', () => {
    const full = Array.from({ length: MAX_MESSAGES }, (_, i) => msg(i));
    expect(appendCapped(full, msg('a'), msg('b'))).toHaveLength(MAX_MESSAGES);
  });

  it('does not pad a short list', () => {
    expect(appendCapped([msg(1)], msg(2))).toHaveLength(2);
  });

  it('appends onto an empty list', () => {
    expect(appendCapped([], msg(1)).map(m => m.text)).toEqual(['m1']);
  });
});

describe('chatHistory — message id generation', () => {
  // Ids double as React keys, so duplicates break list reconciliation.
  // Date.now() alone repeated whenever two messages landed in the same
  // millisecond — which the option-click path does by design, appending a
  // user and a bot message back to back.
  it('never repeats, even for ids minted in the same millisecond', () => {
    const ids = Array.from({ length: 500 }, () => nextMessageId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the caller suffix', () => {
    expect(nextMessageId('_user')).toMatch(/_user$/);
    expect(nextMessageId('_bot')).toMatch(/_bot$/);
  });

  it('distinguishes a user/bot pair minted back to back', () => {
    expect(nextMessageId('_user')).not.toBe(nextMessageId('_bot'));
  });
});
