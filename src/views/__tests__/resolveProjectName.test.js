import { describe, it, expect } from 'vitest';

// Mirrors the placeholder-name resolution inlined in MyProjectsView.jsx, which
// feeds the Completed Projects modal. Every value here originates in a Google
// Sheet cell parsed by PapaParse, so a purely-numeric Name arrives as a
// `number`, not a string — the original `!name || !name.trim()` guard only
// caught falsy values and threw "name.trim is not a function" on those.
const isPlaceholderName = (so, name) => {
  const str = String(name ?? '').trim();
  if (!str) return true;
  return str.toLowerCase() === `so #${so}`.toLowerCase();
};

const makeResolver = (data) => (p) => {
  if (!isPlaceholderName(p.so, p.name)) return p.name;
  const fromMaterials = (data.materialRequirements || [])
    .find(m => String(m.so) === String(p.so) && !isPlaceholderName(m.so, m.name));
  if (fromMaterials) return fromMaterials.name;
  const fromHistory = (data.statusHistory || [])
    .find(h => String(h.so) === String(p.so) && !isPlaceholderName(h.so, h.name));
  if (fromHistory) return fromHistory.name;
  return p.name;
};

describe('isPlaceholderName', () => {
  it('treats a real name as not a placeholder', () => {
    expect(isPlaceholderName('12480', 'Perez Residence')).toBe(false);
  });

  it('treats the "SO #x" placeholder as a placeholder', () => {
    expect(isPlaceholderName('12480', 'SO #12480')).toBe(true);
  });

  it('is case- and whitespace-insensitive about the placeholder', () => {
    expect(isPlaceholderName('12480', '  so #12480  ')).toBe(true);
  });

  it('treats a missing name as a placeholder', () => {
    expect(isPlaceholderName('1', undefined)).toBe(true);
    expect(isPlaceholderName('1', null)).toBe(true);
    expect(isPlaceholderName('1', '')).toBe(true);
    expect(isPlaceholderName('1', '   ')).toBe(true);
  });

  // The regression: PapaParse hands back a number for a numeric Name cell.
  it('does not throw on a numeric name', () => {
    expect(() => isPlaceholderName('1', 12480)).not.toThrow();
    expect(isPlaceholderName('1', 12480)).toBe(false);
  });

  it('does not throw on a numeric so', () => {
    expect(() => isPlaceholderName(12480, 'SO #12480')).not.toThrow();
    expect(isPlaceholderName(12480, 'SO #12480')).toBe(true);
  });

  it('treats numeric zero as a real name, not a placeholder', () => {
    expect(isPlaceholderName('1', 0)).toBe(false);
  });
});

describe('resolveProjectName', () => {
  const data = {
    materialRequirements: [{ so: '12480', name: 'Perez Residence' }],
    statusHistory: [{ so: '999', name: 'Gonzalez Closet' }],
  };
  const resolve = makeResolver(data);

  it('keeps a real name as-is', () => {
    expect(resolve({ so: '1', name: 'Already Good' })).toBe('Already Good');
  });

  it('recovers the real name from materialRequirements', () => {
    expect(resolve({ so: '12480', name: 'SO #12480' })).toBe('Perez Residence');
  });

  it('falls back to statusHistory when materials has nothing', () => {
    expect(resolve({ so: '999', name: '' })).toBe('Gonzalez Closet');
  });

  it('keeps the placeholder when no source has a better name', () => {
    expect(resolve({ so: '777', name: 'SO #777' })).toBe('SO #777');
  });

  it('does not throw on a numeric name (the crash)', () => {
    expect(() => resolve({ so: '1', name: 12480 })).not.toThrow();
    expect(resolve({ so: '1', name: 12480 })).toBe(12480);
  });

  it('does not throw when the data sections are missing entirely', () => {
    const bare = makeResolver({});
    expect(() => bare({ so: '1', name: undefined })).not.toThrow();
  });

  it('does not throw when a source row itself has a numeric name', () => {
    const odd = makeResolver({ materialRequirements: [{ so: '1', name: 555 }] });
    expect(() => odd({ so: '1', name: 'SO #1' })).not.toThrow();
    expect(odd({ so: '1', name: 'SO #1' })).toBe(555);
  });
});
