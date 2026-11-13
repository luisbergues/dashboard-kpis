// Datos de los graficos de Team Stats. Salen SOLO de las tablas "WEEKLY KPI"
// de la hoja (mes anterior y mes actual — ver parseWeeklyKpiTable en
// sheetParser.js). Antes los graficos salian del bloque "% of Total" y de un
// snapshot propio en weekly_engineer_kpi que se congelaba el primer dia de
// cada semana; ese nodo ya no se escribe.

import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

// "November 2026" -> "Nov" / "nov".
export function shortMonth(month, language = 'en') {
  const d = new Date(`${month} 1`);
  if (isNaN(d.getTime())) return String(month || '').slice(0, 3);
  return format(d, 'MMM', { locale: language === 'es' ? es : enUS });
}

// Ingenieros en el orden en que aparecen en la hoja, sin repetir.
function engineersOf(...tables) {
  return [...new Set(tables.flatMap(t => (t?.rows || []).map(r => r.engineer)))];
}

// Cuantas semanas de la tabla mostrar: se recortan las ultimas mientras esten
// en cero para todos. En el mes actual son las semanas que todavia no pasaron;
// en un mes de 4 semanas, la "Week 5" vacia.
function visibleWeekCount(table) {
  let count = table?.weeks?.length || 0;
  while (count > 0 && table.rows.every(r => (r.weeks[count - 1] || 0) === 0)) count--;
  return count;
}

/**
 * Linea de tiempo semana por semana: las semanas del mes anterior seguidas de
 * las del actual. Una serie por ingeniero (para apilar).
 *
 * @returns {{ labels: string[], series: Array<{ engineer: string, data: number[] }> } | null}
 */
export function weeklyTimeline(previous, current, language = 'en') {
  const months = [previous, current].filter(Boolean);
  if (months.length === 0) return null;

  const labels = [];
  const columns = []; // { table, weekIndex }
  months.forEach(table => {
    const prefix = shortMonth(table.month, language);
    for (let w = 0; w < visibleWeekCount(table); w++) {
      labels.push(`${prefix} W${w + 1}`);
      columns.push({ table, weekIndex: w });
    }
  });
  if (labels.length === 0) return null;

  const series = engineersOf(...months).map(engineer => ({
    engineer,
    data: columns.map(({ table, weekIndex }) => {
      const row = table.rows.find(r => r.engineer === engineer);
      // No puede haber puntos negativos en una semana: un valor negativo en la
      // hoja (Luis, Oct W4: -50,026.22) es un error de carga, y se grafica en
      // positivo a pedido del usuario. Solo en este grafico — Month Total
      // sigue mostrando lo que dice la hoja.
      return row ? Math.abs(row.weeks[weekIndex] || 0) : 0;
    }),
  }));

  return { labels, series };
}

/**
 * Month Total de cada ingeniero, mes anterior contra mes actual.
 *
 * @returns {{ engineers: string[], months: Array<{ month: string, data: number[] }> } | null}
 */
export function monthTotals(previous, current) {
  const months = [previous, current].filter(Boolean);
  if (months.length === 0) return null;

  const engineers = engineersOf(...months);
  return {
    engineers,
    months: months.map(table => ({
      month: table.month,
      data: engineers.map(name => table.rows.find(r => r.engineer === name)?.monthTotal ?? 0),
    })),
  };
}
