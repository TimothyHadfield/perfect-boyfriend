// Plan wave 3: real drive times, weather, learning from the date log, a "talk about" line.
// Runs against the real data/plan-stops.json and data/drive-times.json.
import { test, eq, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  TIM_PLANS, OREM, PARK_MIN, planFromStops, makePlan, swapStop, driveTable, historyMarks, logRows, wearLine, bringList,
  talkAbout, TALK,
} from '../js/logic/plan.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const { stops } = read('data/plan-stops.json');
const raw = read('data/drive-times.json');
const times = driveTable(raw);
const S = (id) => stops.find((x) => x.id === id);
const OCT = 10;
const preset = (i, extra = {}) => { const t = TIM_PLANS[i]; return planFromStops(t.stops.map(S), { day: t.day, month: OCT, firstAt: t.at, sscUses: [], origin: OREM, ...extra }); };

test('drive-times.json covers every stop with a place, plus Orem; numbers are sane', () => {
  const placed = stops.filter((s) => !s.home);
  eq(raw.ids.length, placed.length + 1);
  ok(raw.ids.includes('orem'), 'orem');
  for (const s of placed) ok(raw.ids.includes(s.id), s.id);
  eq(raw.min.length, raw.ids.length);
  for (let i = 0; i < raw.min.length; i++) {
    eq(raw.min[i].length, raw.ids.length);
    eq(raw.min[i][i], 0);
  }
  const m = (a, b) => raw.min[raw.ids.indexOf(a)][raw.ids.indexOf(b)];
  ok(m('orem', 'color-me-mine-provo') >= 3 && m('orem', 'color-me-mine-provo') <= 15, 'Orem -> Provo');
  ok(m('orem', 'utah-grizzlies') >= 30 && m('orem', 'utah-grizzlies') <= 70, 'Orem -> West Valley');
});

test('Tim\'s plans use road times: no "est.", parking added, Pleasant Grove much shorter than the estimate', () => {
  const est = preset(1);
  const road = preset(1, { times });
  ok(road.items.every((x) => !x.est), 'no estimates');
  eq(road.driveEst, false);
  eq(est.driveEst, true);
  ok(road.drive < est.drive, `road ${road.drive} < estimate ${est.drive}`);
  // first leg Orem -> Daylight Donuts = table + parking
  eq(road.items[0].drive, raw.min[raw.ids.indexOf('orem')][raw.ids.indexOf('daylight-donuts')] + PARK_MIN);
  // last stop is at home (Orem start): Melty -> home, no parking
  eq(road.items[3].drive, raw.min[raw.ids.indexOf('melty-pg')][raw.ids.indexOf('orem')]);
  // the presets still keep their times (first stop at its set time)
  const d1 = preset(0, { times });
  eq(d1.items[0].start, 18 * 60);
  eq(d1.items[2].start, 20 * 60 + 30);
  ok(d1.drive < preset(0).drive, 'Date #1 shorter too');
});

test('"Near me": legs from your spot are estimates, legs between stops use the table', () => {
  const me = { lat: 40.31, lng: -111.70, name: 'Near me' };
  const t = TIM_PLANS[0];
  const p = planFromStops(t.stops.map(S), { day: t.day, month: OCT, firstAt: t.at, sscUses: [], origin: me, times });
  eq(p.items.map((x) => x.est), [true, false, false]);
  eq(p.driveEst, true);
});

