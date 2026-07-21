import { describe, it, expect } from 'vitest';
import { translations } from '../translations';

const keysOf = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

describe('translations', () => {
  it('en y es exponen exactamente las mismas claves', () => {
    expect(keysOf(translations.es).sort()).toEqual(keysOf(translations.en).sort());
  });
});
