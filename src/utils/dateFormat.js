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