test('history: stops from the last 30 days and from "meh" dates (90 days) are skipped; old rows match by name', () => {
  const rows = [
    { date: '2026-10-01', stops: ['Mooyah'], stopIds: ['mooyah-provo'], cost: 20 },
    { date: '2026-09-25', stops: ['Sweeto Burrito', 'Redline Racing'], cost: 30 },             // old row: names only
    { date: '2026-08-01', stopIds: ['costa-vida-orem'], rating: 'meh', stops: ['Costa Vida'] },   // 75 days: meh still skips
    { date: '2026-05-01', stopIds: ['red-fuego-orem'], rating: 'meh', stops: ['Red Fuego'] },     // 167 days: back in
    { date: '2026-06-01', stopIds: ['melty-pg'], rating: 'loved', stops: ['Melty'] },
    { date: 'junk', stops: ['Melty'] },
  ];
  const h = historyMarks(rows, stops, '2026-10-16');
  eq([...h.skip].sort(), ['costa-vida-orem', 'mooyah-provo', 'redline-racing', 'sweeto-burrito-orem']);
  eq([...h.loved], ['melty-pg']);
  // Auto plans never use skipped stops. Take the stops plans use most without history, log them, and check they're gone.
  const o = { day: 5, month: OCT, start: '18:00', budget: 30, vibe: 'any', sscUses: [], origin: OREM, times, ymd: '2026-10-16' };
  const count = {};
  for (let seed = 1; seed <= 25; seed++) for (const x of makePlan(stops, { ...o, seed }).items) count[x.stop.id] = (count[x.stop.id] || 0) + 1;
  const top = Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 4);
  ok(count[top[0]] >= 5, 'a common stop: ' + top[0] + ' x' + count[top[0]]);
  const recent = [
    { date: '2026-10-10', stopIds: top.slice(0, 2), stops: top.slice(0, 2).map((id) => S(id).short) },
    { date: '2026-10-02', stops: [S(top[2]).short || S(top[2]).name] },                          // old row: name only
    { date: '2026-08-20', stopIds: [top[3]], stops: [S(top[3]).short], rating: 'meh' },
  ];
  const skip = historyMarks(recent, stops, '2026-10-16').skip;
  eq([...skip].sort(), top.slice().sort());
  for (let seed = 1; seed <= 25; seed++) {
    const p = makePlan(stops, { ...o, seed, history: recent });
    ok(p, 'plan ' + seed);
    for (const x of p.items) ok(!skip.has(x.stop.id), 'skipped ' + x.stop.id + ' seed ' + seed);
  }
  // swaps skip them too: swap each stop of a plan through 6 alternatives
  const oh = { ...o, history: recent };
  const p = makePlan(stops, { ...oh, seed: 2 });
  for (let i = 0; i < p.items.length; i++) {
    let cur = p;
    const shown = [p.items[i].stop.id];
    for (let k = 0; k < 6; k++) {
      const q = swapStop(stops, cur, i, oh, shown);
      if (!q) break;
      ok(!skip.has(q.items[i].stop.id), 'swap skipped ' + q.items[i].stop.id);
      shown.push(q.items[i].stop.id);
      cur = q;
    }
  }
  // Tim's plans are never filtered
  eq(preset(3, { times, history: rows, ymd: '2026-10-16' }).items.map((x) => x.stop.id), ['redline-racing', 'sweeto-burrito-orem']);
});

test('history: stops from "loved" dates come up more often', () => {
  const o = { day: 6, month: OCT, start: '12:00', budget: null, vibe: 'food', sscUses: [], origin: { lat: 40.3537, lng: -111.7629 }, times, ymd: '2026-10-17' };
  const loved = [{ date: '2026-06-01', stopIds: ['parlor-doughnuts-pg'], stops: ['Parlor Doughnuts'], rating: 'loved' }];
  let before = 0, after = 0;
  for (let seed = 1; seed <= 30; seed++) {
    if (makePlan(stops, { ...o, seed }).items.some((x) => x.stop.id === 'parlor-doughnuts-pg')) before++;
    if (makePlan(stops, { ...o, seed, history: loved }).items.some((x) => x.stop.id === 'parlor-doughnuts-pg')) after++;
  }
  ok(after > before, `loved stop in ${after}/30 plans vs ${before}/30`);
});

test('"We did this" saves stopIds', () => {
  const p = preset(3, { times });
  const rows = logRows(p, '2026-10-15');
  eq(rows.dateLog.stopIds, ['redline-racing', 'sweeto-burrito-orem']);
  eq(rows.dateLog.stops, ['Redline Racing', 'Sweeto Burrito']);
});

