// Period tracker math. Pure: no DOM, no Firebase, tested in Node.
// Follows docs/cycle-research.md section 3 (ported from docs/sketches/cycle.mjs):
// shrink toward population numbers, then trust her own history; honest 80% ranges;
// skipped logs are flagged and asked about, never silently fixed.
// Dates are 'YYYY-MM-DD' strings; all day math is in UTC day numbers (no DST off-by-one).
import { escapeText, foldLine } from './ics.js';

const DAY = 86400000;
export const toDay = (s) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY);
export const toStr = (d) => new Date(d * DAY).toISOString().slice(0, 10);
export const isYMD = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toStr(toDay(s)) === s;

export const DEFAULTS = {
  popMean: 29,        // Bull 2019: 29.3
  popBetweenSD: 4.5,  // spread of people's typical lengths (Bull 5.2 total vs 2.6 within)
  popWithinSD: 2.6,   // Bull 2019: mean per-user SD
  priorStrength: 3,   // pseudo-cycles of population SD mixed into hers
  halfLife: 6,        // cycles; exponential weight half-life
  maxCycles: 12,      // Clue uses the last 12
  luteal: 13,         // Apple/Clue count back 13
  lutealSD: 2,
  periodLen: 5,       // default bleed length when none logged
  z: 1.28,            // 80% range
  minLen: 15, maxLen: 90,
  backtestMax: 6,
};

export const MODES = ['natural', 'birth-control', 'pregnant'];

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function normPdf(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }
function normCdf(x) { // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/* ---------------- rows ---------------- */

// Firestore rows -> {settings, periods}. Rows: {kind:'period', start, end|null} and one
// {kind:'settings', mode, usualLength, since, okGaps}.
export function readRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const s = list.find((r) => r && r.kind === 'settings') || {};
  const usual = Number(s.usualLength);
  const settings = {
    mode: MODES.includes(s.mode) ? s.mode : 'natural',
    usualLength: usual >= 15 && usual <= 90 ? Math.round(usual) : null,
    since: isYMD(s.since) ? s.since : null,
    okGaps: Array.isArray(s.okGaps) ? s.okGaps.filter(isYMD) : [],
    modeFrom: isYMD(s.modeFrom) ? s.modeFrom : null,
  };
  const seen = new Set();
  const periods = list
    .filter((r) => r && r.kind === 'period' && isYMD(r.start))
    .map((r) => ({ id: r.id, start: r.start, end: isYMD(r.end) && r.end >= r.start ? r.end : null }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (b.end ? 1 : 0) - (a.end ? 1 : 0)))
    .filter((p) => (seen.has(p.start) ? false : seen.add(p.start)));
  return { settings, periods };
}

// The settings row after a mode / usual-length change. Leaving birth control or
// pregnancy starts fresh from today (old cycles stop counting), except a same-day
// change back, which is treated as undoing a mis-tap.
export function nextSettings(settings, mode, usualLength, today) {
  const out = { ...settings, mode, usualLength };
  if (mode === settings.mode) return out;
  if (mode !== 'natural') {
    if (settings.mode === 'natural') out.modeFrom = today;
  } else if (settings.modeFrom !== today) {
    out.since = today;
  }
  return out;
}

/* ---------------- step 1: cycle lengths and cleaning ---------------- */

