# Tags y menciones en Notas de proyecto — diseño

**Fecha:** 2026-08-24
**Estado:** diseño aprobado por el usuario, pendiente de plan de implementación

## El problema

Las notas de proyecto son hoy un monólogo. Alguien escribe una observación en la
tarjeta de un proyecto y no hay forma de dirigirla a una persona concreta ni de
saber si la leyó. Si hace falta que Santiago vea algo, se le avisa por fuera de
la app.

Lo que se pide es poder señalar a una o varias personas del equipo al escribir
una nota, que a esa persona le suene la campana, que al entrar caiga en la nota
exacta y pueda responder ahí mismo, y que mientras no la lea el proyecto se vea
marcado en Pipeline, My Projects y Calendar.

## Lo que ya existe (relevado el 2026-08-24)

Cinco hallazgos del relevamiento que condicionan el diseño:

1. **Hay persistencia real.** Todo vive en Firebase RTDB. El estado de leído
   sobrevive entre sesiones sin infraestructura nueva.

2. **No hay un formulario de notas: hay tres.** Se crean notas en
   `MyProjectsView.handleAddNote` (línea 788), en `PipelineView.handleAddNote`
   (línea 218) y desde el chatbot vía `notesHelper.addProjectNote`. Son tres
   implementaciones separadas, sin componente compartido.

3. **`ProjectDetailView` es de sólo lectura.** Renderiza el timeline de notas
   (línea 222) pero no tiene formulario: es la página del deep link `?so=123`
   que se comparte con diseñadores externos.

4. **La notificación de "notas nuevas" está rota.** `App.jsx:512-517` lee
   `note.timestamp` y `note.author`; las notas se guardan con `createdAt` y
   `createdBy`. Ningún archivo del repo escribe `author:` ni `timestamp:` en una
   nota. `new Date(undefined)` es Invalid Date, así que toda comparación da
   false y `unreadCount` es siempre 0: esa alerta nunca se dispara.

5. **La lista de ingenieros está hardcodeada inline** dentro del JSX en
   `PipelineView.jsx:791`. `designers.js` existe pero es otra lista — 18
   diseñadores, gente distinta de los 8 ingenieros.

Y una restricción dura de seguridad: `database.rules.json:6-9` sólo deja leer el
nodo `users` completo al super admin. Un usuario normal lee únicamente
`users/{su propio uid}`. **Quien taggea no puede traducir un nombre a un uid.**

## Decisiones tomadas

Cerradas con el usuario durante el brainstorming:

1. El selector va en **My Projects y Pipeline**, los dos lugares donde hoy se
   escriben notas de verdad. El chatbot queda afuera.
2. La identidad es el **uid**, con un **directorio público nuevo** que resuelve
   nombre → uid sin abrir el nodo `users`.
3. El destino del click en la notificación es **condicional**: si el proyecto es
   del usuario tageado va a My Projects; si no, a Pipeline.

La tercera la corrigió el usuario sobre la propuesta original, y tiene un motivo
concreto: `myProjectsRaw` (`MyProjectsView.jsx:188-194`) filtra por proyectos
propios, así que un tag en un proyecto ajeno navegaría a una vista que no lo
muestra.

## Modelo de datos

Dos nodos nuevos y un campo opcional en las notas existentes.

```js
// engineer_directory/{uid}
{ name: "Santiago", updatedAt: "2026-08-24T12:00:00.000Z" }

// project_tags/{so}/{tagId}
{
  id:           "t_1756...",
  noteId:       "1756...",     // clave real en project_notes/{so}/{noteId}
  so:           "12480",
  taggedUid:    "abc123",
  taggedName:   "Santiago",
  taggedByUid:  "xyz789",
  taggedByName: "Luis",
  createdAt:    "2026-08-24T12:00:00.000Z",
  readAt:       null           // ISO al leerse
}

// project_notes/{so}/{noteId} — campo nuevo, opcional
{ ..., parentNoteId: "1756..." }   // presente sólo en respuestas
```

