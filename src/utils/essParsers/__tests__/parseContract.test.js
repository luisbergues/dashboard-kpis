import { describe, it, expect } from 'vitest';
import { parseContractText, looksLikeContract } from '../parseContract';

const sampleContract = `
SALES CONTRACT
Client: Ashley Frankel
DEPOSIT: 50% due at signing.
TEAROUT: Included - old closet system removed by JL Closets.
BASEBOARDS: Not Included - customer responsible.
CANCELLATION POLICY: full refund within 3 business days.
`;

describe('parseContractText', () => {
  it('extracts the deposit percent', () => {
    expect(parseContractText(sampleContract).depositPercent).toBe(50);
  });

  it('extracts tearout as included', () => {
    expect(parseContractText(sampleContract).tearoutIncluded).toBe(true);
  });

  it('extracts baseboards as not included', () => {
    expect(parseContractText(sampleContract).baseboardsIncluded).toBe(false);
  });

  it('returns EMPTY_TEXT for blank input instead of guessing', () => {
    const result = parseContractText('');
    expect(result.warnings).toContain('EMPTY_TEXT');
    expect(result.depositPercent).toBeNull();
  });

  it('warns instead of throwing when a field is missing', () => {
    const result = parseContractText('SALES CONTRACT\nNo relevant fields here.');
    expect(result.warnings).toContain('DEPOSIT_NOT_FOUND');
    expect(result.warnings).toContain('TEAROUT_NOT_FOUND');
    expect(result.warnings).toContain('BASEBOARDS_NOT_FOUND');
    expect(result.depositPercent).toBeNull();
    expect(result.tearoutIncluded).toBeNull();
  });
});

describe('looksLikeContract', () => {
  it('is true when DEPOSIT/CANCELLATION language appears', () => {
    expect(looksLikeContract(sampleContract)).toBe(true);
  });

  it('is false for unrelated text', () => {
    expect(looksLikeContract('Valet Rod - VR-100 - Qty: 2')).toBe(false);
  });
});
