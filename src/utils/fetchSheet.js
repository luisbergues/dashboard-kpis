import { auth } from './firebase';

/**
 * Unico punto desde el que el cliente pide datos de planilla.
 *
 * Antes cada modulo tenia su URL de `docs.google.com/.../export?format=csv` y
 * la bajaba con fetch + PapaParse. Eso obligaba a tener la planilla PUBLICADA
 * EN LA WEB (cualquiera con el link la descarga sin login) y ademas metia el
 * ID de la planilla en el bundle, que es publico. Ahora la lectura pasa por
 * /api/sheet, que valida la sesion y usa una cuenta de servicio. Ver
 * api/sheet.js.
 *
 * CONTRATO: devuelve exactamente lo mismo que devolvia
 * `Papa.parse(csvText, { skipEmptyLines: false }).data` — un array de filas,
 * cada fila un array de strings del mismo largo. Los parsers leen por indice,
 * asi que esa forma no se puede cambiar; el relleno de las filas lo hace el
 * servidor (padRows).
 *
 * Lanza si no hay sesion o si el servidor rechaza. Los llamadores ya tenian
 * try/catch alrededor del fetch viejo y caen a su propio respaldo (el cache
 * de Firebase en App.jsx), asi que un fallo degrada a datos viejos en vez de
 * romper la vista.
 *
 * @param {'main'|'quality'|'projectMaterials'|'masterSchedule'} name
 * @returns {Promise<string[][]>}
 */
export async function fetchSheetRows(name) {
  const user = auth?.currentUser;
  if (!user) throw new Error('No hay sesion iniciada para leer la planilla');

  const token = await user.getIdToken();
  const response = await fetch(`/api/sheet?name=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    // El cuerpo del error no se muestra al usuario: puede traer detalle del
    // servidor. Alcanza con el codigo para distinguir "no autorizado" de
    // "no configurado" en la consola.
    throw new Error(`/api/sheet?name=${name} respondio ${response.status}`);
  }

  const body = await response.json();
  return Array.isArray(body?.values) ? body.values : [];
}