`taggedName` y `taggedByName` son denormalización deliberada: sin ellos, mostrar
"tageaste a Santiago" obliga a leer el directorio en cada render.

`noteId` guarda la clave real de storage, la que devuelve `noteStorageKey()` —
no el `note.id`. Para notas nuevas coinciden, pero una nota del formato viejo
(array indexado) vive bajo un índice numérico y su `id` no sirve para
encontrarla. Ver el comentario de `projectNotes.js`.

### Por qué un nodo por proyecto y no un índice por usuario

Se piden dos proyecciones: "sin leer por proyecto" (Pipeline, Calendar) y "sin
leer por usuario" (My Projects, campana). Un solo nodo `project_tags/{so}` da la
primera directo y la segunda recorriéndolo.

El nodo es sólo metadata — sin base64, sin el texto de la nota — así que entra
completo con **un listener**, sin polling. Esto es una restricción de diseño, no
un detalle: los dos incidentes de consumo de agosto de 2026 fueron nodos enteros
descargados en loop. Un índice por usuario duplicaría el dato y exigiría
mantener dos copias del estado de leído sincronizadas, que es exactamente lo que
el pedido quiere evitar.

### El directorio de ingenieros

`engineer_directory/{uid}` se escribe por **auto-registro**: al iniciar sesión,
cada usuario escribe su propia entrada con su `designerName`. La regla permite
`.write` sólo sobre la entrada propia y `.read` a cualquier usuario aprobado.

Se mantiene sincronizado solo, sin administración manual, y se auto-repara si
alguien cambia su `designerName`.

**Ventana conocida:** quien no haya iniciado sesión desde el despliegue no está
en el directorio y no puede ser tageado. El selector lo muestra deshabilitado
con la leyenda "sin cuenta vinculada" en vez de ocultarlo, para que se entienda
por qué no está disponible. Se puede cerrar la ventana sembrando el nodo a mano
una vez desde la Consola de Firebase.

## La fuente única de verdad

Un hook `useProjectTags()` sobre un `onValue` de `project_tags`, montado **una
sola vez** en App.jsx junto a los demás listeners globales, con el resultado
bajando por props — el patrón que ya usan `overrides`, `projectNotes` y
`projectDesigners`.

| Salida | La consume |
|---|---|
| `unreadByProject: { [so]: number }` | Pipeline, Calendar |
| `unreadForMe: Tag[]` | My Projects, campana |
| `tagsByNote: { [noteId]: Tag[] }` | timeline de notas |
| `markTagRead(tagId)` | click en la notificación |

Ninguna vista deriva "leído" por su cuenta. Es el requisito técnico central: sin
esto, cuatro pantallas calcularían el mismo estado de cuatro maneras y se irían
separando con el tiempo.

## Módulos nuevos

- **`src/utils/engineers.js`** — la lista canónica de los 8, hoy inline en
  `PipelineView.jsx:791`. Mismo criterio y mismo formato que `designers.js`.
- **`src/utils/engineerDirectory.js`** — lectura del directorio, resolución
  nombre → uid y el auto-registro al iniciar sesión.
- **`src/utils/projectTags.js`** — forma de almacenamiento y las proyecciones
  puras (`unreadByProject`, `unreadForMe`, `tagsByNote`), separadas del hook
  para poder testearlas sin React.
- **`src/utils/useProjectTags.js`** — el hook con el listener.
- **`src/utils/noteTags.js`** — `createNoteWithTags(so, note, taggedUids)`.
- **`src/utils/projectOwnership.js`** — `ownsProject(userProfile, project)`,
  extraído de `MyProjectsView.jsx:188-194`.
- **`src/components/TagSelector.jsx`** — el selector multi-persona.
- **`src/components/NoteReplyModal.jsx`** — el modal de respuesta.

### Escritura atómica

`createNoteWithTags` escribe la nota y todos sus tags en un solo `update()`
multi-path desde la raíz:

