# Diseño — Red flags de Fase 2 desde notas designer

**Fecha:** 2026-07-28
**Estado:** Aprobado, listo para implementation plan

## Objetivo

Que el puntaje de Fase 2 (IFR) del módulo Designer Performance se calcule automáticamente a partir de las notas de tipo `designer` cargadas en My Projects, en lugar de dos números que el ingeniero escribe a mano al cerrar el proyecto.

Cada nota designer es un red flag. Cuánto descuenta depende de **cuántos días estuvo sin resolverse** y del **semáforo de urgencia** de la nota.

## Contexto

Lo que **ya existe** y no hay que construir:

- Notas por proyecto en Firebase `project_notes/{so}` (array). Se cargan desde `MyProjectsView.jsx`.
- Tipo de nota `designer`, cuarto estado del botón que cicla `normal → priority → obs → designer → normal` ([MyProjectsView.jsx:1663](../../../src/views/MyProjectsView.jsx#L1663)).
- Semáforo de urgencia exclusivo de las notas designer: `green` (Baja) → `yellow` (Media) → `red` (Alta), editable después de creada la nota ([MyProjectsView.jsx:810-828](../../../src/views/MyProjectsView.jsx#L810-L828)).
- Forma de la nota: `{ id, text, noteType, priority, createdAt (ISO), createdBy, urgency?, attachments? }`.

Lo que **falta**: las notas no tienen estado de resolución, y no alimentan ningún cálculo. Hoy `calculatePhase2Score(totalRedFlags, redFlagsOver4Days, icp)` recibe dos números tipeados a mano en `Phase2Form`.

## Fórmula actual (se reemplaza por completo)

```
IFR = 100 − (totalRedFlags / ICP × 40) − (redFlagsOver4Days × 5)
```

El **ICP sale de Fase 2**. Sigue calculándose en Fase 1 y sigue mostrándose como dato del proyecto, pero deja de afectar el puntaje de Fase 2.

## Fórmula nueva

```
score = max(0, 100 − Σ penalización(nota))
```

Por cada nota designer del proyecto:

| Urgencia | Tasa día 1–4 | Tasa día 5+ | Tope |
|----------|--------------|-------------|------|
| 🟢 green  | 0.5 / día    | 1 / día     | 10   |
| 🟡 yellow | 1 / día      | 2 / día     | 20   |
| 🔴 red    | 2 / día      | 4 / día     | 40   |

```
penalización(nota) = min(tope, min(días,4) × tasa + max(0, días−4) × tasa × 2)
```

Los tres topes equivalen a 12 días abiertos, así que las tres urgencias llegan a su techo a la vez y el semáforo mantiene su jerarquía (una roja siempre pesa 4× una verde).

### Cómo se cuentan los días

Se cuentan en **días calendario** (ambos extremos normalizados a medianoche local), igual que en Fase 1.

**Inicio del reloj:** `max(createdAt, RED_FLAG_SCORING_SINCE)` — ver "Migración".

**Fin del reloj:**

| Situación | Fin |
|-----------|-----|
| Nota resuelta | `resolvedAt` |
| Nota abierta, proyecto abierto | hoy (el preview sube solo, como en Fase 1) |
| Nota abierta, proyecto cerrado | fecha de cierre, congelada en `phase2Score` |

### Reglas de borde

- **La urgencia actual se aplica a todo el período.** El semáforo es editable después de creada la nota; no se trocea el historial por tramos. Si una nota estuvo verde 10 días y se pasa a roja, se recalcula entera como roja.
- **Borrar una nota elimina su penalización.** No hay tombstone.
- Solo cuentan las notas con `noteType === 'designer'`. Las `normal`, `priority` y `obs` no puntúan.
- Un proyecto sin notas designer da 100.

## Modelo de datos

Un solo campo nuevo en la nota:

```js
{
  id, text, noteType: 'designer', urgency: 'green' | 'yellow' | 'red',
  createdAt:  "2026-07-03T14:22:00.000Z",
  resolvedAt: "2026-07-15T09:10:00.000Z" | null   // NUEVO
}
```

`resolvedAt` solo es significativo cuando `noteType === 'designer'`. Ausente o `null` = abierta.

`phase2Data` en `designer_performance_projects/{so}` pasa a guardar el desglose con el que se cerró el proyecto, para que el histórico sea auditable:

```js
phase2Data: {
  closedAt: 1753...,          // timestamp de cierre, congela el cálculo
  totalNotes: 3,
  totalPenalty: 53.5,
  breakdown: [ { noteId, urgency, days, penalty }, ... ]
}
```

Los `phase2Data` viejos (`{ totalRedFlags, redFlagsOver4Days }`) se conservan tal cual para lectura del histórico.

## Arquitectura

```
[MyProjectsView]                 [Firebase]                    [Designer Performance]
crear/resolver nota  ──────→  project_notes/{so}  ──────→  KpiContext (onValue)
   (solo ingenieros)                                              │
                                                                  ▼
                                                        redFlags.ts  → penalización por nota
                                                                  │
                                                                  ▼
                                                    Phase2Form (desglose + cerrar)
                                                    ProjectDetailsModal (desglose)
```

`KpiContext` ya tiene el patrón de suscripción `onValue` para `designer_performance_projects`; se agrega una segunda para `project_notes` y se exponen las notas por SO en el contexto. Las claves coinciden: ambos nodos están indexados por número de SO.

## Módulo de cálculo

Archivo nuevo `src/designer-performance/utils/redFlags.ts`, aislado y testeable sin React:

| Función | Responsabilidad |
|---------|-----------------|
| `noteDaysOpen(note, until)` | Días calendario del reloj de la nota, aplicando `RED_FLAG_SCORING_SINCE` |
| `notePenalty(note, until)` | Penalización de una nota, con tasa por urgencia y tope |
| `calculatePhase2FromNotes(notes, until)` | `{ score, totalPenalty, breakdown[] }` sobre las notas designer |

`calculatePhase2Score` en `scoreCalculator.ts` pasa a delegar en este módulo. La firma vieja `(totalRedFlags, redFlagsOver4Days, icp)` se elimina — solo la usaba `Phase2Form`.

## Cambios de UI

### MyProjectsView

- **Botón resolver** en cada nota designer. Escribe `resolvedAt` (o lo limpia, para reabrir). Sigue el mismo patrón de escritura que `handleCycleNoteUrgency`: mutar el array y `set(ref(db, 'project_notes/{so}'), ...)`.
- La nota resuelta se muestra atenuada, con su duración final ("resuelta en 12 días").
- La nota abierta muestra los días que lleva y cuánto está descontando.

### Phase2Form

Se eliminan los dos inputs numéricos. Queda:

```
Phase 2: Project Closure

Red flags del proyecto (desde Notes)

 🔴 "Falta plano de isla"
    Jul 03 → Jul 15  (12d)      −40
 🟡 "Cliente cambió color"
    Jul 10 → Jul 18   (8d)      −12
 🟢 "Medida de zócalo"
    Jul 20 → abierta  (3d)     −1.5
                     ---------------
                     IFR final:  46.5

      [ Cerrar proyecto ]
```

El chip de ICP se saca de este formulario (ya no interviene en el puntaje). Si el proyecto no tiene notas designer, se muestra el estado vacío y el IFR es 100.

### ProjectDetailsModal

El bloque "Friction Metrics" (hoy `totalRedFlags` / `redFlags4Days`) pasa a mostrar el desglose guardado en `phase2Data.breakdown`. Para proyectos cerrados con el formato viejo, se sigue mostrando el par de números anterior.

## Permisos

Crear una nota designer descuenta puntos del KPI de un diseñador, así que se restringe:

| Rol | Crear nota designer |
|-----|---------------------|
| `engineer` | Sí |
| `engineer_nester` | Sí |
| `engineer-admin` (super admin) | Sí |
| `designer` | **No** |
| `administrative` / `admin` | No (ya no podían crear ninguna nota) |

Los roles que no califican no ven la opción `designer` en el ciclo del botón: el ciclo pasa a ser `normal → priority → obs → normal`. La restricción se valida además en `handleAddNote`, no solo escondiendo la UI.

Resolver una nota sigue la misma regla que crearla. Las demás notas (`normal`, `priority`, `obs`) no cambian sus permisos.

## Migración e histórico

**Notas designer creadas antes del release.** No tienen `resolvedAt` y arrastran antigüedad que nadie pudo resolver. Su reloj arranca en la fecha de release, no en su `createdAt` — mismo criterio que ya se aplicó a los ítems nuevos del checklist en Fase 1 (`ITEM_INTRODUCED_AT` en `scoreCalculator.ts`).

```ts
// Fecha en que la feature sale a producción. Las notas anteriores empiezan a
// contar desde acá. Si el deploy se corre a otra fecha, actualizar antes de mergear.
export const RED_FLAG_SCORING_SINCE = new Date(2026, 6, 28).getTime();
```

**Proyectos ya `Completed`.** Conservan su `phase2Score` calculado con la fórmula vieja. **No se recalculan**: esos proyectos no tienen notas designer, así que recalcularlos les daría 100 a todos e inflaría el KPI de todo el mundo.

Consecuencia aceptada: el leaderboard va a mezclar puntajes de fórmula vieja y nueva hasta que rote el histórico.

## Fuera de alcance

- Fase 1 completa (checklist, ICP, `calculatePhase1ScoreAndStatus`).
- `calculateDesignerStats` — sigue promediando `phase2Score` sobre proyectos `Completed`.
- El tipo de nota designer y el semáforo de urgencia (ya existen).
- Notificaciones o recordatorios de notas abiertas.
- Recálculo retroactivo de proyectos cerrados.

## Riesgos

- **Notas abiertas olvidadas.** Una nota que nadie resuelve sigue descontando hasta el cierre. El tope por nota (10/20/40) acota el daño, pero un proyecto con muchas notas viejas puede llegar a 0. Es el comportamiento buscado, pero conviene que Phase2Form las muestre bien visibles antes de cerrar.
- **Escritura concurrente sobre `project_notes/{so}`.** El array completo se reescribe con `set()` tanto al crear, borrar, ciclar urgencia como al resolver. Dos usuarios operando sobre el mismo proyecto a la vez pueden pisarse. Es un problema preexistente del módulo de notas que este cambio hereda y no resuelve; si empieza a doler, la solución es mover a escrituras por clave (`project_notes/{so}/{noteId}`).
- **El diseñador no ve sus red flags.** El rol `designer` no puede crear notas designer y My Projects filtra por ingeniero. Queda pendiente definir si el diseñador debería poder ver (sin editar) las notas que afectan su KPI.
