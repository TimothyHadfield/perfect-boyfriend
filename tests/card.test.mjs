// Card screen logic, run against the real data/ssc-deals.json (421 deals).
import { test, eq, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { usesLeft, leftLabel, sections, matches, filterDeals, totals, lastUse, useRow, todayYMD } from '../js/logic/card.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const deals = JSON.parse(readFileSync(join(root, 'data/ssc-deals.json'), 'utf8')).deals;
const D = (id) => { const d = deals.find((x) => x.id === id); if (!d) throw new Error('no deal ' + id); return d; };
const use = (dealId, date, secs) => ({ id: dealId + date + (secs || ''), dealId, date, updatedAt: secs == null ? null : { seconds: secs, nanoseconds: 0 } });

test('card data: 421 deals, 7 sections, every deal has a usable uses value', () => {
  eq(deals.length, 421);
  eq(sections(deals), ['Free Stuff', 'Treats & Drinks', 'Sandwiches & Burgers', 'Pizza', 'Restaurants', 'Entertainment', 'Retail, Auto & More']);
  for (const d of deals) ok(d.uses === 'unlimited' || d.uses >= 1, d.id + ' uses ' + d.uses);
});

test('usesLeft: printed - punched on paper - logged in the app, never below 0', () => {
  eq(usesLeft(D('free-004')), 3);                                   // 3 printed, none used
  eq(usesLeft(D('treats-037')), 2);                                 // 3 printed, 1 punched
  eq(usesLeft(D('treats-037'), [use('treats-037', '2026-10-01')]), 1);
  eq(usesLeft(D('treats-037'), [use('treats-037', '2026-10-01'), use('free-004', '2026-10-01')]), 1, 'other deals don\'t count');
  eq(usesLeft(D('free-014')), 0);                                   // punched out on paper
  eq(usesLeft(D('free-014'), [use('free-014', '2026-10-01')]), 0, 'no negatives');
  eq(usesLeft(D('free-080')), Infinity);                            // unlimited
  eq(usesLeft(D('free-080'), [use('free-080', '2026-10-01')]), Infinity);
  eq(usesLeft({ id: 'x', uses: null, used: 0 }), 1, 'missing count = one use');
  eq(usesLeft({ id: 'x', uses: null, used: 0 }, [use('x', '2026-10-01')]), 0);
});

test('leftLabel', () => {
  eq(leftLabel(2), '2 left');
  eq(leftLabel(0), 'Used up');
  eq(leftLabel(Infinity), 'Unlimited');
});

test('totals: whole card, unlimited deals count as deals but add no uses', () => {
  eq(totals(deals), { deals: 416, uses: 704 });
  const t = totals(deals, [use('free-004', '2026-10-01'), use('free-001', '2026-10-02'), use('free-080', '2026-10-02')]);
  eq(t, { deals: 415, uses: 702 }, 'free-001 ran out; free-004 down one; unlimited unchanged');
});

test('search: business or deal text, every word, punctuation-blind', () => {
  ok(matches(D('free-003'), 'auntie annes'));
  ok(matches(D('free-003'), "Auntie Anne's lemonade"));
  ok(matches(D('free-003'), '  LEMONADE  '));
  ok(!matches(D('free-003'), 'lemonade pretzel'), 'all words must match');
  ok(!matches(D('free-003'), 'lehi'), 'place is not searched');
  ok(matches(D('free-003'), ''));
  const anne = filterDeals(deals, { q: 'auntie anne' }).map((r) => r.deal.id);
  eq(anne, ['free-003', 'treats-001', 'treats-002']);
});

test('filter: section chip, hide used-up, and both with search', () => {
  eq(filterDeals(deals, {}).length, 421);
  eq(filterDeals(deals, { section: 'Pizza' }).length, 29);
  ok(filterDeals(deals, { section: 'Pizza' }).every((r) => r.deal.section === 'Pizza'));
  eq(filterDeals(deals, { hideUsed: true }).length, 416);
  ok(!filterDeals(deals, { section: 'Pizza', hideUsed: true }).some((r) => r.deal.id === 'pizza-024'), 'pizza-024 is punched out');
  const uses = [use('free-004', '2026-10-01'), use('free-004', '2026-10-02'), use('free-004', '2026-10-03')];
  eq(filterDeals(deals, { q: 'device cleaning', sscUses: uses }).map((r) => [r.deal.id, r.left]), [['free-004', 0]]);
  eq(filterDeals(deals, { q: 'device cleaning', hideUsed: true, sscUses: uses }), [], 'used up in the app hides too');
  eq(filterDeals(deals, { q: 'auntie anne pretzel', section: 'Free Stuff' }), []);
});

test('lastUse: newest date, then newest save; still-saving counts as newest; only that deal', () => {
  eq(lastUse('free-004', []), null);
  eq(lastUse('free-004', [use('treats-001', '2026-10-09', 5)]), null);
  const a = use('free-004', '2026-10-01', 900), b = use('free-004', '2026-10-05', 100), c = use('free-004', '2026-10-05', 200);
  eq(lastUse('free-004', [a, b, c]).id, c.id, 'same day: later save wins');
  eq(lastUse('free-004', [c, b, a]).id, c.id, 'order doesn\'t matter');
  const pending = use('free-004', '2026-10-05');
  eq(lastUse('free-004', [a, b, pending, c]).id, pending.id);
  eq(lastUse('free-004', [a, use('treats-001', '2026-12-01', 1)]).id, a.id);
  const ts = { ...b, id: 'ts', updatedAt: { toMillis: () => 5e12 } };
  eq(lastUse('free-004', [c, ts]).id, 'ts', 'Firestore Timestamp objects are read too');
});

test('useRow matches Plan\'s sscUses row; todayYMD is local', () => {
  eq(useRow('free-004', '2026-10-15'), { dealId: 'free-004', date: '2026-10-15' });
  eq(todayYMD(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
