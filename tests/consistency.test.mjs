// One number = one function: the same question gets the same answer everywhere.
// 2026-10-17 batch 1: savedFor picks the newest row, gift "added" sorts by real time, Plan and Card count uses the same way.
import { test, eq, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { usesLeft as planUsesLeft, pickDeal } from '../js/logic/plan.js';
import { usesLeft as cardUsesLeft } from '../js/logic/card.js';
import { savedFor } from '../js/logic/share.js';
import * as G from '../js/logic/gifts.js';
const { ideasOf } = G;
const addedMs = (g) => G.addedMs(g);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { stops } = JSON.parse(readFileSync(join(root, 'data/plan-stops.json'), 'utf8'));

/* ---------------- uses left ---------------- */

test('uses: Plan and Card use the same usesLeft', () => {
  ok(planUsesLeft === cardUsesLeft, 'plan.js and card.js export one function');
});

test('uses: a deal with no printed uses counts as one use in Plan too', () => {
  // Real stop and deal shape from plan-stops.json, with `uses` taken away.
  const stop = stops.find((s) => (s.deals || []).some((d) => d.uses !== 'unlimited' && +d.uses > 0));
  const deal = { ...stop.deals.find((d) => d.uses !== 'unlimited' && +d.uses > 0) };
  delete deal.uses;
  eq(planUsesLeft(deal, []), cardUsesLeft(deal, []), 'same answer');
  eq(planUsesLeft(deal, []), 1);
  eq(planUsesLeft(deal, [{ dealId: deal.id, date: '2026-10-01' }]), 0);
  // pickDeal skips a deal with no uses left, so the missing count decides whether Plan offers it.
  const one = { ...stop, deals: [deal] };
  const got = pickDeal(one, 6, 19 * 60, 10, []);
  const card = cardUsesLeft(deal, []);
  ok(card > 0, 'card says usable');
  ok(!got || got.left === card, 'plan left matches card');
});

/* ---------------- saved plan for a day ---------------- */

const row = (id, date, seconds, extra = {}) => ({ id, date, title: id, at: '18:00', stops: [{ id: 's1', name: 'A', at: '18:00' }],
  updatedAt: seconds == null ? null : { seconds, nanoseconds: 0 }, ...extra });

test('savedFor: the newest saved row wins, whatever the list order', () => {
  // Firestore returns rows in document-id order, not save order.
  const newer = row('aaa', '2026-10-17', 1760700000);
  const older = row('zzz', '2026-10-17', 1760600000);
  eq(savedFor([newer, older], '2026-10-17').id, 'aaa');
  eq(savedFor([older, newer], '2026-10-17').id, 'aaa');
});

test('savedFor: a row still saving (no server time yet) is the newest', () => {
  const pending = row('mmm', '2026-10-17', null);
  const done = row('nnn', '2026-10-17', 1760700000);
  eq(savedFor([pending, done], '2026-10-17').id, 'mmm');
  eq(savedFor([done, pending], '2026-10-17').id, 'mmm');
});

test('savedFor: other days and empty plans are ignored', () => {
  eq(savedFor([row('a', '2026-10-18', 5)], '2026-10-17'), null);
  eq(savedFor([row('a', '2026-10-17', 5, { stops: [] })], '2026-10-17'), null);
  eq(savedFor(null, '2026-10-17'), null);
});

/* ---------------- gift "added" ---------------- */

// Rows hold either a full ISO time (quick add, "She mentioned…") or a plain day (older "Mark given" rows).
test('gifts: added reads ISO times and plain days on one clock', () => {
  eq(addedMs({ added: '2026-10-16' }), new Date(2026, 9, 16).getTime());
  eq(addedMs({ added: '2026-10-16T02:00:00.000Z' }), Date.UTC(2026, 9, 16, 2));
  eq(addedMs({}), 0);
  eq(addedMs({ added: 'junk' }), 0);
});

test('gifts: ideas sort by when they were added, mixing both formats', () => {
  // Added in the evening of Oct 15 (local time) vs a plain Oct 16 row: the Oct 16 row is newer.
  const eve15 = new Date(2026, 9, 15, 20, 0).toISOString();
  const morning16 = new Date(2026, 9, 16, 9, 0).toISOString();
  const list = [
    { id: 'e', title: 'Evening 15', added: eve15 },
    { id: 'p', title: 'Plain 16', added: '2026-10-16' },
    { id: 'm', title: 'Morning 16', added: morning16 },
    { id: 'o', title: 'Old plain', added: '2026-10-01' },
    { id: 'n', title: 'No date' },
  ];
  eq(ideasOf(list).map((g) => g.id), ['m', 'p', 'e', 'o', 'n']);
});
