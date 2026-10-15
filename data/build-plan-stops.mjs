// Builds data/plan-stops.json: one list of date-plan stops for the Plan screen.
// Run: node data/build-plan-stops.mjs   (from the project folder or data/)
// Inputs: orem-spots.json (110 researched spots), ssc-deals.json (Tim's physical card,
// with punched circles), ssc-app-orem-2026-10-15.json (SSC app; used for business coordinates),
// plus Tim's picks from docs/tim-date-notes.md that aren't in the spot list (EXTRA below).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, f), 'utf8'));
const spots = load('orem-spots.json');
const card = load('ssc-deals.json').deals;

const T = (h, m = 0) => h * 60 + m;
const ALL = [0, 1, 2, 3, 4, 5, 6];

/* ---------- Tim's picks that aren't in orem-spots.json ---------- */
// Coordinates: SSC app business location where it has the Utah County store,
// otherwise OpenStreetMap/Nominatim (address or named place), 2026-10-15.
const EXTRA = [
  { id: 'redline-racing', name: 'Redline Racing', short: 'Redline Racing', kind: 'activity', city: 'Orem', lat: 40.3223, lng: -111.7244, cost: 40, mins: 45, indoor: true, tags: ['active', 'novel'], hours: null, note: 'Address from a directory listing (1439 N 1380 W); price is an estimate' },
  { id: 'mooyah-provo', name: 'Mooyah', short: 'Mooyah', kind: 'food', city: 'Provo', lat: 40.2638, lng: -111.6663, cost: 28, mins: 30, indoor: true, tags: ['cheap', 'casual'], hours: null, note: 'Moved in 2026 to 2319 N 400 W, Provo (street-level location); price estimate' },
  { id: 'sweeto-burrito-orem', name: 'Sweeto Burrito', short: 'Sweeto Burrito', kind: 'food', city: 'Orem', lat: 40.33354, lng: -111.71277, cost: 24, mins: 30, indoor: true, tags: ['cheap', 'casual'], hours: null },
  { id: 'hungry-hawaiian-provo', name: 'Hungry Hawaiian', short: 'Hungry Hawaiian', kind: 'food', city: 'Provo', lat: 40.2359, lng: -111.65844, cost: 30, mins: 40, indoor: true, tags: ['casual'], hours: null },
  { id: 'red-fuego-orem', name: 'Red Fuego', short: 'Red Fuego', kind: 'food', city: 'Orem', lat: 40.31084, lng: -111.67634, cost: 28, mins: 35, indoor: true, tags: ['casual'], hours: null },
  { id: 'tandoor-provo', name: 'Tandoor Indian Grill', short: 'Tandoor', kind: 'food', city: 'Provo', lat: 40.25581, lng: -111.66089, cost: 36, mins: 45, indoor: true, tags: ['sit-down', 'talky'], hours: null },
  { id: 'umami-vineyard', name: 'Umami Japanese Barbeque', short: 'Umami', kind: 'food', city: 'Vineyard', lat: 40.30779, lng: -111.73648, cost: 50, mins: 60, indoor: true, tags: ['sit-down', 'interactive'], hours: null, dealExtra: 'before 3pm' },
  { id: 'village-inn-provo', name: 'Village Inn', short: 'Village Inn', kind: 'food', city: 'Provo', lat: 40.22152, lng: -111.65839, cost: 30, mins: 50, indoor: true, tags: ['sit-down', 'talky', 'late-night'], hours: null },
  { id: 'tommys-burgers-provo', name: "Tommy's Burgers", short: "Tommy's", kind: 'food', city: 'Provo', lat: 40.23498, lng: -111.66586, cost: 22, mins: 30, indoor: true, tags: ['cheap', 'classic'], hours: null },
  { id: 'melty-pg', name: 'Melty', short: 'Melty', kind: 'food', city: 'Pleasant Grove', lat: 40.35367, lng: -111.76292, cost: 24, mins: 30, indoor: true, tags: ['cheap', 'casual'], hours: null },
  { id: 'pita-pit-provo', name: 'Pita Pit', short: 'Pita Pit', kind: 'food', city: 'Provo', lat: 40.2511, lng: -111.65833, cost: 22, mins: 30, indoor: true, tags: ['cheap', 'quick'], hours: 'Mon-Sat 11am-8pm, Sun closed' },
  { id: 'costa-vida-orem', name: 'Costa Vida', short: 'Costa Vida', kind: 'food', city: 'Orem', lat: 40.27379, lng: -111.70907, cost: 28, mins: 35, indoor: true, tags: ['cheap', 'casual'], hours: null },
  { id: 'sub-zero-provo', name: 'Sub Zero Ice Cream', short: 'Sub Zero', kind: 'dessert', city: 'Provo', lat: 40.23407, lng: -111.65969, cost: 14, mins: 20, indoor: true, tags: ['cheap', 'novel'], hours: null },
  { id: 'parlor-doughnuts-pg', name: 'Parlor Doughnuts', short: 'Parlor Doughnuts', kind: 'dessert', city: 'Pleasant Grove', lat: 40.35844, lng: -111.76859, cost: 10, mins: 20, indoor: true, tags: ['cheap'], hours: null },
  { id: 'milkshake-factory-pg', name: 'MilkShake Factory', short: 'MilkShake Factory', kind: 'dessert', city: 'Pleasant Grove', lat: 40.35314, lng: -111.76357, cost: 14, mins: 20, indoor: true, tags: ['cheap'], hours: null },
  { id: 'daylight-donuts', name: 'Daylight Donuts', short: 'Daylight Donuts', kind: 'dessert', city: 'Saratoga Springs', lat: 40.36449, lng: -111.91626, cost: 8, mins: 15, indoor: true, tags: ['cheap'], hours: null, note: 'Tim wrote PG; the card and the SSC app list it in Saratoga Springs, so that location is used' },
  { id: 'provo-bakery', name: 'Provo Bakery', short: 'Provo Bakery', kind: 'dessert', city: 'Provo', lat: 40.23493, lng: -111.65556, cost: 8, mins: 15, indoor: true, tags: ['cheap'], hours: null },
  { id: 'yummy-ice-cream-highland', name: 'Yummy Ice Cream', short: 'Yummy Ice Cream', kind: 'dessert', city: 'Highland', lat: 40.42718, lng: -111.78917, cost: 12, mins: 25, indoor: true, tags: ['cheap', 'arcade'], hours: null, note: 'Location is Highland town center (store address not found)' },
  { id: 'kreative-kiln-pg', name: 'The Kreative Kiln (pottery)', short: 'Kreative Kiln', kind: 'activity', city: 'Pleasant Grove', lat: 40.35412, lng: -111.75336, cost: 50, mins: 90, indoor: true, tags: ['creative', 'talky', 'keepsake'], hours: null, note: '844 S 800 W, Pleasant Grove: the store the card deals are for' },
  { id: 'get-out-games-provo', name: 'GetOut Games (escape room)', short: 'GetOut Games', kind: 'activity', city: 'Provo', lat: 40.23744, lng: -111.65877, cost: 50, mins: 75, indoor: true, tags: ['teamwork', 'playful'], hours: null, note: 'Book ahead; price estimate' },
  { id: 'laser-assault-provo', name: 'Laser Assault', short: 'Laser Assault', kind: 'activity', city: 'Provo', lat: 40.21746, lng: -111.66403, cost: 24, mins: 45, indoor: true, tags: ['active', 'playful', 'laser-tag'], hours: null, note: 'Price estimate' },
  { id: 'lowes-xtreme-provo', name: 'Lowes Xtreme Air Sports', short: 'Lowes Xtreme', kind: 'activity', city: 'Provo', lat: 40.23207, lng: -111.67865, cost: 30, mins: 75, indoor: true, tags: ['active', 'playful', 'trampoline'], hours: null, note: 'Price estimate' },
  { id: 'game-grid-lehi', name: 'Game Grid (board games)', short: 'Game Grid', kind: 'activity', city: 'Lehi', lat: 40.38297, lng: -111.83292, cost: 10, mins: 90, indoor: true, tags: ['talky', 'nerdy', 'board-games'], hours: null },
  { id: 'stadium-cinemas-payson', name: 'Stadium Cinemas', short: 'Stadium Cinemas', kind: 'activity', city: 'Payson', lat: 40.03465, lng: -111.74849, cost: 20, mins: 120, indoor: true, tags: ['movie'], hours: null },
  { id: 'splash-summit-provo', name: 'Splash Summit Waterpark', short: 'Splash Summit', kind: 'activity', city: 'Provo', lat: 40.23643, lng: -111.63664, cost: 60, mins: 180, indoor: false, tags: ['active', 'summer'], hours: null, months: [5, 6, 7, 8], close: T(19) },
  { id: 'quick-wits-slc', name: 'Quick Wits Comedy', short: 'Quick Wits', kind: 'culture', city: 'Salt Lake City', lat: 40.69277, lng: -111.88783, cost: 30, mins: 90, indoor: true, tags: ['funny', 'show'], hours: null },
  { id: 'utah-grizzlies', name: 'Utah Grizzlies (Maverik Center)', short: 'Grizzlies game', kind: 'culture', city: 'West Valley City', lat: 40.70279, lng: -111.95054, cost: 40, mins: 150, indoor: true, tags: ['sporty', 'loud'], hours: null, months: [10, 11, 12, 1, 2, 3, 4] },
  { id: 'mandalyn-academy-af', name: 'Mandalyn Academy (face waxing)', short: 'Mandalyn Academy', kind: 'activity', city: 'American Fork', lat: 40.37156, lng: -111.78177, cost: 0, mins: 45, indoor: true, tags: ['pamper'], hours: null, auto: false },
  { id: 'ticket-to-ride-home', name: 'Ticket to Ride Europe (at home)', short: 'Ticket to Ride', kind: 'at-home', city: 'Home', lat: null, lng: null, home: true, cost: 0, mins: 90, indoor: true, tags: ['talky', 'board-games'], hours: null, bring: ['Ticket to Ride Europe', 'Snacks'] },
];

