// Quien esta haciendo el cambio, para poder sellar registros con su autor.
//
// El nombre se resuelve con la misma cadena que ya usaba MyProjectsView para
// firmar las notas: perfil primero (designerName es el nombre real que el
// usuario cargo al registrarse), despues lo que traiga Auth, y el email como
// ultimo recurso. Centralizado aca para que todos los registros firmados de la
// app usen el mismo criterio.

export const UNKNOWN_ACTOR_NAME = 'Unknown User';

/**
 * @param {object|null} userProfile  users/{uid} de RTDB
 * @param {object|null} currentUser  usuario de Firebase Auth
 * @returns {{uid: string|null, name: string}}
 */
export function actorFrom(userProfile, currentUser) {
  return {
    uid: currentUser?.uid || null,
    name: userProfile?.designerName
      || currentUser?.displayName
      || currentUser?.email
      || UNKNOWN_ACTOR_NAME,
  };
}
