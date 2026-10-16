// Auto plans pick in-season seasonal stops (corn mazes in October, lights in December), never out-of-season ones.
// Run against the real data/plan-stops.json + data/drive-times.json.
import { test, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePlan, eligible, driveTable, OREM, TIM_PLANS } from '../js/logic/plan.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { stops } = JSON.parse(readFileSync(join(root, 'data/plan-stops.json'), 'utf8'));
const times = driveTable(JSON.parse(readFileSync(join(root, 'data/drive-times.json'), 'utf8')));
const seasonal = (s) => (s.tags || []).includes('seasonal');
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

function plans(month, extra = {}) {
  return SEEDS.map((seed) => makePlan(stops, {
    day: 6, month, start: '17:00', budget: null, vibe: 'any', origin: OREM, seed, sscUses: [], times, ...extra,
  }));
}

test('season: October Saturday plans include a seasonal stop at least 25% of the time', () => {
  const ps = plans(10);
  ok(ps.every(Boolean), 'every seed makes a plan');
  const n = ps.filter((p) => p.items.some((x) => seasonal(x.stop))).length;
  ok(n / ps.length >= 0.25, `seasonal share ${n}/${ps.length}`);
});

test('season: June plans never use an out-of-season (fall) stop', () => {
  for (const p of plans(6).filter(Boolean)) {
    for (const x of p.items) ok(!x.stop.months || x.stop.months.includes(6), 'out of season: ' + x.stop.id);
    ok(!p.items.some((x) => ['cornbellys-lehi', 'haunted-forest-af', 'the-pumpkin-patch-orem'].includes(x.stop.id)), 'no fall stops');
  }
});

test('season: seasonal stops up to ~30 km are eligible; ordinary stops still stop at 20 km', () => {
  const o = { day: 6, month: 10, origin: OREM };
  const ids = new Set(eligible(stops, o).map((s) => s.id));
  ok(ids.has('cornbellys-lehi'), 'Cornbelly\'s Lehi (22 km) in October');
  ok(!ids.has('rowleys-red-barn-fall-festival'), 'Rowley\'s (37 km) still too far');
  ok(!ids.has('luminaria-thanksgiving-point'), 'Luminaria is out of season in October');
  ok(eligible(stops, { ...o, month: 12 }).some((s) => s.id === 'pond-town-christmas-salem'), 'Salem Pond (28 km) in December');
});

test('season: budget is still respected when a seasonal stop is favored', () => {
  for (const p of plans(10, { budget: 20 }).filter(Boolean)) ok(p.total <= 20 || p.over, `over budget unflagged: $${p.total}`);
  const n = plans(10, { budget: 20 }).filter((p) => p && !p.over && p.total > 20).length;
  ok(n === 0, 'no in-budget plan above $20');
});

test('season: Tim\'s plans are unchanged', () => {
  ok(TIM_PLANS.length === 4 && TIM_PLANS[1].stops.join() === 'daylight-donuts,kreative-kiln-pg,melty-pg,ticket-to-ride-home', 'presets');
});
