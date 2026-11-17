import { useState, useEffect } from 'react';
import { db, ref, onValue } from './firebase';
import { ENGINEERS } from './engineers';

/**
 * Lee el equipo desde `/team` en RTDB, con la lista del codigo como respaldo.
 *
 * Por que: los nombres del equipo estaban fijos en `engineers.js`, asi que dar
 * de alta o de baja a alguien exigia un commit y un deploy. Ahora el nodo
 * manda y el literal queda solo como red: primer arranque antes de poblar el
 * nodo, Firebase sin configurar, o la app offline. Nadie se queda sin el
 * <select> de "Assign ENG" por un problema de red.
 *
 * Mismo patron que useDesignerContacts.js, que ya hacia esto para el
 * directorio de disenadores (`designer_contacts`). Los disenadores NO se
 * mudan a `/team`: ese nodo ya existe, ya tiene datos y ya funciona; moverlo
 * seria una migracion sin beneficio.
 *
 * Forma esperada del nodo, array o mapa indexado (RTDB devuelve lo segundo
 * cuando las claves dejan de ser contiguas):
 *
 *   /team/engineers  ->  ['Andres', 'Delfina', ...]
 *
 * Se descarta lo que no sea string no vacio y se ordena al salir, para que
 * todo <select> que lo consuma muestre el mismo orden sin acordarse de
 * llamar a .sort() — igual que hacia el modulo estatico.
 */
const normalizeNames = (value) => {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value)
      : null;
  if (!list) return null;
  const clean = list
    .filter((n) => typeof n === 'string' && n.trim())
    .map((n) => n.trim());
  // Un nodo presente pero vacio no debe dejar el <select> sin opciones: se
  // trata como "todavia no hay datos" y gana el respaldo.
  return clean.length > 0 ? [...clean].sort() : null;
};

export function useTeamEngineers() {
  const [engineers, setEngineers] = useState(ENGINEERS);

  useEffect(() => {
    if (!db) return;
    const teamRef = ref(db, 'team/engineers');
    const unsubscribe = onValue(
      teamRef,
      (snapshot) => {
        const fromDb = normalizeNames(snapshot.val());
        if (fromDb) setEngineers(fromDb);
      },
      (error) => {
        // Falla de permisos o de red: se sigue con el respaldo del codigo.
        console.warn('No se pudo leer /team/engineers:', error);
      },
    );
    return () => unsubscribe();
  }, []);

  return engineers;
}

export { normalizeNames as __normalizeNamesForTests };
