import type { DesignerNote, Urgency, RedFlagLine, Phase2Result } from '../types';
import { businessDaysBetween } from './businessDays';

// Fecha en que la feature sale a producción. Las notas creadas antes empiezan
// a contar desde acá: nadie arrastra antigüedad que no pudo resolver porque el
// botón de resolver no existía. Si el deploy se corre, actualizar antes de mergear.
export const RED_FLAG_SCORING_SINCE = new Date(2026, 6, 28).getTime();

// Puntos por día. Se duplican a partir del día 5.
export const RATE: Record<Urgency, number> = { green: 0.5, yellow: 1, red: 2 };

// Techo por nota — equivale a 12 días hábiles abiertos en las tres urgencias,
// así que el semáforo mantiene su jerarquía (una roja siempre pesa 4× una verde).
export const CAP: Record<Urgency, number> = { green: 10, yellow: 20, red: 40 };

const urgencyOf = (note: DesignerNote): Urgency =>
  note.urgency && note.urgency in RATE ? note.urgency : 'green';

// Notas viejas pueden no tener createdAt (o tenerlo corrupto). Sin este guard
// el calculo propaga NaN hasta la UI ("NaN días abierta").
const parseDate = (value: string | null | undefined, fallback: number): number => {
  if (!value) return fallback;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? fallback : ms;
};

// Días HÁBILES abierta. Antes se contaban días corridos, lo que hacía que una
// nota abierta durante un fin de semana costara más que un documento del
// checklist entregado ese mismo fin de semana. Ahora las dos fases usan el
// mismo calendario: nadie trabaja sábado, así que ese día no es demora de nadie.
export const noteDaysOpen = (note: DesignerNote, until: number): number => {
  const created = parseDate(note.createdAt, RED_FLAG_SCORING_SINCE);
  const start = Math.max(created, RED_FLAG_SCORING_SINCE);
  const end = note.resolvedAt ? parseDate(note.resolvedAt, until) : until;
  return businessDaysBetween(start, end);
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