// Tim's picks (docs/tim-date-notes.md), by stop id.
const PICKS = new Set(['classic-fun-center-orem', 'redline-racing', 'stadium-cinemas-payson', 'color-me-mine-provo', 'escapes-in-time',
  'game-grid-lehi', 'get-out-games-provo', 'kreative-kiln-pg', 'laser-assault-provo', 'lowes-xtreme-provo', 'mandalyn-academy-af',
  'peaks-ice-arena', 'quick-wits-slc', 'splash-summit-provo', 'the-rift-provo', 'the-ruth-theater', 'tippin-point-country-dance', 'utah-grizzlies',
  'costa-vida-orem', 'hungry-hawaiian-provo', 'sweeto-burrito-orem', 'red-fuego-orem', 'tandoor-provo', 'umami-vineyard', 'village-inn-provo',
  'bobbys-burgers-orem', 'burgers-supreme-provo', 'tommys-burgers-provo', 'mooyah-provo', 'melty-pg', 'pita-pit-provo',
  'sub-zero-provo', 'parlor-doughnuts-pg', 'roll-up-crepe', 'waffle-love-provo', 'yummy-ice-cream-highland', 'provo-bakery',
  'milkshake-factory-pg', 'daylight-donuts', 'jersey-mikes-orem', 'ticket-to-ride-home']);

