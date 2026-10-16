# Wave 3 plan — connect the pieces

Tim (2026-10-15), after Claude listed ideas: **"alright build everything that you think would be a good improvement."**

Built by 4 parallel builders, one per area, each in its own worktree. Shared groundwork (done first by the manager): settings doc may hold `monthlyBudget` (rules deployed, `backend.saveMonthlyBudget(dollars|null)`).

## Shared data contract
`dateLog` row (one per date you went on):
`{ title, date: 'YYYY-MM-DD', stops: [names], stopIds: [plan-stop ids], cost: number, rating?: 'loved'|'ok'|'meh', note?: string (≤500), manual?: true }`
- Plan writes `stopIds` from now on (old rows only have `stops` names; match by name as fallback).
- Dates (history) writes `rating`, `note`, and manual rows.
- `gifts` rows keep their shape; spending counts given gifts' `cost` if present (Gifts builder confirms the field name it already uses).

## A · Home (builder `w3-home`)
- One **smart suggestion** chosen by priority: birthday/anniversary within 14 days → "plan + gift"; gift reminder due → that; long gap since last date (>10 days) → "plan a date" (taps to Plan); cycle phase (period/PMS days) → gentle tip; otherwise rotating **little things** nudge or the **weekly check-in question**. Tapping goes to the right screen.
- **Milestones** from the anniversary date (100, 200, 365, 500, 1000 days; each year) show in Coming up.
- Owns: `js/screens/home.js`, `css/home.css`, `js/logic/home.js`, new `js/logic/suggest.js`, new `js/logic/nudges.js` (content), tests.

## B · Plan (builder `w3-plan`)
- **Weather**: Open-Meteo (free, no key, CORS) 7-day forecast for Orem; rain/snow/cold → favor indoor stops, show the forecast on each day chip or plan header, wear tips use it. Works without it (offline).
- **Real drive times**: precompute `data/drive-times.json` from the OSRM public table service at build time (script `data/build-drive-times.mjs`, polite request rate). Plan uses it; "Near me" falls back to the estimate. Label "est." only on estimates.
- **Learn from history**: skip stops used in the last 30 days (auto plans only), skip stops from 'meh' dates for 90 days, boost stops from 'loved' dates.
- **Talk about**: one conversation starter line per plan.
- Owns: `js/screens/plan.js`, `css/plan.css`, `js/logic/plan.js`, new `js/logic/weather.js`, data files above, tests.

## C · Dates history + spending (builder `w3-history`)
- Dates screen gets **Upcoming · Past** (Past = dateLog, newest first): rate (loved/ok/meh), note, add a past date by hand, delete.
- **This month's spending**: dates + given gifts vs `monthlyBudget`; set the budget in Settings.
- Owns: `js/screens/dates.js`, `css/dates.css`, `js/screens/settings.js`, `css/settings.css`, new `js/logic/history.js`, tests.

## D · Gifts from her profile + argument patterns (builder `w3-gifts-args`)
- Gifts: **From her profile** — her favorites (flowers, candy, food, colors…) become one-tap ideas or reminders.
- Arguments: **Patterns** — most common topics and what worked most for each. No cycle link (privacy is Tim's call).
- Owns: `js/screens/gifts.js`, `css/gifts.css`, `js/logic/gifts.js`, `js/screens/arguments.js`, `css/arguments.css`, `js/logic/arguments.js`, tests.

## Not in this wave (parked, with reason)
- Local events feed — no reliable free source with CORS; data goes stale.
- Photos in memories — Firebase Storage needs the paid plan.
- Arguments ↔ cycle timing — sensitive; Tim decides.
- Other cities / cards, sharing a plan with her, couples mode — "public later" decisions are Tim's.

## BUILT 2026-10-15
- Shipped all 4 lanes, live @ c418bf1. ~~Sharing a plan with her is parked~~ superseded: wave 4 built "Send to her".
- Where the plan was wrong: Plan's preset Start box stuck at the old time (app.js kept typed values) → `data-nokeep`.
- Verified: `node tests/run.mjs` 161/161; rules emulator 38/38; phone-view on live, 7 screens at 393×659 WebKit + 1440×900, clean.
