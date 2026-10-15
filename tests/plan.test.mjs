// Date planner logic, run against the real data/plan-stops.json.
import { test, eq, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseLimits, dealSave, usesLeft, pickDeal, driveMin, haversineKm, timeline, makePlan, planFromStops,
  swapStop, eligible, bringList, wearLine, TIM_PLANS, OREM, toMin, fmtTime, logRows, weekAhead, defaultDay, mapsUrl,
} from '../js/logic/plan.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { stops } = JSON.parse(readFileSync(join(root, 'data/plan-stops.json'), 'utf8'));
const deals = JSON.parse(readFileSync(join(root, 'data/ssc-deals.json'), 'utf8')).deals;
const S = (id) => { const s = stops.find((x) => x.id === id); if (!s) throw new Error('no stop ' + id); return s; };
const OCT = 10;

test('data: Tim\'s picks are all stops, with real coordinates and card deals that exist', () => {
  ok(stops.length >= 120, 'stop count ' + stops.length);
  for (const id of ['color-me-mine-provo', 'mooyah-provo', 'tippin-point-country-dance', 'the-rift-provo', 'redline-racing',
    'sweeto-burrito-orem', 'melty-pg', 'kreative-kiln-pg', 'daylight-donuts', 'ticket-to-ride-home']) ok(S(id).pick, id + ' is a pick');
  const ids = new Set(deals.map((d) => d.id));
  for (const s of stops) {
    ok(['food', 'dessert', 'activity', 'free-outdoor', 'culture', 'at-home'].includes(s.kind), s.id + ' kind');
    if (!s.home) ok(s.lat > 39.9 && s.lat < 40.8 && s.lng > -112.1 && s.lng < -111.5, s.id + ' coords');
    ok(s.cost >= 0 && s.mins > 0, s.id + ' cost/mins');
    for (const d of s.deals) ok(ids.has(d.id), s.id + ' deal ' + d.id);
  }
  eq(S('daylight-donuts').city, 'Saratoga Springs');
  ok(S('tippin-point-country-dance').deals.some((d) => d.id === 'entertainment-063'), 'Utah Country Dance Wed deal on Tippin Point');
});

test('parseLimits reads the card\'s day and time limits', () => {
  eq(parseLimits('Mon Only Provo').days, [1]);
  eq(parseLimits('M-Th').days, [1, 2, 3, 4]);
  eq(parseLimits('M-Thurs Before 6pm! Not Valid Holidays!'), { days: [1, 2, 3, 4], before: 18 * 60, after: null, months: null });
  eq(parseLimits('M-Fri Before 6pm').days, [1, 2, 3, 4, 5]);
  eq(parseLimits('Thurs').days, [4]);
  eq(parseLimits('2-4-1! Wednesday Admission!').days, [3]);
  eq(parseLimits('Valid May & June').months, [5, 6]);
  const mb = parseLimits('Not Valid after 5 PM, Saturdays, Holidays or School Holidays; Orem');
  eq(mb.before, 17 * 60);
  eq(mb.days, [0, 1, 2, 3, 4, 5]);
  eq(parseLimits('Buy 1 Break Neck Breakfast Burrito, Get 1 FREE!').before, 11 * 60);
  eq(parseLimits('All Utah County'), { days: null, before: null, after: null, months: null });
});

test('deal savings: 2-4-1 halves, FREE for two is free, a free side is a few dollars', () => {
  eq(dealSave('2-4-1! Studio Fee! M-Th', 32, 'activity'), 16);
  eq(dealSave('FREE! Admit 2 to Any Experience!', 30, 'activity'), 30);
  eq(dealSave('FREE! Admission!', 12, 'activity'), 6);
  eq(dealSave('Buy Sub, Get Chips and Reg. Size Drink FREE!', 25, 'food'), 4);
  eq(dealSave('Buy 1 Reg. Sub, Get a Reg. Sub FREE!', 25, 'food'), 13);
  eq(dealSave('2-4-1! Entree! Up to $7!', 22, 'dessert'), 7);
  eq(dealSave('Buy One Entree, Get One 50% OFF!', 44, 'food'), 11);
  eq(dealSave('50% OFF! Entire Purchase! Max $30 Discount', 28, 'food'), 14);
});