// cycles: [{from, to, L}] in order. okGaps: `from` dates she confirmed are real cycles.
// ref: typical length to test "k cycles with a skipped log" against when there's too
// little history for a median. Returns {kept: [cycle], flagged: [cycle + why]}.
export function cleanCycles(cycles, { okGaps = [], ref = null } = {}, C = DEFAULTS) {
  const kept = [], flagged = [];
  const ok = cycles.map((c) => c.L).filter((L) => L >= C.minLen && L <= C.maxLen);
  const med = ok.length >= 3 ? median(ok) : null;
  const base = med != null ? med : ref;
  const cld = [];
  for (let i = 1; i < ok.length; i++) cld.push(Math.abs(ok[i] - ok[i - 1]));
  const medCLD = cld.length >= 2 ? median(cld) : null;
  for (const c of cycles) {
    const { L } = c;
    if (okGaps.includes(c.from)) { if (L <= C.maxLen) kept.push(c); continue; }
    if (L < C.minLen) { flagged.push({ ...c, why: 'short' }); continue; }
    if (L > C.maxLen) { flagged.push({ ...c, why: 'long' }); continue; }
    if (base != null) {
      const k = Math.round(L / base);
      if (k >= 2 && Math.abs(L - k * base) <= Math.max(4, 0.15 * L)) {
        flagged.push({ ...c, why: 'skipped', k, guess: toStr(toDay(c.from) + Math.round(L / k)) });
        continue;
      }
      if (med != null && medCLD != null && L - med >= medCLD + 10) { flagged.push({ ...c, why: 'outlier' }); continue; }
    }
    kept.push(c);
  }
  return { kept, flagged };
}

export function cyclesFrom(starts) {
  const days = [...new Set(starts)].sort();
  return days.slice(1).map((to, i) => ({ from: days[i], to, L: toDay(to) - toDay(days[i]) }));
}

/* ---------------- steps 2-6: predict ---------------- */

export function predict({ starts, periodLengths = [], usualLength = null, today = null, mode = 'natural', okGaps = [] }, C = DEFAULTS) {
  if (mode !== 'natural') return { paused: true, reason: mode };
  const sorted = [...new Set(starts || [])].filter(isYMD).sort();
  if (!sorted.length) return { paused: true, reason: 'none' };
  const mu0 = usualLength || C.popMean;
  const { kept, flagged } = cleanCycles(cyclesFrom(sorted), { okGaps, ref: mu0 }, C);
  const recent = kept.slice(-C.maxCycles).map((c) => c.L);
  const n = recent.length;

  // exponentially weighted mean (newest weight 1) and effective count
  let sw = 0, sw2 = 0, m = 0;
  recent.forEach((L, i) => { const w = Math.pow(0.5, (n - 1 - i) / C.halfLife); sw += w; sw2 += w * w; m += w * L; });
  m = n ? m / sw : 0;
  const nEff = n ? (sw * sw) / sw2 : 0;
  let userVar = 0;
  if (n >= 2) { const mu = recent.reduce((a, b) => a + b, 0) / n; userVar = recent.reduce((a, L) => a + (L - mu) ** 2, 0) / (n - 1); }
  const k = C.priorStrength;
  const sigma2 = (k * C.popWithinSD ** 2 + Math.max(0, n - 1) * userVar) / (k + Math.max(0, n - 1));
  const tau2 = usualLength ? 2 ** 2 : C.popBetweenSD ** 2;
  const prec = 1 / tau2 + nEff / sigma2;
  const muHat = (mu0 / tau2 + (nEff * m) / sigma2) / prec;
  const predSD = Math.sqrt(sigma2 + 1 / prec);

  const last = toDay(sorted[sorted.length - 1]);
  const todayD = today ? toDay(today) : null;
  const daysSince = todayD != null ? todayD - last : 0;
  const L = Math.round(muHat);
  let expLen = muHat, late = 0;
  if (daysSince > muHat) { // already past expected: condition on "hasn't started yet"
    const a = (daysSince - muHat) / predSD;
    expLen = Math.max(daysSince + 1, muHat + predSD * normPdf(a) / Math.max(1e-6, 1 - normCdf(a)));
    late = Math.max(0, daysSince - L);
  }
  const half = Math.min(10, Math.max(2, Math.round(C.z * predSD)));
  const next = last + Math.round(expLen);
  const lens = periodLengths.filter((x) => x >= 1 && x <= 15);
  const pl = lens.length ? Math.round(median(lens.slice(-6))) : C.periodLen;
  const ov = L - C.luteal; // cycle day of ovulation (day 1 = first period day)
  const ovSD = Math.sqrt(sigma2 + C.lutealSD ** 2);
  const pad = Math.min(4, Math.max(0, Math.round(C.z * ovSD) - 2));
  const last6 = recent.slice(-6);
  const range6 = last6.length >= 3 ? Math.max(...last6) - Math.min(...last6) : null;
  const irregular = (range6 != null && range6 > 9) || Math.sqrt(sigma2) > 4.5;
  const veryLate = late > Math.round(2 * predSD + 5);
  return {
    paused: false,
    lastStart: toStr(last),
    nextStart: toStr(next),
    window: [toStr(todayD != null ? Math.max(next - half, todayD) : next - half), toStr(next + half)],
    typicalLength: +muHat.toFixed(1), cycleLength: L, sd: +predSD.toFixed(1), cyclesUsed: n,
    flagged, late, veryLate, periodLength: pl, irregular,
    ovulationCycleDay: ov, fertilePad: pad,
    ovulationDay: toStr(last + ov - 1),
    fertile: [toStr(last + ov - 6 - pad), toStr(last + ov - 1 + pad)],
    phases: {
      menstrual: [1, pl], follicular: [pl + 1, Math.max(pl + 1, ov - 3)], ovulatory: [ov - 2, ov + 1],
      luteal: [ov + 2, L], pms: [Math.max(ov + 2, L - 4), L],
    },
  };
}

