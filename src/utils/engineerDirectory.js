import { db, ref, set, onValue } from './firebase';
import { ENGINEERS } from './engineers';

// Puente nombre -> uid.
//
// Hace falta porque las reglas (database.rules.json) solo dejan leer el nodo
// `users` completo al super admin: un usuario normal lee unicamente
// users/{su propio uid}. Sin este directorio, quien taggea no tiene forma de
// traducir "Santiago" al uid que necesita el tag.
//
// Se llena por AUTO-REGISTRO: cada usuario escribe su propia entrada al
// iniciar sesion, y la regla solo le permite esa. Asi no hay nada que
// administrar a mano y se auto-repara si alguien cambia su designerName.
const DIRECTORY_PATH = 'engineer_directory';

/**
 * Registra al usuario actual en el directorio.
 *
 * Nunca lanza: se la llama desde el flujo de login y un fallo aca (permisos,
 * red) no puede impedir que alguien entre a la app. El costo de fallar es que
 * esa persona no aparece como tageable hasta el proximo intento.
 */
export async function registerSelf(uid, name) {
  const clean = String(name ?? '').trim();
  if (!db || !uid || !clean) return;
  try {
    await set(ref(db, `${DIRECTORY_PATH}/${uid}`), {
      name: clean,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('⚠️ No se pudo registrar en el directorio de ingenieros:', error?.message || error);
  }
}

/** Un listener sobre el nodo entero. Son ~8 entradas de dos campos. */
export function subscribeToDirectory(onChange) {
  if (!db) {
    onChange({});
    return () => {};
  }
  return onValue(
    ref(db, DIRECTORY_PATH),
    snapshot => onChange(snapshot.val() || {}),
    error => {
      console.error('Failed to subscribe to engineer directory:', error);
      onChange({});
    }
  );
}

export function uidForName(directory, name) {
  const target = String(name ?? '').trim().toLowerCase();
  if (!directory || !target) return null;
  const hit = Object.entries(directory)
    .find(([, entry]) => String(entry?.name ?? '').trim().toLowerCase() === target);
  return hit ? hit[0] : null;
}

export function nameForUid(directory, uid) {
  if (!directory || !uid) return null;
  return directory[uid]?.name ?? null;
}

/**
 * Los 8 ingenieros con su uid si ya se registraron.
 *
 * Devuelve la lista COMPLETA, no solo los registrados: el selector muestra a
 * los no registrados deshabilitados con una leyenda, para que se entienda por
 * que no estan disponibles en vez de que parezca que faltan del equipo.
 */
export function taggableEngineers(directory) {
  return ENGINEERS.map(name => {
    const uid = uidForName(directory, name);
    return { name, uid, registered: Boolean(uid) };
  });
}
