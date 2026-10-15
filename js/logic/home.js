// Home helpers: latest logged entry, and the rotating "Suggested ideas".
// Pure: tested in Node.
import { parseYMD, toYMD } from './dates.js';

// Placeholder list (cheap, thoughtful gestures) until the date planner slice.
export const IDEAS = [
  'Leave a note where she\'ll find it in the morning.',
  'Bring her favorite drink, no reason.',
  'Plan a sunset walk and bring a snack.',
  'Make dinner tonight and do the dishes.',
  'Send a photo of a favorite memory together.',
  'Ask about her day and just listen.',
  'Recreate your first date, cheaply.',
  'Pick up her favorite flower.',
  'Make a playlist of songs that remind you of her.',
  'Take care of a chore she\'s been dreading.',
  'Plan a picnic in the park.',
  'Write down three things you love about her.',
  'Have a movie night with her pick and her snacks.',
  'Go stargazing with a blanket and cocoa.',
];

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

// Changes once a day; `offset` lets a tap show the next one.
export function ideaFor(today, offset = 0) {
  const dayNum = Math.round(Date.UTC(today.y, today.m - 1, today.d) / 86400000);
  const n = IDEAS.length;
  return IDEAS[(((dayNum + offset) % n) + n) % n];
}
