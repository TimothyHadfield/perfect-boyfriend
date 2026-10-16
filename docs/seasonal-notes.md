# Seasonal Utah County dates

Researched 2026-10-15 from free web sources. Tim's ask: "I also want it to come up with smart dates specifically in your area. Right now we'll just focus on Orem Utah".

Data lives in `data/build-plan-stops.mjs` (`SEASONAL`), built into `data/plan-stops.json`. A stop only shows up in its `months`. Every seasonal stop carries the `seasonal` tag, a `source` URL and a `checked` date. The 8 older seasonal stops come from `orem-spots.json` (pumpkin patch, Hee Haw, CLAS cruises, the light displays and the Alpine Loop).

**Price** is per couple. "est." means no current price was found.

| Stop | City | Months | $/couple | Hours used | Source |
|---|---|---|---|---|---|
| Cornbelly's Corn Maze (Lehi) | Lehi | Sep-Oct | 40 (Mon-Thu; 56 Fri-Sat) | Mon-Sat 4-10pm (assumed) | [cornbellys.com](https://cornbellys.com/products/lehi) |
| Cornbelly's Corn Maze (Spanish Fork) | Spanish Fork | Sep-Oct | 26 (32 Fri-Sat) | Mon-Sat 4-10pm (assumed) | [cornbellys.com](https://cornbellys.com/products/spanish-fork) |
| Rowley's Red Barn Fall Festival | Santaquin | Sep-Oct | 24 (30 Fri-Sat) | Mon-Fri 3:30-9, Sat 10-9 | [rowleysredbarn.com](https://www.rowleysredbarn.com/pages/fall-festival) |
| The Haunted Forest | American Fork | Sep-Oct | 60 est. | Mon-Sat 7:30-10pm | [hauntedforestutah.com](https://hauntedforestutah.com/) |
| Luminaria | Lehi | Nov-Jan | 50 est. | Mon-Sat 4-9pm | [thanksgivingpoint.org](https://thanksgivingpoint.org/events/luminaria) |
| Spanish Fork Festival of Lights | Spanish Fork | Nov-Dec | 10 per car | 6-10pm | [spanishfork.gov](https://www.spanishfork.gov/news_detail_T17_R54.php) |
| Pond Town Christmas (Salem Pond) | Salem | Dec | 0 | 5:30-11pm | [What's Up Provo guide](https://whatsupprovo.beehiiv.com/p/christmas-lights-guide) |
| Rock Canyon Park sledding | Provo | Dec-Feb | 0 | daylight | [BYU Universe](https://universe.byu.edu/2012/02/09/sledding-revitalizes-winter) |
| Sundance Nordic (snowshoe) | Sundance | Dec-Mar | 60 est. | 9-4:30 (est.) | [sundanceresort.com](https://www.sundanceresort.com/winter-activities/nordic-center/) |
| Tulip Festival | Lehi | Apr-May | 52 est. | Mon-Sat 9am-8pm | [thanksgivingpoint.org](https://thanksgivingpoint.org/events/tulip-festival/) |
| Cherry blossoms (Nielsen's Grove) | Orem | Apr | 0 | daylight | [Daily Herald](https://www.heraldextra.com/news/community/2025/mar/22/tales-from-utah-valley-its-time-for-springing/) |
| Festival of Colors (by hand only) | Spanish Fork | Mar-Apr | 20 est. | one weekend | [Daily Herald](https://www.heraldextra.com/news/2026/mar/29/color-rush-thousands-celebrate-2026-festival-of-colors-at-krishna-temple/) |
| Rooftop Concert (by hand only) | Provo | May-Sep | 0 | one Fri a month, 7pm | [Daily Herald](https://www.heraldextra.com/news/2026/apr/29/rooftop-concert-series-sets-date-announces-bands-for-downtown-provo-return/) |
| Provo Farmers Market | Provo | Jun-Oct | 10 est. | Sat 9am-2pm | [marketspread](https://marketspread.com/market/35940/provo-farmers-market/) |
| Outdoor movie, Thanksgiving Point | Lehi | Jun-Aug | 15 | Fri, film ~9pm | [thanksgivingpoint.org](https://www.thanksgivingpoint.org/events/outdoor-movie-series) |
| Provo River tubing (High Country) | Provo Canyon | Jun-Aug | 83 est. | 10am-6pm | [highcountryadventure.com](https://highcountryadventure.com/tubing/provo-river-tubing/) |
| Timpanogos Cave tour | AF Canyon | Jun-Sep | 24 | 8am-5pm (est.) | [nps.gov](https://home.nps.gov/tica/planyourvisit/fees.htm) |
| Sundance scenic lift | Sundance | Jun-Sep | 60 | 10am-6pm (est.) | [sundanceresort.com](https://www.sundanceresort.com/activities/scenic-lift-rides/) |
| Cascade Springs | Alpine Loop | Jun-Oct | 0 | daylight | [utah.com](https://www.utah.com/things-to-do/scenic-drives/alpine-loop-scenic-drive/) |
| AF Boat Harbor (Utah Lake sunset) | American Fork | May-Sep | 0 | sunset | [Utah Hiking Beauty](https://utahhikingbeauty.com/utah-lake-sunsets/) |

## Card deals
- **Rowley's Red Barn:** 2-for-1 corn maze (Mon-Thu), cider slush and ice cream.
- **High Country Adventure:** 2-for-1 tubing (Mon-Fri).
- Both link by business name.

## Caveats
- **Over 20 km from Orem:** `MAX_KM` in `js/logic/plan.js` is 20, so these never show in auto plans started from Orem, only when added by hand or planned from a nearer start:
  - Luminaria, the Tulip Festival and the outdoor movies (all 24 km)
  - Cornbelly's Lehi (22 km)
  - Spanish Fork Festival of Lights (25 km)
  - Salem Pond (28 km)
  - Rowley's (37 km)
  - Cascade Springs (22 km)
- **Dates finer than a month** are only in each stop's `note`. Months can't hold them:
  - Luminaria starts Nov 12.
  - The Festival of Lights starts on Thanksgiving.
  - The Haunted Forest runs only Fri-Sat in September.
  - Rowley's ends Oct 30.
  - The blossoms last about 2 weeks.
  - The Rooftop Concert and Festival of Colors are single dates, so they're set to by-hand only (`auto: false`).
- **Not added:**
  - Temple Square lights: Salt Lake City, about 50 min.
  - u-pick apple orchards: Payson and Santaquin; 2026 hours not confirmed.
  - Outdoor ice rinks: no 2025-26 outdoor rink found. Peaks Ice Arena is already a year-round stop.
  - Strawberry Days, Freedom Festival, Provo Movies in the Park: single dates.
- **Coordinates:**
  - Nominatim found most places.
  - The US Census geocoder found the Haunted Forest (6000 W 6400 N) and Cornbelly's Spanish Fork (3687 W 5600 S).
  - Rowley's and High Country come from the SSC app's business location.
