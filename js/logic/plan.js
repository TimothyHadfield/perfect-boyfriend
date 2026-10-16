// Orem date planner (pure; no DOM, no Firebase). Tested in tests/plan.test.mjs.
// Stops come from data/plan-stops.json (built by data/build-plan-stops.mjs).
// Times are minutes after midnight (18:30 = 1110). Days: 0 = Sunday ... 6 = Saturday.
// Road drive times come from data/drive-times.json (o.times = driveTable(json)); without it, estimates.
// o.weather = that day's forecast ({code, hi, lo, pop}, js/logic/weather.js); o.history = dateLog rows.
import { badWeather, dateTemp, wetLikely, wxKind } from './weather.js';

export const OREM = { lat: 40.2969, lng: -111.6946, name: 'Orem' };
export const ROAD_FACTOR = 1.3;     // straight line -> road distance
export const CITY_KMH = 40;         // average city speed
export const PARK_MIN = 2;          // parking and walking in
export const MAX_KM = 20;           // stops farther than this from the start aren't used
export const MAX_WAIT = 75;         // longest wait for a fixed-time stop (lessons, a show)
export const LATEST_END = 24 * 60 + 30;
export const SEASON_KM = 30;        // in-season seasonal stops (corn mazes, lights) may be this far
// Tuned 2026-10-15: October auto plans include a seasonal stop ~31% of the time (Fri/Sat, all budgets/vibes/starts).
export const SEASON_BONUS = 6;      // score points off for an in-season seasonal stop (lower wins)
export const SEASON_PAY = 1;        // plus this much of its price (up to $30)
export const SEASON_NEAR = 20;  // km "closer" a seasonal stop counts as when picking candidates
const isSeasonal = (s) => !!s && Array.isArray(s.tags) && s.tags.includes('seasonal');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayName = (d) => DAY_NAMES[d];

/* ---------------- small helpers ---------------- */

