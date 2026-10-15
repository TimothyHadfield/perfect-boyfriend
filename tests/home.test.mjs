import { test, eq, ok } from './harness.mjs';
import { latestEntry, IDEAS, ideaFor } from '../js/logic/home.js';
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
});

test('ideas rotate daily and wrap around', () => {
  ok(IDEAS.length >= 10, 'enough ideas');
  const a = ideaFor(T('2026-10-15'), 0), b = ideaFor(T('2026-10-16'), 0);
  ok(a !== b, 'changes day to day');
  eq(ideaFor(T('2026-10-15'), IDEAS.length), a, 'offset wraps');
  ok(typeof ideaFor(T('2026-10-15'), -1) === 'string', 'negative offset ok');
});
