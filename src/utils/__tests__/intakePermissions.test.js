import { describe, it, expect } from 'vitest';
import { canForceApproveIntake } from '../intakePermissions';

describe('canForceApproveIntake', () => {
  it('permite solo al rol administrative', () => {
    expect(canForceApproveIntake({ role: 'administrative' })).toBe(true);
  });

  it('no permite a los roles de ingenieria', () => {
    expect(canForceApproveIntake({ role: 'engineer' })).toBe(false);
    expect(canForceApproveIntake({ role: 'engineer_nester' })).toBe(false);
  });

  it('no permite al super admin ni a admin', () => {
    // El usuario pidio explicitamente que sea solo 'administrative'.
    expect(canForceApproveIntake({ role: 'engineer-admin' })).toBe(false);
    expect(canForceApproveIntake({ role: 'admin' })).toBe(false);
  });

  it('no permite al disenador', () => {
    expect(canForceApproveIntake({ role: 'designer' })).toBe(false);
  });

  it('no permite sin perfil ni sin rol', () => {
    expect(canForceApproveIntake(null)).toBe(false);
    expect(canForceApproveIntake(undefined)).toBe(false);
    expect(canForceApproveIntake({})).toBe(false);
  });
});
