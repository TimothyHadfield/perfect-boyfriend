// Pure date math for important dates. No DOM, no Firebase: tested in Node.
// Dates are plain {y, m, d} (m is 1-12). Day counts use UTC day numbers so a
// daylight-saving change can never make a count off by one.

export function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y, m) {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// 'YYYY-MM-DD' -> {y, m, d}, or null if it isn't a real calendar date.
export function parseYMD(s) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!match) return null;
  const y = +match[1], m = +match[2], d = +match[3];
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function toYMD({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Today in the device's local time zone.
export function todayLocal(now = new Date()) {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

function dayNumber({ y, m, d }) {
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// The yearly date as it falls in year y. Feb 29 falls on Feb 28 in a
// non-leap year (the same rule the .ics file uses: last day of February).
function inYear(p, y) {
  return { y, m: p.m, d: Math.min(p.d, daysInMonth(y, p.m)) };
}

// Next time this date happens, counting today. One-time dates are just the date.
export function nextOccurrence(item, today) {
  const p = parseYMD(item && item.date);
  if (!p) return null;
  if (!item.yearly) return p;
  const thisYear = inYear(p, today.y);
  return dayNumber(thisYear) >= dayNumber(today) ? thisYear : inYear(p, today.y + 1);
}

// Whole days from today to the next occurrence (0 = today, negative = a
// one-time date that has passed), or null for a bad date.
export function daysUntil(item, today) {
  const n = nextOccurrence(item, today);
  return n ? dayNumber(n) - dayNumber(today) : null;
}

// Dates still to come, soonest first, each with .days and .next added.
export function upcoming(list, today) {
  return (list || [])
    .map((x) => ({ ...x, days: daysUntil(x, today), next: nextOccurrence(x, today) }))
    .filter((x) => x.days !== null && x.days >= 0)
    .sort((a, b) => a.days - b.days || String(a.title || '').localeCompare(String(b.title || '')));
}

// Everything, for the Dates list: upcoming first, then passed one-time dates
// (most recent first), then rows with a bad date.
export function allSorted(list, today) {
  const withDays = (list || []).map((x) => ({ ...x, days: daysUntil(x, today), next: nextOccurrence(x, today) }));
  const up = withDays.filter((x) => x.days !== null && x.days >= 0)
    .sort((a, b) => a.days - b.days || String(a.title || '').localeCompare(String(b.title || '')));
  const past = withDays.filter((x) => x.days !== null && x.days < 0).sort((a, b) => b.days - a.days);
  const bad = withDays.filter((x) => x.days === null);
  return [...up, ...past, ...bad];
}

export function countdownLabel(days) {
  if (days === null || days === undefined) return '';
  if (days < 0) return 'passed';
  if (days === 0) return 'today!';
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Oct 20" (yearly) or "Oct 20, 2026" (one-time).
export function shortDate(p, withYear) {
  if (!p) return '';
  return `${MONTHS[p.m - 1]} ${p.d}${withYear ? ', ' + p.y : ''}`;
}
