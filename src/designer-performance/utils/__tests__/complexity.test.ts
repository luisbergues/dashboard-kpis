import { describe, it, expect } from 'vitest';
import { deriveComplexity, complexityFromSheet } from '../complexity';

const YES = { thermofoil: 'Yes', noHoles: 'Yes', dovetail: 'Yes', element: 'Yes' };
const NO  = { thermofoil: 'No',  noHoles: 'No',  dovetail: 'No',  element: 'No'  };

const allFalse = {
  colorsDefined: false, thermofoilDoors: false, customBoreHoles: false,
  routingRequired: false, customPanels: false,
};

describe('complexityFromSheet', () => {
  it('devuelve vacio si no hay match en la planilla', () => {
    expect(complexityFromSheet(null)).toEqual({});
    expect(complexityFromSheet(undefined)).toEqual({});
  });

  it('mapea las 4 columnas de la planilla', () => {
    expect(complexityFromSheet(YES)).toEqual({
      thermofoilDoors: true, customBoreHoles: true,
      routingRequired: true, customPanels: true,
    });
  });

  it('solo cuenta el valor exacto "Yes"', () => {
    expect(complexityFromSheet({ thermofoil: 'yes' }).thermofoilDoors).toBe(false);
    expect(complexityFromSheet({ thermofoil: '' }).thermofoilDoors).toBe(false);
  });

  it('nunca incluye colorsDefined: no tiene fuente en la planilla', () => {
    expect(complexityFromSheet(YES)).not.toHaveProperty('colorsDefined');
  });
});

describe('deriveComplexity — proyecto nuevo, sin nada guardado', () => {
  it('sin match queda todo en false', () => {
    expect(deriveComplexity(undefined, null)).toEqual(allFalse);
  });

  it('con match toma los valores de la planilla', () => {
    expect(deriveComplexity(undefined, YES)).toEqual({ ...allFalse,
      thermofoilDoors: true, customBoreHoles: true, routingRequired: true, customPanels: true });
  });
});

describe('deriveComplexity — el caso que motivo el cambio', () => {
  it('completa un proyecto guardado en falso cuando la planilla trae los materiales', () => {
    // Alta temprana: no habia materiales, se guardo todo en false.
    const guardado = { ...allFalse };
    // Mas tarde el proyecto llega al pipeline y la planilla ya lo tiene.
    const ahora = deriveComplexity(guardado, YES);
    expect(ahora.thermofoilDoors).toBe(true);
    expect(ahora.customBoreHoles).toBe(true);
    expect(ahora.routingRequired).toBe(true);
    expect(ahora.customPanels).toBe(true);
  });

  it('sin match conserva lo que ya estaba guardado', () => {
    const guardado = { ...allFalse, thermofoilDoors: true, customPanels: true };
    expect(deriveComplexity(guardado, null)).toEqual(guardado);
  });

  it('la planilla tambien puede apagar un campo si dice No', () => {
    const guardado = { ...allFalse, thermofoilDoors: true };
    expect(deriveComplexity(guardado, NO).thermofoilDoors).toBe(false);
  });
});

describe('deriveComplexity — colorsDefined es siempre manual', () => {
  it('se conserva lo guardado aunque haya match en la planilla', () => {
    expect(deriveComplexity({ ...allFalse, colorsDefined: true }, YES).colorsDefined).toBe(true);
    expect(deriveComplexity({ ...allFalse, colorsDefined: false }, YES).colorsDefined).toBe(false);
  });

  it('arranca en false si nunca se guardo', () => {
    expect(deriveComplexity(undefined, YES).colorsDefined).toBe(false);
  });
});
