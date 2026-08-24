/**
 * Lista canónica de ingenieros del equipo.
 *
 * Vivía literal dentro del JSX del <select> "Assign ENG" de PipelineView. Con
 * el selector de tags pasaban a ser dos copias que hay que acordarse de editar
 * juntas, que es una copia de más. Mismo criterio que designers.js — que es
 * OTRA lista, de diseñadores, no de ingenieros.
 *
 * Se exporta ordenada para que todo <select> que la consuma muestre el mismo
 * orden sin tener que acordarse de llamar a .sort().
 */
export const ENGINEERS = [
  'Andres',
  'Delfina',
  'Joaquin',
  'Jose',
  'Josema',
  'Julieta',
  'Luis',
  'Santiago',
];
