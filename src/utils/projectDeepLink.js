// Link que el ingeniero le manda al disenador para que vea el estado de su
// paperwork: en que quedo la revision, la nota escrita, que documentos faltan y
// hasta cuando tiene.
//
// Es un deep link a la app, no una pagina publica: quien lo abre igual tiene que
// iniciar sesion. La ficha del proyecto lleva nombre de cliente, SO y notas
// internas, asi que un link que funcione sin cuenta expondria todo eso a
// cualquiera que lo reenvie.

export const SHARED_PROJECT_PARAM = 'so';

/**
 * SO valido presente en la URL, o null. Solo acepta digitos: el valor entra por
 * la barra de direcciones, asi que no se confia en el.
 */
export function getSharedProjectSo(search = typeof window !== 'undefined' ? window.location.search : '') {
  let raw;
  try {
    raw = new URLSearchParams(search).get(SHARED_PROJECT_PARAM);
  } catch {
    return null;
  }
  if (!raw) return null;
  const so = String(raw).trim();
  return /^\d+$/.test(so) ? so : null;
}

/** URL absoluta para compartir. Conserva el origen y la ruta actuales. */
export function buildSharedProjectLink(so, location = typeof window !== 'undefined' ? window.location : null) {
  const clean = String(so ?? '').trim();
  if (!/^\d+$/.test(clean)) return '';
  const origin = location?.origin || '';
  const path = location?.pathname || '/';
  return `${origin}${path}?${SHARED_PROJECT_PARAM}=${clean}`;
}