test('uses left = printed uses - punched circles - logged uses; used-up deals are skipped', () => {
  const melt = deals.find((d) => d.id === 'sandwiches-032');          // Melty 2-4-1 melt: 3 uses, 2 punched
  eq(usesLeft(melt, []), 1);
  eq(usesLeft(melt, [{ dealId: 'sandwiches-032', date: '2026-10-10' }]), 0);
  eq(usesLeft({ uses: 'unlimited', used: 0, id: 'x' }, [{ dealId: 'x' }]), Infinity);
  const rift = S('the-rift-provo');
  eq(pickDeal(rift, 1, 18 * 60, OCT, []).id, 'free-071');                  // free for two on Monday
  eq(pickDeal(rift, 1, 18 * 60, OCT, [{ dealId: 'free-071' }]).id, 'entertainment-058');   // used up -> 2-4-1
  eq(pickDeal(S('color-me-mine-provo'), 3, 18 * 60, OCT, []).id, 'entertainment-012');     // free admission already punched
  eq(pickDeal(S('color-me-mine-provo'), 5, 18 * 60, OCT, []), null);                       // 2-4-1 is M-Th only
});

test('drive time: haversine x 1.3 road factor at 40 km/h + 2 min parking', () => {
  const a = { lat: 40.2969, lng: -111.6946 }, b = { lat: 40.2969 + 0.09, lng: -111.6946 };  // ~10 km north
  const km = haversineKm(a, b);
  ok(Math.abs(km - 10.0) < 0.1, 'km ' + km);
  eq(driveMin(a, b), Math.round(km * 1.3 / 40 * 60 + 2));
  eq(driveMin(a, a), 0);
});

test('Tim\'s Date #1 reproduces: Color Me Mine 6:00 -> Mooyah -> Tippin\' Point lessons 8:30', () => {
  const t = TIM_PLANS[0];
  const p = planFromStops(t.stops.map(S), { day: t.day, month: OCT, firstAt: t.at, sscUses: [], origin: OREM });
  ok(p, 'plan builds');
  eq(p.items.map((x) => x.stop.id), ['color-me-mine-provo', 'mooyah-provo', 'tippin-point-country-dance']);
  eq(fmtTime(p.items[0].start), '6:00 PM');
  eq(p.items[0].end, toMin('19:30'));
  ok(p.items[1].start >= toMin('19:30') && p.items[1].end <= toMin('20:30'), 'Mooyah between');
  eq(fmtTime(p.items[2].start), '8:30 PM');
  eq(p.total, p.items.reduce((a, x) => a + x.price, 0));
  ok(p.items.every((x) => x.deal), 'a card deal at every stop');
  ok(p.bring.includes('SSC card'), 'bring card');
  ok(p.drive > 0 && p.drive === p.items.reduce((a, x) => a + x.drive, 0), 'drive total');
});

test('the planner fills Date #1\'s shape itself: locked activity + dance, it picks nearby food', () => {
  const o = { day: 3, month: OCT, start: '17:52', budget: null, vibe: 'any', seed: 4, sscUses: [], origin: OREM,
    shape: ['activity', 'food', 'activity'], lock: { 0: 'color-me-mine-provo', 2: 'tippin-point-country-dance' } };
  const p = makePlan(stops, o);
  ok(p, 'plan');
  eq(p.items[1].stop.kind, 'food');
  eq(p.items[2].start, toMin('20:30'));
  ok(p.items[1].km < 8, 'food is close to Color Me Mine: ' + p.items[1].km.toFixed(1) + ' km');
  // Tippin' Point dances Wed & Sat only: same plan on a Thursday can't be built.
  eq(makePlan(stops, { ...o, day: 4 }), null);
});

test('The Rift (Monday only) shows up only on Mondays', () => {
  const near = { lat: 40.2175, lng: -111.664 };    // Provo Towne Centre, so it's a likely pick
  let mondays = 0;
  for (let day = 0; day < 7; day++) {
    for (let seed = 1; seed <= 12; seed++) {
      const p = makePlan(stops, { day, month: OCT, start: '18:00', budget: null, vibe: 'any', seed, sscUses: [], origin: near, tries: 120 });
      const has = p && p.items.some((x) => x.stop.id === 'the-rift-provo');
      if (has) ok(day === 1, 'The Rift on day ' + day);
      if (has) mondays++;
    }
  }
  ok(mondays > 0, 'appears on some Mondays');
});

test('plans: deterministic per seed, Shuffle gives something new, budget respected, cheap and close', () => {
  const o = { day: 5, month: OCT, start: '18:00', budget: 20, vibe: 'any', sscUses: [], origin: OREM };
  const a = makePlan(stops, { ...o, seed: 1 });
  eq(makePlan(stops, { ...o, seed: 1 }).key, a.key);
  const keys = new Set();
  for (let seed = 1; seed <= 8; seed++) {
    const p = makePlan(stops, { ...o, seed });
    keys.add(p.key);
    ok(p.total <= 20, 'budget ' + p.total);
    ok(p.items.length >= 2 && p.items.length <= 4, 'stops ' + p.items.length);
    ok(p.drive <= 40, 'drive ' + p.drive);
    for (let i = 1; i < p.items.length; i++) ok(p.items[i].start >= p.items[i - 1].end + p.items[i].drive, 'time order');
  }
  ok(keys.size >= 4, 'shuffle variety ' + keys.size);
});

