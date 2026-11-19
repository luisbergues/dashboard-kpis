import { describe, it, expect } from 'vitest';
import { mapEventToCells } from './syncMapping.js';

describe('mapEventToCells', () => {
  it('ENGINEER_ASSIGNED writes ENG (col I)', () => {
    const r = mapEventToCells({ eventType: 'ENGINEER_ASSIGNED', so: '11088', engineer: 'Delfina' });
    expect(r).toEqual({ writes: [{ col: 'I', value: 'Delfina' }], needsObsRead: false });
  });

  it('ON_HOLD writes STATUS (col N)', () => {
    const r = mapEventToCells({ eventType: 'ON_HOLD', so: '11088', sheetStatus: 'ON HOLD' });
    expect(r).toEqual({ writes: [{ col: 'N', value: 'ON HOLD' }], needsObsRead: false });
  });

  it('STAGE_UPDATE with startDate writes START DATE (J) and STATUS (N)', () => {
    const r = mapEventToCells({ eventType: 'STAGE_UPDATE', so: '1', startDate: '07/09/2026', checkDate1: '', checkDate2: '', completionDate: '', sheetStatus: 'Engineering' });
    expect(r.writes).toEqual([{ col: 'J', value: '07/09/2026' }, { col: 'N', value: 'Engineering' }]);
  });

  it('STAGE_UPDATE with checkDate1 writes only Check Date 1 (K) and STATUS, not J/L/M', () => {
    const r = mapEventToCells({ eventType: 'STAGE_UPDATE', so: '1', startDate: '', checkDate1: '07/10/2026', checkDate2: '', completionDate: '', sheetStatus: 'Check' });
    expect(r.writes).toEqual([{ col: 'K', value: '07/10/2026' }, { col: 'N', value: 'Check' }]);
  });

  it('STAGE_UPDATE with empty sheetStatus does not write N', () => {
    const r = mapEventToCells({ eventType: 'STAGE_UPDATE', so: '1', startDate: '', checkDate1: '', checkDate2: '', completionDate: '', sheetStatus: '' });
    expect(r.writes).toEqual([]);
  });

  it('NOTE_ADDED obs flags needsObsRead and carries noteText', () => {
    const r = mapEventToCells({ eventType: 'NOTE_ADDED', so: '1', noteType: 'obs', noteText: 'Falta material' });
    expect(r.needsObsRead).toBe(true);
    expect(r.writes).toEqual([{ col: 'O', value: 'Falta material' }]);
  });

  it('NOTE_ADDED non-obs is skipped', () => {
    const r = mapEventToCells({ eventType: 'NOTE_ADDED', so: '1', noteType: 'normal', noteText: 'x' });
    expect(r).toEqual({ writes: [], needsObsRead: false });
  });

  it('unknown event is skipped', () => {
    expect(mapEventToCells({ eventType: 'RELEASE_HOLD', so: '1' })).toEqual({ writes: [], needsObsRead: false });
  });
});
