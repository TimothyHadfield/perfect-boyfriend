import { test, eq, ok } from './harness.mjs';
import { pastSorted, monthSpend, money, parseCost, budgetOf, spendHue, dollars, ratingName, editedRow } from '../js/logic/history.js';

const TODAY = { y: 2026, m: 10, d: 15 };

// Shaped like real rows: Plan's "We did this" rows, a manual row, gifts from the Gifts screen.
const LOG = [
  { id: 'a', title: 'Cafe Rio + Bowling', date: '2026-10-03', stops: ['Cafe Rio', 'Bowling'], stopIds: ['caferio', 'bowl'], cost: 38 },
  { id: 'b', title: 'Picnic', date: '2026-10-31', cost: 12.5, rating: 'loved', manual: true },
  { id: 'c', title: 'Movie', date: '2026-09-30', stops: ['Movie'], cost: 20 },           // last day of last month
  { id: 'd', title: 'Ice cream', date: '2026-11-01', cost: 9 },                         // next month
  { id: 'e', title: 'Walk', date: '2026-10-01', cost: 0, rating: 'ok', manual: true },   // first day of month
  { id: 'f', title: 'Old row', date: '2026-10-10', stops: ['Park'] },                  // no cost at all
  { id: 'g', title: 'Broken', date: '2026-10-99', cost: 50 },                           // not a real date
  { id: 'h', title: 'Last year', date: '2025-10-12', cost: 40 },                        // same month, other year
];
const GIFTS = [
  { id: 'g1', title: 'Tulips', price: 15, added: '2026-10-01T18:00:00.000Z', date: '2026-10-08', reaction: 3 },
  { id: 'g2', title: 'Necklace', price: 60, added: '2026-10-02T18:00:00.000Z' },                 // idea: not given
  { id: 'g3', title: 'Candy', added: '2026-10-04T18:00:00.000Z', date: '2026-10-09' },            // given, no price
  { id: 'g4', title: 'Book', price: 18.25, added: '2026-09-01T18:00:00.000Z', date: '2026-09-28' }, // last month
];

test('monthly sum: dates + given gifts, inside this month only', () => {
  eq(monthSpend(LOG, GIFTS, TODAY), { month: '2026-10', dates: 50.5, gifts: 15, total: 65.5 });
});

test('month boundaries: first and last day count, neighbours do not', () => {
  eq(monthSpend([{ date: '2026-10-01', cost: 1 }, { date: '2026-10-31', cost: 2 }], [], TODAY).total, 3);
  eq(monthSpend([{ date: '2026-09-30', cost: 1 }, { date: '2026-11-01', cost: 2 }], [], TODAY).total, 0);
  eq(monthSpend([{ date: '2026-12-31', cost: 5 }], [{ date: '2027-01-01', price: 7 }], { y: 2027, m: 1, d: 1 }).total, 7, 'year rolls');
  eq(monthSpend([{ date: '2028-02-29', cost: 4 }], [], { y: 2028, m: 2, d: 10 }).total, 4, 'leap day');
});

test('gift ideas (no date) never count, even with a price', () => {
  eq(monthSpend([], [{ title: 'Necklace', price: 60, added: '2026-10-02T18:00:00.000Z' }], TODAY).gifts, 0);
  eq(monthSpend([], [{ title: 'Bad', price: 60, date: '' }], TODAY).gifts, 0);
});

test('missing or junk costs count as 0', () => {
  eq(monthSpend([{ date: '2026-10-02' }, { date: '2026-10-03', cost: null }, { date: '2026-10-04', cost: 'abc' }, { date: '2026-10-05', cost: -5 }],
    [{ date: '2026-10-06' }, { date: '2026-10-07', price: '' }], TODAY).total, 0);
  eq(money('12.5'), 12.5);
  eq(money(true), 0);
  eq(monthSpend(null, undefined, TODAY).total, 0);
});

test('past list: newest first, ties by title, bad dates last', () => {
  eq(pastSorted(LOG).map((x) => x.id), ['d', 'b', 'f', 'a', 'e', 'c', 'h', 'g']);
  eq(pastSorted([{ id: 2, title: 'B', date: '2026-10-01' }, { id: 1, title: 'A', date: '2026-10-01' }]).map((x) => x.id), [1, 2]);
  const src = [{ id: 1, date: '2026-01-01' }, { id: 2, date: '2026-02-01' }];
  pastSorted(src);
  eq(src[0].id, 1, 'does not reorder the input');
});

test('cost input parsing', () => {
  eq(parseCost(''), null);
  eq(parseCost(' $25.50 '), 25.5);
  eq(parseCost('1,200'), 1200);
  ok(Number.isNaN(parseCost('abc')), 'junk is NaN');
  ok(Number.isNaN(parseCost('-3')), 'negative is NaN');
});

test('budget and red->green scale', () => {
  eq(budgetOf({ monthlyBudget: 150 }), 150);
  eq(budgetOf({}), null);
  eq(budgetOf({ monthlyBudget: 0 }), null);
  eq(spendHue(30, 150), 120, 'well under: green');
  eq(spendHue(90, 150), 120, '60%: still green');
  eq(spendHue(120, 150), 60, '80%: yellow');
  eq(spendHue(150, 150), 0, 'at budget: red');
  eq(spendHue(400, 150), 0, 'over: red');
  eq(spendHue(50, null), null);
});

test('editing a Plan row keeps stops, stopIds and other fields', () => {
  const orig = { id: 'a', title: 'Cafe Rio + Bowling', date: '2026-10-03', stops: ['Cafe Rio', 'Bowling'], stopIds: ['caferio', 'bowl'], cost: 38, updatedAt: { seconds: 1 } };
  const row = editedRow(orig, { title: 'Cafe Rio + Bowling', date: '2026-10-03', cost: 38, rating: 'loved', note: '  She liked bowling  ' });
  eq(row, { id: 'a', title: 'Cafe Rio + Bowling', date: '2026-10-03', stops: ['Cafe Rio', 'Bowling'], stopIds: ['caferio', 'bowl'], cost: 38, rating: 'loved', note: 'She liked bowling' });
  const cleared = editedRow(row, { title: 'X', date: '2026-10-04', cost: null, rating: '', note: '' });
  eq(cleared, { id: 'a', title: 'X', date: '2026-10-04', stops: ['Cafe Rio', 'Bowling'], stopIds: ['caferio', 'bowl'], cost: 0 });
  eq(editedRow({ id: 'm', manual: true }, { title: 'Picnic', date: '2026-10-01', cost: 5, rating: 'bogus', note: 'x'.repeat(600) }).note.length, 500);
  eq(editedRow({ id: 'm', manual: true }, { title: 'Picnic', date: '2026-10-01', cost: 5, rating: 'bogus' }), { id: 'm', manual: true, title: 'Picnic', date: '2026-10-01', cost: 5 });
});

test('labels', () => {
  eq(dollars(38), '$38');
  eq(dollars(12.5), '$12.50');
  eq(dollars(undefined), '$0');
  eq(ratingName('loved'), 'Loved');
  eq(ratingName('x'), '');
});