```js
await update(ref(db), {
  [`project_notes/${so}/${noteKey}`]: note,
  [`project_tags/${so}/${tagId1}`]: tag1,
  [`project_tags/${so}/${tagId2}`]: tag2,
});
```

Así no puede existir un tag apuntando a una nota que no se guardó, ni una nota
que dice tener destinatarios sin tags que la respalden. Es el mismo contrato que
`essFiles.saveEssFile` ya usa para el par archivo/índice.

## Por qué no se unifican los dos formularios

La propuesta inicial era extraer un `NoteComposer` compartido. Al leer los dos
formularios quedó claro que no son lo bastante parecidos: My Projects maneja
`noteInputs[so] = {text, noteType, urgency}` con adjuntos, Pipeline maneja
`newNoteTexts[so]` más `commentTypes[so]` con imágenes. Unificarlos de verdad es
un refactor grande en dos archivos grandes, con riesgo propio y sin relación con
lo que se pidió.

Se comparte en cambio lo que importa — la lista, el selector y la escritura — y
cada formulario conserva su estructura de estado. La unificación completa queda
anotada como deuda, no se hace acá.

## Notificación, navegación y respuesta

`realAlerts` suma un tipo `tag` alimentado por `unreadForMe`, con SO, quién
tageó y un preview del texto de la nota.

El click ejecuta, en orden:

1. Resuelve el destino con `ownsProject(userProfile, project)`: propio → My
   Projects, ajeno → Pipeline.
2. Fija `focusedProjectSo` y un `focusedNoteId` nuevo.
3. Escribe `readAt = now` en el tag.
4. Abre `NoteReplyModal` con la nota original visible.

Responder es opcional y no bloqueante: cerrar el modal no deshace el marcado de
leído. Si responde, la respuesta se guarda como nota nueva con `parentNoteId`
apuntando a la original y puede taggear a su vez, con el mismo `TagSelector` y
el mismo `createNoteWithTags`. El flujo recursivo no necesita código propio.

En el timeline, una respuesta se muestra en línea con una referencia a la nota
que responde, no anidada. El timeline es plano hoy y anidarlo es un cambio de
presentación mayor que no se pidió.

## Fix adyacente incluido

`App.jsx:512-517` pasa a leer `createdAt` y `createdBy`, los campos que las
notas realmente tienen. El pedido dice que el contador de la campana debe
incluir los tags "junto con las notificaciones que ya existan hoy", y esa hoy no
existe en la práctica. Son dos líneas y sin ellas el requisito queda a medias.

Efecto secundario a tener presente: la alerta empieza a dispararse por primera
vez desde que se escribió, así que en el primer arranque puede aparecer un pico
de notas sin leer. El código ya lo acota a 7 días para los usuarios sin marca de
lectura previa.

## Indicadores

Los cuatro leen del hook, sin cálculo propio:

- **Pipeline** — punto en la tarjeta si `unreadByProject[so] > 0`, de cualquier
  usuario.
- **My Projects** — sección "Tags para mí" con contador, alimentada por
  `unreadForMe`, cruzando todos los proyectos activos.
- **Calendar** — indicador sobre el día de instalación si el proyecto tiene tags
  sin leer.
- **Timeline de notas** — chips con los tageados y un check cuando `readAt` no
  es null.

## Reglas de RTDB

Dos bloques nuevos:

```jsonc
"project_tags": {
  ".read": "<aprobado>",
  "$so": {
    "$tagId": {
      // Crear (data no existe) o borrar (newData no existe, y sólo quien tageó).
      // Modificar el cuerpo de un tag ya creado no lo permite nadie.
      ".write": "<aprobado> && (!data.exists() || (!newData.exists() && auth.uid === data.child('taggedByUid').val()))",
      // Nadie puede tagear en nombre de otro.
      ".validate": "newData.child('taggedByUid').val() === auth.uid",
      "readAt": {
        // La única excepción a la inmutabilidad, y sólo para el destinatario.
        ".write": "<aprobado> && auth.uid === root.child('project_tags').child($so).child($tagId).child('taggedUid').val()"
      }
    }
  }
},
"engineer_directory": {
  ".read": "<aprobado>",
  "$uid": { ".write": "auth.uid === $uid" }
}
```