test('season: summer-only and Christmas stops are out in October, in during their months', () => {
  const ids = (month, day = 2) => eligible(stops, { day, month, origin: OREM }).map((s) => s.id);
  const oct = ids(OCT);
  for (const id of ['splash-summit-provo', 'clas-christmas-cruise', 'orem-lights-on']) ok(!oct.includes(id), id + ' out in Oct');
  ok(oct.includes('the-pumpkin-patch-orem'), 'pumpkin patch in Oct');
  ok(ids(7).includes('splash-summit-provo'), 'Splash Summit in July');
  ok(ids(12).includes('clas-christmas-cruise'), 'Christmas cruise in Dec');
  ok(!ids(OCT, 0).includes('escapes-in-time'), 'closed Sundays');
});

test('generated plans only use stops open that day and in season', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const p = makePlan(stops, { day: 2, month: OCT, start: '19:00', budget: null, vibe: 'any', seed, sscUses: [], origin: OREM, tries: 120 });
    for (const x of p.items) {
      ok(!x.stop.months || x.stop.months.includes(OCT), x.stop.id + ' in season');
      ok(!x.stop.days || x.stop.days.includes(2), x.stop.id + ' open Tuesday');
    }
  }
});

test('swap one stop: same kind, different place, rest kept', () => {
  const o = { day: 5, month: OCT, start: '18:00', budget: 30, vibe: 'any', seed: 3, sscUses: [], origin: OREM };
  const p = makePlan(stops, o);
  const q = swapStop(stops, p, 0, o, []);
  ok(q, 'swapped');
  eq(q.items[0].stop.kind, p.items[0].stop.kind);
  ok(q.items[0].stop.id !== p.items[0].stop.id, 'new place');
  eq(q.items.slice(1).map((x) => x.stop.id), p.items.slice(1).map((x) => x.stop.id));
  // Tapping swap again skips places already shown.
  const seen = [p.items[0].stop.id, q.items[0].stop.id];
  const r = swapStop(stops, q, 0, o, seen);
  ok(r && !seen.includes(r.items[0].stop.id), 'third place differs');
});

test('bring and wear lines', () => {
  const items = [{ stop: S('peaks-ice-arena'), deal: { id: 'free-050' } }, { stop: S('tippin-point-country-dance'), deal: null }];
  eq(bringList(items, OCT), ['SSC card', 'Thick socks', 'Gloves', 'Water bottle']);
  eq(bringList([{ stop: S('ticket-to-ride-home'), deal: null }], OCT), ['Ticket to Ride Europe', 'Snacks']);
  eq(wearLine(items, 12), 'Warm layers · Boots or shoes that spin · Warm coat');
});

test('"We did this" rows: dateLog with title/date/stops/cost, one sscUses row per deal', () => {
  const t = TIM_PLANS[3];
  const p = planFromStops(t.stops.map(S), { day: t.day, month: OCT, firstAt: t.at, sscUses: [] });
  const rows = logRows(p, '2026-10-15');
  eq(rows.dateLog, { title: 'Redline Racing + Sweeto Burrito', date: '2026-10-15', stops: ['Redline Racing', 'Sweeto Burrito'], cost: p.total });
  eq(rows.sscUses.length, 2);
  ok(rows.sscUses.every((u) => u.date === '2026-10-15' && u.dealId), 'use rows');
  const t2 = TIM_PLANS[1];   // Ticket to Ride at home has no deal
  const p2 = planFromStops(t2.stops.map(S), { day: t2.day, month: OCT, firstAt: t2.at, sscUses: [] });
  eq(logRows(p2, '2026-10-17').sscUses.length, p2.items.filter((x) => x.stop.id !== 'ticket-to-ride-home').length);
});

test('day picker: next 7 days, default Friday', () => {
  const w = weekAhead(new Date(2026, 9, 15));      // Thu Oct 15 2026
  eq(w.map((x) => x.day), [4, 5, 6, 0, 1, 2, 3]);
  eq(defaultDay(w), '2026-10-16');
});

test('maps link has every stop that isn\'t at home', () => {
  const t = TIM_PLANS[0];
  const p = planFromStops(t.stops.map(S), { day: t.day, month: OCT, firstAt: t.at, sscUses: [] });
  const u = mapsUrl(p, OREM);
  ok(u.startsWith('https://www.google.com/maps/dir/?api=1'), u);
  eq(decodeURIComponent(u.split('waypoints=')[1].split('&')[0]).split('|').length, 2);
});
