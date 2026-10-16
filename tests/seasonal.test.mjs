// Seasonal Utah County stops (data/build-plan-stops.mjs SEASONAL + orem-spots' seasonal ones), run against
// the real data/plan-stops.json and js/logic/plan.js.
import { test, eq, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePlan, eligible, stopOpen } from '../js/logic/plan.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { stops } = JSON.parse(readFileSync(join(root, 'data/plan-stops.json'), 'utf8'));
const seasonal = stops.filter((s) => (s.tags || []).includes('seasonal'));
const FALL = [9, 10, 11], WINTER = [12, 1, 2], SPRING = [3, 4, 5], SUMMER = [6, 7, 8];
const only = (s, set) => s.months.every((m) => set.includes(m));
const fall = seasonal.filter((s) => only(s, FALL));
// Utah County, roughly (Lehi/Alpine Loop to Santaquin, Utah Lake to Sundance)
const inUtahCounty = (s) => s.lat > 39.8 && s.lat < 40.6 && s.lng > -112.2 && s.lng < -111.2;

test('seasonal: 25+ stops, each with months, Utah County coords, cost, indoor flag and a source', () => {
  ok(seasonal.length >= 25, 'seasonal stop count ' + seasonal.length);
  for (const s of seasonal) {
    ok(Array.isArray(s.months) && s.months.length > 0 && s.months.length < 12, s.id + ' months');
    ok(s.months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12), s.id + ' month values');
    ok(inUtahCounty(s), s.id + ' coords ' + s.lat + ',' + s.lng);
    ok(typeof s.cost === 'number' && s.cost >= 0, s.id + ' cost');
    ok(s.mins > 0, s.id + ' mins');
    eq(typeof s.indoor, 'boolean', s.id + ' indoor');
    ok(/^https:\/\/\S+$/.test(s.source || ''), s.id + ' source');
    ok(/^\d{4}-\d\d-\d\d$/.test(s.checked || ''), s.id + ' checked date');
    ok(Array.isArray(s.deals), s.id + ' deals');
  }
  const ids = new Set(stops.map((s) => s.id));
  eq(ids.size, stops.length, 'stop ids unique');
});

test('seasonal: every season has stops, some in auto plans near Orem', () => {
  for (const [name, set] of [['fall', FALL], ['winter', WINTER], ['spring', SPRING], ['summer', SUMMER]]) {
    const inSeason = seasonal.filter((s) => s.months.some((m) => set.includes(m)));
    ok(inSeason.length >= 4, name + ' has ' + inSeason.length);
    const month = set[1];
    const auto = eligible(inSeason, { day: 5, month }).filter((s) => !s.home);
    ok(auto.length >= 1, name + ' auto-eligible near Orem: ' + auto.length);
  }
  // A seasonal stop is closed outside its months.
  const lum = stops.find((s) => s.id === 'luminaria-thanksgiving-point');
  ok(lum && stopOpen(lum, 5, 12) && !stopOpen(lum, 5, 6), 'Luminaria open Dec, closed Jun');
});

test('seasonal: the card deal links by business name (Rowley\'s, High Country)', () => {
  const row = stops.find((s) => s.id === 'rowleys-red-barn-fall-festival');
  ok(row.deals.some((d) => d.id === 'entertainment-051'), 'Rowley\'s corn maze 2-4-1');
  const tube = stops.find((s) => s.id === 'high-country-tubing');
  ok(tube.deals.some((d) => d.id === 'entertainment-029'), 'High Country tubing 2-4-1');
});

function plansWith(month, pred) {
  let hit = 0, total = 0;
  for (const day of [5, 6]) for (const start of ['10:00', '17:00', '19:00']) for (let seed = 1; seed <= 25; seed++) {
    const p = makePlan(stops, { day, month, start, budget: null, vibe: 'any', seed, tries: 120 });
    if (!p) continue;
    total++;
    if (p.items.some((x) => pred(x.stop))) hit++;
  }
  return { hit, total };
}

test('seasonal: an October auto plan can include a fall stop, a June one never does', () => {
  ok(fall.length >= 6, 'fall-only stops ' + fall.length);
  const isFall = (s) => fall.includes(s);
  const oct = plansWith(10, isFall);
  ok(oct.total > 50 && oct.hit > 0, `October plans with a fall stop: ${oct.hit}/${oct.total}`);
  const jun = plansWith(6, isFall);
  ok(jun.total > 50, 'June plans ' + jun.total);
  eq(jun.hit, 0, 'June plans with a fall stop');
});

test('seasonal: a summer stop fits a June plan and is refused in December', () => {
  const base = { day: 6, start: '18:00', budget: null, vibe: 'any', seed: 3, shape: ['free-outdoor', 'food', 'dessert'], lock: { 0: 'af-boat-harbor-sunset' } };
  const jun = makePlan(stops, { ...base, month: 6 });
  ok(jun && jun.items[0].stop.id === 'af-boat-harbor-sunset', 'June sunset plan');
  eq(makePlan(stops, { ...base, month: 12 }), null, 'December sunset plan');
  const cave = makePlan(stops, { ...base, start: '09:00', month: 7, shape: ['activity', 'food'], lock: { 0: 'timpanogos-cave' } });
  ok(cave && cave.items[0].stop.id === 'timpanogos-cave', 'July cave plan');
});
