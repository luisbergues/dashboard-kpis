import type { Project } from '../types';

/** Fila de `materialRequirements`, la pestaña de materiales del pipeline. */
export interface MaterialRow {
  thermofoil?: string;
  noHoles?: string;
  dovetail?: string;
  element?: string;
}

/**
 * Los 4 campos de complejidad que la planilla puede determinar.
 * `colorsDefined` no tiene columna equivalente: es siempre manual.
 */
export const complexityFromSheet = (matReq?: MaterialRow | null): Partial<Project['complexity']> => {
  if (!matReq) return {};
  return {
    thermofoilDoors: matReq.thermofoil === 'Yes',
    customBoreHoles: matReq.noHoles    === 'Yes',
    routingRequired: matReq.dovetail   === 'Yes',
    customPanels:    matReq.element    === 'Yes',
  };
};

/** Los 4 campos que la planilla puede determinar (todo `complexity` salvo
 *  `colorsDefined`, que no tiene columna equivalente y siempre es manual). */
type SheetField = 'thermofoilDoors' | 'customBoreHoles' | 'routingRequired' | 'customPanels';

/**
 * Complejidad efectiva de un proyecto.
 *
 * La planilla es la autoridad para sus 4 campos: cada vez que hay match, sus
 * valores pisan lo guardado. Sin match, se conserva lo guardado.
 *
 * Esto es lo que hace que un proyecto dado de alta antes de que existieran sus
 * materiales se complete solo en cuanto la planilla los trae. Antes se usaba
 * `??` sobre cada campo, y como un valor guardado en `false` no es nullish, el
 * fallback a la planilla no volvia a aplicarse nunca despues del primer guardado.
 *
 * `overrides` es la excepcion a esa regla: marca los campos que alguien
 * corrigio a mano en este proyecto puntual. Para esos, gana lo guardado sin
 * importar lo que diga la planilla — en cualquiera de las dos direcciones.
 * Sin marca, sigue ganando la planilla como siempre.
 */
export const deriveComplexity = (
  saved: Partial<Project['complexity']> | undefined,
  matReq?: MaterialRow | null,
  overrides?: Partial<Record<SheetField, boolean>>,
): Project['complexity'] => {
  const pick = (field: SheetField, fromSheet: boolean): boolean =>
    overrides?.[field] ? (saved?.[field] ?? false) : (matReq ? fromSheet : (saved?.[field] ?? false));

  return {
    colorsDefined:   saved?.colorsDefined ?? false,
    thermofoilDoors: pick('thermofoilDoors', matReq?.thermofoil === 'Yes'),
    customBoreHoles: pick('customBoreHoles', matReq?.noHoles    === 'Yes'),
    routingRequired: pick('routingRequired', matReq?.dovetail   === 'Yes'),
    customPanels:    pick('customPanels',    matReq?.element    === 'Yes'),
  };
};
