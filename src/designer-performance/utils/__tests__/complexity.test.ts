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

// Reportado en produccion: se tildaban a mano hasta 5 casillas de Technical
// Complexity, se guardaba, y al releer el proyecto solo quedaban las que la
// planilla ya traia en "Yes" — el resto (corregidas a mano contra un "No" de
// la planilla) volvian a aparecer destildadas. "La planilla gana" corria en
// las dos direcciones sin dar forma de fijar una correccion manual.
describe('deriveComplexity — override manual por campo', () => {
  it('sin override, la planilla sigue ganando (comportamiento previo intacto)', () => {
    const guardado = { ...allFalse, routingRequired: true };
    expect(deriveComplexity(guardado, NO).routingRequired).toBe(false);
  });

  it('con el campo marcado como override, lo guardado gana aunque la planilla diga No', () => {
    const guardado = { ...allFalse, routingRequired: true };
    const overrides = { routingRequired: true };
    expect(deriveComplexity(guardado, NO, overrides).routingRequired).toBe(true);
  });

  it('con el campo marcado como override, lo guardado gana aunque la planilla diga Yes', () => {
    // El caso inverso: alguien destildo a mano un campo que la planilla
    // marca "Yes" porque en este proyecto puntual no aplica.
    const guardado = { ...allFalse, thermofoilDoors: false };
    const overrides = { thermofoilDoors: true };
    expect(deriveComplexity(guardado, YES, overrides).thermofoilDoors).toBe(false);
  });

  it('el override es por campo: los demas campos siguen gobernados por la planilla', () => {
    const guardado = { ...allFalse, routingRequired: true, customPanels: true };
    const overrides = { routingRequired: true }; // solo este se toco a mano
    const result = deriveComplexity(guardado, NO, overrides);
    expect(result.routingRequired).toBe(true);   // manual, se respeta
    expect(result.customPanels).toBe(false);     // sin tocar, la planilla (No) gana
  });

  it('un override sin match en la planilla se comporta igual que sin override', () => {
    const guardado = { ...allFalse, routingRequired: true };
    expect(deriveComplexity(guardado, null, { routingRequired: true }).routingRequired).toBe(true);
    expect(deriveComplexity(guardado, null, {}).routingRequired).toBe(true);
  });

  it('colorsDefined ignora los overrides: siempre fue manual, no necesita marca', () => {
    expect(deriveComplexity({ ...allFalse, colorsDefined: true }, YES, {}).colorsDefined).toBe(true);
  });
});
