import { test, eq, ok } from './harness.mjs';
import { buildBackup, backupName, parseBackup, validateBackup, planRestore, BACKUP_APP } from '../js/logic/backup.js';

const LISTS = ['gifts', 'dateLog', 'giftReminders', 'cycles', 'arguments', 'sscUses', 'followUps', 'savedPlans'];

// A Firestore Timestamp look-alike (what updatedAt holds in S).
const ts = (iso) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0, toDate: () => new Date(iso) });

// Realistic state: sizes like a few months of use. No real partner data.
function makeS() {
  const dates = Array.from({ length: 12 }, (_, i) => ({
    id: 'd' + i, title: 'Date ' + i, date: `2026-0${(i % 9) + 1}-1${i % 9}`, type: i ? 'other' : 'birthday',
    yearly: i < 3, notes: '', updatedAt: ts('2026-10-01T12:00:00Z'),
  }));
  const profile = Array.from({ length: 20 }, (_, i) => ({ id: 'p' + i, section: 'favorites', label: 'Thing ' + i, value: 'Value ' + i }));
  const S = {
    dates, profile, settings: { holidays: { valentines: true }, monthlyBudget: 120, updatedAt: ts('2026-10-01T12:00:00Z') },
    gifts: Array.from({ length: 15 }, (_, i) => ({ id: 'g' + i, name: 'Gift ' + i, status: 'idea', updatedAt: ts('2026-10-02T00:00:00Z') })),
    dateLog: Array.from({ length: 8 }, (_, i) => ({ id: 'l' + i, date: '2026-09-0' + (i + 1), title: 'Plan ' + i })),
    giftReminders: [{ id: 'r1', what: 'Flowers', every: 14 }],
    cycles: Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i, start: `2026-0${i + 3}-02` })),
    arguments: Array.from({ length: 5 }, (_, i) => ({ id: 'a' + i, date: '2026-10-0' + (i + 1), topic: 'Chores', helped: 'listened' })),
    sscUses: [{ id: 'u1', dealId: 'x', date: '2026-10-01' }],
    // followUps and savedPlans missing on purpose (screens not merged yet).
  };
  return S;
}

const NOW = new Date(2026, 9, 15, 9, 30);

test('buildBackup: dates, profile, settings and every list; missing lists become []', () => {
  const b = buildBackup(makeS(), LISTS, NOW);
  eq(b.app, BACKUP_APP);
  eq(b.version, 1);
  eq(b.dates.length, 12);
  eq(b.profile.length, 20);
  eq(b.settings.monthlyBudget, 120);
  eq(Object.keys(b.lists), LISTS);
  eq(b.lists.gifts.length, 15);
  eq(b.lists.followUps, []);
  eq(b.lists.savedPlans, []);
  eq(b.dates[0].updatedAt, '2026-10-01T12:00:00.000Z', 'timestamps become ISO text');
  eq(b.settings.updatedAt, '2026-10-01T12:00:00.000Z');
  ok(validateBackup(JSON.parse(JSON.stringify(b))).ok, 'own output validates');
});

test('backupName uses the local date', () => {
  eq(backupName(NOW), 'perfect-boyfriend-backup-2026-10-15.json');
  eq(backupName(new Date(2027, 0, 5)), 'perfect-boyfriend-backup-2027-01-05.json');
});

test('validateBackup refuses anything that is not our file', () => {
  const good = JSON.parse(JSON.stringify(buildBackup(makeS(), LISTS, NOW)));
  const bad = [
    null, 42, 'text', [], {},
    { ...good, app: 'other-app' },
    { ...good, version: 'x' },
    { ...good, dates: 'nope' },
    { ...good, dates: [{ title: 'no id' }] },
    { ...good, dates: [{ id: 'a/b', title: 'slash id' }] },
    { ...good, profile: [{ id: 5 }] },
    { ...good, lists: [] },
    { ...good, lists: { gifts: 'x' } },
    { ...good, lists: { gifts: [null] } },
  ];
  bad.forEach((x, i) => {
    const r = validateBackup(x);
    eq(r.ok, false, 'case ' + i);
    ok(typeof r.error === 'string' && r.error.length > 0 && r.error.length < 80, 'friendly message ' + i);
  });
  eq(validateBackup(good).ok, true);
});