Tres restricciones, cada una cerrando un agujero distinto:

- **Sólo la persona tageada puede marcar su propio tag como leído.** Sin esto
  cualquier usuario aprobado podría marcar leídos los tags ajenos y el estado
  dejaría de significar nada. Se expresa como regla del hijo `readAt`, que en
  RTDB habilita escritura sobre ese campo aunque el padre la niegue.
- **Nadie puede tagear en nombre de otro.** El `.validate` fuerza
  `taggedByUid === auth.uid` al crear.
- **Un tag creado es inmutable salvo `readAt`.** El `.write` del padre sólo
  admite creación y borrado, no modificación.

### Borrado en cascada

Borrar una nota tiene que borrar sus tags: si no, quedan tags apuntando a una
nota que ya no está, contando como "sin leer" para siempre y sin forma de
llegar a ellos desde la UI. `handleDeleteNote` (`MyProjectsView.jsx:874`) pasa a
borrar la nota y sus tags en un solo `update()` multi-path, igual que
`createNoteWithTags` los crea.

Por eso el `.write` del padre deja borrar a quien tageó: es quien escribió la
nota y quien puede borrarla. El hook igual descarta defensivamente los tags sin
nota, porque los que ya existan de antes de este cambio no se van a limpiar
solos.

**Escribir el archivo no alcanza.** En este repo ningún CI publica las reglas, así
que `database.rules.json` por sí solo no aplica nada. Hay que correr
`npm run deploy:rules` para que la restricción exista de verdad.

## Lo que este cambio NO hace

- No permite taggear desde el chatbot.
- No manda mail ni push. La notificación es la campana que ya existe.
- No permite editar un tag ni quitarlo por separado. Los tags se van con la
  nota cuando se la borra, y nada más.
- No unifica los dos formularios de notas.
- No anida las respuestas en el timeline.
- No toca `ProjectDetailView`, que sigue siendo de sólo lectura, salvo para
  mostrar los chips de tageados en las notas que ya renderiza.

## Pruebas

Vitest, siguiendo los patrones del repo:

- **Puras** (`projectTags.js`): las tres proyecciones, incluidos tags de
  proyectos archivados, tags huérfanos cuya nota se borró, y un `readAt` con
  fecha inválida.
- **`noteTags.js`**: que la escritura sea un único `update()` con todas las
  rutas, y que un fallo no deje la nota sin sus tags.
- **Borrado en cascada**: borrar una nota borra sus tags en la misma escritura,
  y borrar una nota sin tags sigue funcionando.
- **`projectOwnership.js`**: los tres roles globales más el match por
  `designerName`, replicando el comportamiento actual de `myProjectsRaw`.
- **`engineerDirectory.js`**: resolución nombre → uid, y el caso de un
  ingeniero que todavía no se registró.
- **Componente**: `TagSelector` (selección múltiple, deshabilitados) y
  `NoteReplyModal` (marca leído al abrir, responder es opcional, la respuesta
  lleva `parentNoteId`).
- **Regresión**: crear una nota sin tags sigue funcionando igual en los dos
  formularios.

## Lo que queda abierto

- Si los 8 ingenieros deberían poder taggear a diseñadores además de entre
  ellos. Hoy el selector se limita a `engineers.js`.
- Qué pasa con los tags de un proyecto que se archiva. Hoy `snapshotAuxData`
  (`completedProjectsArchive.js:13-21`) copia siete nodos auxiliares al archivo
  y `project_tags` no está entre ellos, así que se perderían al archivar. Se
  puede sumar al snapshot, pero conviene decidirlo con el consumo en mente: el
  nodo de archivo se lee una vez cada 5 minutos.
- Si el contador de la campana debería agrupar varios tags del mismo proyecto en
  una sola línea o listarlos por separado.