/* ---------- per-stop fixes ---------- */
const OVERRIDE = {
  'tippin-point-country-dance': { short: "Tippin' Point", slots: { 3: T(20, 30), 6: T(20, 30) }, mins: 180, close: T(24, 30) },
  'marnells-country-dance': { short: "Marnell's", slots: { 1: T(20), 4: T(21) }, mins: 150, close: T(24) },
  'salsa-chocolate': { short: 'Salsa Chocolate', slots: { 4: T(21) }, mins: 150, close: T(25) },
  'the-rift-provo': { short: 'The Rift', days: [1], mins: 60, note: 'Tim: Mondays only (free for two)' },
  'the-ruth-theater': { short: 'The Ruth', slots: { 1: T(19, 30), 2: T(19, 30), 3: T(19, 30), 4: T(19, 30), 5: T(19, 30), 6: T(19, 30) }, mins: 150, close: T(23) },
  'color-me-mine-provo': { short: 'Color Me Mine', mins: 90 },
  'classic-fun-center-orem': { short: 'Classic Fun Center', close: T(22) },
  'escapes-in-time': { short: 'Escapes in Time', mins: 75 },
  'peaks-ice-arena': { short: 'Peaks Ice Arena', mins: 75, close: T(21, 30) },
  'scera-center': { mins: 120 },
  'dry-bar-comedy': { auto: false },
  'dragons-keep-orem': { auto: false },   // a game and comic store: fine to add by hand, not a date on its own
  'uvu-athletics': { auto: false, mins: 120 },
  'alpine-loop-fall-drive': { mins: 90, months: [9, 10] },
  'kyhv-peak-overlook': { months: [5, 6, 7, 8, 9, 10] },
  'the-pumpkin-patch-orem': { months: [9, 10] },
  'hee-haw-farms': { months: [9, 10, 11] },
  'clas-halloween-cruise': { months: [9, 10], slots: { 1: T(20), 2: T(20), 3: T(20), 4: T(20), 5: T(20), 6: T(20) }, mins: 60 },
  'clas-christmas-cruise': { months: [12], slots: { 1: T(20), 2: T(20), 3: T(20), 4: T(20), 5: T(20), 6: T(20) }, mins: 60 },
  'orem-lights-on': { months: [12] },
  'riverwoods-christmas-lights': { months: [11, 12] },
  'university-place-holiday-lights': { months: [11, 12] },
  'bridal-veil-falls': { note: 'Under construction until about Sep 2027' },
  'jersey-mikes-orem': { short: "Jersey Mike's" },
  'bobbys-burgers-orem': { short: "Bobby's Burgers" },
  'burgers-supreme-provo': { short: 'Burgers Supreme' },
  'roll-up-crepe': { short: 'Roll Up Crepes' },
  'waffle-love-provo': { short: 'Waffle Love' },
};
const DROP = new Set(['kreative-kiln-provo']);   // replaced by the Pleasant Grove store (the card's)