export function rng(seed) {                       // mulberry32: same seed, same numbers
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

export function fmtTime(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function haversineKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Estimated drive: straight line x 1.3 road factor at 40 km/h, plus 2 min to park. 0 if it's the same place.
export function driveMin(a, b) {
  const km = haversineKm(a, b);
  if (km < 0.15) return 0;
  return Math.round((km * ROAD_FACTOR) / CITY_KMH * 60 + PARK_MIN);
}

/* ---------------- road drive times ---------------- */

// data/drive-times.json -> lookup table (null if it's missing or broken).
export function driveTable(json) {
  if (!json || !Array.isArray(json.ids) || !Array.isArray(json.min)) return null;
  return { idx: new Map(json.ids.map((id, i) => [id, i])), min: json.min };
}

function tableMin(tbl, a, b) {
  if (!tbl || a == null || b == null) return null;
  const i = tbl.idx.get(a), j = tbl.idx.get(b);
  if (i == null || j == null) return null;
  const v = tbl.min[i] && tbl.min[i][j];
  return typeof v === 'number' ? v : null;
}

const isOrem = (o) => !o || o === OREM || (o.lat === OREM.lat && o.lng === OREM.lng);

// Where a stop is, as a drive-times key: its id; "at home" is the start, which is only in the table when it's Orem.
function placeKey(stop, origin) {
  if (stop.home) return isOrem(origin) ? 'orem' : null;
  return stop.id;
}

// One leg: road time + parking when both ends are in the table, else the estimate (est: true).
function leg(fromKey, fromPt, toStop, toPt, o) {
  if (haversineKm(fromPt, toPt) < 0.15) return { min: 0, est: false };
  const t = tableMin(o.times, fromKey, placeKey(toStop, o.origin || OREM));
  if (t != null) return { min: t + (toStop.home ? 0 : PARK_MIN), est: false };
  return { min: driveMin(fromPt, toPt), est: true };
}

// Rough Orem sunset by month (local clock time, mid-month).
const SUNSET = [0, 17 * 60 + 25, 17 * 60 + 58, 19 * 60 + 28, 19 * 60 + 58, 20 * 60 + 26, 20 * 60 + 52,
  20 * 60 + 55, 20 * 60 + 28, 19 * 60 + 44, 18 * 60 + 57, 17 * 60 + 20, 17 * 60 + 5];
export const sunset = (month) => SUNSET[month] || 19 * 60;

/* ---------------- deal limits printed on the card ---------------- */

const DAY_WORDS = [
  [/\bsun(day)?s?\b/, 0], [/\bmon(day)?s?\b/, 1], [/\btue(s|sday)?s?\b/, 2], [/\bwed(nesday)?s?\b/, 3],
  [/\bthu(r|rs|rsday)?s?\b/, 4], [/\bfri(day)?s?\b/, 5], [/\bsat(urday)?s?\b/, 6],
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function clock(h, mm, ap) {
  let x = (+h % 12) + (ap === 'pm' ? 12 : 0);
  return x * 60 + (+mm || 0);
}

// "Mon Only", "M-Th", "M-Fri Before 6pm", "Thurs", "Wednesday", "Valid May & June",
// "Not Valid after 5 PM, Saturdays, Holidays" -> {days, before, after, months} (null = no limit).
export function parseLimits(text) {
  let t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  const out = { days: null, before: null, after: null, months: null };
  let not = '';
  const nv = t.indexOf('not valid');
  if (nv >= 0) { not = t.slice(nv); t = t.slice(0, nv); }

  // ranges first, then cut them out so "M-Thurs" doesn't also read as "Thurs"
  const ranges = [
    [/\b(m|mon)\s?-\s?(th|thu|thur|thurs|thursday)\b/g, [1, 2, 3, 4]],
    [/\b(m|mon)\s?-\s?(f|fri|friday)\b/g, [1, 2, 3, 4, 5]],
    [/\bfri\s?-\s?sat\b/g, [5, 6]],
  ];
  let days = [];
  for (const [re, ds] of ranges) if (re.test(t)) { days.push(...ds); t = t.replace(re, ' '); }
  if (!days.length) for (const [re, d] of DAY_WORDS) if (re.test(t)) days.push(d);
  if (days.length) out.days = [...new Set(days)].sort((a, b) => a - b);

  const before = /before (\d{1,2})(?::(\d\d))?\s*(am|pm)/.exec(t);
  if (before) out.before = clock(before[1], before[2], before[3]);
  const after = /after (\d{1,2})(?::(\d\d))?\s*(am|pm)/.exec(t);
  if (after) out.after = clock(after[1], after[2], after[3]);

  const months = [];
  MONTHS.forEach((m, i) => { if (new RegExp('\\b' + m + '[a-z]*\\b').test(t)) months.push(i + 1); });
  if (months.length && /valid|only/.test(t)) out.months = months;

  // Meal-time deals: breakfast items before 11am, lunch items before 3pm.
  const full = String(text || '').toLowerCase();
  const cut = (m) => { out.before = out.before == null ? m : Math.min(out.before, m); };
  if (/lunch/.test(full)) cut(15 * 60);
  else if (/breakfast/.test(full)) cut(11 * 60);

  if (not) {
    const notAfter = /after (\d{1,2})(?::(\d\d))?\s*(am|pm)/.exec(not);
    if (notAfter) out.before = clock(notAfter[1], notAfter[2], notAfter[3]);
    const bad = DAY_WORDS.filter(([re]) => re.test(not)).map(([, d]) => d);
    if (bad.length) out.days = (out.days || [0, 1, 2, 3, 4, 5, 6]).filter((d) => !bad.includes(d));
  }
  return out;
}

export function limitsOk(lim, day, start, month) {
  if (lim.days && !lim.days.includes(day)) return false;
  if (lim.before != null && start >= lim.before) return false;
  if (lim.after != null && start < lim.after) return false;
  if (lim.months && !lim.months.includes(month)) return false;
  return true;
}

/* ---------------- what a deal saves ---------------- */

const MAIN_WORDS = {
  food: /entree|entrée|burger|sandwich|melt\b|sub\b|burrito|plate|meal|combo|pizza|taco|bowl|platter|gyro|ramen|roll\b|buffet|menu item|hot dog|wings|chicken|calzone|salad|quesadilla|pita|teriyaki/,
  dessert: /shake|sundae|ice cream|yogurt|cone|scoop|donut|doughnut|cookie|crepe|waffle|cake|bundtlet|cinnamon roll|drink|smoothie|gelato|italian ice|cupcake|custard|blizzard|menu item|entree|pastry|malasada|molten|pretzel|soda|treat|dozen/,
  activity: /admission|admit|ticket|race|game|session|hour|pass|studio|attraction|experience|class|round|show|bowling|skating|laser|throwing|rental|tour|ride|play|cruise|wax|facial/,
};
MAIN_WORDS.culture = MAIN_WORDS.activity;
MAIN_WORDS['free-outdoor'] = MAIN_WORDS.activity;
MAIN_WORDS['at-home'] = /$^/;

// Dollars a deal saves for the two of you at a stop that costs `cost` per couple.
// 2-4-1 = half of two items; FREE = one person's item free (both, if "for two");
// a free side, cookie or drink at a meal = a few dollars.
export function dealSave(text, cost, kind) {
  const t = String(text || '').toLowerCase();
  if (!cost) return 0;
  const capM = /(?:up to|max(?:imum)?(?: discount)?)\s*\$(\d+)/.exec(t);
  const cap = capM ? +capM[1] : Infinity;
  const words = MAIN_WORDS[kind] || MAIN_WORDS.activity;
  const minor = (x) => Math.min(4, Math.round(cost * 0.25), x);
  let save = 0;
  const dollar = /\$(\d+)\s*off/.exec(t);
  const pct = /(\d+)%\s*off/.exec(t);
  if (dollar) {
    const min = /purchase of \$(\d+)/.exec(t);
    save = min && +min[1] > cost ? 0 : +dollar[1];
  } else if (pct) {
    const p = +pct[1] / 100;
    const whole = /entire|any purchase/.test(t);
    save = whole ? cost * p : words.test(t) ? cost * p * 0.5 : minor(cost * p * 0.5);
  } else if (/2-4-1|get [^!]*free/.test(t) && !/^free!/.test(t.trim())) {
    // What comes free: "get 1 FREE" means the same item; "get chips & a drink FREE" is a side.
    const g = /get (.*)$/.exec(t);
    const part = g ? g[1] : t;
    const same = !g || /^(1|one|a|an|the|2nd|second)?\s*(free|50% off)/.test(part.trim());
    const main = same ? words.test(t) : words.test(part);
    save = main ? cost * 0.5 : minor(cost);
  } else if (/free/.test(t)) {
    const item = t.split(/ w\/| with /)[0];
    const both = /for two|admit 2|for up to 2|up to 2 people|for 2\b/.test(t);
    save = words.test(item) ? (both ? cost : cost * 0.5) : minor(cost);
  }
  return Math.max(0, Math.min(cost, cap, Math.round(save)));
}

/* ---------------- SSC uses ---------------- */

// Uses left = printed uses - circles already punched on the card - uses logged in the app.
export function usesLeft(deal, sscUses = []) {
  if (deal.uses === 'unlimited') return Infinity;
  const logged = sscUses.filter((u) => u.dealId === deal.id).length;
  return Math.max(0, (+deal.uses || 0) - (+deal.used || 0) - logged);
}

export function pickDeal(stop, day, start, month, sscUses) {
  let best = null;
  for (const d of stop.deals || []) {
    const left = usesLeft(d, sscUses);
    if (left <= 0) continue;
    if (!limitsOk(parseLimits((d.limits || '') + ' ' + d.text), day, start, month)) continue;
    const save = dealSave(d.text, stop.cost, stop.kind);
    if (save <= 0) continue;
    if (!best || save > best.save) best = { id: d.id, text: d.text, save, left };
  }
  return best;
}

/* ---------------- timeline ---------------- */

export function stopPoint(stop, origin) {
  return stop.home ? { lat: origin.lat, lng: origin.lng } : { lat: stop.lat, lng: stop.lng };
}

// closeByDay: {weekday (0=Sun): minutes} for places whose closing time changes by day.
function closeOf(stop, month, day) {
  if (stop.closeByDay && stop.closeByDay[day] != null) return stop.closeByDay[day];
  if (stop.close != null) return stop.close;
  if (stop.kind === 'free-outdoor') return sunset(month) + 20;
  return 21 * 60;
}

// Lay stops out in time from `start`. Returns null when it can't work
// (closed that day, out of season, closes too early, a fixed time is missed).
export function timeline(stops, o) {
  const origin = o.origin || OREM;
  const month = o.month || 1;
  let t = toMin(o.start) ?? 18 * 60;
  let at = origin;
  let atKey = isOrem(origin) ? 'orem' : null;
  const items = [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (!stopOpen(s, o.day, month)) return null;
    const p = stopPoint(s, origin);
    const lg = leg(atKey, at, s, p, o);
    const drive = lg.min;
    const arrive = t + drive;
    let begin = arrive;
    const slot = s.slots ? s.slots[o.day] : null;
    if (slot != null) {
      if (arrive > slot + 15) return null;                  // missed the start (lessons, show)
      if (slot - arrive > MAX_WAIT) return null;
      begin = Math.max(arrive, slot);
    } else if (s.open != null && arrive < s.open) {
      if (s.open - arrive > MAX_WAIT) return null;
      begin = s.open;
    }
    const end = begin + (s.mins || 60);
    if (end > closeOf(s, month, o.day) +(slot != null ? 240 : 0)) return null;
    if (end > LATEST_END) return null;
    const deal = pickDeal(s, o.day, begin, month, o.sscUses);
    const price = Math.max(0, (s.cost || 0) - (deal ? deal.save : 0));
    items.push({ stop: s, start: begin, end, drive, est: lg.est && drive > 0, wait: begin - arrive, km: haversineKm(at, p), deal, price });
    t = end;
    at = p;
    atKey = placeKey(s, origin);
  }
  const total = items.reduce((a, x) => a + x.price, 0);
  const drive = items.reduce((a, x) => a + x.drive, 0);
  return { items, total, drive, base: items.reduce((a, x) => a + (x.stop.cost || 0), 0) };
}

export function stopOpen(s, day, month) {
  if (s.months && !s.months.includes(month)) return false;
  if (s.slots) return s.slots[day] != null;
  if (s.days && !s.days.includes(day)) return false;
  return true;
}

/* ---------------- building a plan ---------------- */

export const VIBES = [['any', 'Any'], ['active', 'Active'], ['chill', 'Chill'], ['food', 'Food']];

const SHAPES = {
  any: [['activity', 'food', 'dessert'], ['food', 'activity', 'dessert'], ['activity', 'food'], ['food', 'activity'],
    ['culture', 'food', 'dessert'], ['free-outdoor', 'food', 'dessert'], ['food', 'free-outdoor', 'dessert'], ['activity', 'food', 'activity']],
  active: [['activity', 'food', 'dessert'], ['activity', 'food', 'activity'], ['food', 'activity', 'dessert'], ['free-outdoor', 'food', 'dessert'], ['activity', 'food', 'activity', 'dessert']],
  chill: [['culture', 'food', 'dessert'], ['at-home', 'food', 'dessert'], ['food', 'free-outdoor', 'dessert'], ['food', 'culture'], ['activity', 'food', 'dessert']],
  food: [['food', 'dessert'], ['food', 'free-outdoor', 'dessert'], ['food', 'culture', 'dessert'], ['food', 'dessert', 'dessert']],
};

function vibeOk(stop, vibe) {
  const tags = stop.tags || [];
  if (vibe === 'active' && stop.kind === 'activity') return tags.includes('active');
  if (vibe === 'chill' && stop.kind === 'activity') return !tags.includes('active');
  return true;
}

// Stops that could go in a plan for these options (any kind). Seasonal stops (only open in their months)
// may sit farther out: Luminaria, Cornbelly's Lehi and Salem Pond are 22-28 km from Orem.
export function eligible(all, o) {
  const origin = o.origin || OREM;
  const max = o.maxKm || MAX_KM;
  return all.filter((s) => s.auto !== false
    && stopOpen(s, o.day, o.month)
    && (s.home || haversineKm(origin, s) <= (isSeasonal(s) ? Math.max(max, SEASON_KM) : max)));
}

// Rain, snow, or very cold/hot (o.weather): outdoor stops cost a lot, so indoor plans win.
const outdoorBad = (o) => !!o.weather && badWeather(o.weather, toMin(o.start) ?? 18 * 60);
const isOutdoor = (s) => s.indoor === false && !s.home;

function score(tl, o, marks) {
  const waits = tl.items.reduce((a, x) => a + x.wait, 0);
  const picks = tl.items.filter((x) => x.stop.pick).length;
  const deals = tl.items.filter((x) => x.deal).length;
  const loved = marks ? tl.items.filter((x) => marks.loved.has(x.stop.id)).length : 0;
  const outside = outdoorBad(o) ? tl.items.filter((x) => isOutdoor(x.stop)).length : 0;
  // In-season seasonal stops (eligible() already dropped out-of-season ones) get a boost, at most one per plan.
  // Paid ones (corn mazes, Luminaria) get more of their price back, so they can beat cheap everyday stops.
  const sea = tl.items.find((x) => isSeasonal(x.stop));
  const season = sea ? SEASON_BONUS + Math.min(30, sea.price) * SEASON_PAY : 0;
  return tl.total + tl.drive * 0.5 + waits * 0.1 - picks * 3 - deals * 2 - loved * 8 + outside * 40 - tl.items.length * 5
    - season
    + (o.budget != null && tl.total > o.budget ? 1000 : 0);
}

/* ---------------- learning from the date log ---------------- */

const DAY_MS = 86400000;
function dayNum(ymdStr) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(ymdStr || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS : null;
}

// From dateLog rows: stops to skip (used within 30 days, or from a 'meh' date within 90) and stops from 'loved' dates.
// Rows without stopIds (older ones) match by stop name. `ymd` = the day being planned.
export function historyMarks(rows, all, ymd) {
  const skip = new Set(), loved = new Set();
  const today = dayNum(ymd);
  if (!Array.isArray(rows) || today == null) return { skip, loved };
  const nk = (n) => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const byName = new Map();
  for (const s of all) for (const n of [s.short, s.name]) if (n && !byName.has(nk(n))) byName.set(nk(n), s.id);
  for (const r of rows) {
    const d = r ? dayNum(r.date) : null;
    if (d == null) continue;
    const ids = Array.isArray(r.stopIds) && r.stopIds.length ? r.stopIds
      : (Array.isArray(r.stops) ? r.stops : []).map((n) => byName.get(nk(n))).filter(Boolean);
    const gap = Math.abs(today - d);
    for (const id of ids) {
      if (gap <= 30 || (r.rating === 'meh' && gap <= 90)) skip.add(id);
      if (r.rating === 'loved') loved.add(id);
    }
  }
  return { skip, loved };
}

const marksFor = (all, o) => (o.history ? historyMarks(o.history, all, o.ymd) : null);

// Leave out skipped stops, unless that leaves nothing.
function fresh(list, marks) {
  if (!marks) return list;
  const f = list.filter((s) => !marks.skip.has(s.id));
  return f.length ? f : list;
}

// Build one plan. o = {day, month, start:'HH:MM', budget|null, vibe, origin, seed, sscUses, shape?, lock?: {index: stopId}}.
// Same options + same seed -> same plan. Shuffle = a new seed.
export function makePlan(all, o) {
  const r = rng((o.seed || 1) * 7919 + (o.day || 0) * 31 + 17);
  const pool = eligible(all, o);
  const byId = Object.fromEntries(all.map((s) => [s.id, s]));
  const origin = o.origin || OREM;
  const marks = marksFor(all, o);
  const wet = outdoorBad(o);
  // Bad weather: a free outdoor stop becomes a free-ish indoor one (museum, show), so cheap plans stay indoors.
  const shapes = (o.shape ? [o.shape] : SHAPES[o.vibe] || SHAPES.any)
    .map((sh) => (wet && !o.shape ? sh.map((k) => (k === 'free-outdoor' ? 'culture' : k)) : sh));
  const seen = new Map();
  const tries = o.tries || 260;
  for (let n = 0; n < tries; n++) {
    const shape = shapes[Math.floor(r() * shapes.length)];
    const seq = [];
    let at = origin;
    let bad = false;
    for (let i = 0; i < shape.length; i++) {
      const locked = o.lock && o.lock[i] ? byId[o.lock[i]] : null;
      if (locked) { seq.push(locked); at = stopPoint(locked, origin); continue; }
      const nextLock = o.lock && o.lock[i + 1] ? byId[o.lock[i + 1]] : null;
      const cands = fresh(pool.filter((s) => s.kind === shape[i] && vibeOk(s, o.vibe) && !seq.includes(s) && !(o.exclude || []).includes(s.id)), marks);
      if (!cands.length) { bad = true; break; }
      const dist = (s) => {
        const p = stopPoint(s, origin);
        return haversineKm(at, p) + (nextLock ? haversineKm(p, stopPoint(nextLock, origin)) : 0) - (s.pick ? 1 : 0)
          - (marks && marks.loved.has(s.id) ? 3 : 0) + (wet && isOutdoor(s) ? 8 : 0) - (isSeasonal(s) ? SEASON_NEAR : 0);
      };
      cands.sort((a, b) => dist(a) - dist(b) || (a.id < b.id ? -1 : 1));
      const k = Math.min(cands.length, 7);
      const pick = cands[Math.floor(r() ** 1.6 * k)];
      seq.push(pick);
      at = stopPoint(pick, origin);
    }
    if (bad) continue;
    const key = seq.map((s) => s.id).join('>');
    if (seen.has(key)) continue;
    const tl = timeline(seq, o);
    seen.set(key, tl ? { key, ...tl, score: score(tl, o, marks) } : null);
  }
  const ok = [...seen.values()].filter(Boolean).sort((a, b) => a.score - b.score || (a.key < b.key ? -1 : 1));
  if (!ok.length) return null;
  const inBudget = o.budget == null ? ok : ok.filter((p) => p.total <= o.budget);
  const list = inBudget.length ? inBudget : ok;
  const top = list.slice(0, 6);
  const plan = top[Math.floor(r() * top.length)];
  return finish(plan, o, !inBudget.length);
}

function finish(tl, o, over) {
  const key = tl.key || tl.items.map((x) => x.stop.id).join('>');
  const start = toMin(o.start) ?? 18 * 60;
  return {
    key, day: o.day, start,
    items: tl.items, total: tl.total, drive: tl.drive,
    driveEst: tl.items.some((x) => x.est),
    over: !!over || (o.budget != null && tl.total > o.budget),
    bring: bringList(tl.items, o.month, o.weather),
    wear: wearLine(tl.items, o.month, o.weather, tl.items.length ? tl.items[0].start : start),
    weather: o.weather || null,
    talk: talkAbout(key),
  };
}

// A fixed list of stops (Tim's plans, or after a swap) as a plan.
// o.firstAt ('HH:MM') = when the first stop starts; you leave earlier by the drive there.
export function planFromStops(stops, o) {
  if (o.firstAt && stops.length) {
    const origin = o.origin || OREM;
    const lead = leg(isOrem(origin) ? 'orem' : null, origin, stops[0], stopPoint(stops[0], origin), o).min;
    const m = toMin(o.firstAt) - lead;
    o = { ...o, start: `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` };
  }
  const tl = timeline(stops, o);
  return tl ? finish(tl, o, false) : null;
}

// Replace stop i with the best other stop of the same kind that still fits.
export function swapStop(all, plan, i, o, exclude = []) {
  const cur = plan.items.map((x) => x.stop);
  const kind = cur[i].kind;
  const marks = marksFor(all, o);
  const pool = fresh(eligible(all, o).filter((s) => s.kind === kind && !cur.includes(s) && !exclude.includes(s.id)), marks);
  let best = null;
  for (const s of pool) {
    const seq = cur.slice();
    seq[i] = s;
    const tl = timeline(seq, o);
    if (!tl) continue;
    const sc = score(tl, o, marks) + (vibeOk(s, o.vibe) ? 0 : 5);
    if (!best || sc < best.sc || (sc === best.sc && s.id < best.s.id)) best = { sc, tl, s };
  }
  return best ? finish(best.tl, o, false) : null;
}

/* ---------------- bring / wear ---------------- */

// wx = the day's forecast (optional): rain likely adds an umbrella.
export function bringList(items, month, wx) {
  const out = [];
  const add = (x) => { if (x && !out.includes(x)) out.push(x); };
  if (items.some((x) => x.deal)) add('SSC card');
  for (const x of items) (x.stop.bring || []).forEach(add);
  const outdoor = items.some((x) => isOutdoor(x.stop));
  const sunny = wx ? wx.hi >= 75 && !wetLikely(wx) : month >= 6 && month <= 8;
  if (outdoor && sunny) add('Sunscreen');
  if (wx && wetLikely(wx) && wxKind(wx.code) !== 'snow' && items.some((x) => !x.stop.home)) add('Umbrella');
  return out;
}

// With a forecast: dress for the temperature during the date (start = when the first stop starts).
// Without one: by month (coat Nov-Mar, jacket Oct/Apr).
export function wearLine(items, month, wx, start) {
  const out = [];
  const add = (x) => { if (x && !out.includes(x)) out.push(x); };
  for (const x of items) add(x.stop.wear);
  if (wx) {
    const t = dateTemp(wx, start);
    if (t < 48) add('Warm coat');
    else if (t < 62) add('Light jacket');
    else if (t >= 85) add('Light clothes');
    if (wxKind(wx.code) === 'snow' && wetLikely(wx)) add('Boots');
  } else if (month >= 11 || month <= 3) add('Warm coat');
  else if (month === 10 || month === 4) add('Light jacket');
  return out.length ? out.join(' · ') : 'Casual';
}

/* ---------------- something to talk about ---------------- */

export const TALK = [
  'What made your week a little better?',
  'Where would you road-trip if we left tomorrow?',
  'What food from your childhood do you miss?',
  'Three people, any era, at one dinner: who?',
  'What do you want to learn but haven\'t started?',
  'What song would play when you walk into a room?',
  'Best job you could have for exactly one year?',
  'What skill would you master overnight?',
  'What\'s your comfort show, and why that one?',
  'What did you want to be when you were ten?',
  'What tradition should we start?',
  'Your perfect free Saturday, start to finish?',
  'Best advice anyone has given you?',
  'Which fictional world would you live in?',
  'What are you looking forward to this month?',
  'What harmless opinion will you never give up?',
  'Mountains or beach for a week off?',
  'A place nearby you\'ve never been but want to go?',
  'Funniest thing that happened to you this year?',
  'Whose life would you swap with for a day?',
  'What should I read, watch or listen to next?',
  'Which family recipe should never be lost?',
  'What bucket-list item could we actually do soon?',
  'Best gift you\'ve ever gotten?',
  'What does a perfect lazy Sunday look like?',
  'If we opened a tiny business, what would it sell?',
  'What habit are you quietly proud of?',
  'Which decade would you visit for a week?',
  'What snack could you eat every single day?',
  'What do people often get wrong about you?',
  'Which childhood memory still makes you laugh?',
  'If you taught one class, what would it be?',
  'Most beautiful place you\'ve ever seen?',
  'Which superpower would help most on a Tuesday?',
  'What have you changed your mind about lately?',
  'How would you spend a dream birthday?',
  'What small luxury is always worth it to you?',
  'Which song do you always sing along to?',
  'What\'s one goal you have for this year?',
  'What should we do more of together?',
];

// Same plan, same line.
export function talkAbout(key) {
  let h = 2166136261;
  for (const c of String(key || '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return TALK[(h >>> 0) % TALK.length];
}

/* ---------------- Tim's plans (docs/tim-date-notes.md) ---------------- */

// at = when the first stop starts. Plan 2 runs in daytime order (donut shop first, game at home last):
// Tim listed the stops without times, and donut shops close early.
export const TIM_PLANS = [
  { key: 'tim-1', name: 'Provo dance', day: 3, at: '18:00', stops: ['color-me-mine-provo', 'mooyah-provo', 'tippin-point-country-dance'] },
  { key: 'tim-2', name: 'Pleasant Grove', day: 6, at: '10:00', stops: ['daylight-donuts', 'kreative-kiln-pg', 'melty-pg', 'ticket-to-ride-home'] },
  { key: 'tim-3', name: 'The Rift', day: 1, at: '18:00', stops: ['the-rift-provo'] },
  { key: 'tim-4', name: 'Redline', day: 4, at: '18:00', stops: ['redline-racing', 'sweeto-burrito-orem'] },
];

/* ---------------- dates, maps, log rows ---------------- */

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The next 7 days starting today, as [{ymd, day, month, date}].
export function weekAhead(today) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    out.push({ ymd: ymd(d), day: d.getDay(), month: d.getMonth() + 1, date: d.getDate() });
  }
  return out;
}

// Default day: Friday if it's within the week (today counts), else today.
export function defaultDay(week) {
  return (week.find((w) => w.day === 5) || week[0]).ymd;
}

// Google Maps directions with every stop as a waypoint (opens the Maps app or web).
export function mapsUrl(plan, origin) {
  const pts = plan.items.filter((x) => !x.stop.home).map((x) => `${x.stop.lat},${x.stop.lng}`);
  if (!pts.length) return '';
  const o = origin || OREM;
  const dest = pts[pts.length - 1];
  const way = pts.slice(0, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${dest}${way ? '&waypoints=' + encodeURIComponent(way) : ''}&travelmode=driving`;
}

export function appleMapsUrl(stop) {
  return `https://maps.apple.com/?q=${encodeURIComponent(stop.name)}&ll=${stop.lat},${stop.lng}`;
}

export function planTitle(plan) {
  const t = plan.items.map((x) => x.stop.short || x.stop.name).join(' + ');
  return t.length > 120 ? t.slice(0, 117) + '…' : t;
}

// Rows saved by "We did this": one dateLog row, one sscUses row per deal used.
export function logRows(plan, dateYMD) {
  return {
    dateLog: {
      title: planTitle(plan), date: dateYMD, stops: plan.items.map((x) => x.stop.short || x.stop.name),
      stopIds: plan.items.map((x) => x.stop.id), cost: plan.total,
    },
    sscUses: plan.items.filter((x) => x.deal).map((x) => ({ dealId: x.deal.id, date: dateYMD })),
  };
}

export function dealLabel(text) {
  return String(text || '').replace(/!+/g, '').replace(/\s+/g, ' ').trim();
}
