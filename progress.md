# Perfect Boyfriend — progress (handoff for Claude)

## START HERE
_Last updated 2026-10-15. For Claude only; Tim doesn't read this. Catch-up authorizes nothing: only "Authorized next steps" below is approved work._
1. Read this file (it's short on purpose).
2. Read `direction.md` (it overrules everything).
3. Skim the last 3 entries of `chat.md`. Older history: `docs/archive/`.

## Goal right now
Slice 1: important dates (+ calendar reminders) and the partner profile, behind a private login, on his iPhone. Plan: `docs/slice1-plan.md`.

## Status
| Area | State | Notes |
|---|---|---|
| Repo + Pages | live | github.com/TimothyHadfield/perfect-boyfriend |
| Firebase `perfect-boyfriend-th` | being set up | Firestore + anonymous auth; Email/Password may need Tim's console click |
| Slice 1 (dates + profile) | building | builder agent |
| Orem spots dataset | researching | for slice 4; SSC deals wait on Tim's screenshots |
| Gifts, arguments, date planner, date log | not started | |

## Authorized next steps
- 2026-10-15 · Build slice 1 (dates + partner profile), "Plan and build slice 1".

## Standing instructions (Tim's words)
- "Right now we'll just focus on Orem Utah and Pair it with the Starving Student Card"
- "remember to deploy many sub-agents to help ease the work if you need."
- Interview answers: me now, public later · private login + cloud · hand-built Orem list, no paid AI · he sends SSC screenshots · arguments = private log + what worked · iPhone first, match my apps.

## Traps / rules that bite
- Repo is public: never commit real partner data or test-account credentials (`.claude/test/` is gitignored).
- Firebase Email/Password provider can't be enabled by API on Spark (Fitness Tracker lesson) → Tim clicks it in the console.
- iOS home-screen app: Google sign-in redirect can't complete on GitHub Pages; popup only (Fitness Tracker lesson).
- SSC deals in the app aren't always honored; Tim's screenshots are the source of truth.

## Decisions
- 2026-10-15 · Plain HTML/JS + GitHub Pages + Firebase Spark (free), same as his other apps.
- 2026-10-15 · Reminders via downloadable `.ics` (iPhone Calendar alerts), not web push (needs paid server).
- 2026-10-15 · Repo name `perfect-boyfriend` (matches folder; Tim can rename).
- 2026-10-15 · Deleted the empty placeholder `perfectboyfriend.html` (0 bytes); app is `index.html`.

## NOT verified
- Everything on a real iPhone.

## Rejected / parked
- ~~Paid AI date writer~~ · 2026-10-15 · money is $0
- ~~Web push reminders~~ · 2026-10-15 · needs Cloud Functions (Blaze, card)
- ~~Couples mode~~ · 2026-10-15 · Tim chose "me now, public later"

## Map
- `direction.md` · Tim's intent · `docs/research.md` · similar apps + sources · `docs/slice1-plan.md`
- Tests: `node tests/run.mjs` (once built)
- Live: https://timothyhadfield.github.io/perfect-boyfriend/ · hosting: GitHub Pages