/* ---------- card deal links ---------- */
const norm = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/^\s*the\s+/, '').replace(/[^a-z0-9]/g, '');
const ALIAS = {   // card business -> stop id(s), where names don't line up
  'Utah Country Dance': ['tippin-point-country-dance'],   // utahcountrydance.com runs Tippin' Point (Wed & Sat)
  'Salsa at Southworth': ['salsa-chocolate'],
  'Fabulosos Tacos': ['los-fabulosos-tacos'],
  "La Carreta's Peruvian Restaurant": ['la-carreta-peruvian'],
  '5 Star BBQ': ['five-star-bbq'],
  "Rhyno's Axe & Archery": ['rhynos-axe-throwing'],
  'Quarry Indoor Climbing Center': ['quarry-climbing'],
  'Bahama Buck\'s': ['bahama-bucks-provo'],
  SCERA: ['scera-center'],
};
const DEAL_TO = {   // single card lines that belong to a different stop than their business name
  'entertainment-005': 'clas-christmas-cruise',
  'entertainment-006': 'clas-halloween-cruise',
};
const NOT_DEAL = new Set(['free-051', 'retail-025', 'retail-026', 'free-072']);   // Pita Pit T-shirt, Mandalyn facials, The Ruth youth-show ticket

function dealsFor(stop) {
  const ns = norm(stop.name);
  return card.filter((d) => {
    if (NOT_DEAL.has(d.id)) return false;
    if (DEAL_TO[d.id]) return DEAL_TO[d.id] === stop.id;
    const alias = ALIAS[d.business];
    let hit;
    if (alias) hit = alias.includes(stop.id);
    else {
      const nb = norm(d.business);
      hit = nb.length >= 4 && (ns.startsWith(nb) || nb.startsWith(ns));
    }
    if (!hit) return false;
    // Location-limited lines ("Lehi", "Saratoga Springs") only count at that city's store.
    const where = (d.where || '') + ' ' + (d.limits || '');
    if (d.where && !/multiple|all |all$|valid all|particip/i.test(where) && stop.city && stop.city !== 'Home') {
      const w = d.where.toLowerCase();
      const c = stop.city.toLowerCase();
      if (!w.includes(c) && !(c === 'orem' && /uvu/.test(w))) return false;
    }
    return true;
  }).map((d) => ({ id: d.id, text: d.deal, limits: [d.limits, stop.dealExtra].filter(Boolean).join('; ') || null, uses: d.uses, used: d.used }));
}

