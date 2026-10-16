import { test, eq, ok } from './harness.mjs';
import { workedBefore, CHECKLIST, REPAIR_LINES } from '../js/logic/arguments.js';

test('workedBefore: top "helped" phrases across all logs, most used first, ties to most recent', () => {
  const list = [
    { id: '1', date: '2026-10-12', topic: 'Chores', helped: 'Made a plan, listened first' },
    { id: '2', date: '2026-09-20', topic: 'Money', helped: 'listened first; took a break' },
    { id: '3', date: '2026-08-30', topic: 'Chores', helped: 'took a break, Listened first, listened first' },
    { id: '4', date: '2026-10-05', topic: 'Phone', helped: 'Phone away' },
    { id: '5', date: '2026-07-01', topic: 'Phone', helped: '' },
  ];
  eq(workedBefore(list), [
    { phrase: 'listened first', n: 3 },
    { phrase: 'took a break', n: 2 },
    { phrase: 'made a plan', n: 1 },
  ]);
  eq(workedBefore(list, 5).map((x) => x.phrase), ['listened first', 'took a break', 'made a plan', 'phone away']);
  eq(workedBefore([]), []);
  eq(workedBefore(undefined), []);
});

test('repair content: 4-6 short checklist items, about 10 short lines', () => {
  ok(CHECKLIST.length >= 4 && CHECKLIST.length <= 6, 'checklist size');
  ok(REPAIR_LINES.length >= 8 && REPAIR_LINES.length <= 12, 'lines size');
  for (const s of [...CHECKLIST, ...REPAIR_LINES]) ok(s.split(/\s+/).length <= 9, 'short: ' + s);
  eq(new Set(REPAIR_LINES).size, REPAIR_LINES.length);
});
