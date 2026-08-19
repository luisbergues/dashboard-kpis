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

  // Redacciones reales: el Summary de un Quote real dice 'Deposit of 50%
  // required to Secure price', y los Contracts suelen separar la etiqueta del
  // número con puntos de relleno. La regex vieja exigía que el número viniera
  // pegado a la palabra, así que ninguna de las dos matcheaba.
  it.each([
    ['Deposit of 50% required to Secure price and set installation date.', 50],
    ['Deposit Required ......... 50%', 50],
    ['DEPOSIT: 30 %', 30],
  ])('lee el depósito de %j', (line, expected) => {
    expect(parseContractText(line).depositPercent).toBe(expected);
  });

  // El relleno se corta en el salto de renglón para no saltar de una cláusula a
  // otra y tomar un porcentaje que no es el del depósito.
  it('no cruza de renglón para agarrar un porcentaje ajeno', () => {
    const result = parseContractText('Deposit due at signing.\nDiscount 5.00%');
    expect(result.depositPercent).toBeNull();
    expect(result.warnings).toContain('DEPOSIT_NOT_FOUND');
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
