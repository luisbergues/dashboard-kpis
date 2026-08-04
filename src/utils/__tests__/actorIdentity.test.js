import { describe, it, expect } from 'vitest';
import { actorFrom, UNKNOWN_ACTOR_NAME } from '../actorIdentity';

describe('actorFrom', () => {
  it('prefiere el nombre del perfil', () => {
    const a = actorFrom({ designerName: 'Monica Gabriel' },
      { uid: 'u1', displayName: 'monig', email: 'm@x.com' });
    expect(a).toEqual({ uid: 'u1', name: 'Monica Gabriel' });
  });

  it('cae al displayName de Auth si el perfil no tiene nombre', () => {
    expect(actorFrom({}, { uid: 'u1', displayName: 'monig', email: 'm@x.com' }).name).toBe('monig');
  });

  it('cae al email como ultimo recurso', () => {
    expect(actorFrom(null, { uid: 'u1', email: 'm@x.com' }).name).toBe('m@x.com');
  });

  it('nunca devuelve vacio', () => {
    expect(actorFrom(null, null)).toEqual({ uid: null, name: UNKNOWN_ACTOR_NAME });
    expect(actorFrom({}, {}).name).toBe(UNKNOWN_ACTOR_NAME);
  });

  it('ignora un designerName en blanco', () => {
    expect(actorFrom({ designerName: '' }, { uid: 'u1', email: 'm@x.com' }).name).toBe('m@x.com');
  });

  it('el uid queda en null sin sesion, no en undefined', () => {
    // Firebase rechaza undefined al escribir; null es un valor valido.
    expect(actorFrom({ designerName: 'X' }, null).uid).toBeNull();
  });
});
