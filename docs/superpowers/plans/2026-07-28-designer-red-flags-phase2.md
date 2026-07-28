# Red Flags de Fase 2 desde Notas Designer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el puntaje IFR de Fase 2 se calcule automáticamente desde las notas `designer` de My Projects, reemplazando los dos inputs manuales.

**Architecture:** Un módulo puro (`redFlags.ts`) calcula la penalización por nota según urgencia y días abierta. `KpiContext` se suscribe a `project_notes` en Firebase y expone las notas al módulo Designer Performance. `Phase2Form` pasa de recibir dos números tipeados a mostrar el desglose y cerrar. Un helper de permisos restringe la creación de notas designer a roles de ingeniería.

**Tech Stack:** React 18 + Vite, TypeScript (módulo designer-performance) / JSX (app principal), Firebase Realtime Database, vitest.

**Spec:** `docs/superpowers/specs/2026-07-28-designer-red-flags-phase2-design.md`

## Global Constraints

- Tasas por día: `green 0.5`, `yellow 1`, `red 2`. Se **duplican** a partir del día 5.
- Topes por nota: `green 10`, `yellow 20`, `red 40`. Los tres equivalen a 12 días abiertos.
- `score = max(0, 100 − Σ penalizaciones)`, redondeado a 1 decimal.
- Días contados en **días calendario** (ambos extremos normalizados a medianoche local).
- `RED_FLAG_SCORING_SINCE = new Date(2026, 6, 28).getTime()` — notas anteriores arrancan su reloj acá.
- La **urgencia actual** se aplica a todo el período. No se trocea el historial.
- Solo `noteType === 'designer'` puntúa. `normal`, `priority`, `obs` no.
- Roles que pueden crear/resolver notas designer: `engineer`, `engineer_nester`, `engineer-admin`.
- El ICP **no interviene** en el puntaje de Fase 2.
- Los proyectos ya `Completed` conservan su `phase2Score` viejo. No se recalculan.
- Tests con vitest: `import { describe, it, expect } from 'vitest'`.
- Los tests de cálculo deben usar timestamps fijos, nunca `Date.now()` real.

---

## File Structure

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/designer-performance/types.ts` | **Modificar.** Tipos `DesignerNote`, `Urgency`, `RedFlagLine`; nuevo shape de `phase2Data`. |
| `src/designer-performance/utils/redFlags.ts` | **Crear.** Cálculo puro: días abiertos, penalización por nota, score total. Sin React. |
| `src/designer-performance/utils/__tests__/redFlags.test.ts` | **Crear.** Tests del módulo de cálculo. |
| `src/utils/notePermissions.js` | **Crear.** Quién puede crear/resolver notas designer. Compartido entre app y módulo. |
| `src/utils/__tests__/notePermissions.test.js` | **Crear.** Tests de permisos. |
| `src/designer-performance/utils/scoreCalculator.ts` | **Modificar.** Eliminar `calculatePhase2Score` vieja. |
| `src/designer-performance/context/KpiContext.tsx` | **Modificar.** Suscripción a `project_notes`, exponer `getProjectNotes(so)`. |
| `src/views/MyProjectsView.jsx` | **Modificar.** Botón resolver, gate de rol en la opción `designer`. |
| `src/views/MyProjectsView.css` | **Modificar.** Estilos de nota resuelta y botón resolver. |
| `src/designer-performance/views/Phase2Form.tsx` | **Modificar.** Sacar inputs, mostrar desglose. |
| `src/designer-performance/components/ProjectDetailsModal.tsx` | **Modificar.** Desglose nuevo, retrocompatible con el viejo. |
| `src/utils/translations.js` | **Modificar.** Claves nuevas de `designerPerf.modal`. |

---

## Task 1: Módulo de cálculo `redFlags.ts`

**Files:**
- Modify: `src/designer-performance/types.ts`
- Create: `src/designer-performance/utils/redFlags.ts`
- Test: `src/designer-performance/utils/__tests__/redFlags.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - `type Urgency = 'green' | 'yellow' | 'red'`
  - `interface DesignerNote { id: string; text: string; noteType: string; urgency?: Urgency; createdAt: string; createdBy?: string; resolvedAt?: string | null }`
  - `interface RedFlagLine { noteId: string; urgency: Urgency; days: number; penalty: number }`
  - `interface Phase2Result { score: number; totalPenalty: number; breakdown: RedFlagLine[] }`
  - `RED_FLAG_SCORING_SINCE: number`
  - `noteDaysOpen(note: DesignerNote, until: number): number`
  - `notePenalty(note: DesignerNote, until: number): number`
  - `calculatePhase2FromNotes(notes: DesignerNote[], until?: number): Phase2Result`

- [ ] **Step 1: Agregar los tipos a `types.ts`**

