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
  { id: 'daylight-donuts', name: 'Daylight Donuts', short: 'Daylight Donuts', kind: 'dessert', city: 'Pleasant Grove', lat: 40.35773, lng: -111.73820, cost: 8, mins: 15, indoor: true, tags: ['cheap'], hours: null, anyStore: true, note: '125 E State St, Pleasant Grove. The card lists the deal at Saratoga Springs; Tim chose the PG store (2026-10-15), so the deal may not be honored here' },
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

/* ---------- seasonal Utah County dates (only in their months) ---------- */
// Researched 2026-10-15 from free web sources; table + caveats in docs/seasonal-notes.md.
// Coordinates: Nominatim (OpenStreetMap) named place, else US Census address geocoder, else the SSC app's
// business location. months = calendar months it runs (finer date ranges are in `note`).
// priceNote 'estimate' = couldn't confirm a current price. days 0=Sun. Times are minutes after midnight.
const CHECKED = '2026-10-15';
const MON_SAT = [1, 2, 3, 4, 5, 6];
const SEASONAL = [
  // fall
  { id: 'cornbellys-lehi', name: "Cornbelly's Corn Maze (Lehi)", short: "Cornbelly's", kind: 'activity', city: 'Lehi', lat: 40.42474, lng: -111.89137, cost: 40, mins: 120, indoor: false, tags: ['seasonal', 'corn-maze', 'playful', 'photos'], months: [9, 10], days: MON_SAT, open: T(16), close: T(22), priceNote: '$19.99 Mon-Thu, $27.99 Fri-Sat per person (official, 2026)', note: 'At Thanksgiving Point. 2025 season Sep 20-Nov 2, closed Sundays; 2026 hours not posted (4-10pm assumed)', source: 'https://cornbellys.com/products/lehi' },
  { id: 'cornbellys-spanish-fork', name: "Cornbelly's Corn Maze (Spanish Fork)", short: "Cornbelly's SF", kind: 'activity', city: 'Spanish Fork', lat: 40.12909, lng: -111.74212, cost: 26, mins: 120, indoor: false, tags: ['seasonal', 'corn-maze', 'playful', 'photos'], months: [9, 10], days: MON_SAT, open: T(16), close: T(22), priceNote: '$12.99 Mon-Thu, $15.99 Fri-Sat per person (official, 2026)', note: '3687 W 5600 S. Smaller and cheaper than Lehi; u-pick pumpkins. Hours assumed like Lehi', source: 'https://cornbellys.com/products/spanish-fork' },
  { id: 'rowleys-red-barn-fall-festival', name: "Rowley's Red Barn Fall Festival", short: "Rowley's Red Barn", kind: 'activity', city: 'Santaquin', lat: 39.96886, lng: -111.78993, cost: 24, mins: 120, indoor: false, tags: ['seasonal', 'corn-maze', 'playful', 'cozy', 'orchard'], months: [9, 10], hours: 'Mon-Fri 3:30-9pm, Sat 10am-9pm, Sun closed', priceNote: '$12 Mon-Thu, $15 Fri-Sat per person (official, 2026)', note: '2026: Sep 19-Oct 30. Orchard farm stand (apple cider slush). About 30 min south of Orem', source: 'https://www.rowleysredbarn.com/pages/fall-festival' },
  { id: 'haunted-forest-af', name: 'The Haunted Forest', short: 'Haunted Forest', kind: 'activity', city: 'American Fork', lat: 40.35448, lng: -111.80157, cost: 60, mins: 90, indoor: false, tags: ['seasonal', 'spooky', 'scary', 'night'], months: [9, 10], days: MON_SAT, open: T(19, 30), close: T(22), priceNote: 'estimate', note: '2026: Fri-Sat in Sep, Mon-Sat in Oct, plus Nov 6-7; 7:30-10pm (to midnight Fri-Sat). Tickets online only', source: 'https://hauntedforestutah.com/' },
  // winter
  { id: 'luminaria-thanksgiving-point', name: 'Luminaria at Thanksgiving Point', short: 'Luminaria', kind: 'activity', city: 'Lehi', lat: 40.43409, lng: -111.91081, cost: 50, mins: 75, indoor: false, tags: ['seasonal', 'romantic', 'christmas-lights', 'walk'], months: [11, 12, 1], hours: 'Mon-Sat 4-9pm, Sun closed', priceNote: 'estimate (2025: $24-27 adult)', note: '2026: Nov 12-Jan 9; closed Sundays, Christmas Eve and Day. Timed tickets', source: 'https://thanksgivingpoint.org/events/luminaria' },
  { id: 'spanish-fork-festival-of-lights', name: 'Spanish Fork Festival of Lights (drive-through)', short: 'Festival of Lights', kind: 'activity', city: 'Spanish Fork', lat: 40.08228, lng: -111.60346, cost: 10, mins: 45, indoor: true, tags: ['seasonal', 'christmas-lights', 'drive', 'talky'], months: [11, 12], hours: '6-10pm', priceNote: '$10 per car online (2024); more at the booth', note: 'Canyon View Park. Thanksgiving Day to Jan 1. You stay in the car (indoor = weatherproof)', source: 'https://www.spanishfork.gov/news_detail_T17_R54.php' },
  { id: 'pond-town-christmas-salem', name: 'Pond Town Christmas lights (Salem Pond)', short: 'Salem Pond lights', kind: 'free-outdoor', city: 'Salem', lat: 40.05031, lng: -111.67434, cost: 0, mins: 45, indoor: false, tags: ['seasonal', 'free', 'christmas-lights', 'walk', 'romantic'], months: [12], open: T(17, 30), close: T(23), note: 'About Nov 29-Jan 1, 5:30-11pm (2024 guide); walk or drive the loop', source: 'https://whatsupprovo.beehiiv.com/p/christmas-lights-guide' },
  { id: 'rock-canyon-park-sledding', name: 'Rock Canyon Park sledding hill', short: 'Rock Canyon sledding', kind: 'free-outdoor', city: 'Provo', lat: 40.26733, lng: -111.63502, cost: 0, mins: 60, indoor: false, tags: ['seasonal', 'free', 'active', 'playful', 'sledding', 'snow'], months: [12, 1, 2], note: 'Only after a good snowfall; bring your own sled. Crowded on snow days', source: 'https://universe.byu.edu/2012/02/09/sledding-revitalizes-winter' },
  { id: 'sundance-nordic-snowshoe', name: 'Sundance Nordic Center (snowshoeing)', short: 'Sundance snowshoe', kind: 'activity', city: 'Sundance', lat: 40.39561, lng: -111.59089, cost: 60, mins: 90, indoor: false, tags: ['seasonal', 'active', 'scenic', 'snow', 'romantic'], months: [12, 1, 2, 3], open: T(9), close: T(16, 30), priceNote: 'estimate (2026-27 prices TBA)', note: 'Trail pass + snowshoe rental. Full-moon snowshoe nights and Night Owling on set dates. Hours estimated', source: 'https://www.sundanceresort.com/winter-activities/nordic-center/' },
  // spring
  { id: 'tulip-festival-thanksgiving-point', name: 'Tulip Festival at Thanksgiving Point', short: 'Tulip Festival', kind: 'activity', city: 'Lehi', lat: 40.43409, lng: -111.91081, cost: 52, mins: 120, indoor: false, tags: ['seasonal', 'romantic', 'flowers', 'walk', 'photos'], months: [4, 5], hours: 'Mon-Sat 9am-8pm, Sun closed', priceNote: 'estimate ($24 weekday to $29 peak adult, 2024-26 reports)', note: '2026: Apr 6-May 16 at Ashton Gardens. Timed tickets', source: 'https://thanksgivingpoint.org/events/tulip-festival/' },
  { id: 'cherry-blossoms-nielsens-grove', name: "Cherry blossom walk (Nielsen's Grove Park)", short: 'Cherry blossoms', kind: 'free-outdoor', city: 'Orem', lat: 40.26234, lng: -111.70341, cost: 0, mins: 45, indoor: false, tags: ['seasonal', 'free', 'romantic', 'flowers', 'walk', 'photos'], months: [4], note: 'Blooms last about 2 weeks, usually early to mid April; check before going', source: 'https://www.heraldextra.com/news/community/2025/mar/22/tales-from-utah-valley-its-time-for-springing/' },
  { id: 'festival-of-colors-spanish-fork', name: 'Festival of Colors (Krishna Temple)', short: 'Festival of Colors', kind: 'activity', city: 'Spanish Fork', lat: 40.07571, lng: -111.66209, cost: 20, mins: 120, indoor: false, tags: ['seasonal', 'playful', 'festival', 'loud'], months: [3, 4], auto: false, priceNote: 'estimate (color bags + parking)', note: 'One spring weekend only (2026: Mar 28-29), so add it by hand', source: 'https://www.heraldextra.com/news/2026/mar/29/color-rush-thousands-celebrate-2026-festival-of-colors-at-krishna-temple/' },
  // summer
  { id: 'provo-rooftop-concert', name: 'Rooftop Concert Series (downtown Provo)', short: 'Rooftop Concert', kind: 'culture', city: 'Provo', lat: 40.23384, lng: -111.6606, cost: 0, mins: 180, indoor: false, tags: ['seasonal', 'free', 'show', 'music', 'loud'], months: [5, 6, 7, 8, 9], slots: { 5: T(19) }, close: T(22), auto: false, note: 'One Friday a month, May-Sep (2026: May 15, Jun 26), 7pm, Nu Skin Plaza. Add it by hand on show nights', source: 'https://www.heraldextra.com/news/2026/apr/29/rooftop-concert-series-sets-date-announces-bands-for-downtown-provo-return/' },
  { id: 'provo-farmers-market', name: 'Provo Farmers Market (Pioneer Park)', short: 'Farmers Market', kind: 'free-outdoor', city: 'Provo', lat: 40.23304, lng: -111.66844, cost: 10, mins: 60, indoor: false, tags: ['seasonal', 'casual', 'walk', 'talky'], months: [6, 7, 8, 9, 10], days: [6], open: T(9), close: T(14), priceNote: 'estimate (snacks; entry free)', note: '2026: Saturdays Jun 6-Oct 31, 9am-2pm (10am in Oct)', source: 'https://marketspread.com/market/35940/provo-farmers-market/' },
  { id: 'thanksgiving-point-outdoor-movie', name: 'Outdoor Movie at Thanksgiving Point', short: 'Outdoor movie', kind: 'culture', city: 'Lehi', lat: 40.43409, lng: -111.91081, cost: 15, mins: 120, indoor: false, tags: ['seasonal', 'movie', 'romantic', 'picnic'], months: [6, 7, 8], slots: { 5: T(21) }, close: T(23, 30), priceNote: '$7.50 per adult (series page; 2026 not confirmed)', note: 'Fridays late Jun to mid Aug at Ashton Gardens; doors 8pm, film at dusk', source: 'https://www.thanksgivingpoint.org/events/outdoor-movie-series' },
  { id: 'high-country-tubing', name: 'High Country Adventure (Provo River tubing)', short: 'River tubing', kind: 'activity', city: 'Provo Canyon', lat: 40.35621, lng: -111.57281, cost: 83, mins: 150, indoor: false, tags: ['seasonal', 'active', 'river', 'summer'], months: [6, 7, 8], open: T(10), close: T(18), priceNote: 'estimate ($41.46 per person, undated listing)', note: '3702 E Provo Canyon Rd. Shuttles hourly 10am-4pm; float 1.5-2 hours. Book ahead', source: 'https://highcountryadventure.com/tubing/provo-river-tubing/' },
  { id: 'timpanogos-cave', name: 'Timpanogos Cave tour', short: 'Timpanogos Cave', kind: 'activity', city: 'American Fork Canyon', lat: 40.43902, lng: -111.7094, cost: 24, mins: 180, indoor: false, tags: ['seasonal', 'active', 'hike', 'cave', 'novel'], months: [6, 7, 8, 9], open: T(8), close: T(17), priceNote: '$12 per adult tour (NPS)', note: '2026 season opened May 18. Steep 1.5 mi trail up. Tickets on recreation.gov, released 30 days ahead; they sell out. Hours estimated', source: 'https://home.nps.gov/tica/planyourvisit/fees.htm' },
  { id: 'sundance-scenic-lift', name: 'Sundance scenic lift ride', short: 'Sundance lift', kind: 'activity', city: 'Sundance', lat: 40.3909, lng: -111.57766, cost: 60, mins: 90, indoor: false, tags: ['seasonal', 'scenic', 'romantic', 'view'], months: [6, 7, 8, 9], open: T(10), close: T(18), priceNote: '$30 per adult (official)', note: 'Daily late May to early Oct; food at Bearclaw Cabin up top. Hours estimated', source: 'https://www.sundanceresort.com/activities/scenic-lift-rides/' },
  { id: 'cascade-springs', name: 'Cascade Springs (Alpine Loop)', short: 'Cascade Springs', kind: 'free-outdoor', city: 'Alpine Loop', lat: 40.45815, lng: -111.55075, cost: 0, mins: 90, indoor: false, tags: ['seasonal', 'free', 'scenic', 'walk', 'talky', 'drive'], months: [6, 7, 8, 9, 10], note: 'Boardwalk springs off the Alpine Loop, open about late May to late Oct (snow closes the road)', source: 'https://www.utah.com/things-to-do/scenic-drives/alpine-loop-scenic-drive/' },
  { id: 'af-boat-harbor-sunset', name: 'American Fork Boat Harbor (Utah Lake sunset)', short: 'Utah Lake sunset', kind: 'free-outdoor', city: 'American Fork', lat: 40.34152, lng: -111.80192, cost: 0, mins: 45, indoor: false, tags: ['seasonal', 'free', 'sunset', 'romantic', 'view'], months: [5, 6, 7, 8, 9], note: 'Water on both sides at sunset', source: 'https://utahhikingbeauty.com/utah-lake-sunsets/' },
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
  // moa.byu.edu/plan-your-visit-hours (checked 2026-10-15): Mon/Thu/Fri 10-9, Tue/Wed/Sat 10-6, Sun closed.
  'byu-museum-of-art': { days: [1, 2, 3, 4, 5, 6], open: T(10), close: T(21), closeByDay: { 2: T(18), 3: T(18), 6: T(18) } },
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
    // anyStore: Tim chose a different store than the card names; keep its deals anyway.
    if (d.where && !stop.anyStore && !/multiple|all |all$|valid all|particip/i.test(where) && stop.city && stop.city !== 'Home') {
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
  if (tags.includes('sledding')) { bring.add('Sled'); bring.add('Gloves'); wear = 'Snow clothes'; }
  if (tags.includes('snow') && !tags.includes('sledding')) { bring.add('Gloves'); wear = 'Warm layers'; }
  if (/haunted-forest|luminaria|tulip-festival|timpanogos-cave/.test(id)) bring.add('Tickets');
  if (/outdoor-movie/.test(id)) bring.add('Blanket');
  if (/high-country-tubing/.test(id)) { bring.add('Swimsuit'); bring.add('Water shoes'); bring.add('Sunscreen'); }
  if (/festival-of-colors/.test(id)) wear = 'Old white clothes';
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
  const seasonal = sp.category === 'seasonal';
  const tags = seasonal && !(sp.tags || []).includes('seasonal') ? [...(sp.tags || []), 'seasonal'] : (sp.tags || []);
  const h = parseHours(sp.hours);
  const outdoorEvening = kind === 'free-outdoor' && tags.some((t) => ['evening', 'night', 'christmas-lights'].includes(t));
  out.push({
    id: sp.id, name: sp.name, short: sp.name.replace(/\s*\(.*\)\s*/g, ''), kind, city: sp.city, lat: sp.lat, lng: sp.lng,
    cost: sp.costPerCouple, mins: minsOf(kind, tags), indoor: sp.indoor, tags,
    days: h.days, open: kind === 'free-outdoor' ? null : h.open, close: outdoorEvening ? T(22) : (kind === 'free-outdoor' ? null : h.close),
    months: SEASON[sp.season] ?? null, slots: null, auto: true, pick: false, home: false,
    priceNote: sp.priceNote || null, note: null,
    source: seasonal ? sp.sourceUrl : null, checked: seasonal ? CHECKED : null,   // orem-spots research date
  });
}
for (const x of EXTRA) {
  const h = parseHours(x.hours);
  out.push({
    id: x.id, name: x.name, short: x.short, kind: x.kind, city: x.city, lat: x.lat, lng: x.lng,
    cost: x.cost, mins: x.mins, indoor: x.indoor, tags: x.tags,
    days: h.days, open: h.open, close: x.close ?? h.close, months: x.months || null, slots: null,
    auto: x.auto !== false, pick: false, home: !!x.home, bring: x.bring, dealExtra: x.dealExtra,
    anyStore: x.anyStore || undefined, priceNote: x.home ? null : 'estimate', note: x.note || null,
  });
}
for (const x of SEASONAL) {
  const h = parseHours(x.hours);
  out.push({
    id: x.id, name: x.name, short: x.short, kind: x.kind, city: x.city, lat: x.lat, lng: x.lng,
    cost: x.cost, mins: x.mins, indoor: x.indoor, tags: x.tags,
    days: x.days ?? h.days, open: x.open ?? h.open, close: x.close ?? h.close, months: x.months, slots: x.slots || null,
    auto: x.auto !== false, pick: false, home: false,
    priceNote: x.priceNote || null, note: x.note || null, source: x.source, checked: CHECKED,
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
