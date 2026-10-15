// Gifts: ideas, given history, recurring reminders. Pure: tested in Node.
// Rows: gifts {title, price?, where?, occasion?, notes?, added, date?, reaction?}
//   (an idea has no `date`; marking it given sets date 'YYYY-MM-DD' + reaction 1-3)
// giftReminders {what, every, unit 'day'|'week'|'month', start 'YYYY-MM-DD', time 'HH:MM'}
import { parseYMD, toYMD, daysInMonth, shortDate } from './dates.js';
import { escapeText, foldLine } from './ics.js';

export const OCCASIONS = [['birthday', 'Birthday'], ['christmas', 'Christmas'], ['anniversary', 'Anniversary'], ['just', 'Just because']];
export const REACTIONS = [[1, 'Meh'], [2, 'Liked'], [3, 'Loved']];
export const UNITS = [['day', 'Days'], ['week', 'Weeks'], ['month', 'Months']];

export const occasionName = (k) => (OCCASIONS.find((x) => x[0] === k) || [null, ''])[1];
export const reactionName = (n) => (REACTIONS.find((x) => x[0] === Number(n)) || [null, ''])[1];

// One-tap starting points for reminders. `hint` = the About-her Favorites label shown with it.
export const PRESETS = [
  { key: 'flowers', what: 'Flowers', every: 2, unit: 'week', hint: 'Flower' },
  { key: 'candy', what: 'Candy', every: 1, unit: 'month', hint: 'Candy' },
  { key: 'note', what: 'Love note', every: 1, unit: 'week' },
  { key: 'date', what: 'Date night', every: 1, unit: 'week' },
];

/* ---------------- ideas and given ---------------- */

export const isGiven = (g) => !!parseYMD(g && g.date);

// Ideas, newest added first.
export function ideasOf(list) {
  return (list || []).filter((g) => !isGiven(g))
    .sort((a, b) => String(b.added || '').localeCompare(String(a.added || '')) || String(a.title || '').localeCompare(String(b.title || '')));
}

// Given gifts, newest date first.
export function givenOf(list) {
  return (list || []).filter(isGiven)
    .sort((a, b) => b.date.localeCompare(a.date) || String(a.title || '').localeCompare(String(b.title || '')));
}

const STOP = new Set(['a', 'an', 'the', 'of', 'for', 'from', 'her', 'some', 'new', 'and', 'to', 'at', 'with', 'my']);

