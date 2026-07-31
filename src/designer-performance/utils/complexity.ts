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
 * Contrapartida a tener presente: si alguien destilda a mano un campo que la
 * planilla marca como "Yes", al reabrir el proyecto vuelve a aparecer tildado.
 * La planilla gana.
 */
export const deriveComplexity = (
  saved: Partial<Project['complexity']> | undefined,
  matReq?: MaterialRow | null,
): Project['complexity'] => ({
  colorsDefined:   saved?.colorsDefined ?? false,
  thermofoilDoors: matReq ? matReq.thermofoil === 'Yes' : (saved?.thermofoilDoors ?? false),
  customBoreHoles: matReq ? matReq.noHoles    === 'Yes' : (saved?.customBoreHoles ?? false),
  routingRequired: matReq ? matReq.dovetail   === 'Yes' : (saved?.routingRequired ?? false),
  customPanels:    matReq ? matReq.element    === 'Yes' : (saved?.customPanels    ?? false),
});
