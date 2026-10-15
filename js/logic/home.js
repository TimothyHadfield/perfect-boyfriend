// Home helpers: latest logged entry, and anniversary milestones for Coming up.
// Pure: tested in Node. (The rotating suggestion lives in suggest.js + nudges.js.)
import { parseYMD, toYMD } from './dates.js';

const dayNum = ({ y, m, d }) => Math.round(Date.UTC(y, m - 1, d) / 86400000);
function fromDayNum(n) {
  const t = new Date(n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function entryDay(e) {
  if (!e) return null;
  const p = parseYMD(e.date);
  if (p) return toYMD(p);
  const c = e.createdAt;
  const t = c && (typeof c.toDate === 'function' ? c.toDate() : typeof c.seconds === 'number' ? new Date(c.seconds * 1000) : null);
  return t ? toYMD({ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }) : null;
}

// Most recent entry dated today or earlier (future plans don't count), or null.
export function latestEntry(list, today) {
  const cutoff = toYMD(today);
  let best = null, bestDay = '';
  for (const e of list || []) {
    const day = entryDay(e);
    if (day && day <= cutoff && day > bestDay) { best = e; bestDay = day; }
  }
  return best ? { ...best, day: bestDay } : null;
}

// Whole days from the latest logged entry to today, or null when nothing is logged.
export function daysSinceLatest(list, today) {
  const e = latestEntry(list, today);
  return e ? dayNum(today) - dayNum(parseYMD(e.day)) : null;
}

export const MILESTONE_DAYS = [100, 200, 365, 500, 1000];

// Day-count milestones (N days after each anniversary date) still to come, in the same
// shape as upcoming() rows so Coming up can show them. The yearly anniversary row already
// covers "1 year", so 365 is left out when that anniversary repeats yearly.
export function milestones(dates, today) {
  const t = dayNum(today);
  const out = [];
  for (const a of dates || []) {
    if (!a || a.type !== 'anniversary') continue;
    const p = parseYMD(a.date);
    if (!p) continue;
    for (const n of MILESTONE_DAYS) {
      if (n === 365 && a.yearly) continue;
      const day = dayNum(p) + n;
      if (day < t) continue;
      out.push({
        id: a.id, milestone: n, title: `${n} days together`, type: 'anniversary', yearly: false,
        date: toYMD(fromDayNum(day)), next: fromDayNum(day), days: day - t,
      });
    }
  }
  return out.sort((x, y) => x.days - y.days);
}