// Phase on a cycle day (1-based). Past the predicted length counts as the PMS window.
export function phaseOn(pred, day, periodDays = pred.periodLength) {
  const p = pred.phases;
  if (day <= periodDays) return 'menstrual';
  if (day >= p.ovulatory[0] && day <= p.ovulatory[1]) return 'ovulatory';
  if (day >= p.pms[0]) return 'pms';
  if (day < p.ovulatory[0]) return 'follicular';
  return 'luteal';
}

/* ---------------- step 8: honesty check ---------------- */

// Predict each past start from the starts before it (at least one full cycle of history),
// skipping cycles flagged as skipped logs. {count, within} for the last few, or null.
export function backtest(starts, { usualLength = null, okGaps = [] } = {}, C = DEFAULTS) {
  const sorted = [...new Set(starts || [])].filter(isYMD).sort();
  const { flagged } = cleanCycles(cyclesFrom(sorted), { okGaps, ref: usualLength || C.popMean }, C);
  const bad = new Set(flagged.map((f) => f.to));
  const errs = [];
  for (let j = 2; j < sorted.length; j++) {
    if (bad.has(sorted[j])) continue;
    const p = predict({ starts: sorted.slice(0, j), usualLength, okGaps }, C);
    errs.push(Math.abs(toDay(p.nextStart) - toDay(sorted[j])));
  }
  const lastErrs = errs.slice(-C.backtestMax);
  if (lastErrs.length < 2) return null;
  return { count: lastErrs.length, within: Math.max(...lastErrs) };
}