/* ---------- hours -> open days, open/close times ---------- */
function parseHours(h) {
  const out = { days: null, open: null, close: null };
  if (!h) return out;
  const s = h.toLowerCase();
  if (/24 hours/.test(s)) return { days: null, open: 0, close: T(24) };
  const days = ALL.slice();
  if (/sun(day)?s?\s*closed|closed\s*sun/.test(s)) days.splice(days.indexOf(0), 1);
  if (/mon(day)?\s*closed/.test(s)) days.splice(days.indexOf(1), 1);
  if (days.length < 7) out.days = days;
  let close = null, open = null;
  const re = /(\d{1,2})(?::(\d\d))?\s*(am|pm)|midnight|noon/g;
  let m;
  while ((m = re.exec(s))) {
    let v;
    if (m[0] === 'midnight') v = T(24);
    else if (m[0] === 'noon') v = T(12);
    else {
      const hh = (+m[1]) % 12, mm = +m[2] || 0;
      v = m[3] === 'pm' ? T(hh + 12, mm) : (hh <= 3 ? T(hh + 24, mm) : T(hh, mm));
    }
    if (v >= T(15)) close = Math.max(close || 0, v);
    if (v >= T(5) && v <= T(14) && m[3] !== 'pm') open = Math.min(open ?? 9999, v);
  }
  // "2-8pm": the open hour has no am/pm
  const bare = /\b(\d{1,2})-(\d{1,2})(?::\d\d)?\s*pm/.exec(s);
  if (bare && +bare[1] < +bare[2]) open = Math.min(open ?? 9999, T(+bare[1] + 12));
  out.close = close;
  out.open = open;
  return out;
}

/* ---------- what to bring / wear ---------- */
function bringWear(s) {
  const id = s.id, tags = s.tags || [];
  const bring = new Set(s.bring || []);
  let wear = '';
  if (/ice-arena/.test(id)) { bring.add('Thick socks'); bring.add('Gloves'); wear = 'Warm layers'; }
  if (tags.includes('dance')) { bring.add('Water bottle'); wear = 'Boots or shoes that spin'; }
  if (/color-me-mine|kreative-kiln/.test(id)) wear = 'Clothes that can get messy';
  if (tags.includes('hike')) { bring.add('Water'); bring.add('Flashlight'); wear = 'Hiking shoes'; }
  if (/quarry/.test(id)) { bring.add('Water bottle'); wear = 'Stretchy clothes'; }
  if (/back-nine-golf/.test(id)) bring.add('Golf clubs');
  if (/redline/.test(id)) wear = 'Closed-toe shoes';
  if (tags.includes('trampoline')) { bring.add('Socks'); wear = 'Athletic clothes'; }
  if (tags.includes('laser-tag')) wear = 'Dark clothes';
  if (/classic-fun-center|miracle-bowl|fat-cats/.test(id)) bring.add('Socks');
  if (/hang-time/.test(id)) wear = 'Athletic clothes';
  if (/voltage-ebike|provo-river-parkway/.test(id)) { bring.add('Water'); wear = 'Athletic clothes'; }
  if (/clas-ropes/.test(id)) wear = 'Athletic clothes';
  if (/splash-summit/.test(id)) { bring.add('Swimsuit'); bring.add('Towel'); bring.add('Sunscreen'); }
  if (tags.includes('corn-maze')) { bring.add('Flashlight'); wear = 'Shoes that can get muddy'; }
  if (tags.includes('dress-up')) wear = 'Dress up a little';
  if (tags.includes('sunset') || /utah-lake|sunset-beach|kyhv/.test(id)) { bring.add('Blanket'); }
  if (/sunset-beach|utah-lake/.test(id)) bring.add('Bug spray');
  if (tags.includes('picnic') && s.kind === 'free-outdoor') bring.add('Blanket');
  if (/canyon-glen/.test(id)) bring.add('Firewood & matches');
  if (/escapes-in-time|get-out-games/.test(id)) bring.add('Booking confirmation');
  if (/the-ruth|scera-center/.test(id)) bring.add('Tickets');
  if (/utah-grizzlies|uvu-athletics/.test(id)) wear = 'Team colors';
  return { bring: [...bring], wear };
}

