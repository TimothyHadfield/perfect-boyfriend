import { test, eq, ok } from './harness.mjs';
import { parseYMD } from '../js/logic/dates.js';
import { hasPatterns, patterns, PATTERN_MIN } from '../js/logic/arguments.js';

const today = parseYMD('2026-10-15');

test('patterns show only from 3 entries with a topic', () => {
  eq(PATTERN_MIN, 3);
  eq(hasPatterns([]), false);
  eq(hasPatterns(undefined), false);
  const two = [{ date: '2026-10-01', topic: 'Chores' }, { date: '2026-10-02', topic: 'Money' }];
  eq(hasPatterns(two), false);
  eq(hasPatterns([...two, { date: '2026-10-03', topic: '  ' }]), false, 'blank topic not counted');
  eq(hasPatterns([...two, { date: '2026-10-03', topic: 'chores' }]), true);
});

test('pattern counting: topic counts and what worked most per topic', () => {
  const list = [
    { id: '1', date: '2026-10-12', topic: 'Chores', helped: 'Made a plan, listened first', outcome: 'resolved' },
    { id: '2', date: '2026-09-20', topic: 'chores', helped: 'listened first', outcome: 'resolved' },
    { id: '3', date: '2026-08-30', topic: 'Chores ', helped: 'took a break; listened first', outcome: 'open' },
    { id: '4', date: '2026-10-05', topic: 'Phone at dinner', helped: 'Phone away', outcome: 'resolved' },
    { id: '5', date: '2026-07-01', topic: 'Phone at dinner', helped: 'said sorry', outcome: 'resolved' },
    { id: '6', date: '2026-01-10', topic: 'Money', helped: '', outcome: 'revisit' },
  ];
  ok(hasPatterns(list));
  const p = patterns(list, today);
  eq(p.map((x) => [x.topic, x.count]), [['Chores', 3], ['Phone at dinner', 2], ['Money', 1]]);
  eq(p[0].helped, { phrase: 'listened first', n: 3 });
  eq(p[1].helped, { phrase: 'phone away', n: 1 }, 'tie goes to most recent');
  eq(p[2].helped, null);
});
