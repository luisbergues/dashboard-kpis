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
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
};
