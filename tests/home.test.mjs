import { test, eq, ok } from './harness.mjs';
import { latestEntry, daysSinceLatest, milestones } from '../js/logic/home.js';
import { parseYMD } from '../js/logic/dates.js';

const T = (s) => parseYMD(s);

test('latest entry: newest past-or-today date wins; future and undated ignored', () => {
  const list = [
    { id: 'a', title: 'Picnic', date: '2026-09-01' },
    { id: 'b', title: 'Bowling', date: '2026-10-10' },
    { id: 'c', title: 'Planned', date: '2026-12-01' },
    { id: 'd', title: 'No date' },
  ];
  eq(latestEntry(list, T('2026-10-15')).id, 'b');
  eq(latestEntry([], T('2026-10-15')), null);
  eq(latestEntry(undefined, T('2026-10-15')), null);
  eq(daysSinceLatest(list, T('2026-10-15')), 5);
  eq(daysSinceLatest([], T('2026-10-15')), null);
});

test('milestones: 100/200/500/1000 days after a yearly anniversary (365 is the yearly row)', () => {
  const anniv = { id: 'a1', title: 'Our anniversary', date: '2026-08-01', type: 'anniversary', yearly: true };
  const m = milestones([anniv], T('2026-10-15'));
  eq(m.map((x) => [x.title, x.date, x.days]), [
    ['100 days together', '2026-11-09', 25],
    ['200 days together', '2027-02-17', 125],
    ['500 days together', '2027-12-14', 425],
    ['1000 days together', '2029-04-27', 925],
  ]);
  eq(m[0].id, 'a1', 'tapping opens the anniversary');
  eq(m[0].type, 'anniversary');
  eq(m[0].next, { y: 2026, m: 11, d: 9 });
});

test('milestones: one-time anniversary keeps 365; passed ones and other types dropped; today counts', () => {
  const once = { id: 'a2', title: 'First date', date: '2025-10-15', type: 'anniversary', yearly: false };
  const m = milestones([once, { id: 'b', title: 'Bday', date: '2025-10-15', type: 'birthday', yearly: true }], T('2026-10-15'));
  eq(m.map((x) => [x.milestone, x.days]), [[365, 0], [500, 135], [1000, 635]]);
  eq(milestones([{ id: 'x', type: 'anniversary', date: 'bad' }], T('2026-10-15')), []);
  eq(milestones(undefined, T('2026-10-15')), []);
});