Agregar al final de `src/designer-performance/types.ts`:

```ts
export type Urgency = 'green' | 'yellow' | 'red';

// Una nota de project_notes/{so}. Solo las de noteType 'designer' puntúan
// en Fase 2; el resto se ignoran.
export interface DesignerNote {
  id: string;
  text: string;
  noteType: string;
  urgency?: Urgency;
  createdAt: string;          // ISO
  createdBy?: string;
  resolvedAt?: string | null; // ISO; ausente o null = abierta
}

export interface RedFlagLine {
  noteId: string;
  urgency: Urgency;
  days: number;
  penalty: number;
}

export interface Phase2Result {
  score: number;
  totalPenalty: number;
  breakdown: RedFlagLine[];
}
```

Y reemplazar el bloque `phase2Data` existente (líneas 33-36) por:

```ts
  // Phase 2 specific data
  phase2Data?: {
    // Formato viejo — proyectos cerrados antes del cambio a notas designer.
    totalRedFlags?: number;
    redFlagsOver4Days?: number;
    // Formato nuevo — desglose congelado al cerrar.
    closedAt?: number;
    totalNotes?: number;
    totalPenalty?: number;
    breakdown?: RedFlagLine[];
  };
```

- [ ] **Step 2: Escribir el test que falla**

Crear `src/designer-performance/utils/__tests__/redFlags.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { noteDaysOpen, notePenalty, calculatePhase2FromNotes, RED_FLAG_SCORING_SINCE } from '../redFlags';
import type { DesignerNote } from '../../types';

// Mediodía local, para que el redondeo a medianoche no dependa de la hora.
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).toISOString();
const ts  = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0).getTime();

const note = (over: Partial<DesignerNote> = {}): DesignerNote => ({
  id: 'n1',
  text: 'falta plano',
  noteType: 'designer',
  urgency: 'green',
  createdAt: iso(2026, 8, 1),
  resolvedAt: null,
  ...over,
});

describe('noteDaysOpen', () => {
  it('cuenta 0 el mismo día', () => {
    expect(noteDaysOpen(note(), ts(2026, 8, 1))).toBe(0);
  });

  it('cuenta días calendario hasta hoy si sigue abierta', () => {
    expect(noteDaysOpen(note(), ts(2026, 8, 4))).toBe(3);
  });

  it('se detiene en resolvedAt si está resuelta', () => {
    const n = note({ resolvedAt: iso(2026, 8, 6) });
    expect(noteDaysOpen(n, ts(2026, 8, 30))).toBe(5);
  });

  it('arranca en RED_FLAG_SCORING_SINCE si la nota es anterior al release', () => {
    // Creada en marzo, pero el reloj arranca el 28-jul. Hasta el 4-ago son 7 días,
    // no los ~147 que habría desde createdAt.
    const n = note({ createdAt: iso(2026, 3, 10) });
    expect(noteDaysOpen(n, ts(2026, 8, 4))).toBe(7);
    expect(RED_FLAG_SCORING_SINCE).toBe(new Date(2026, 6, 28).getTime());
  });

  it('nunca devuelve negativo', () => {
    expect(noteDaysOpen(note(), ts(2026, 7, 1))).toBe(0);
  });
});

describe('notePenalty', () => {
  it('aplica la tasa base los primeros 4 días', () => {
    expect(notePenalty(note({ urgency: 'green'  }), ts(2026, 8, 4))).toBe(1.5); // 3 × 0.5
    expect(notePenalty(note({ urgency: 'yellow' }), ts(2026, 8, 4))).toBe(3);   // 3 × 1
    expect(notePenalty(note({ urgency: 'red'    }), ts(2026, 8, 4))).toBe(6);   // 3 × 2
  });

  it('duplica la tasa a partir del día 5', () => {
    // 8 días: 4 × tasa + 4 × tasa × 2
    expect(notePenalty(note({ urgency: 'green'  }), ts(2026, 8, 9))).toBe(6);
    expect(notePenalty(note({ urgency: 'yellow' }), ts(2026, 8, 9))).toBe(12);
    expect(notePenalty(note({ urgency: 'red'    }), ts(2026, 8, 9))).toBe(24);
  });

  it('topea a los 12 días abiertos', () => {
    expect(notePenalty(note({ urgency: 'green'  }), ts(2026, 8, 13))).toBe(10);
    expect(notePenalty(note({ urgency: 'yellow' }), ts(2026, 8, 13))).toBe(20);
    expect(notePenalty(note({ urgency: 'red'    }), ts(2026, 8, 13))).toBe(40);
  });

  it('no supera el tope por más vieja que sea', () => {
    expect(notePenalty(note({ urgency: 'red' }), ts(2026, 12, 31))).toBe(40);
  });

  it('trata una urgencia ausente como verde', () => {
    const n = note();
    delete n.urgency;
    expect(notePenalty(n, ts(2026, 8, 4))).toBe(1.5);
  });
});

describe('calculatePhase2FromNotes', () => {
  it('da 100 sin notas', () => {
    expect(calculatePhase2FromNotes([], ts(2026, 8, 4)).score).toBe(100);
  });

  it('ignora las notas que no son designer', () => {
    const notes = [
      note({ id: 'a', noteType: 'normal',   urgency: 'red' }),
      note({ id: 'b', noteType: 'priority', urgency: 'red' }),
      note({ id: 'c', noteType: 'obs',      urgency: 'red' }),
    ];
    const r = calculatePhase2FromNotes(notes, ts(2026, 8, 30));
    expect(r.score).toBe(100);
    expect(r.breakdown).toHaveLength(0);
  });

  it('calcula el ejemplo del spec: roja 12d + amarilla 8d + verde 3d = 46.5', () => {
    const notes = [
      note({ id: 'a', urgency: 'red',    createdAt: iso(2026, 8, 1), resolvedAt: iso(2026, 8, 13) }),
      note({ id: 'b', urgency: 'yellow', createdAt: iso(2026, 8, 1), resolvedAt: iso(2026, 8, 9)  }),
      note({ id: 'c', urgency: 'green',  createdAt: iso(2026, 8, 1) }),
    ];
    const r = calculatePhase2FromNotes(notes, ts(2026, 8, 4));
    expect(r.totalPenalty).toBe(53.5);
    expect(r.score).toBe(46.5);
  });

  it('devuelve el desglose por nota', () => {
    const notes = [note({ id: 'x', urgency: 'yellow', createdAt: iso(2026, 8, 1) })];
    const r = calculatePhase2FromNotes(notes, ts(2026, 8, 9));
    expect(r.breakdown).toEqual([{ noteId: 'x', urgency: 'yellow', days: 8, penalty: 12 }]);
  });

  it('nunca baja de 0', () => {
    const notes = Array.from({ length: 10 }, (_, i) =>
      note({ id: `n${i}`, urgency: 'red', createdAt: iso(2026, 8, 1) }));
    expect(calculatePhase2FromNotes(notes, ts(2026, 9, 30)).score).toBe(0);
  });

  it('tolera undefined', () => {
    expect(calculatePhase2FromNotes(undefined as unknown as DesignerNote[], ts(2026, 8, 4)).score).toBe(100);
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `npx vitest run src/designer-performance/utils/__tests__/redFlags.test.ts`
Expected: FAIL — `Failed to resolve import "../redFlags"`

- [ ] **Step 4: Implementar `redFlags.ts`**

Crear `src/designer-performance/utils/redFlags.ts`:

```ts
import type { DesignerNote, Urgency, RedFlagLine, Phase2Result } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Fecha en que la feature sale a producción. Las notas creadas antes empiezan
// a contar desde acá: nadie arrastra antigüedad que no pudo resolver porque el
// botón de resolver no existía. Si el deploy se corre, actualizar antes de mergear.
export const RED_FLAG_SCORING_SINCE = new Date(2026, 6, 28).getTime();

