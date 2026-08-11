const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Penalties are counted in whole calendar days, so a document checked at 09:00
// the same day the project was registered at 14:00 is day 0, not "-1".
export const startOfDay = (ts: number): number => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Business days elapsed after `from`, up to and including `to`. Weekends don't
// count: a document requested Friday and delivered Monday is 1 day late, not 3
// — nobody is working Saturday, so it isn't the designer's delay.
// Full weeks are taken in one step (5 business days each) so the loop never
// runs more than 6 times, however old the project is.
//
// Vive en su propio modulo porque lo usan tanto el puntaje del checklist
// (scoreCalculator) como el vencimiento de plazos (phase1Outcome), y ese
// segundo tambien necesita el puntaje: tenerlo aca corta el import circular.
const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6;

export const businessDaysBetween = (from: number, to: number): number => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end <= start) return 0;

  const totalDays = Math.round((end - start) / MS_PER_DAY);
  const fullWeeks = Math.floor(totalDays / 7);
  let count = fullWeeks * 5;

  // setDate (en vez de sumar milisegundos) mantiene la cuenta correcta a través
  // de cambios de horario de verano y de fin de mes.
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + fullWeeks * 7);
  for (let i = 0; i < totalDays - fullWeeks * 7; i++) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) count++;
  }
  return count;
};

/**
 * Atraso de un documento que YA fue entregado, con la excepción de fin de
 * semana encima de la regla base.
 *
 * La regla base no cobra sábado ni domingo porque no son tiempo de trabajo
 * perdido. Pero si el diseñador sube el archivo *un día inhábil*, ese día sí
 * cuenta: significa que el día hábil se perdió igual. Sábado suma 1; domingo
 * suma 2, porque para llegar al domingo pasó también el sábado.
 *
 * El recargo aplica sólo al día de ENTREGA, no a los fines de semana que hayan
 * pasado en el medio: un documento entregado el lunes sigue costando 1 día
 * desde el viernes, como siempre.
 *
 * Consecuencia deliberada de la regla pedida: entregar el domingo (2) cuesta
 * más que entregar el lunes (1).
 *
 * Se usa solo para entregas reales. Un ítem todavía sin marcar se mide con
 * `businessDaysBetween` contra hoy — no hubo subida, así que no hay recargo.
 */
export const deliveryDaysLate = (from: number, to: number): number => {
  const start = startOfDay(from);
  const cursor = new Date(startOfDay(to));

  // Como mucho dos vueltas (domingo y sábado). La condición `> start` evita
  // cobrar un fin de semana que sea anterior o igual al inicio del reloj.
  let weekendSurcharge = 0;
  while (isWeekend(cursor) && cursor.getTime() > start) {
    weekendSurcharge++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return businessDaysBetween(from, to) + weekendSurcharge;
};
