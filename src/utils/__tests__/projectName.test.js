import { describe, it, expect } from 'vitest';
import { shortProjectName } from '../projectName';

describe('shortProjectName', () => {
  it('recorta el sufijo ":[SO] ..." que trae la columna Name del sheet', () => {
    expect(shortProjectName('Chris Jaensch:[12112] Chris Jaensch')).toBe('Chris Jaensch');
    expect(shortProjectName('Brian Wille:[12389] Wille Residence')).toBe('Brian Wille');
  });

  it('deja intacto un nombre sin dos puntos', () => {
    expect(shortProjectName('Perez Residence')).toBe('Perez Residence');
  });

  it('trimea espacios alrededor', () => {
    expect(shortProjectName('  Perez : Master Closet')).toBe('Perez');
  });

  // PapaParse devuelve number para celdas puramente numéricas.
  it('nunca lanza con undefined, null o number', () => {
    expect(shortProjectName(undefined)).toBe('');
    expect(shortProjectName(null)).toBe('');
    expect(shortProjectName(12480)).toBe('12480');
    expect(shortProjectName(0)).toBe('0');
  });
});
