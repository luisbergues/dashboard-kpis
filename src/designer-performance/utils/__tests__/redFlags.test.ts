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

  it('no propaga NaN si la nota no tiene createdAt', () => {
    const n = note();
    delete (n as Partial<DesignerNote>).createdAt;
    // Sin createdAt el reloj arranca en el release: hasta el 4-ago son 7 días.
    expect(noteDaysOpen(n, ts(2026, 8, 4))).toBe(7);
  });

  it('no propaga NaN si createdAt o resolvedAt son ilegibles', () => {
    expect(noteDaysOpen(note({ createdAt: 'no-es-fecha' }), ts(2026, 8, 4))).toBe(7);
    expect(noteDaysOpen(note({ resolvedAt: 'no-es-fecha' }), ts(2026, 8, 4))).toBe(3);
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

  it('ignora los huecos null que deja Firebase al borrar notas', () => {
    const notes = [
      note({ id: 'a', urgency: 'yellow', createdAt: iso(2026, 8, 1) }),
      null as unknown as DesignerNote,
      note({ id: 'b', urgency: 'green', createdAt: iso(2026, 8, 1) }),
    ];
    const r = calculatePhase2FromNotes(notes, ts(2026, 8, 9));
    expect(r.breakdown.map(l => l.noteId)).toEqual(['a', 'b']);
  });
});