/* ---------------- what the screen shows ---------------- */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDay = (s) => `${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`;
export function fmtRange(a, b) {
  if (a === b) return fmtDay(a);
  return a.slice(0, 7) === b.slice(0, 7) ? `${fmtDay(a)}–${+b.slice(8, 10)}` : `${fmtDay(a)}–${fmtDay(b)}`;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const PHASE_NAME = {
  menstrual: 'Period', follicular: 'Follicular', ovulatory: 'Ovulatory', luteal: 'Luteal', pms: 'PMS window',
};

// Everything the Cycle screen needs, from the raw rows and today's date.
export function cycleStatus(rows, today, C = DEFAULTS) {
  const { settings, periods } = readRows(rows);
  const T = toDay(today);
  const past = periods.filter((p) => p.start <= today);
  const lastP = past[past.length - 1] || null;
  const out = { settings, periods, today, pred: null, prompt: null, accuracy: null, onPeriod: false, openPeriod: null, cycleDay: null, phase: null, fertileToday: false };
  if (lastP) out.cycleDay = T - toDay(lastP.start) + 1;
  if (lastP && !lastP.end && out.cycleDay <= 14) out.openPeriod = lastP;

  if (settings.mode !== 'natural') {
    out.helpKey = settings.mode;
    out.headline = settings.mode === 'pregnant' ? 'Pregnant' : 'On birth control';
    out.sub = 'Predictions off';
    return out;
  }
  // After birth control or pregnancy, only cycles since then count.
  const used = past.filter((p) => !settings.since || p.start >= settings.since);
  if (!used.length) {
    out.headline = past.length ? 'Waiting for a new period' : 'No period logged';
    out.sub = 'Tap Period started';
    out.helpKey = null;
    return out;
  }
  const starts = used.map((p) => p.start);
  const lens = used.filter((p) => p.end).map((p) => toDay(p.end) - toDay(p.start) + 1);
  const opts = { starts, periodLengths: lens, usualLength: settings.usualLength, okGaps: settings.okGaps };
  const pred = predict({ ...opts, today }, C);
  out.pred = pred;
  out.accuracy = backtest(starts, opts, C);

  const day = out.cycleDay;
  const bleedDays = lastP.end ? toDay(lastP.end) - toDay(lastP.start) + 1 : pred.periodLength;
  out.onPeriod = day <= bleedDays;
  out.phase = pred.late ? 'pms' : phaseOn(pred, day, bleedDays);
  out.helpKey = out.phase;
  out.fertileToday = !out.onPeriod && today >= pred.fertile[0] && today <= pred.fertile[1];

  // One question at a time: the newest flagged gap, then "very late".
  const f = pred.flagged[pred.flagged.length - 1];
  if (f) {
    out.prompt = f.why === 'short'
      ? { kind: 'short', from: f.from, to: f.to, text: `Starts ${f.L} days apart. Same period?` }
      : { kind: 'gap', from: f.from, to: f.to, guess: f.guess || toStr(toDay(f.from) + pred.cycleLength), text: `Missed a period around ${fmtDay(f.guess || toStr(toDay(f.from) + pred.cycleLength))}?` };
  } else if (pred.veryLate) {
    out.prompt = { kind: 'late', text: 'Missed logging a period?' };
  }

  const toNext = toDay(pred.nextStart) - T;
  const rangeTxt = fmtRange(pred.window[0], pred.window[1]);
  if (out.onPeriod) {
    out.headline = `Period day ${day}`;
    out.sub = `Next likely ${rangeTxt}`;
  } else if (pred.late) {
    out.headline = `${plural(pred.late, 'day')} late`;
    out.sub = pred.veryLate ? 'Predictions paused' : `Now likely ${rangeTxt}`;
  } else if (toNext <= 0) {
    out.headline = 'Period due today';
    out.sub = `Likely ${rangeTxt}`;
  } else if (toNext <= 7) {
    out.headline = `Period in ~${plural(toNext, 'day')}`;
    out.sub = `Likely ${rangeTxt}`;
  } else {
    out.headline = `Day ${day} · ${PHASE_NAME[out.phase]}`;
    out.sub = `Period likely ${rangeTxt}`;
  }
  return out;
}

export function accuracyText(a) {
  if (!a) return '';
  return a.within === 0
    ? `Predictions were on the day for the last ${a.count} periods`
    : `Predictions were within ${plural(a.within, 'day')} for the last ${a.count} periods`;
}

/* ---------------- calendar ---------------- */

// Marks for every day: logged period, predicted range / likely period days, fertile days.
// Projects up to `cycles` future cycles so later months show something too.
export function dayMarks(st, { cycles = 4 } = {}) {
  const marks = new Map();
  const mark = (d, key) => { const s = toStr(d); const m = marks.get(s) || {}; if (!m[key]) m[key] = true; marks.set(s, m); };
  const T = toDay(st.today);
  const P = st.pred && !st.pred.paused ? st.pred.periodLength : DEFAULTS.periodLen;
  for (const p of st.periods) {
    const a = toDay(p.start);
    const b = p.end ? toDay(p.end) : a + P - 1;
    for (let d = a; d <= b; d++) {
      if (p.end || d <= T) mark(d, 'logged');
      else mark(d, 'likely');
    }
  }
  const pred = st.pred;
  if (!pred || pred.paused || pred.veryLate) return marks;
  const fert = (a, b) => { for (let d = a; d <= b; d++) { const m = marks.get(toStr(d)); if (!m || (!m.logged && !m.likely)) mark(d, 'fertile'); } };
  // this cycle's fertile window, if it hasn't been overtaken by a late period
  if (!pred.late) fert(toDay(pred.fertile[0]), toDay(pred.fertile[1]));
  const L = pred.cycleLength, ov = pred.ovulationCycleDay, pad = pred.fertilePad;
  let start = toDay(pred.nextStart);
  for (let k = 0; k < cycles; k++) {
    if (k === 0) for (let d = toDay(pred.window[0]); d <= toDay(pred.window[1]); d++) mark(d, 'range');
    for (let d = start; d < start + P; d++) if (d >= T) mark(d, 'likely');
    fert(start + ov - 6 - pad, start + ov - 1 + pad);
    start += L;
  }
  return marks;
}

// 42 cells (6 weeks, Sunday first) for month m (1-12) of year y.
export function monthCells(y, m, marks, today) {
  const first = Math.round(Date.UTC(y, m - 1, 1) / DAY);
  const dow = new Date(first * DAY).getUTCDay();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = first - dow + i;
    const s = toStr(d);
    cells.push({ date: s, day: +s.slice(8, 10), inMonth: +s.slice(5, 7) === m, today: s === today, ...(marks.get(s) || {}) });
  }
  return cells;
}