test('parseBackup: bad JSON and wrong shape get a friendly message', () => {
  eq(parseBackup('{not json').ok, false);
  eq(parseBackup('{"a":1}').ok, false);
  const text = JSON.stringify(buildBackup(makeS(), LISTS, NOW));
  const r = parseBackup(text);
  eq(r.ok, true);
  eq(r.data.dates.length, 12);
});

test('planRestore: same file adds 0 and skips everything', () => {
  const S = makeS();
  const b = JSON.parse(JSON.stringify(buildBackup(S, LISTS, NOW)));
  const p = planRestore(b, S, LISTS);
  eq(p.added, 0);
  eq(p.skipped, 12 + 20 + 15 + 8 + 1 + 6 + 5 + 1);
  eq(p.dates, []);
  eq(p.profile, null, 'profile untouched');
  for (const n of LISTS) eq(p.lists[n], [], n);
});

test('planRestore: adds only missing ids, never touches existing rows', () => {
  const old = makeS();
  const b = JSON.parse(JSON.stringify(buildBackup(old, LISTS, NOW)));
  b.lists.followUps = [{ id: 'f1', text: 'Ask about the interview', date: '2026-10-17', updatedAt: '2026-10-10T00:00:00.000Z' }];
  // Now: some rows were deleted since the backup, one was edited.
  const now = makeS();
  now.dates = now.dates.slice(2);                     // d0, d1 gone
  now.dates[0] = { ...now.dates[0], title: 'Edited' };
  now.profile = now.profile.filter((x) => x.id !== 'p5');
  now.profile.push({ id: 'p99', section: 'notes', label: 'New', value: 'kept' });
  now.gifts = now.gifts.slice(0, 10);                 // g10..g14 gone
  const p = planRestore(b, now, LISTS);
  eq(p.dates.map((d) => d.id), ['d0', 'd1']);
  ok(!('updatedAt' in p.dates[0]), 'updatedAt stripped (backend stamps it)');
  eq(p.lists.gifts.map((g) => g.id), ['g10', 'g11', 'g12', 'g13', 'g14']);
  eq(p.lists.followUps.map((g) => g.id), ['f1']);
  ok(!('updatedAt' in p.lists.followUps[0]));
  // Profile: whole current list kept as is, p5 appended.
  eq(p.profile.length, 21);
  eq(p.profile.slice(0, 20), now.profile);
  eq(p.profile[20].id, 'p5');
  eq(p.added, 2 + 1 + 5 + 1);
  eq(p.skipped, 10 + 19 + 10 + 8 + 1 + 6 + 5 + 1);
});

test('planRestore: ignores lists the app does not know, and missing current keys', () => {
  const b = JSON.parse(JSON.stringify(buildBackup(makeS(), LISTS, NOW)));
  b.lists.mystery = [{ id: 'm1' }];
  delete b.lists.cycles;
  const p = planRestore(b, { dates: [], profile: [], settings: {} }, LISTS);
  ok(!('mystery' in p.lists));
  eq(p.lists.cycles, []);
  eq(p.lists.gifts.length, 15);
  eq(p.added, 12 + 20 + 15 + 8 + 1 + 5 + 1);
  eq(p.skipped, 0);
});

test('planRestore: duplicate ids inside the file are added once', () => {
  const b = JSON.parse(JSON.stringify(buildBackup(makeS(), LISTS, NOW)));
  b.lists.gifts.push({ ...b.lists.gifts[0] });
  const p = planRestore(b, { dates: [], profile: [] }, LISTS);
  eq(p.lists.gifts.length, 15);
});