function kindOf(sp) {
  if (sp.category === 'food') return 'food';
  if (sp.category === 'dessert' || sp.category === 'drinks') return 'dessert';
  if (sp.category === 'outdoor') return 'free-outdoor';
  if (sp.category === 'culture') return 'culture';
  if (sp.category === 'seasonal') return (sp.tags || []).includes('free') ? 'free-outdoor' : 'activity';
  return 'activity';
}

function minsOf(kind, tags) {
  if (kind === 'food') return tags.includes('sit-down') ? 60 : 35;
  if (kind === 'dessert') return 20;
  if (kind === 'free-outdoor') return tags.includes('hike') ? 90 : 45;
  if (kind === 'culture') return tags.includes('show') ? 120 : 60;
  return 75;
}

const SEASON = { all: null, summer: [6, 7, 8], fall: [9, 10, 11], winter: [12, 1, 2], 'spring-fall': [4, 5, 6, 7, 8, 9, 10] };

const out = [];
for (const sp of spots) {
  if (DROP.has(sp.id) || sp.costPerCouple == null) continue;   // no price found (Karaoke38, SCERA Shell, Improv Broadway, ComedyBox)
  const kind = kindOf(sp);
  const tags = sp.tags || [];
  const h = parseHours(sp.hours);
  const outdoorEvening = kind === 'free-outdoor' && tags.some((t) => ['evening', 'night', 'christmas-lights'].includes(t));
  out.push({
    id: sp.id, name: sp.name, short: sp.name.replace(/\s*\(.*\)\s*/g, ''), kind, city: sp.city, lat: sp.lat, lng: sp.lng,
    cost: sp.costPerCouple, mins: minsOf(kind, tags), indoor: sp.indoor, tags,
    days: h.days, open: kind === 'free-outdoor' ? null : h.open, close: outdoorEvening ? T(22) : (kind === 'free-outdoor' ? null : h.close),
    months: SEASON[sp.season] ?? null, slots: null, auto: true, pick: false, home: false,
    priceNote: sp.priceNote || null, note: null,
  });
}
for (const x of EXTRA) {
  const h = parseHours(x.hours);
  out.push({
    id: x.id, name: x.name, short: x.short, kind: x.kind, city: x.city, lat: x.lat, lng: x.lng,
    cost: x.cost, mins: x.mins, indoor: x.indoor, tags: x.tags,
    days: h.days, open: h.open, close: x.close ?? h.close, months: x.months || null, slots: null,
    auto: x.auto !== false, pick: false, home: !!x.home, bring: x.bring, dealExtra: x.dealExtra,
    priceNote: x.home ? null : 'estimate', note: x.note || null,
  });
}
for (const s of out) {
  Object.assign(s, OVERRIDE[s.id] || {});
  s.pick = PICKS.has(s.id);
  s.deals = dealsFor(s);
  const bw = bringWear(s);
  s.bring = bw.bring;
  s.wear = bw.wear;
  delete s.dealExtra;
  for (const k of Object.keys(s)) if (s[k] == null || (Array.isArray(s[k]) && !s[k].length && k !== 'deals')) delete s[k];
}

const missing = [...PICKS].filter((id) => !out.find((s) => s.id === id));
if (missing.length) throw new Error('Tim picks missing: ' + missing.join(', '));

writeFileSync(join(here, 'plan-stops.json'), JSON.stringify({
  built: new Date().toISOString().slice(0, 10),
  note: 'Generated by data/build-plan-stops.mjs. Times are minutes after midnight; days 0=Sun. cost = estimated dollars per couple before SSC deals. deals[].id refers to ssc-deals.json.',
  stops: out,
}, null, 0).replace(/\},\{"id"/g, '},\n{"id"'));
const counts = {};
for (const s of out) counts[s.kind] = (counts[s.kind] || 0) + 1;
console.log(out.length, 'stops', counts, out.reduce((a, s) => a + s.deals.length, 0), 'deal links');
