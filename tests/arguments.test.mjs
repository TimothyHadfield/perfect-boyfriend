import { test, eq, ok } from './harness.mjs';
import { parseYMD } from '../js/logic/dates.js';
import {
  splitPhrases, topicList, daysSinceLast, topPhrase, patterns, sortLog, cleanEntry, daysAgo,
} from '../js/logic/arguments.js';

const T = (s) => parseYMD(s);
const today = T('2026-10-15');

test('splitPhrases: commas, semicolons, new lines; case and punctuation ignored', () => {
  eq(splitPhrases('Listened first, Hugged;  took a BREAK.\nsaid sorry!'),
    ['listened first', 'hugged', 'took a break', 'said sorry']);
  eq(splitPhrases(''), []);
  eq(splitPhrases(undefined), []);
  eq(splitPhrases(' , ; '), []);
  eq(splitPhrases("didn't yell"), ["didn't yell"]);
});

test('topic list: most used first, spelled as last written, case-insensitive', () => {
  const list = [
    { date: '2026-01-01', topic: 'chores' },
    { date: '2026-02-01', topic: 'Money' },
    { date: '2026-03-01', topic: 'Chores ' },
    { date: '2026-04-01', topic: '  ' },
  ];
  eq(topicList(list), ['Chores', 'Money']);
  eq(topicList([]), []);
});

test('days since last ignores future and bad dates', () => {
  eq(daysSinceLast([{ date: '2026-10-10' }, { date: '2026-10-01' }, { date: '2026-12-01' }, { date: 'x' }], today), 5);
  eq(daysSinceLast([{ date: '2026-10-15' }], today), 0);
  eq(daysSinceLast([], today), null);
  eq(daysSinceLast([{ date: '2027-01-01' }], today), null);
});

test('top phrase: most often wins, ties go to most recent, counted once per entry', () => {
  eq(topPhrase(['hugged, hugged', 'listened', 'hugged']), { phrase: 'hugged', n: 2 });
  eq(topPhrase(['listened', 'hugged']), { phrase: 'listened', n: 1 });
  eq(topPhrase(['', undefined]), null);
});

test('90-day window: 89 days ago counts, 90 does not', () => {
  eq(daysAgo('2026-07-18', today), 89);
  const p = patterns([
    { date: '2026-07-18', topic: 'A' },
    { date: '2026-07-17', topic: 'A' },
  ], today);
  eq(p[0].count90, 1);
  eq(p[0].count, 2);
});

// Realistic year of entries: 40 rows across 6 topics.
function yearOfData() {
  const topics = ['Chores', 'Phone at dinner', 'Money', 'Family visits', 'Being late', 'Plans'];
  const helped = ['listened first', 'took a break', 'said sorry', 'hugged', 'made a plan'];
  const worse = ['raised voice', 'phone out', 'brought up old stuff'];
  const list = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2026, 9, 14) - i * 9 * 86400000);
    const ymd = d.toISOString().slice(0, 10);
    const t = i % 7 === 0 ? 'Money' : topics[i % 3];
    list.push({
      id: 'r' + i, date: ymd, topic: i % 2 ? t.toLowerCase() : t,
      trigger: 'something ' + i,
      helped: i % 3 === 0 ? `${helped[0]}, ${helped[i % 5]}` : helped[i % 5],
      worse: worse[i % 3],
      outcome: i % 5 === 0 ? 'revisit' : 'resolved',
      intensity: (i % 3) + 1,
    });
  }
  return list;
}

test('patterns on a realistic year: ranked by 90 days then all time', () => {
  const list = yearOfData();
  const p = patterns(list, today);
  ok(p.length >= 3 && p.length <= 6, 'topic count ' + p.length);
  for (let i = 1; i < p.length; i++) {
    ok(p[i - 1].count90 > p[i].count90 || (p[i - 1].count90 === p[i].count90 && p[i - 1].count >= p[i].count), 'ranked');
  }
  eq(p.reduce((s, x) => s + x.count, 0), 40, 'every row counted once');
  // Recount by hand for one topic.
  const chores = p.find((x) => x.key === 'chores');
  const rows = list.filter((e) => e.topic.toLowerCase() === 'chores');
  eq(chores.count, rows.length);
  eq(chores.count90, rows.filter((e) => daysAgo(e.date, today) < 90).length);
  eq(chores.last, sortLog(rows)[0].date);
  eq(chores.revisit.length, rows.filter((e) => e.outcome === 'revisit').length);
  ok(chores.helped && chores.helped.n >= 2, 'helped phrase found');
  ok(chores.worse && chores.worse.n >= 2, 'worse phrase found');
});

test('patterns: helped/worse/revisit per topic, future entries not "last"', () => {
  const p = patterns([
    { id: 'a', date: '2026-10-01', topic: 'Chores', helped: 'Listened first, hugged', worse: 'Raised voice', outcome: 'resolved' },
    { id: 'b', date: '2026-09-01', topic: 'chores', helped: 'listened first.', worse: '', outcome: 'revisit' },
    { id: 'c', date: '2026-12-01', topic: 'Chores', helped: '', outcome: 'resolved' },
    { id: 'd', date: '2026-10-10', topic: 'Money', helped: 'made a plan', outcome: 'open' },
  ], today);
  eq(p.map((x) => x.topic), ['Chores', 'Money']);
  eq(p[0].count, 3);
  eq(p[0].last, '2026-10-01');
  eq(p[0].lastDays, 14);
  eq(p[0].helped, { phrase: 'listened first', n: 2 });
  eq(p[0].worse, { phrase: 'raised voice', n: 1 });
  eq(p[0].revisit.map((e) => e.id), ['b']);
  eq(p[1].revisit, []);
  eq(patterns([], today), []);
});

test('cleanEntry keeps rows small and valid', () => {
  const e = cleanEntry({ id: 'x', date: '2026-10-15', topic: '  Chores  again ', intensity: '9', outcome: 'weird', notes: 'n'.repeat(5000) });
  eq(e.topic, 'Chores again');
  eq(e.intensity, 2);
  eq(e.outcome, 'resolved');
  eq(e.notes.length, 2000);
  eq(cleanEntry({ date: 'nope' }).date, '');
  eq(cleanEntry({ date: '2026-10-15', intensity: 3, outcome: 'revisit' }).intensity, 3);
});