// Puntos por día. Se duplican a partir del día 5.
export const RATE: Record<Urgency, number> = { green: 0.5, yellow: 1, red: 2 };

// Techo por nota — equivale a 12 días abiertos en las tres urgencias, así que
// el semáforo mantiene su jerarquía (una roja siempre pesa 4× una verde).
export const CAP: Record<Urgency, number> = { green: 10, yellow: 20, red: 40 };

const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const urgencyOf = (note: DesignerNote): Urgency =>
  note.urgency && note.urgency in RATE ? note.urgency : 'green';

export const noteDaysOpen = (note: DesignerNote, until: number): number => {
  const created = new Date(note.createdAt).getTime();
  const start = startOfDay(Math.max(created, RED_FLAG_SCORING_SINCE));
  const end = startOfDay(note.resolvedAt ? new Date(note.resolvedAt).getTime() : until);
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
};

export const notePenalty = (note: DesignerNote, until: number): number => {
  const urgency = urgencyOf(note);
  const rate = RATE[urgency];
  const days = noteDaysOpen(note, until);
  const raw = Math.min(days, 4) * rate + Math.max(0, days - 4) * rate * 2;
  return Math.min(CAP[urgency], raw);
};

export const calculatePhase2FromNotes = (
  notes: DesignerNote[],
  until: number = Date.now(),
): Phase2Result => {
  const breakdown: RedFlagLine[] = (notes || [])
    .filter(n => n && n.noteType === 'designer')
    .map(n => ({
      noteId: n.id,
      urgency: urgencyOf(n),
      days: noteDaysOpen(n, until),
      penalty: notePenalty(n, until),
    }));

  const totalPenalty = breakdown.reduce((acc, line) => acc + line.penalty, 0);
  const round1 = (v: number) => Math.round(v * 10) / 10;

  return {
    score: Math.max(0, round1(100 - totalPenalty)),
    totalPenalty: round1(totalPenalty),
    breakdown,
  };
};
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npx vitest run src/designer-performance/utils/__tests__/redFlags.test.ts`
Expected: PASS — 16 tests

- [ ] **Step 6: Commit**

```bash
git add src/designer-performance/types.ts src/designer-performance/utils/redFlags.ts src/designer-performance/utils/__tests__/redFlags.test.ts
git commit -m "feat(designer-perf): modulo de calculo de red flags desde notas designer"
```

---

## Task 2: Permisos de notas designer

**Files:**
- Create: `src/utils/notePermissions.js`
- Test: `src/utils/__tests__/notePermissions.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `canManageDesignerNotes(userProfile: { role?: string } | null | undefined): boolean`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/utils/__tests__/notePermissions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { canManageDesignerNotes } from '../notePermissions';

