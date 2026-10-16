// Plan sharing: saved rows, the text for her, the calendar file. Run against the real data/plan-stops.json.
import { test, eq, ok } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { planFromStops, makePlan, TIM_PLANS, OREM } from '../js/logic/plan.js';
import { planStops, savedRow, sameStops, savedFor, shareText, buildPlanIcs, planIcsName, hhmm } from '../js/logic/share.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { stops } = JSON.parse(readFileSync(join(root, 'data/plan-stops.json'), 'utf8'));
const byId = (id) => { const s = stops.find((x) => x.id === id); if (!s) throw new Error('no stop ' + id); return s; };

// Tim's Pleasant Grove plan on Sat 2026-10-17, first stop at 10:00 (no forecast, no uses logged).
const pg = TIM_PLANS.find((t) => t.key === 'tim-2');
const pgPlan = { ...planFromStops(pg.stops.map(byId), { day: 6, month: 10, firstAt: pg.at, origin: OREM, sscUses: [] }), ymd: '2026-10-17' };
const now = new Date(Date.UTC(2026, 9, 15, 12, 0, 0));

test('share: savedRow follows the savedPlans contract', () => {
  const r = savedRow(pgPlan, 'Pleasant Grove');
  eq(Object.keys(r).sort(), ['at', 'date', 'driveMins', 'stops', 'title', 'total']);
  eq(r.title, 'Pleasant Grove');
  eq(r.date, '2026-10-17');
  eq(r.at, '10:00');
  eq(r.total, pgPlan.total);
  eq(r.driveMins, pgPlan.drive);
  eq(r.stops.map((s) => s.id), pg.stops);
  for (const s of r.stops) {
    ok(/^\d\d:\d\d$/.test(s.at), 'stop time ' + s.at);
    ok(typeof s.name === 'string' && s.name.length, 'stop name');
    ok(!('deal' in s) || (typeof s.deal === 'string' && s.deal.length <= 120), 'deal is a string');
    eq(Object.keys(s).filter((k) => !['id', 'name', 'at', 'deal'].includes(k)), [], 'no extra fields');
  }
  ok(r.stops.some((s) => s.deal), 'card deals kept');
  // Default title: the stop names.
  eq(savedRow(pgPlan).title, 'Daylight Donuts + Kreative Kiln + Melty + Ticket to Ride');
});

test('share: sameStops / savedFor find the saved plan for a day', () => {
  const r = { id: 'a', ...savedRow(pgPlan) };
  ok(sameStops(r, pgPlan), 'same plan matches');
  ok(!sameStops({ ...r, date: '2026-10-18' }, pgPlan), 'other day does not match');
  ok(!sameStops({ ...r, stops: r.stops.slice(0, 3) }, pgPlan), 'fewer stops do not match');
  ok(!sameStops({ ...r, stops: [...r.stops].reverse() }, pgPlan), 'other order does not match');
  const older = { id: 'b', ...savedRow(pgPlan), stops: r.stops.slice(0, 2) };
  eq(savedFor([older, r, { id: 'c', date: '2026-10-18', stops: r.stops }], '2026-10-17').id, 'a');
  eq(savedFor([r], '2026-10-20'), null);
  eq(savedFor([{ id: 'x', date: '2026-10-17', stops: [] }], '2026-10-17'), null, 'empty stop list ignored');
  eq(savedFor(undefined, '2026-10-17'), null);
});

test('share: text for her has day, times, places and what to wear; no prices, no card', () => {
  const t = shareText(pgPlan);
  ok(t.startsWith('Sat 10:00 AM: Daylight Donuts → 10:'), t);
  ok(t.includes('Kreative Kiln'), t);
  ok(t.includes('Ticket to Ride at home'), t);
  ok(/Wear: clothes that can get messy/.test(t), t);
  ok(!/\$/.test(t), 'no prices: ' + t);
  ok(!/SSC|card|2-4-1|FREE/i.test(t), 'no card or deals: ' + t);
  ok(t.length < 260, 'short: ' + t.length);
  // AM -> PM flip gets its label; times in the same half don't repeat it.
  const parts = t.split(' → ');
  eq(parts.length, 4);
  ok(/^\d{1,2}:\d\d( PM)? /.test(parts[1]), parts[1]);
});

test('share: evening auto plan crosses no AM/PM and names every stop', () => {
  const p = makePlan(stops, { day: 5, month: 10, start: '18:00', budget: 20, vibe: 'any', origin: OREM, seed: 3, sscUses: [] });
  ok(p, 'plan');
  const t = shareText({ ...p, ymd: '2026-10-16' });
  ok(t.startsWith('Fri '), t);
  eq((t.match(/PM/g) || []).length, 1, 'PM once: ' + t);
  for (const x of p.items) ok(t.includes(x.stop.short || x.stop.name), x.stop.id);
  ok(!/\$|SSC/.test(t), t);
});

test('share: .ics has one event per stop at its time and place, one alarm 2 h before the first', () => {
  const ics = buildPlanIcs(pgPlan, now);
  ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics), 'CRLF line ends');
  for (const line of ics.split('\r\n')) ok(new TextEncoder().encode(line).length <= 75, 'folded: ' + line);
  const flat = ics.replace(/\r\n /g, '');
  eq((flat.match(/BEGIN:VEVENT/g) || []).length, 4);
  eq((flat.match(/BEGIN:VALARM/g) || []).length, 1);
  ok(/TRIGGER:-PT2H/.test(flat), 'alarm 2 h before');
  const starts = [...flat.matchAll(/DTSTART:(\d{8}T\d{6})/g)].map((m) => m[1]);
  eq(starts, pgPlan.items.map((x) => '20261017T' + hhmm(x.start).replace(':', '') + '00'));
  eq(starts[0], '20261017T100000');
  const ends = [...flat.matchAll(/DTEND:(\d{8}T\d{6})/g)].map((m) => m[1]);
  ends.forEach((e, i) => ok(e > starts[i], 'ends after it starts'));
  ok(flat.includes('LOCATION:Daylight Donuts\\, Pleasant Grove\\, UT'), 'place');
  ok(flat.includes('LOCATION:Home'), 'home stop');
  ok(flat.includes('SUMMARY:Kreative Kiln'), 'name');
  // Alarm sits inside the first event.
  const first = flat.split('END:VEVENT')[0];
  ok(first.includes('BEGIN:VALARM') && first.includes('SUMMARY:Daylight Donuts'), 'alarm on first stop');
  const uids = [...flat.matchAll(/UID:(\S+)/g)].map((m) => m[1]);
  eq(new Set(uids).size, 4, 'unique UIDs');
  eq(planIcsName(pgPlan), 'date-2026-10-17.ics');
});

test('share: .ics stops after midnight roll to the next day', () => {
  const late = { ...pgPlan, items: pgPlan.items.map((x, i) => (i === 3 ? { ...x, start: 23 * 60 + 30, end: 24 * 60 + 20 } : x)) };
  const flat = buildPlanIcs(late, now).replace(/\r\n /g, '');
  ok(flat.includes('DTSTART:20261017T233000'), 'start');
  ok(flat.includes('DTEND:20261018T002000'), 'end next day');
  eq(planStops(late)[3].end, '00:20');
});
