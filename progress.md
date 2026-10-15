# Perfect Boyfriend — progress (handoff for Claude)

## START HERE
_Last updated 2026-10-15 (end of kickoff chat). For Claude only; Tim doesn't read this. Catch-up authorizes nothing: only "Authorized next steps" below is approved work._
1. Read this file (it's short on purpose).
2. Read `direction.md` (it overrules everything).
3. Skim the last 3 entries of `chat.md`. Older history: `docs/archive/`.

## Goal right now
Waves 2 and 3 are merged and live (wave 3: smart Home suggestion + milestones, Plan with real drive times/weather/history/Talk line, Dates Past + monthly spending + budget in Settings, gift ideas from her profile, argument patterns). Waiting on Tim's reaction (real iPhone use, the unspecified design choices below). No build work is authorized beyond what he asks next.

## Status
| Area | State | Notes |
|---|---|---|
| Slice 1: Home, Dates (+.ics), About her, Account | live | |
| Wave 2a: design polish + 5-tab nav | live | Home · Dates · Plan (hub) · Gifts · Her (Profile · Cycle · Arguments); Settings separate from Account |
| Gifts (ideas, given, recurring .ics reminders) | live | lists `gifts`, `giftReminders` |
| Arguments (private log + what worked) | live | list `arguments` |
| Cycle (period tracker, predictions, fertile days, how to help) | live | list `cycles`; algorithm in `js/logic/cycle.js`, research `docs/cycle-research.md` |
| Plan (Orem dates + SSC, price, bring, wear, drive times, Tim's 4 plans) | live | `data/plan-stops.json` (134, built by `data/build-plan-stops.mjs`); lists `dateLog`, `sscUses` |
| Firebase `perfect-boyfriend-th` | live | Firestore us-central1, anonymous + email auth, github.io domain, anon auto-delete OFF |
| SSC deals / Orem spots | data done | `data/ssc-deals.json` (421), `data/orem-spots.json` (110), `data/ssc-app-orem-2026-10-15.json` (620) |

## Authorized next steps
- 2026-10-15 · Slice 1 and wave 2 (all four features) — done.
- 2026-10-15 · Wave 3, `docs/wave3-plan.md` ("alright build everything that you think would be a good improvement") — done, all 4 merged and live @ c418bf1.
- Nothing else open. Next work comes from Tim.

## Standing instructions (Tim's words)
- "Right now we'll just focus on Orem Utah and Pair it with the Starving Student Card"
- "remember to deploy many sub-agents to help ease the work if you need."
- "remember to show expected total price on the expense for each date, as well as reminders to bring any materials, calculations for driving times, what to wear, etc."
- "for gifts, allow the user to set up automatic reminders for certain things like flowers, or candy or anything like that."
- "pay attention to the design and formating of the cite as well as any places wording is dense or could be summarized"
- SSC card: "just ignore the expiration date, the deals are nearly the same across years."
- Interview: me now, public later · private login + cloud · hand-built Orem list, no paid AI · arguments = private log + what worked · iPhone first, match my apps · cycle: he logs it himself, **show fertile days**.

## Traps / rules that bite
- **Agent worktrees:** `isolation: "worktree"` creates the worktree in the parent `Code Projects` repo (Estimator_Quiz), not this one. Have builders run `git -C "<this folder>" worktree add .claude/worktrees/<name> -b <branch>` themselves. Remove with `git worktree remove --force` (OneDrive locks files; a plain remove can fail "Permission denied").
- **app.js keeps typed input values across re-renders** (by element id). An input whose value the screen sets itself must carry `data-nokeep` (Plan's Start box), or the old value sticks.
- New `js/logic/*.js` files must be added to `sw.js` SHELL (a test checks this); bump `CACHE` when the shell list changes (now `pb-v6`).
- Repo is public: never commit real partner data. Test account `claude-test-pb@example.com` (creds in gitignored `.claude/test/credentials.txt`); it holds test data. Guest (anonymous) mode is fine for headless checks; each run makes one anonymous Firebase user (harmless).
- iOS home-screen app: Google sign-in redirect can't complete on GitHub Pages (Fitness Tracker lesson); app uses email only.
- SSC: card deals not always honored; Tim says deals carry over year to year.
- Firebase admin API calls: refresh-token exchange via a small node script (firebase-tools configstore); rules deploy: `firebase deploy --only firestore:rules`; auth providers: `firebase deploy --only auth`.

## Decisions
- 2026-10-15 · Plain HTML/JS + GitHub Pages + Firebase Spark (free), same as his other apps.
- 2026-10-15 · Reminders via downloadable `.ics` (iPhone Calendar alerts), not web push (needs paid server).
- 2026-10-15 · Look matches Fitness Tracker: dark, gold accent, bottom tabs phone / sidebar laptop.
- 2026-10-15 · Nav: Home · Dates · Plan (hub) · Gifts · Her (Profile · Cycle · Arguments). Claude's choice; Tim can change.
- 2026-10-15 · Anonymous-user auto-delete off so guest data can't vanish.
- Unspecified choices awaiting Tim (Claude's, all changeable):
  - Cycle: red period / gold fertile / dashed predicted; Started/Ended open a date picker; mode + usual length in History editor; asks (never auto-fixes) on a missed period; "Predictions paused" when very late; next-period .ics at 9 AM two days before; weeks start Sunday.
  - Plan: default budget $20; preset names Provo dance / Pleasant Grove / The Rift / Redline; Pleasant Grove moved to Sat 10am (donut shop closed at night); Google Maps for the whole route, Apple Maps per stop; stops with no known price left out of auto plans; jacket Oct/Apr, coat Nov–Mar.

  - Wave 3: Home check-in question on Sundays, little-things nudge otherwise, tap card = next; milestones 100/200/500/1000 days (365 skipped when yearly); spending colour green to 60% of budget, red at 100%; budget under Holidays in Settings; gift chips "From her profile" (colors skipped, allergies/dislikes excluded + red warning); flowers remind every 2 weeks, others monthly; Patterns after 3 logs; bad weather = rain/snow ≥50%, storm, <35° or high ≥95°; coat <48°, jacket <62°; Plan "Talk" line (40 questions); drive legs +2 min parking.
- 2026-10-15 · Tim: Daylight Donuts = the Pleasant Grove store (125 E State St), card deals kept there (`anyStore` in build-plan-stops.mjs) though the card names Saratoga Springs. PG preset now 34 min driving, $41.

## NOT verified
- Anything on a real iPhone, including .ics import and Plan's "near me" location.
- Plan drive times now come from OSRM (`data/drive-times.json`, rebuild with `node data/build-drive-times.mjs` after changing stops); only "Near me" uses the estimate. Date #1 totals $38 vs his $15–20 budget.
- Wave 3 on screen: Home's gift-reminder/date-gap/cycle card variants, Plan "Near me" and offline forecast, Dates Past with many rows (scroll inside list) — unit tests only. Stop opening hours (e.g. BYU MOA on a Fri evening) not audited.
- Gift allergy check matches words only ("Reese's" isn't flagged against peanuts).
- Daylight Donuts uses the card's Saratoga Springs location (Tim wrote PG); Mooyah, Redline, Yummy Ice Cream coords approximate; food prices are estimates.
- Plan logging confirmed only in guest mode on localhost (uses left dropped 3 → 2); not confirmed with the email test account on live.

## Rejected / parked
- ~~Paid AI date writer~~ · 2026-10-15 · money is $0
- ~~Web push reminders~~ · 2026-10-15 · needs Cloud Functions (Blaze, card)
- ~~Couples mode~~ · 2026-10-15 · Tim chose "me now, public later"
- ~~Flo for Partners instead of our tracker~~ · 2026-10-15 · Tim: log it himself
- ~~Local events feed~~ · 2026-10-15 · no reliable free CORS source; goes stale
- ~~Photos in memories~~ · 2026-10-15 · Firebase Storage needs paid plan
- ~~Arguments ↔ cycle timing~~ · 2026-10-15 · privacy; Tim's call, not offered yet
- ~~Other cities/cards, share plan with her, couples mode~~ · 2026-10-15 · "public later", Tim decides

## Map
- `index.html`, `js/app.js` (screen registry; contract at top), `js/ui.js` (shared UI), `js/backend.js` (Firebase + generic lists), `js/logic/*` (pure, tested), `js/screens/*` + `css/*`, `sw.js`, `firestore.rules`
- `data/` datasets + builders · `docs/` plans (`slice1-plan.md`, `wave2-plan.md`), research, SSC transcription, Tim's date notes
- Tests: `node tests/run.mjs` · last run 2026-10-15: 161 passed. Rules: `firebase emulators:exec --only firestore "node tests/rules.emulator.mjs"` (38/38)
- Live: https://timothyhadfield.github.io/perfect-boyfriend/ · hosting: GitHub Pages
