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
