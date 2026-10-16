import { test, eq, ok } from './harness.mjs';
import { suggest } from '../js/logic/suggest.js';
import { nudgeFor, isCheckInDay, LITTLE_THINGS, CHECK_INS } from '../js/logic/nudges.js';
import { parseYMD } from '../js/logic/dates.js';

const T = (s) => parseYMD(s);
const TODAY = T('2026-10-15'); // a Thursday

// Realistic rows, shaped like Firestore's (ids, extra fields).
const bday = { id: 'd1', title: "Sam's birthday", date: '2001-10-27', type: 'birthday', yearly: true, notes: '' };
const anniv = { id: 'd2', title: 'Our anniversary', date: '2025-10-20', type: 'anniversary', yearly: true, notes: '' };
const other = { id: 'd3', title: 'Concert', date: '2026-10-18', type: 'other', yearly: false, notes: '' };
const flowers = { id: 'r1', what: 'Flowers', every: 2, unit: 'week', start: '2026-10-01', time: '17:00' };   // next: Oct 15
const candy = { id: 'r2', what: 'Candy', every: 1, unit: 'month', start: '2026-09-16', time: '17:00' };     // next: Oct 16
const recentDate = [{ id: 'l1', title: 'Bowling', date: '2026-10-10', stops: ['Bowling'], cost: 12 }];
const oldDate = [{ id: 'l1', title: 'Bowling', date: '2026-10-03', stops: ['Bowling'], cost: 12 },
  { id: 'l2', title: 'Picnic', date: '2026-09-20', stops: ['Park'], cost: 8 }];
const period = (start, end) => ({ id: 'c' + start, kind: 'period', start, end });
// Regular 28-day cycles: last start Oct 12 -> period now (cycle day 4).
const onPeriod = [period('2026-07-20', '2026-07-24'), period('2026-08-17', '2026-08-21'), period('2026-09-14', '2026-09-18'), period('2026-10-12', null)];
// Last start Sep 19 -> cycle day 27 of ~28: the PMS days.
const preMenses = [period('2026-06-27', '2026-07-01'), period('2026-07-25', '2026-07-29'), period('2026-08-22', '2026-08-26'), period('2026-09-19', '2026-09-23')];
// Last start Sep 30 -> cycle day 16: nothing to say.
const midCycle = [period('2026-08-05', '2026-08-09'), period('2026-09-02', '2026-09-06'), period('2026-09-30', '2026-10-04')];

test('1: birthday within 14 days wins over everything, goes to Plan with a Gifts link', () => {
  const s = suggest({ today: TODAY, dates: [bday, other], giftReminders: [flowers], dateLog: oldDate, cycles: onPeriod });
  eq(s.kind, 'event');
  eq(s.text, "Plan + gift for Sam's birthday (12 days)");
  eq(s.go, 'plan');
  eq(s.link, ['gifts', 'Gifts']);
});

test('1: anniversary counts too; nearest event wins; today/tomorrow wording', () => {
  eq(suggest({ today: TODAY, dates: [bday, anniv] }).text, 'Plan + gift for Our anniversary (5 days)');
  eq(suggest({ today: T('2026-10-20'), dates: [anniv] }).text, 'Plan + gift for Our anniversary (today)');
  eq(suggest({ today: T('2026-10-19'), dates: [anniv] }).text, 'Plan + gift for Our anniversary (tomorrow)');
});

test('1: 15 days out, "other" dates and passed dates do not count', () => {
  eq(suggest({ today: T('2026-10-12'), dates: [bday] }).kind !== 'event', true, '15 days');
  eq(suggest({ today: T('2026-10-13'), dates: [bday] }).kind, 'event', '14 days');
  ok(suggest({ today: TODAY, dates: [other] }).kind !== 'event', 'other type');
  ok(suggest({ today: TODAY, dates: [{ ...anniv, yearly: false, date: '2026-10-01' }] }).kind !== 'event', 'passed one-time');
});

test('2: gift reminder due today, with her favorite from About her; goes to Gifts', () => {
  const profile = [{ id: 'p1', section: 'favorites', label: 'Flower', value: 'Tulips' }];
  const s = suggest({ today: TODAY, dates: [other], giftReminders: [candy, flowers], dateLog: oldDate, cycles: onPeriod, profile });
  eq(s.kind, 'gift');
  eq(s.text, 'Flowers today · she likes Tulips');
  eq(s.go, 'gifts');
});

test('2: due tomorrow counts; due in 2+ days does not; bad rows ignored', () => {
  eq(suggest({ today: TODAY, giftReminders: [candy] }).text, 'Candy tomorrow');
  ok(suggest({ today: T('2026-10-13'), giftReminders: [flowers] }).kind !== 'gift', '2 days out');
  ok(suggest({ today: TODAY, giftReminders: [{ id: 'x', what: 'Bad', every: 0, unit: 'week', start: '2026-10-15' }] }).kind !== 'gift', 'bad row');
});

test('3: more than 10 days since the last date -> Plan', () => {
  const s = suggest({ today: TODAY, dates: [other], giftReminders: [], dateLog: oldDate, cycles: onPeriod });
  eq(s.kind, 'gap');
  eq(s.text, "It's been 12 days since your last date");
  eq(s.go, 'plan');
  ok(suggest({ today: T('2026-10-13'), dateLog: oldDate }).kind !== 'gap', 'exactly 10 days');
  ok(suggest({ today: TODAY, dateLog: [] }).kind !== 'gap', 'nothing logged');
  ok(suggest({ today: TODAY, dateLog: [...oldDate, { id: 'f', title: 'Planned', date: '2026-10-20' }] }).kind === 'gap', 'future plan does not count');
});

