/**
 * Lista canónica de diseñadores.
 *
 * Vivía duplicada literal en dos lugares: el <select> del modal "Diseñador a
 * Cargo" de MyProjectsView y `CANONICAL_DESIGNERS` en el KpiContext de Designer
 * Performance. Dos copias que hay que acordarse de editar juntas es una copia
 * de más; con la incorporación del gate de asignación pasaban a ser tres.
 *
 * Se ordena al exportar para que todo <select> que la consuma muestre el mismo
 * orden sin tener que acordarse de llamar a .sort().
 */
export const DESIGNERS = [
  'Blerta Veseli',
  'Caryn Henslovitz',
  // Delfina es ingeniera Y disenadora: aparece tambien en la lista de
  // ingenieros (allowed_designers / DEFAULT_DESIGNERS, que guarda ingenieros
  // pese al nombre del nodo). Tener los dos roles es valido.
  'Delfina Breton',
  'Malanie Dalfrey',
  'Melissa Barker',
  'Russell Reiner',
  'Sarah Manev',
];
