import { describe, it, expect } from 'vitest';
import { canManageDesignerNotes } from '../notePermissions';

describe('canManageDesignerNotes', () => {
  it('permite a los roles de ingenieria', () => {
    expect(canManageDesignerNotes({ role: 'engineer' })).toBe(true);
    expect(canManageDesignerNotes({ role: 'engineer_nester' })).toBe(true);
    expect(canManageDesignerNotes({ role: 'engineer-admin' })).toBe(true);
  });

  it('no permite al disenador', () => {
    expect(canManageDesignerNotes({ role: 'designer' })).toBe(false);
  });

  it('no permite a administrative ni admin', () => {
    expect(canManageDesignerNotes({ role: 'administrative' })).toBe(false);
    expect(canManageDesignerNotes({ role: 'admin' })).toBe(false);
  });

  it('no permite sin perfil ni sin rol', () => {
    expect(canManageDesignerNotes(null)).toBe(false);
    expect(canManageDesignerNotes(undefined)).toBe(false);
    expect(canManageDesignerNotes({})).toBe(false);
  });
});
