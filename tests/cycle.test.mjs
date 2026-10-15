// Period tracker logic (js/logic/cycle.js). Fixtures are a year of real-shaped
// rows: {id, kind:'period', start, end} plus one settings row.
import { test, eq, ok } from './harness.mjs';
import {
  toDay, toStr, readRows, nextSettings, predict, phaseOn, backtest, cycleStatus, accuracyText,
  dayMarks, monthCells, buildCycleIcs, fmtRange, cyclesFrom, cleanCycles,
} from '../js/logic/cycle.js';

const add = (s, n) => toStr(toDay(s) + n);
// starts every `lens[i]` days from `first`
function startsFrom(first, lens) {
  const out = [first];
  for (const L of lens) out.push(add(out[out.length - 1], L));
  return out;
}
// period rows with an end date `bleed` days long (1-based), ids like Firestore's
function rows(starts, bleeds = [], extra = []) {
  return [
    ...starts.map((s, i) => ({ id: 'p' + i + 'xYz', kind: 'period', start: s, end: bleeds[i] ? add(s, bleeds[i] - 1) : null })),
    ...extra,
  ];
}
const REG = startsFrom('2025-10-03', Array(12).fill(28)); // 13 starts, 12 cycles of 28
const REG_BLEEDS = [5, 4, 5, 5, 4, 6, 5, 4, 5, 5, 4, 5, null];
const lastReg = REG[REG.length - 1];

test('cycle: first period only uses the population prior (wide, honest)', () => {
  const p = predict({ starts: ['2026-10-01'], today: '2026-10-12' });
  eq(p.cyclesUsed, 0);
  eq(p.typicalLength, 29);
  ok(p.sd >= 5 && p.sd <= 5.6, 'sd ~5.2, got ' + p.sd);
  eq(p.nextStart, '2026-10-30');
  eq(p.window, ['2026-10-23', '2026-11-06']); // +-7
  const st = cycleStatus(rows(['2026-10-01']), '2026-10-12');
  eq(st.headline, 'Day 12 · Follicular');
  eq(st.sub, 'Period likely Oct 23–Nov 6');
  eq(st.accuracy, null);
});

test('cycle: typed usual length beats the population prior', () => {
  const p = predict({ starts: ['2026-10-01'], usualLength: 32, today: '2026-10-02' });
  eq(p.typicalLength, 32);
  eq(p.nextStart, '2026-11-02');
  const st = cycleStatus(rows(['2026-10-01'], [], [{ id: 'settings', kind: 'settings', mode: 'natural', usualLength: 32 }]), '2026-10-02');
  eq(st.pred.nextStart, '2026-11-02');
});

test('cycle: a year of regular 28-day cycles gives a tight window', () => {
  const p = predict({ starts: REG, today: add(lastReg, 3) });
  eq(p.cyclesUsed, 12);
  ok(Math.abs(p.typicalLength - 28) < 0.3, 'typical ' + p.typicalLength);
  eq(p.nextStart, add(lastReg, 28));
  eq(p.window, [add(lastReg, 26), add(lastReg, 30)]); // +-2 (the floor)
  eq(p.irregular, false);
  eq(p.flagged, []);
});

test('cycle: irregular history widens the window and the fertile days', () => {
  const s = startsFrom('2025-11-01', [24, 39, 27, 41, 27, 42, 25, 36]);
  const p = predict({ starts: s, today: add(s[s.length - 1], 2) });
  eq(p.irregular, true);
  const half = toDay(p.nextStart) - toDay(p.window[0]);
  ok(half >= 7, 'half-window ' + half);
  const fertileLen = toDay(p.fertile[1]) - toDay(p.fertile[0]) + 1;
  ok(fertileLen >= 12 && fertileLen <= 14, 'fertile days ' + fertileLen);
  const reg = predict({ starts: REG, today: add(lastReg, 2) });
  const regLen = toDay(reg.fertile[1]) - toDay(reg.fertile[0]) + 1;
  ok(regLen >= 6 && regLen < fertileLen, 'regular fertile ' + regLen);
});

