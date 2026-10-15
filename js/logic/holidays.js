// Holidays mixed into Home's upcoming list. Pure: tested in Node.
// Fixed ones have a set day; floating ones are "the nth weekday of a month".
import { toYMD, daysUntil } from './dates.js';

// weekday: 0 = Sunday ... 6 = Saturday. `on` = default switch setting.
export const HOLIDAYS = [
  { key: 'valentines', name: "Valentine's Day", m: 2, d: 14, on: true },
  { key: 'mothers', name: "Mother's Day", m: 5, weekday: 0, nth: 2, on: false }, // only if she's a mom
  { key: 'halloween', name: 'Halloween', m: 10, d: 31, on: true },
  { key: 'thanksgiving', name: 'Thanksgiving', m: 11, weekday: 4, nth: 4, on: true },
  { key: 'christmas', name: 'Christmas', m: 12, d: 25, on: true },
  { key: 'nye', name: "New Year's Eve", m: 12, d: 31, on: true },
];

// The nth (1-based) given weekday of month m in year y.
export function nthWeekday(y, m, weekday, n) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const d = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return { y, m, d };
}

export function holidayDate(key, y) {
  const h = HOLIDAYS.find((x) => x.key === key);
  if (!h) return null;
  return h.nth ? nthWeekday(y, h.m, h.weekday, h.nth) : { y, m: h.m, d: h.d };
}

// Saved switches merged over the defaults.
export function holidayPrefs(saved) {
  const out = {};
  for (const h of HOLIDAYS) out[h.key] = saved && typeof saved[h.key] === 'boolean' ? saved[h.key] : h.on;
  return out;
}

// Switched-on holidays as date rows ({holiday, title, date, type:'holiday', days}).
// Each row is the next occurrence (today counts) as a one-time date.
export function upcomingHolidays(today, prefs) {
  const out = [];
  for (const h of HOLIDAYS) {
    if (!prefs[h.key]) continue;
    for (const y of [today.y, today.y + 1]) {
      const item = { id: 'holiday-' + h.key, holiday: h.key, title: h.name, date: toYMD(holidayDate(h.key, y)), type: 'holiday', yearly: false, notes: '' };
      const days = daysUntil(item, today);
      if (days >= 0) { out.push({ ...item, days }); break; }
    }
  }
  return out;
}
