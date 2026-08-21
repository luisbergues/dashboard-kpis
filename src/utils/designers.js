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
  'Iris Lopes',
  'Kat Baumgartner',
  'Krisztina Vizi',
  'Lana Kravtchenko',
  'Luana Tamagnone',
  'Malanie Dalfrey',
  'Marsha Diquez',
  'Mauricio Dasso',
  'Melissa Barker',
  'Michael Kaboskey',
  'Monica Gabriel',
  'Natalie Ball',
  'Nicole Dugan',
  'Russell Reiner',
  'Sarah Manev',
  'Tricia Hatton',
];
