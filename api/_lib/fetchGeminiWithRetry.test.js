import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchGeminiWithRetry } from './fetchGeminiWithRetry.js';

// Minimal Response stand-in — the module only touches ok/status/text().
const mockRes = (status, body = '') => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

describe('fetchGeminiWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Runs fn while auto-advancing timers, so the backoff sleeps resolve without
  // the test actually waiting.
  const runWithTimers = async (fn) => {
    const promise = fn();
    await vi.runAllTimersAsync();
    return promise;
  };

  it('returns immediately on success without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes(200, 'ok'));
    const res = await runWithTimers(() => fetchGeminiWithRetry('url', { method: 'POST' }, fetchMock));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a transient 503 and succeeds on the second attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockRes(503, 'overloaded'))
      .mockResolvedValueOnce(mockRes(200, 'ok'));
    const res = await runWithTimers(() => fetchGeminiWithRetry('url', {}, fetchMock));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after MAX_ATTEMPTS on a persistent 503 and returns the last response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes(503, 'overloaded'));
    const res = await runWithTimers(() => fetchGeminiWithRetry('url', {}, fetchMock));
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a 500 (upstream hiccup)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockRes(500))
      .mockResolvedValueOnce(mockRes(200, 'ok'));
    const res = await runWithTimers(() => fetchGeminiWithRetry('url', {}, fetchMock));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a 400 — a bad request will not improve', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes(400, 'bad request'));
    const res = await runWithTimers(() => fetchGeminiWithRetry('url', {}, fetchMock));
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a 429 — quota exhausted, hammering makes it worse', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockRes(429, 'quota'));
    const res = await runWithTimers(() => fetchGeminiWithRetry('url', {}, fetchMock));
    expect(res.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a network-level throw and recovers', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(mockRes(200, 'ok'));
    const res = await runWithTimers(() => fetchGeminiWithRetry('url', {}, fetchMock));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rethrows when every attempt throws at the network level', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    // Attach the rejection handler before advancing timers, otherwise the
    // pending rejection surfaces as an unhandled error while they run.
    const promise = fetchGeminiWithRetry('url', {}, fetchMock);
    const assertion = expect(promise).rejects.toThrow('ECONNRESET');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