/* ---------------- help cards (docs/cycle-research.md section 4) ---------------- */

export const TIPS = {
  menstrual: ['Heating pad or hot water', 'Her usual pain reliever', 'Lighter, flexible plans', 'Easy food, lots of rest'],
  follicular: ['Nothing special needed', 'Plan as usual'],
  ovulatory: ['Mid-cycle cramps: heat helps', 'Most fertile days'],
  luteal: ['Nothing special needed', 'Check in as usual'],
  pms: ['Extra patience', 'Comfort food, early night', 'Ask, don\'t assume', 'Take her feelings seriously'],
  'birth-control': ['Ask what helps her', 'Heat if she cramps'],
  pregnant: ['Ask what she needs', 'Her doctor over this app'],
};

/* ---------------- .ics reminder ---------------- */

const pad2 = (n) => String(n).padStart(2, '0');
function stamp(t) {
  return `${t.getUTCFullYear()}${pad2(t.getUTCMonth() + 1)}${pad2(t.getUTCDate())}T${pad2(t.getUTCHours())}${pad2(t.getUTCMinutes())}${pad2(t.getUTCSeconds())}Z`;
}

// All-day event on the predicted start, alert at 9 AM two days before.
export function buildCycleIcs(start, now = new Date()) {
  if (!isYMD(start)) throw new Error('Bad date: ' + start);
  const v = (s) => s.replace(/-/g, '');
  const title = 'Her period (expected)';
  const L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Perfect Boyfriend//Cycle//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:period-${v(start)}@perfect-boyfriend`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${v(start)}`,
    `DTEND;VALUE=DATE:${v(toStr(toDay(start) + 1))}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText('A prediction; it can be a few days off.')}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText('Her period may start in 2 days')}`, 'TRIGGER:-P1DT15H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return L.map(foldLine).join('\r\n') + '\r\n';
}