describe('canManageDesignerNotes', () => {
  it('permite a los roles de ingenieria', () => {
    expect(canManageDesignerNotes({ role: 'engineer' })).toBe(true);
    expect(canManageDesignerNotes({ role: 'engineer_nester' })).toBe(true);
    expect(canManageDesignerNotes({ role: 'engineer-admin' })).toBe(true);
  });

  it('no permite al disenador', () => {
    expect(canManageDesignerNotes({ role: 'designer' })).toBe(false);
  });

  it('no permite a administrative ni admin', () => {
    expect(canManageDesignerNotes({ role: 'administrative' })).toBe(false);
    expect(canManageDesignerNotes({ role: 'admin' })).toBe(false);
  });

  it('no permite sin perfil ni sin rol', () => {
    expect(canManageDesignerNotes(null)).toBe(false);
    expect(canManageDesignerNotes(undefined)).toBe(false);
    expect(canManageDesignerNotes({})).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/utils/__tests__/notePermissions.test.js`
Expected: FAIL — `Failed to resolve import "../notePermissions"`

- [ ] **Step 3: Implementar**

Crear `src/utils/notePermissions.js`:

```js
// Crear una nota designer le descuenta puntos del KPI a un disenador, asi que
// queda restringida a los roles de ingenieria. Resolver una nota sigue la
// misma regla que crearla.
const DESIGNER_NOTE_ROLES = ['engineer', 'engineer_nester', 'engineer-admin'];

export const canManageDesignerNotes = (userProfile) =>
  Boolean(userProfile && DESIGNER_NOTE_ROLES.includes(userProfile.role));
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/utils/__tests__/notePermissions.test.js`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/notePermissions.js src/utils/__tests__/notePermissions.test.js
git commit -m "feat: helper de permisos para notas designer"
```

---

## Task 3: Exponer las notas en `KpiContext`

**Files:**
- Modify: `src/designer-performance/context/KpiContext.tsx`
- Modify: `src/designer-performance/utils/scoreCalculator.ts:76-81`

**Interfaces:**
- Consumes: `DesignerNote` (Task 1).
- Produces: `useKpi().getProjectNotes(soNumber: string): DesignerNote[]`

- [ ] **Step 1: Eliminar la `calculatePhase2Score` vieja**

En `src/designer-performance/utils/scoreCalculator.ts`, borrar el bloque completo:

```ts
export const calculatePhase2Score = (totalRedFlags: number, redFlagsOver4Days: number, icp: number): number => {
  if (icp === 0) return 0; // Avoid division by zero

  let ifr = 100 - ((totalRedFlags / icp) * 40) - (redFlagsOver4Days * 5);
  return Math.max(0, Math.round(ifr * 10) / 10); // Keep 1 decimal place and minimum 0
};
```

No agregar nada en su lugar — `calculatePhase2FromNotes` de `redFlags.ts` la reemplaza y los consumidores se actualizan en la Task 5.

- [ ] **Step 2: Agregar la suscripción a `project_notes`**

En `src/designer-performance/context/KpiContext.tsx`:

Cambiar el import de tipos (línea 3) a:

```tsx
import type { Project, Designer, DesignerNote } from '../types';
```

Agregar `getProjectNotes` a la interfaz `KpiContextType` (después de `getProjectComplexity`):

```tsx
  getProjectNotes: (soNumber: string) => DesignerNote[];
```

Agregar el estado junto a los otros `useState` del provider:

```tsx
  const [projectNotes, setProjectNotes] = useState<Record<string, DesignerNote[]>>({});
```

Agregar el efecto justo después del efecto que lee `designer_performance_projects`:

```tsx
  // 2b. Notas de proyecto — las de noteType 'designer' son los red flags de Fase 2
  useEffect(() => {
    if (!db) return;
    const notesRef = ref(db, 'project_notes');
    const unsub = onValue(notesRef, (snapshot) => {
      setProjectNotes(snapshot.val() || {});
    });
    return () => unsub();
  }, []);
```

Agregar el helper junto a `getProjectComplexity`:

```tsx
  const getProjectNotes = (soNumber: string): DesignerNote[] => projectNotes[soNumber] || [];
```

Agregarlo al `value` del provider:

```tsx
    <KpiContext.Provider value={{ projects, designers, designerNames, projectDesigners, addProject, updateProject, getProjectComplexity, getProjectNotes }}>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: FAIL — `Phase2Form.tsx` sigue importando `calculatePhase2Score`, que ya no existe. Eso se arregla en la Task 5; este build confirma que el único consumidor roto es ese.

- [ ] **Step 4: Commit**

```bash
git add src/designer-performance/context/KpiContext.tsx src/designer-performance/utils/scoreCalculator.ts
git commit -m "feat(designer-perf): exponer project_notes en KpiContext"
```

---

## Task 4: Botón resolver y gate de rol en My Projects

**Files:**
- Modify: `src/views/MyProjectsView.jsx`
- Modify: `src/views/MyProjectsView.css`

**Interfaces:**
- Consumes: `canManageDesignerNotes` (Task 2); `noteDaysOpen`, `notePenalty` (Task 1).
- Produces: notas con `resolvedAt` en `project_notes/{so}`.

- [ ] **Step 1: Importar el helper de permisos**

En `src/views/MyProjectsView.jsx`, agregar junto a los demás imports de utils:

```jsx
import { canManageDesignerNotes } from '../utils/notePermissions';
```

- [ ] **Step 2: Calcular el permiso**

Junto a la definición de `isAdmin` (línea ~233):

```jsx
  const canDesignerNote = canManageDesignerNotes(userProfile);
```

- [ ] **Step 3: Sacar `designer` del ciclo para quien no puede**

En el botón que cicla el tipo de nota (línea ~1663), reemplazar el cálculo de `nextType`:

```jsx
                                  const nextType = currentType === 'normal' ? 'priority'
                                    : currentType === 'priority' ? 'obs'
                                    : currentType === 'obs' ? (canDesignerNote ? 'designer' : 'normal')
                                    : 'normal';
```

- [ ] **Step 4: Validar el permiso en `handleAddNote`**

En `handleAddNote`, justo después del guard de rol administrative/admin existente:

```jsx
    if (noteInputs[so]?.noteType === 'designer' && !canManageDesignerNotes(userProfile)) {
      return;
    }
```

- [ ] **Step 5: Agregar `handleResolveNote`**

Después de `handleCycleNoteUrgency`:

```jsx
  // Marca/desmarca una nota designer como resuelta. El reloj de penalizacion
  // de Fase 2 se detiene en resolvedAt.
  const handleResolveNote = async (so, noteId) => {
    if (!canManageDesignerNotes(userProfile)) return;
    const currentNotes = projectNotes[so] ? [...projectNotes[so]] : [];
    const idx = currentNotes.findIndex(n => n.id === noteId);
    if (idx === -1) return;
    const isResolved = Boolean(currentNotes[idx].resolvedAt);
    currentNotes[idx] = {
      ...currentNotes[idx],
      resolvedAt: isResolved ? null : new Date().toISOString(),
    };

    if (db && currentUser) {
      try {
        await set(ref(db, `project_notes/${so}`), currentNotes);
      } catch (err) {
        console.error('Failed to update note resolution in Firebase:', err);
      }
    } else {
      localStorage.setItem(`project_notes_${so}`, JSON.stringify(currentNotes));
      setProjectNotes(prev => ({ ...prev, [so]: currentNotes }));
    }
  };
```

- [ ] **Step 6: Agregar el botón resolver en la nota**

En el bloque `note-item-header-right` (línea ~1774), justo después del botón de urgencia y antes del de borrar:

```jsx
                                  {(note.noteType || (note.priority ? 'priority' : 'normal')) === 'designer' && canDesignerNote && (
                                    <button
                                      type="button"
                                      className={`note-resolve-btn ${note.resolvedAt ? 'is-resolved' : ''}`}
                                      onClick={() => handleResolveNote(project.so, note.id)}
                                      title={note.resolvedAt
                                        ? (language === 'es' ? 'Reabrir red flag' : 'Reopen red flag')
                                        : (language === 'es' ? 'Marcar como resuelta' : 'Mark as resolved')}
                                    >
                                      <Check size={13} />
                                      {note.resolvedAt
                                        ? (language === 'es' ? 'Resuelta' : 'Resolved')
                                        : (language === 'es' ? 'Resolver' : 'Resolve')}
                                    </button>
                                  )}
```

`Check` ya está importado de `lucide-react` en este archivo (se usa en el stepper de etapas, línea ~1486). Verificarlo antes de agregar el import.

- [ ] **Step 7: Marcar visualmente la nota resuelta**

En el `div` de la nota (línea ~1751), agregar la clase condicional:

```jsx
                            <div key={note.id} className={`note-item ${note.resolvedAt ? 'note-resolved' : ''}`}>
```

- [ ] **Step 8: Mostrar días abiertos y penalización en la nota**

El spec pide que la nota designer muestre cuánto lleva y cuánto está descontando. Importar el cálculo en `MyProjectsView.jsx`, junto al import de `notePermissions`:

```jsx
import { noteDaysOpen, notePenalty } from '../designer-performance/utils/redFlags';
```

Y agregar la línea informativa justo después de `<div className="note-item-text">{note.text}</div>` (línea ~1802):

```jsx
                              {(note.noteType || (note.priority ? 'priority' : 'normal')) === 'designer' && (() => {
                                const dias = noteDaysOpen(note, Date.now());
                                const pts  = notePenalty(note, Date.now());
                                return (
                                  <div className="note-redflag-meta">
                                    {note.resolvedAt
                                      ? (language === 'es' ? `Resuelta en ${dias} días` : `Resolved in ${dias} days`)
                                      : (language === 'es' ? `${dias} días abierta` : `${dias} days open`)}
                                    <span className="note-redflag-penalty">&minus;{pts}</span>
                                  </div>
                                );
                              })()}
```

`redFlags.ts` es un módulo puro sin dependencias de React ni de Firebase, así que importarlo desde la app principal no arrastra nada del módulo designer-performance.

- [ ] **Step 9: Agregar los estilos**

Al final de `src/views/MyProjectsView.css`:

```css
/* ── Red flags: resolucion de notas designer ─────────────────────── */
.note-resolve-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.note-resolve-btn:hover {
  background: rgba(16, 185, 129, 0.22);
}

.note-resolve-btn.is-resolved {
  border-color: rgba(148, 163, 184, 0.35);
  background: rgba(148, 163, 184, 0.12);
  color: #94a3b8;
}

.note-item.note-resolved {
  opacity: 0.6;
}

.note-item.note-resolved .note-item-text {
  text-decoration: line-through;
}

.note-redflag-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  font-size: 0.72rem;
  color: var(--text-secondary, #94a3b8);
}

.note-redflag-penalty {
  font-weight: 700;
  color: #ef4444;
}
```

- [ ] **Step 10: Verificar build y tests**

Run: `npm run build && npm test`
Expected: build FAIL todavía (Task 5 pendiente), tests PASS. Si el build falla por algo que **no** sea `calculatePhase2Score` en `Phase2Form.tsx`, corregirlo antes de commitear.

- [ ] **Step 11: Commit**

```bash
git add src/views/MyProjectsView.jsx src/views/MyProjectsView.css
git commit -m "feat(notes): boton resolver y restriccion por rol en notas designer"
```

---

## Task 5: `Phase2Form` automático

**Files:**
- Modify: `src/designer-performance/views/Phase2Form.tsx`

**Interfaces:**
- Consumes: `calculatePhase2FromNotes` (Task 1), `getProjectNotes` (Task 3).
- Produces: proyectos cerrados con `phase2Data` en formato nuevo.

- [ ] **Step 1: Reemplazar imports y lógica del componente**

En `src/designer-performance/views/Phase2Form.tsx`, cambiar el import (línea 3):

```tsx
import { calculatePhase2FromNotes } from '../utils/redFlags';
```

Reemplazar el cuerpo del componente desde `export const Phase2Form` hasta el cierre de `handleSubmit` por:

```tsx
export const Phase2Form: React.FC = () => {
  const { projects, updateProject, getProjectNotes } = useKpi();

  const [selectedProjectId, setSelectedProjectId] = useState('');

  const approvedProjects = projects.filter(p => p.status === 'Approved');
  const selectedProject  = projects.find(p => p.id === selectedProjectId);

  // Las notas designer del proyecto son los red flags. El reloj de las que
  // sigan abiertas corre hasta hoy, asi que el preview sube solo.
  const notes = selectedProject ? getProjectNotes(selectedProject.id) : [];
  const result = useMemo(
    () => calculatePhase2FromNotes(notes, Date.now()),
    [notes],
  );

  const noteById = (id: string) => notes.find(n => n.id === id);

  const scoreColor = result.score >= 80 ? T.green
    : result.score >= 60 ? T.yellow
    : T.red;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) { toast.error('Please select an approved project.'); return; }

    const closedAt = Date.now();
    // Se recalcula con el timestamp de cierre para congelar el valor: las notas
    // abiertas dejan de acumular en este instante.
    const finalResult = calculatePhase2FromNotes(notes, closedAt);

    const updateResult = await updateProject({
      ...selectedProject,
      status: 'Completed',
      phase2Score: finalResult.score,
      phase2Data: {
        closedAt,
        totalNotes: finalResult.breakdown.length,
        totalPenalty: finalResult.totalPenalty,
        breakdown: finalResult.breakdown,
      },
    });
    if (updateResult.conflict) {
      toast.error(`Designer was just changed to "${updateResult.currentDesignerName}" by someone else. Reload and try again.`);
      return;
    }
    toast.success(`Project Closed! IFR Score: ${finalResult.score}`);
    setSelectedProjectId('');
  };
```

- [ ] **Step 2: Reemplazar la tarjeta de métricas y el bloque de fricción**

Borrar el `MetricChip` de ICP del bloque de métricas del proyecto (el ICP ya no interviene). El bloque queda:

```tsx
          {selectedProject && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <MetricChip icon={<Layers size={16} color={T.blue} />} label="Total Rooms" value={selectedProject.totalRooms} color={T.blue} />
              <MetricChip icon={<User size={16} color={T.green} />}  label="Designer"    value={selectedProject.designerName} color={T.green} />
            </div>
          )}
```

Reemplazar todo el `<Card>` de "Friction Metrics" por:

```tsx
        {selectedProject && (
          <Card>
            <SectionTitle
              icon={<Flag size={15} color={T.red} />}
              title="Red Flags"
              subtitle="Notas de tipo Designer cargadas en My Projects. Verde −0.5/día, amarillo −1, rojo −2; se duplica a partir del día 5, con tope por nota."
            />

            {result.breakdown.length === 0 ? (
              <div style={{
                padding: '12px 16px', borderRadius: T.radiusMd,
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                color: T.green, fontSize: '0.82rem',
              }}>
                Sin red flags para este proyecto. IFR = 100.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.breakdown.map(line => {
                  const note = noteById(line.noteId);
                  const dot = line.urgency === 'red' ? T.red : line.urgency === 'yellow' ? T.yellow : T.green;
                  return (
                    <div key={line.noteId} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      padding: '10px 14px', borderRadius: T.radiusMd,
                      background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: T.textPrimary, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note?.text || '(sin texto)'}
                          </div>
                          <div style={{ color: T.textMuted, fontSize: '0.72rem' }}>
                            {line.days} {line.days === 1 ? 'día' : 'días'} · {note?.resolvedAt ? 'resuelta' : 'abierta'}
                          </div>
                        </div>
                      </div>
                      <span style={{ color: T.red, fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                        −{line.penalty}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: T.radiusMd,
              background: T.bgSurface, border: `1px solid ${T.cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div style={{ color: T.textMuted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Penalización total
                </div>
                <code style={{ color: T.textSecondary, fontSize: '0.78rem' }}>
                  100 − {result.totalPenalty}
                </code>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: T.textMuted, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  IFR
                </div>
                <div style={{
                  fontSize: '1.6rem', fontWeight: 800, color: scoreColor,
                  textShadow: `0 0 20px ${scoreColor}60`, transition: 'color 0.3s',
                }}>
                  {result.score}
                </div>
              </div>
            </div>
          </Card>
        )}
```

- [ ] **Step 3: Limpiar imports muertos**

`BarChart2` ya no se usa (era el ícono del ICP). Sacarlo del import de `lucide-react` en la línea 5.

- [ ] **Step 4: Verificar build y tests**

Run: `npm run build && npm test`
Expected: build PASS, tests PASS. Si TypeScript se queja de `notes` cambiando de identidad en cada render (el `useMemo` depende de un array nuevo), no es un error de tipos sino de performance; se resuelve en el paso siguiente.

- [ ] **Step 5: Estabilizar la dependencia del `useMemo`**

`getProjectNotes` devuelve un array nuevo en cada render, así que el `useMemo` no memoiza nada. Cambiar la dependencia a algo estable:

```tsx
  const notes = selectedProject ? getProjectNotes(selectedProject.id) : [];
  const notesKey = notes.map(n => `${n.id}:${n.urgency || 'green'}:${n.resolvedAt || ''}`).join('|');
  const result = useMemo(
    () => calculatePhase2FromNotes(notes, Date.now()),
    // notesKey captura lo unico que afecta el calculo; `notes` cambia de
    // identidad en cada render y volveria a calcular siempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notesKey],
  );
```

- [ ] **Step 6: Verificar de nuevo**

Run: `npm run build && npm test && npx eslint src/designer-performance/views/Phase2Form.tsx`
Expected: los tres PASS.

- [ ] **Step 7: Commit**

```bash
git add src/designer-performance/views/Phase2Form.tsx
git commit -m "feat(designer-perf): Phase2Form calcula el IFR desde las notas designer"
```

---

## Task 6: Desglose en `ProjectDetailsModal`

**Files:**
- Modify: `src/designer-performance/components/ProjectDetailsModal.tsx:254-268`
- Modify: `src/utils/translations.js`

**Interfaces:**
- Consumes: `phase2Data.breakdown` (Task 5).
- Produces: nada.

- [ ] **Step 1: Agregar las claves de traducción**

En `src/utils/translations.js`, dentro del bloque `designerPerf.modal` **en inglés** (después de `drawingsSigned`):

```js
        redFlagsBreakdown: "Red Flags",
        redFlagOpen: "open",
        redFlagResolved: "resolved",
        redFlagDays: "days",
        totalPenalty: "Total penalty",
```

Y el equivalente **en español**:

```js
        redFlagsBreakdown: "Red Flags",
        redFlagOpen: "abierta",
        redFlagResolved: "resuelta",
        redFlagDays: "días",
        totalPenalty: "Penalización total",
```

- [ ] **Step 2: Reemplazar el bloque de Friction Metrics**

Reemplazar el bloque completo `{project.phase2Data && ( ... )}` (líneas 254-268) por:

```tsx
              {project.phase2Data?.breakdown && project.phase2Data.breakdown.length > 0 && (
                <div>
                  <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('designerPerf.modal.redFlagsBreakdown')}</h3>
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
                    {project.phase2Data.breakdown.map(line => {
                      const dot = line.urgency === 'red' ? T.red : line.urgency === 'yellow' ? T.yellow : T.green;
                      return (
                        <div key={line.noteId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.textSecondary, fontSize: '0.85rem' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: dot }} />
                            {line.days} {t('designerPerf.modal.redFlagDays')}
                          </span>
                          <span style={{ color: T.red, fontWeight: 600 }}>−{line.penalty}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem', fontWeight: 600 }}>{t('designerPerf.modal.totalPenalty')}</span>
                      <span style={{ color: T.red, fontWeight: 700 }}>−{project.phase2Data.totalPenalty}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Formato viejo — proyectos cerrados antes del cambio a notas designer */}
              {project.phase2Data && !project.phase2Data.breakdown && project.phase2Data.totalRedFlags !== undefined && (
                <div>
                  <h3 style={{ color: T.textPrimary, fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>{t('designerPerf.modal.frictionMetrics')}</h3>
                  <div style={{ background: T.bgSurface, border: `1px solid ${T.cardBorder}`, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.cardBorder}` }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem' }}>{t('designerPerf.modal.totalRedFlags')}</span>
                      <span style={{ color: T.red, fontWeight: 600 }}>{project.phase2Data.totalRedFlags}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                      <span style={{ color: T.textSecondary, fontSize: '0.85rem' }}>{t('designerPerf.modal.redFlags4Days')}</span>
                      <span style={{ color: T.red, fontWeight: 600 }}>{project.phase2Data.redFlagsOver4Days}</span>
                    </div>
                  </div>
                </div>
              )}
```

- [ ] **Step 3: Verificar build, tests y lint**

Run: `npm run build && npm test && npm run lint`
Expected: los tres PASS.

- [ ] **Step 4: Commit**

```bash
git add src/designer-performance/components/ProjectDetailsModal.tsx src/utils/translations.js
git commit -m "feat(designer-perf): desglose de red flags en el detalle de proyecto"
```

---

## Verificación final

- [ ] **Correr todo**

```bash
npm run build && npm test && npm run lint
```

Los tres deben pasar. El suite arranca de 254 tests; con los 16 de la Task 1 y los 4 de la Task 2 debe quedar en 274.

- [ ] **Prueba manual en dev**

```bash
npm run dev
```

1. En **My Projects**, con un usuario `engineer`: crear una nota, ciclar el tipo hasta **Designer**, elegir urgencia, guardarla. Debe aparecer con el semáforo, el botón **Resolver** y la línea "0 días abierta · −0".
2. Con un usuario `designer`: el ciclo del botón debe saltar de **Obs** a **Normal**, sin pasar por Designer.
3. Resolver la nota: se atenúa, se tacha el texto y la línea pasa a "Resuelta en N días".
4. En **Designer Perf. → Phase 2**: seleccionar el proyecto (debe estar en `Approved`). Se ve el desglose con la penalización de cada nota y el IFR.
5. Cerrar el proyecto y abrir su detalle: debe mostrar el desglose congelado.
6. Abrir un proyecto cerrado **antes** de este cambio: debe seguir mostrando el bloque viejo de Total Red Flags / Red Flags > 4 Days.
