// Single display format for dates app-wide. Sources are heterogeneous:
// sheet cells ('7/30/2026'), RTDB notes ('2026-07-27'), Date objects and
// epoch-ms timestamps. Unparseable input falls back to the original text so
// a weird cell never crashes a view (see calendarNoteDate.test.js history).
import { format, parse, isValid } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

const toDate = (raw) => {
  if (raw instanceof Date) return isValid(raw) ? raw : null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isValid(d) ? d : null;
  }
  const str = String(raw ?? '').trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = parse(str, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : null;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const d = parse(str, 'M/d/yyyy', new Date());
    return isValid(d) ? d : null;
  }
  return null;
};

export const formatDisplayDate = (raw, language = 'en') => {
  const d = toDate(raw);
  if (!d) return String(raw ?? '');
  return format(d, 'MMM dd, yyyy', { locale: language === 'es' ? es : enUS });
};

// Parses a project install date into a local-midnight Date. Sheet install
// values are day-granular strings like "2026-06-12"; `new Date("2026-06-12")`
// parses as midnight UTC, which in negative-offset timezones (all of the
// Americas) lands on the previous local day — so a later `setHours(0,0,0,0)`,
// which truncates in LOCAL time, silently rewinds the date by one day and
// drops an install scheduled for today. Split the YYYY-MM-DD ourselves and
// build a local Date so day comparisons are timezone-stable. Falls back to
// Date parsing for other formats. Returns null when unparseable.
export function parseInstallDateLocal(install) {
  const iso = String(install).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const d = new Date(install);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