test('bad weather: auto plans pick indoor stops; good weather still allows outdoor ones', () => {
  const rain = { code: 63, hi: 50, lo: 38, pop: 90 };
  const clear = { code: 0, hi: 66, lo: 42, pop: 0 };
  const o = { day: 6, month: OCT, start: '13:00', budget: null, vibe: 'any', sscUses: [], origin: OREM, times };
  let outdoorClear = 0, outdoorRain = 0;
  for (let seed = 1; seed <= 25; seed++) {
    outdoorClear += makePlan(stops, { ...o, seed, weather: clear }).items.filter((x) => x.stop.indoor === false).length;
    outdoorRain += makePlan(stops, { ...o, seed, weather: rain }).items.filter((x) => x.stop.indoor === false).length;
  }
  ok(outdoorClear > 0, 'some outdoor stops when clear: ' + outdoorClear);
  eq(outdoorRain, 0);
  // Tight budget (free outdoor stops are what make $20 work): still indoors, still mostly in budget.
  const cheap = { ...o, day: 5, start: '18:00', budget: 20, weather: { code: 63, hi: 44, lo: 33, pop: 90 } };
  let out20 = 0, over = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const p = makePlan(stops, { ...cheap, seed });
    out20 += p.items.filter((x) => x.stop.indoor === false).length;
    if (p.over) over++;
  }
  eq(out20, 0);
  ok(over <= 2, 'over budget ' + over + '/20');
});

test('wear and bring use the forecast when there is one, the month rule otherwise', () => {
  const items = [{ stop: S('the-rift-provo'), deal: null }];
  eq(wearLine(items, OCT), 'Light jacket');
  eq(wearLine(items, OCT, { code: 0, hi: 80, lo: 60, pop: 0 }, 18 * 60), 'Casual');
  eq(wearLine(items, OCT, { code: 0, hi: 45, lo: 25, pop: 0 }, 18 * 60), 'Warm coat');
  eq(wearLine(items, 7, { code: 71, hi: 30, lo: 20, pop: 90 }, 12 * 60), 'Warm coat · Boots');
  eq(wearLine(items, 1, { code: 3, hi: 62, lo: 50, pop: 0 }, 13 * 60), 'Casual');
  eq(wearLine(items, 7, { code: 0, hi: 96, lo: 70, pop: 0 }, 14 * 60), 'Light clothes');
  ok(bringList(items, OCT, { code: 63, hi: 50, lo: 40, pop: 80 }).includes('Umbrella'), 'umbrella in rain');
  ok(!bringList(items, OCT, { code: 0, hi: 50, lo: 40, pop: 0 }).includes('Umbrella'), 'no umbrella when dry');
  const p = preset(1, { times, weather: { code: 63, hi: 50, lo: 40, pop: 80 } });
  ok(p.bring.includes('Umbrella') && p.wear.includes('Light jacket'), 'preset uses the forecast: ' + p.wear);
});

test('talk about: one starter per plan, same plan same line, ~40 short ones', () => {
  ok(TALK.length >= 38 && TALK.length <= 45, 'count ' + TALK.length);
  eq(new Set(TALK).size, TALK.length);
  for (const t of TALK) ok(t.length <= 60 && t.endsWith('?'), t);
  const p = preset(0, { times });
  ok(TALK.includes(p.talk), 'from the list');
  eq(preset(0, { times }).talk, p.talk);
  eq(talkAbout('a>b'), talkAbout('a>b'));
  const lines = new Set();
  for (let seed = 1; seed <= 12; seed++) lines.add(makePlan(stops, { day: 5, month: OCT, start: '18:00', budget: 30, vibe: 'any', sscUses: [], origin: OREM, times, seed }).talk);
  ok(lines.size >= 5, 'variety ' + lines.size);
});
