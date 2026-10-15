import { test, eq, ok } from './harness.mjs';
import { parseYMD, nextOccurrence, daysUntil, upcoming, countdownLabel } from '../js/logic/dates.js';

const T = (s) => parseYMD(s);

test('parseYMD reads YYYY-MM-DD and rejects junk', () => {
  eq(parseYMD('2026-10-15'), { y: 2026, m: 10, d: 15 });
  eq(parseYMD('2026-02-30'), null, 'Feb 30');
  eq(parseYMD('hello'), null);
  eq(parseYMD(''), null);
});

test('same day is 0 days ("today")', () => {
  eq(daysUntil({ date: '1999-10-15', yearly: true }, T('2026-10-15')), 0);
  eq(countdownLabel(0), 'today!');
});

test('yearly date later this year', () => {
  eq(daysUntil({ date: '2000-10-20', yearly: true }, T('2026-10-15')), 5);
});

test('yearly date already passed this year rolls to next year', () => {
  // Oct 14 2026 -> Oct 14 2027 is 364 days from Oct 15 2026
  eq(daysUntil({ date: '2000-10-14', yearly: true }, T('2026-10-15')), 364);
});

test('crosses New Year', () => {
  eq(daysUntil({ date: '2020-01-02', yearly: true }, T('2026-12-30')), 3);
});

test('Feb 29 birthday falls on Feb 28 in a non-leap year', () => {
  eq(nextOccurrence({ date: '2004-02-29', yearly: true }, T('2026-02-01')), { y: 2026, m: 2, d: 28 });
  eq(daysUntil({ date: '2004-02-29', yearly: true }, T('2026-02-28')), 0);
});

test('Feb 29 birthday is Feb 29 in a leap year', () => {
  eq(nextOccurrence({ date: '2004-02-29', yearly: true }, T('2028-01-01')), { y: 2028, m: 2, d: 29 });
  // Feb 28 2028 is the day before; not "today"
  eq(daysUntil({ date: '2004-02-29', yearly: true }, T('2028-02-28')), 1);
});

test('Feb 29 after it passed in a non-leap year goes to next year', () => {
  // Mar 1 2027 -> Feb 29 2028 (leap) = 365 days
  eq(daysUntil({ date: '2004-02-29', yearly: true }, T('2027-03-01')), 365);
});

test('one-time date in the future and in the past', () => {
  eq(daysUntil({ date: '2026-11-01', yearly: false }, T('2026-10-15')), 17);
  eq(daysUntil({ date: '2026-10-01', yearly: false }, T('2026-10-15')), -14);
});

test('days count is exact across DST changes', () => {
  // US DST ends Nov 1 2026; whole days still whole
  eq(daysUntil({ date: '2026-11-10', yearly: false }, T('2026-10-31')), 10);
  eq(daysUntil({ date: '2027-03-20', yearly: false }, T('2027-03-01')), 19);
});

test('upcoming sorts soonest first, drops past one-time dates and bad rows', () => {
  const list = [
    { id: 'a', title: 'Anniversary', date: '2023-06-01', yearly: true },
    { id: 'b', title: 'Concert', date: '2026-10-01', yearly: false },
    { id: 'c', title: 'Birthday', date: '1999-10-15', yearly: true },
    { id: 'd', title: 'Trip', date: '2026-10-20', yearly: false },
    { id: 'e', title: 'Broken', date: 'nope', yearly: true },
  ];
  const out = upcoming(list, T('2026-10-15'));
  eq(out.map((x) => x.id), ['c', 'd', 'a']);
  eq(out.map((x) => x.days), [0, 5, 229]);
});

test('upcoming breaks ties by title', () => {
  const list = [
    { id: 'z', title: 'Zed', date: '2000-12-01', yearly: true },
    { id: 'y', title: 'Amy', date: '2001-12-01', yearly: true },
  ];
  eq(upcoming(list, T('2026-10-15')).map((x) => x.id), ['y', 'z']);
});

test('countdown labels', () => {
  eq(countdownLabel(1), 'in 1 day');
  eq(countdownLabel(12), 'in 12 days');
  eq(countdownLabel(-3), 'passed');
});

test('handles a realistic list of 60 dates quickly', () => {
  const list = [];
  for (let i = 0; i < 60; i++) {
    const m = (i % 12) + 1, d = (i % 28) + 1;
    list.push({ id: 'x' + i, title: 'Date ' + i, date: `1990-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, yearly: i % 3 !== 0 });
  }
  const out = upcoming(list, T('2026-10-15'));
  ok(out.length > 30 && out.length <= 60, 'count ' + out.length);
  for (let i = 1; i < out.length; i++) ok(out[i - 1].days <= out[i].days, 'sorted');
});