test('cycle: a ~2x gap is flagged and asked about, not silently used', () => {
  // 28s with one 57-day gap in the middle (a forgotten log)
  const s = startsFrom('2025-12-01', [28, 29, 27, 57, 28, 28, 29, 28]);
  const p = predict({ starts: s, today: add(s[s.length - 1], 2) });
  eq(p.flagged.length, 1);
  eq(p.flagged[0].why, 'skipped');
  eq(p.flagged[0].L, 57);
  ok(Math.abs(p.typicalLength - 28) < 0.6, 'prediction ignores the gap: ' + p.typicalLength);
  const st = cycleStatus(rows(s), add(s[s.length - 1], 2));
  eq(st.prompt.kind, 'gap');
  eq(st.prompt.from, s[3]);
  eq(st.prompt.guess, add(s[3], 29)); // round(57/2)
  ok(/^Missed a period around [A-Z][a-z]{2} \d+\?$/.test(st.prompt.text), st.prompt.text);
  // she says it was real: no more question, and the long cycle now counts
  const ok2 = cycleStatus(rows(s, [], [{ id: 'settings', kind: 'settings', okGaps: [s[3]] }]), add(s[s.length - 1], 2));
  eq(ok2.prompt, null);
  ok(ok2.pred.typicalLength > p.typicalLength + 1, 'gap counted: ' + ok2.pred.typicalLength);
});

test('cycle: a 2x gap with little history is still asked about', () => {
  const s = ['2026-07-01', '2026-08-28']; // 58 days, only one cycle logged
  const st = cycleStatus(rows(s), '2026-09-02');
  eq(st.prompt && st.prompt.kind, 'gap');
  eq(st.pred.cyclesUsed, 0);
});

test('cycle: two starts days apart ask "same period?"', () => {
  const s = [...REG.slice(0, 6), add(REG[5], 3)];
  const st = cycleStatus(rows(s), add(REG[5], 5));
  eq(st.prompt.kind, 'short');
  eq(st.prompt.text, 'Starts 3 days apart. Same period?');
});

test('cycle: late period says N days late and the estimate moves later', () => {
  const s = REG.slice(0, 8);
  const last = s[s.length - 1];
  const d31 = cycleStatus(rows(s), add(last, 31));
  eq(d31.pred.late, 3);
  eq(d31.headline, '3 days late');
  ok(d31.pred.nextStart > add(last, 31), 'next after today: ' + d31.pred.nextStart);
  ok(d31.pred.window[0] >= add(last, 31), 'window never starts before today');
  ok(/^Now likely /.test(d31.sub), d31.sub);
  const d34 = cycleStatus(rows(s), add(last, 34));
  eq(d34.headline, '6 days late');
  ok(d34.pred.nextStart > d31.pred.nextStart, 'moved: ' + d31.pred.nextStart + ' -> ' + d34.pred.nextStart);
  eq(d34.phase, 'pms');
  eq(d34.prompt, null);
});

test('cycle: very late pauses predictions and asks about a missed log', () => {
  const s = REG.slice(0, 8);
  const st = cycleStatus(rows(s), add(s[s.length - 1], 45));
  eq(st.pred.veryLate, true);
  eq(st.sub, 'Predictions paused');
  eq(st.prompt.kind, 'late');
  eq(dayMarks(st).size > 0, true);
  ok(![...dayMarks(st).values()].some((m) => m.range || m.fertile), 'no predicted marks when paused');
});

test('cycle: birth control and pregnancy modes turn predictions off', () => {
  for (const [mode, head] of [['birth-control', 'On birth control'], ['pregnant', 'Pregnant']]) {
    const st = cycleStatus(rows(REG, REG_BLEEDS, [{ id: 'settings', kind: 'settings', mode }]), add(lastReg, 10));
    eq(st.pred, null, mode);
    eq(st.headline, head);
    eq(st.sub, 'Predictions off');
    eq(st.helpKey, mode);
    const m = dayMarks(st);
    ok([...m.values()].every((x) => !x.fertile && !x.range), mode + ': no fertile/predicted marks');
    ok(m.get(lastReg) && m.get(lastReg).logged, mode + ': logged days still shown');
  }
  eq(predict({ starts: REG, mode: 'birth-control' }).paused, true);
});

test('cycle: after stopping birth control only new cycles count', () => {
  const old = startsFrom('2025-01-05', [35, 35, 35, 35]);
  const since = '2026-06-01';
  const fresh = startsFrom('2026-06-10', [28, 28]);
  const set = { id: 'settings', kind: 'settings', mode: 'natural', since };
  const st = cycleStatus(rows([...old, ...fresh], [], [set]), add(fresh[2], 3));
  eq(st.pred.cyclesUsed, 2);
  ok(st.pred.typicalLength < 29, 'old 35s ignored: ' + st.pred.typicalLength);
  const none = cycleStatus(rows(old, [], [set]), '2026-06-05');
  eq(none.pred, null);
  eq(none.headline, 'Waiting for a new period');
});