test('4: her period -> gentle tip to Cycle', () => {
  const s = suggest({ today: TODAY, dateLog: recentDate, cycles: onPeriod });
  eq(s.kind, 'cycle');
  eq(s.go, 'cycle');
  ok(/period/i.test(s.text));
});

test('4: PMS days before her period -> tip; mid-cycle -> none', () => {
  const s = suggest({ today: TODAY, dateLog: recentDate, cycles: preMenses });
  eq(s.kind, 'cycle');
  ok(/close/.test(s.text), s.text);
  ok(suggest({ today: TODAY, dateLog: recentDate, cycles: midCycle }).kind !== 'cycle', 'mid-cycle');
});

test('4: birth control / pregnancy modes and very late cycles give no cycle tip', () => {
  for (const mode of ['birth-control', 'pregnant']) {
    const rows = [...onPeriod, { id: 'set', kind: 'settings', mode, usualLength: null, okGaps: [] }];
    ok(suggest({ today: TODAY, cycles: rows }).kind !== 'cycle', mode);
  }
  const veryLate = [period('2026-06-01', '2026-06-05'), period('2026-06-29', '2026-07-03'), period('2026-07-27', '2026-07-31')];
  ok(suggest({ today: TODAY, cycles: veryLate }).kind !== 'cycle', 'very late');
});

test('5: otherwise a little thing on weekdays; Sunday is the check-in question', () => {
  const s = suggest({ today: TODAY, dates: [other], dateLog: recentDate, cycles: midCycle });
  eq(s.kind, 'little');
  ok(LITTLE_THINGS.includes(s.text));
  eq(s.next, true);
  ok(!s.go, 'tap shows the next one, not a screen');
  const sun = suggest({ today: T('2026-10-18') });
  eq(sun.kind, 'checkin');
  ok(CHECK_INS.includes(sun.text));
  eq(suggest({ today: TODAY }).kind, 'little', 'no data at all');
});

test('nudges: enough content, short lines, stable per day, rotate with offset', () => {
  ok(LITTLE_THINGS.length >= 40, 'little things ' + LITTLE_THINGS.length);
  ok(CHECK_INS.length >= 30, 'check-ins ' + CHECK_INS.length);
  for (const t of [...LITTLE_THINGS, ...CHECK_INS]) ok(t.length <= 60, 'too long: ' + t);
  eq(new Set(LITTLE_THINGS).size, LITTLE_THINGS.length, 'no duplicate little things');
  eq(new Set(CHECK_INS).size, CHECK_INS.length, 'no duplicate check-ins');
  eq(isCheckInDay(T('2026-10-18')), true);
  eq(isCheckInDay(TODAY), false);
  eq(nudgeFor(TODAY).text, nudgeFor(T('2026-10-15')).text, 'same day, same nudge');
  ok(nudgeFor(TODAY).text !== nudgeFor(T('2026-10-16')).text, 'changes daily');
  ok(nudgeFor(TODAY, 1).text !== nudgeFor(TODAY).text, 'next shows another');
  eq(nudgeFor(TODAY, LITTLE_THINGS.length).text, nudgeFor(TODAY).text, 'wraps');
  eq(nudgeFor(T('2026-10-18')).text, nudgeFor(T('2026-10-25'), -1).text, 'check-in changes weekly');
  ok(typeof nudgeFor(TODAY, -5).text === 'string', 'negative offset ok');
});

// Follow-ups ("ask how her interview went"): rows shaped like the followUps contract.
const interview = { id: 'f1', text: 'Ask how her interview went', date: '2026-10-15', done: false };
const examLate = { id: 'f2', text: 'Ask how the exam went', date: '2026-10-13', done: false };
const tripLater = { id: 'f3', text: 'Ask about her trip', date: '2026-10-16', done: false };

test('follow-up due today is the top suggestion, with Done', () => {
  const s = suggest({ today: TODAY, dates: [bday, other], giftReminders: [flowers], dateLog: oldDate, cycles: onPeriod, followUps: [interview, tripLater] });
  eq(s.kind, 'followup', 'beats a birthday 12 days out, gift reminder, gap and cycle');
  eq(s.text, 'Ask how her interview went');
  eq(s.done, 'f1');
  ok(!s.go && !s.next, 'tap Done, not a screen');
});

test('follow-up: overdue counts (oldest first), done and future ones do not', () => {
  eq(suggest({ today: TODAY, followUps: [interview, examLate] }).done, 'f2');
  eq(suggest({ today: TODAY, followUps: [interview, examLate] }).late, 2);
  ok(suggest({ today: TODAY, followUps: [tripLater] }).kind !== 'followup', 'tomorrow');
  ok(suggest({ today: TODAY, followUps: [{ ...interview, done: true }] }).kind !== 'followup', 'done');
  eq(suggest({ today: TODAY, followUps: [{ ...interview, done: true }], dates: [bday] }).kind, 'event', 'falls through to the birthday');
});

test('follow-up: a birthday or anniversary within 3 days still wins', () => {
  eq(suggest({ today: T('2026-10-17'), dates: [anniv], followUps: [interview] }).kind, 'event', '3 days');
  eq(suggest({ today: T('2026-10-16'), dates: [anniv], followUps: [interview] }).kind, 'followup', '4 days');
  eq(suggest({ today: T('2026-10-20'), dates: [anniv], followUps: [interview] }).kind, 'event', 'today');
});
