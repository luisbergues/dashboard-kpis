import { useState, useEffect, useMemo, useCallback } from 'react';
import { db, ref, onValue } from './firebase';
import {
  normalizeTags,
  buildNoteIndex,
  liveTags,
  unreadByProject as projectUnread,
  unreadForMe as mineUnread,
  tagsByNote as byNote,
} from './projectTags';
import { markTagRead } from './noteTags';

/**
 * La fuente unica del estado de tags.
 *
 * Se monta UNA vez en App.jsx y baja por props, igual que overrides,
 * projectNotes y projectDesigners. Ninguna vista deriva "leido" por su cuenta:
 * si lo hicieran, Pipeline, My Projects, Calendar y el timeline calcularian lo
 * mismo de cuatro maneras y se irian separando.
 *
 * Un solo listener sobre el nodo entero. El nodo es solo metadata — sin base64,
 * sin el texto de las notas — asi que pesa poco. NO agregar aca un get() dentro
 * de un intervalo: es el patron que disparo el consumo de agosto de 2026.
 */
export function useProjectTags(currentUser, projectNotes) {
  const [raw, setRaw] = useState(null);
  const uid = currentUser?.uid || null;

  // Gateado en el uid y no sin dependencias: la pagina publica del deep link
  // (?project=123) se renderiza sin sesion, y ahi la suscripcion se disparaba
  // igual como visitante anonimo, con un permission-denied en la consola en
  // cada carga. Solo re-corre al entrar o salir de la sesion, asi que no
  // reintroduce descargas repetidas del nodo entero.
  useEffect(() => {
    if (!db || !uid) return;
    return onValue(
      ref(db, 'project_tags'),
      snapshot => setRaw(snapshot.val()),
      error => console.error('Failed to subscribe to project tags:', error)
    );
  }, [uid]);

  const projections = useMemo(() => {
    // Sin sesion no hay tags que proyectar. Se descarta aca y no con un
    // setRaw(null) en el efecto para no encadenar un render de mas al cerrar
    // sesion.
    const all = normalizeTags(uid ? raw : null);
    const live = liveTags(all, buildNoteIndex(projectNotes));
    return {
      tags: live,
      unreadByProject: projectUnread(live),
      unreadForMe: mineUnread(live, uid),
      tagsByNote: byNote(live),
    };
  }, [raw, projectNotes, uid]);

  const markRead = useCallback((so, tagId) => markTagRead({ so, tagId }), []);

  return { ...projections, markRead };
}