test('cycle: period length is the median of the last 6 logged', () => {
  eq(predict({ starts: REG, periodLengths: [3, 7, 5, 5, 6, 4, 5], today: lastReg }).periodLength, 5);
  eq(predict({ starts: REG, periodLengths: [9, 3, 3, 4, 3, 7, 3], today: lastReg }).periodLength, 3);
  eq(predict({ starts: REG, today: lastReg }).periodLength, 5); // default
  const st = cycleStatus(rows(REG, [7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, null]), add(lastReg, 1));
  eq(st.pred.periodLength, 7);
});

test('cycle: phases for a 28-day cycle', () => {
  const p = predict({ starts: REG, today: lastReg });
  eq(p.cycleLength, 28);
  eq(p.ovulationCycleDay, 15);
  eq(p.phases, { menstrual: [1, 5], follicular: [6, 12], ovulatory: [13, 16], luteal: [17, 28], pms: [24, 28] });
  eq([1, 5, 6, 12, 13, 16, 17, 23, 24, 28, 30].map((d) => phaseOn(p, d)),
    ['menstrual', 'menstrual', 'follicular', 'follicular', 'ovulatory', 'ovulatory', 'luteal', 'luteal', 'pms', 'pms', 'pms']);
});

test('cycle: fertile window = 6 days ending on ovulation, padded by uncertainty', () => {
  const p = predict({ starts: REG, today: lastReg });
  eq(p.ovulationDay, add(lastReg, 14));
  eq(p.fertile, [add(lastReg, 14 - 5 - p.fertilePad), add(lastReg, 14 + p.fertilePad)]);
  ok(p.fertilePad >= 0 && p.fertilePad <= 1, 'regular pad ' + p.fertilePad);
  const st = cycleStatus(rows(REG), add(lastReg, 12));
  eq(st.fertileToday, true);
  eq(st.phase, 'ovulatory');
});

test('cycle: status lines (period day, period soon, due today)', () => {
  eq(cycleStatus(rows(REG), add(lastReg, 1)).headline, 'Period day 2');
  eq(cycleStatus(rows(REG), add(lastReg, 1)).onPeriod, true);
  eq(cycleStatus(rows(REG), add(lastReg, 1)).openPeriod.start, lastReg);
  // ended early: not on her period on day 4
  const ended = cycleStatus(rows(REG, [...REG_BLEEDS.slice(0, 12), 3]), add(lastReg, 3));
  eq(ended.onPeriod, false);
  eq(ended.openPeriod, null);
  const soon = cycleStatus(rows(REG), add(lastReg, 23));
  eq(soon.headline, 'Period in ~5 days');
  eq(soon.sub, 'Likely ' + fmtRange(add(lastReg, 26), add(lastReg, 30)));
  eq(cycleStatus(rows(REG), add(lastReg, 27)).headline, 'Period in ~1 day');
  eq(cycleStatus(rows(REG), add(lastReg, 28)).headline, 'Period due today');
  eq(cycleStatus([], '2026-10-15').headline, 'No period logged');
});

test('cycle: self-accuracy backtest', () => {
  const a = backtest(REG);
  eq(a, { count: 6, within: 0 });
  eq(accuracyText(a), 'Predictions were on the day for the last 6 periods');
  const s = startsFrom('2026-01-01', [28, 30, 27, 29, 31]);
  const b = backtest(s);
  eq(b.count, 4);
  ok(b.within >= 1 && b.within <= 3, 'within ' + b.within);
  eq(accuracyText({ count: 4, within: 2 }), 'Predictions were within 2 days for the last 4 periods');
  eq(backtest(['2026-01-01', '2026-01-29']), null);
});