// Lowercase words, no punctuation or filler, plural "s" dropped.
export function titleWords(title) {
  return String(title || '').toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

// Same gift if every word of the shorter title is in the longer one.
export function sameGift(a, b) {
  const wa = titleWords(a), wb = titleWords(b);
  if (!wa.length || !wb.length) return false;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const set = new Set(long);
  return short.every((w) => set.has(w));
}

// The latest given gift that matches this idea's title, or null.
export function givenBefore(idea, list) {
  for (const g of givenOf(list)) {
    if (g.id !== idea.id && sameGift(idea.title, g.title)) return g;
  }
  return null;
}

export function priceLabel(p) {
  const n = Number(p);
  if (p === '' || p == null || !Number.isFinite(n) || n < 0) return '';
  return '$' + (Number.isInteger(n) ? n : n.toFixed(2));
}

// '25', '$25.50' -> number; blank or junk -> null.
export function parsePrice(s) {
  const t = String(s == null ? '' : s).replace(/[$,\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/* ---------------- reminders: next occurrence ---------------- */

const dayNum = ({ y, m, d }) => Math.round(Date.UTC(y, m - 1, d) / 86400000);
function fromDayNum(n) {
  const t = new Date(n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

// start + k months, the day clamped to the month's end (Jan 31 + 1 month = Feb 28/29).
// Always counted from the start, so Jan 31 -> Feb 28 -> Mar 31 (not Mar 28).
export function addMonths(p, k) {
  const idx = p.y * 12 + (p.m - 1) + k;
  const y = Math.floor(idx / 12), m = (idx % 12) + 1;
  return { y, m, d: Math.min(p.d, daysInMonth(y, m)) };
}

export function validReminder(r) {
  const every = Number(r && r.every);
  return !!(r && parseYMD(r.start) && Number.isInteger(every) && every >= 1 && every <= 999
    && UNITS.some((u) => u[0] === r.unit));
}

// The k-th occurrence (k = 0 is the start date).
export function occurrence(r, k) {
  const s = parseYMD(r.start);
  const n = Number(r.every);
  if (r.unit === 'month') return addMonths(s, k * n);
  return fromDayNum(dayNum(s) + k * n * (r.unit === 'week' ? 7 : 1));
}

// First occurrence on or after today ({y,m,d}), or null for a bad reminder.
export function nextReminder(r, today) {
  if (!validReminder(r)) return null;
  const s = parseYMD(r.start);
  const n = Number(r.every);
  if (dayNum(s) >= dayNum(today)) return s;
  let k;
  if (r.unit === 'month') {
    const months = (today.y - s.y) * 12 + (today.m - s.m);
    k = Math.floor(months / n);
  } else {
    const step = n * (r.unit === 'week' ? 7 : 1);
    k = Math.ceil((dayNum(today) - dayNum(s)) / step);
  }
  let o = occurrence(r, k);
  while (dayNum(o) < dayNum(today)) o = occurrence(r, ++k);
  return o;
}

// Whole days until the next one (0 = today).
export function daysToNext(r, today) {
  const n = nextReminder(r, today);
  return n ? dayNum(n) - dayNum(today) : null;
}

export function nextLabel(r, today) {
  const n = nextReminder(r, today);
  if (!n) return '';
  const days = dayNum(n) - dayNum(today);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return shortDate(n, n.y !== today.y);
}

export function everyLabel(r) {
  const n = Number(r.every);
  const unit = r.unit === 'month' ? 'month' : r.unit === 'week' ? 'week' : 'day';
  if (n === 1) return unit === 'day' ? 'Daily' : unit === 'week' ? 'Weekly' : 'Monthly';
  return `Every ${n} ${unit}s`;
}

// 'HH:MM' -> '5 PM' / '5:30 PM'.
export function timeLabel(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return '';
  const h = +m[1], min = +m[2];
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${min ? ':' + m[2] : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

// Soonest first; bad rows last.
export function remindersSorted(list, today) {
  return (list || []).map((r) => ({ ...r, days: daysToNext(r, today) }))
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9) || String(a.what || '').localeCompare(String(b.what || '')));
}

// A hint from About her for this reminder, e.g. "Tulips" for flowers.
const HINT_WORDS = [[/flower|rose|tulip|bouquet/i, 'Flower'], [/candy|chocolate|sweet/i, 'Candy'], [/snack/i, 'Snack'], [/drink|coffee|boba|soda/i, 'Drink']];
export function profileHint(what, profileItems) {
  for (const [re, label] of HINT_WORDS) {
    if (!re.test(String(what || ''))) continue;
    const it = (profileItems || []).find((x) => x.section === 'favorites' && String(x.label || '').trim().toLowerCase() === label.toLowerCase() && String(x.value || '').trim());
    if (it) return String(it.value).trim();
  }
  return '';
}

/* ---------------- from her profile ---------------- */

// "Tulips, peonies; lilies" -> ['Tulips', 'peonies', 'lilies']
export function splitValues(v) {
  return String(v || '').split(/[,;\n/]+/).map((s) => s.trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '')).filter((s) => s.length > 1);
}

// Allergy/dislike labels that name a category, not the thing itself ("Food: peanuts").
// Used as a term only when the row has no details ("Dislikes: Flowers").
const GENERIC = new Set(['food', 'foods', 'drink', 'drinks', 'candy', 'snack', 'snacks', 'flower', 'flowers', 'plant', 'plants',
  'other', 'misc', 'general', 'allergy', 'allergies', 'medicine', 'medication', 'medications', 'pets', 'animals',
  'smell', 'smells', 'scent', 'scents', 'thing', 'things', 'stuff', 'gift', 'gifts', 'severe', 'mild']);

// Words for allergy matching: also folds "lilies"/"lily" and "candies"/"candy" together.
const avoidWords = (s) => titleWords(s).map((w) => (w.length > 4 && w.endsWith('ie') ? w.slice(0, -2) + 'y' : w));

function avoidTerms(profileItems) {
  const out = [];
  for (const kind of ['allergies', 'dislikes']) {
    for (const it of profileItems || []) {
      if (it.section !== kind) continue;
      const label = String(it.label || '').trim();
      const parts = splitValues(it.value);
      const lw = titleWords(label);
      if (label && (!parts.length || !lw.every((w) => GENERIC.has(w)))) parts.unshift(label);
      for (const p of parts) {
        const words = avoidWords(p);
        if (words.length) out.push({ kind: kind === 'allergies' ? 'allergy' : 'dislike', term: p, words });
      }
    }
  }
  return out;
}

// The first allergy (then dislike) whose words all appear in this title, or null.
// e.g. "Peanut butter cups" vs allergy "Peanuts" -> { kind: 'allergy', term: 'Peanuts' }
export function conflictOf(title, profileItems) {
  const set = new Set(avoidWords(title));
  if (!set.size) return null;
  for (const t of avoidTerms(profileItems)) {
    if (t.words.every((w) => set.has(w))) return { kind: t.kind, term: t.term };
  }
  return null;
}

// Favorites that aren't something you buy.
const NOT_GIFTS = new Set(['color', 'colour', 'colors', 'colours']);
// Favorites label -> reminder preset used when it becomes a reminder.
const LABEL_PRESET = [[/flower/i, 'flowers'], [/candy|chocolate/i, 'candy']];

// Her Favorites as one-tap gift ideas. Never an allergy or dislike; never one already
// in her ideas. Returns [{ title, label, preset }] in Profile order.
export function profileSuggestions(profileItems, giftList) {
  const ideas = ideasOf(giftList);
  const out = [];
  for (const it of profileItems || []) {
    if (it.section !== 'favorites') continue;
    const label = String(it.label || '').trim();
    if (NOT_GIFTS.has(label.toLowerCase())) continue;
    const preset = (LABEL_PRESET.find(([re]) => re.test(label)) || [null, ''])[1];
    for (const v of splitValues(it.value)) {
      const title = (v.charAt(0).toUpperCase() + v.slice(1)).slice(0, 200);
      if (!titleWords(title).length) continue;
      if (conflictOf(title, profileItems)) continue;
      if (ideas.some((g) => sameGift(g.title, title))) continue;
      const key = titleWords(title).join(' ');
      if (out.some((s) => titleWords(s.title).join(' ') === key)) continue;
      out.push({ title, label, preset });
    }
  }
  return out;
}

// A reminder seeded from a suggestion: its preset's repeat, else monthly.
export function reminderSeed(s) {
  const p = PRESETS.find((x) => x.key === (s && s.preset));
  return { what: String((s && s.title) || ''), every: p ? p.every : 1, unit: p ? p.unit : 'month' };
}

/* ---------------- reminders: repeating .ics ---------------- */

const pad = (n, w = 2) => String(n).padStart(w, '0');

function utcStamp(t) {
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}Z`;
}

// The RRULE for a reminder. Monthly on the 29th-31st takes the last of those days the
// month has (BYSETPOS=-1), the same month-end clamping as nextReminder.
export function rruleFor(r) {
  const n = Number(r.every);
  const freq = r.unit === 'month' ? 'MONTHLY' : r.unit === 'week' ? 'WEEKLY' : 'DAILY';
  let rule = `RRULE:FREQ=${freq};INTERVAL=${n}`;
  const s = parseYMD(r.start);
  if (r.unit === 'month' && s.d > 28) {
    const days = [];
    for (let d = 28; d <= s.d; d++) days.push(d);
    rule += `;BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
  }
  return rule;
}

// A repeating 30-minute event at the reminder's local time, with an alert at that time.
export function buildReminderIcs(r, now = new Date()) {
  if (!validReminder(r)) throw new Error('Bad reminder');
  const s = parseYMD(r.start);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(r.time || '')) || [null, '17', '00'];
  const what = String(r.what || '').trim() || 'Gift';
  const start = `${pad(s.y, 4)}${pad(s.m)}${pad(s.d)}T${pad(+tm[1])}${tm[2]}00`;
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Perfect Boyfriend//Gifts//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${r.id || 'gift-' + start}@perfect-boyfriend`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${start}`, // floating local time: fires at this clock time wherever the phone is
    'DURATION:PT30M',
    rruleFor(r),
    `SUMMARY:${escapeText(what)}`,
  ];
  if (r.hint) L.push(`DESCRIPTION:${escapeText('Her favorite: ' + r.hint)}`);
  L.push('TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(what)}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR');
  return L.map(foldLine).join('\r\n') + '\r\n';
}

export function todayYMD(now = new Date()) {
  return toYMD({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}
