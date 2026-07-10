import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stageToStatus, sendStageEvent, sendEngineerAssignEvent } from '../sheetSync.js';

describe('stageToStatus', () => {
  it('ingeniería started -> Engineering', () => expect(stageToStatus('ingenieria', 'started')).toBe('Engineering'));
  it('check_eng started -> Check', () => expect(stageToStatus('check_eng', 'started')).toBe('Check'));
  it('check_eng2 started -> Check', () => expect(stageToStatus('check_eng2', 'started')).toBe('Check'));
  it('paperwork finished -> Paperwork', () => expect(stageToStatus('paperwork', 'finished')).toBe('Paperwork'));
  it('nesting -> Nesting', () => expect(stageToStatus('nesting', 'started')).toBe('Nesting'));
});

describe('sheetSync POST', () => {
  beforeEach(() => { global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('sendEngineerAssignEvent POSTs to /api/sync with ENGINEER_ASSIGNED', async () => {
    await sendEngineerAssignEvent('11088', 'Delfina', { name: 'x' });
    expect(global.fetch).toHaveBeenCalledOnce();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/sync');
    const payload = JSON.parse(opts.body);
    expect(payload.eventType).toBe('ENGINEER_ASSIGNED');
    expect(payload.so).toBe('11088');
    expect(payload.engineer).toBe('Delfina');
  });

  it('sendStageEvent sends sheetStatus on started (check_eng -> Check)', async () => {
    await sendStageEvent('11088', 'check_eng', 'started', 'Luis');
    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.eventType).toBe('STAGE_UPDATE');
    expect(payload.sheetStatus).toBe('Check');
    expect(payload.checkDate1).not.toBe('');
  });
});