test('cycle: rows are cleaned (bad dates, duplicates, settings defaults)', () => {
  const r = readRows([
    { id: 'a', kind: 'period', start: '2026-09-01', end: null },
    { id: 'b', kind: 'period', start: '2026-09-01', end: '2026-09-05' },
    { id: 'c', kind: 'period', start: '2026-02-30', end: null },
    { id: 'd', kind: 'period', start: '2026-08-01', end: '2026-07-30' },
    { id: 'settings', kind: 'settings', mode: 'weird', usualLength: 400 },
  ]);
  eq(r.periods, [{ id: 'd', start: '2026-08-01', end: null }, { id: 'b', start: '2026-09-01', end: '2026-09-05' }]);
  eq(r.settings, { mode: 'natural', usualLength: null, since: null, okGaps: [], modeFrom: null });
});

test('cycle: mode changes (stop birth control starts fresh; same-day undo keeps history)', () => {
  const base = readRows([]).settings;
  const bc = nextSettings(base, 'birth-control', null, '2026-03-01');
  eq([bc.mode, bc.modeFrom, bc.since], ['birth-control', '2026-03-01', null]);
  const stopped = nextSettings(bc, 'natural', null, '2026-09-10');
  eq([stopped.mode, stopped.since], ['natural', '2026-09-10']);
  const undo = nextSettings(bc, 'natural', null, '2026-03-01');
  eq([undo.mode, undo.since], ['natural', null]);
  eq(nextSettings(base, 'natural', 31, '2026-03-01'), { ...base, usualLength: 31 });
});

test('cycle: day math is immune to daylight saving', () => {
  eq(cyclesFrom(['2026-03-01', '2026-03-29', '2026-11-01'])[0].L, 28);
  eq(cyclesFrom(['2026-10-15', '2026-11-12'])[0].L, 28);
  eq(cleanCycles([{ from: 'x', to: 'y', L: 12 }]).flagged[0].why, 'short');
});

test('cycle: calendar marks logged, predicted range, likely days and fertile days', () => {
  const st = cycleStatus(rows(REG, REG_BLEEDS), add(lastReg, 8));
  const m = dayMarks(st);
  ok(m.get(lastReg).logged, 'logged start');
  ok(m.get(add(lastReg, 26)).range && m.get(add(lastReg, 30)).range, 'range ends');
  ok(!m.get(add(lastReg, 25)) || !m.get(add(lastReg, 25)).range, 'nothing before range');
  ok(m.get(add(lastReg, 28)).likely, 'likely next start');
  ok(m.get(add(lastReg, 14)).fertile, 'ovulation day fertile');
  ok(m.get(add(lastReg, 28 + 14)).fertile, 'next cycle fertile too');
  ok([...m.values()].every((x) => !(x.fertile && (x.logged || x.likely))), 'fertile never on period days');
  // short, irregular cycles with long bleeds: the padded fertile window reaches the period
  const s = startsFrom('2026-03-02', [21, 30, 22, 31, 21, 29]);
  const st2 = cycleStatus(rows(s, [7, 7, 7, 7, 7, 7, 7]), add(s[s.length - 1], 8));
  ok(toDay(st2.pred.fertile[0]) - toDay(s[s.length - 1]) < 7, 'fixture overlaps: ' + st2.pred.fertile[0]);
  ok([...dayMarks(st2).values()].every((x) => !(x.fertile && (x.logged || x.likely))), 'fertile never on period days (short cycles)');
  const [y, mo] = [+st.today.slice(0, 4), +st.today.slice(5, 7)];
  const cells = monthCells(y, mo, m, st.today);
  eq(cells.length, 42);
  eq(cells.filter((c) => c.today).length, 1);
  eq(cells.find((c) => c.inMonth).day, 1);
  eq(new Date(Date.UTC(+cells[0].date.slice(0, 4), +cells[0].date.slice(5, 7) - 1, +cells[0].date.slice(8, 10))).getUTCDay(), 0);
});

test('cycle: .ics reminder for the next period', () => {
  const t = buildCycleIcs('2026-11-02', new Date(Date.UTC(2026, 9, 15, 12, 0, 0)));
  ok(t.includes('DTSTART;VALUE=DATE:20261102\r\n'), 'start');
  ok(t.includes('DTEND;VALUE=DATE:20261103\r\n'), 'end');
  ok(t.includes('TRIGGER:-P1DT15H'), '2 days before, 9 AM');
  ok(t.includes('DTSTAMP:20261015T120000Z'), 'stamp');
  ok(t.endsWith('END:VCALENDAR\r\n'), 'crlf');
  ok(!/[^\r]\n/.test(t), 'only CRLF line ends');
});
