# Wave 4 plan — new features

Tim (2026-10-15): **"really think of all the possible new features we could add to the cite and once you're ready implement the ones that you think we should have."**

## Full brainstorm (✓ = building now)
| Idea | Verdict |
|---|---|
| ✓ **"She mentioned…" quick capture** (gift she wants / follow up on a date / fact about her) | Core boyfriend job; feeds Gifts, Home, Profile |
| ✓ **Follow-ups** ("ask how her interview went" on Fri) shown on Home that day | Small, high value |
| ✓ **Save a plan + add to Calendar (.ics with each stop) + send her the plan text** | Plans are made ahead; she wants to know the plan |
| ✓ **Card screen**: browse/search all 421 SSC deals, uses left, mark a use by hand | SSC is the core of the date side; uses outside Plan go untracked today |
| ✓ **Seasonal Utah County dates** (corn mazes, haunted houses, Christmas lights, skating, summer events) as Plan stops with months | "smart dates in your area" |
| ✓ **Repair helper** in Arguments (before you talk, repair lines, cool-down) | Arguments is only a log today |
| ✓ **Backup**: download all data as a file; restore adds missing rows, never deletes | Data safety; the repo is public, data only lives in Firestore |
| Love language in Profile → tailor nudges | Later; nudges work without it |
| Cycle symptom/mood log | Later; he logs only start/end by choice |
| App passcode | Privacy is Tim's call |
| First-run setup wizard | Home already prompts "Add her birthday"; revisit for public |
| Light theme / visual themes | Visuals are Tim's call |
| Spotify playlists, photo memories, events feed, couples mode, other cities | Need paid/auth services or are "public later" (parked) |

## Shared contracts
- `followUps` row: `{ text (≤200), date: 'YYYY-MM-DD', done?: bool }`.
- `savedPlans` row: `{ title, date: 'YYYY-MM-DD', at: 'HH:MM', stops: [{ id, name, at: 'HH:MM', deal?: string }], total, driveMins }`.
- Gift idea from capture: same shape Gifts uses for ideas (no `date`).
- Profile fact: appended to `S.profile` items via `backend.saveProfile(items)` (whole list; keep existing items).
- `sscUses` row (manual use from Card): `{ dealId, date: 'YYYY-MM-DD' }`, same as Plan writes.
- `S.followUps` is subscribed by Home (owner); `S.savedPlans` by Plan (owner). Others only read.

## Builders (one worktree each)
| Branch | Area | Owns |
|---|---|---|
| `w4-capture` | Quick capture + follow-ups on Home; saved plans in Coming up | `js/screens/home.js`, `css/home.css`, `js/logic/home.js`, `js/logic/suggest.js`, new `js/logic/capture.js`, tests |
| `w4-plan` | Save / Calendar / Send for plans; Card link in Plan | `js/screens/plan.js`, `css/plan.css`, `js/logic/plan.js`, new `js/logic/share.js`, tests |
| `w4-card` | Card screen | `js/screens/card.js`, `css/card.css`, new `js/logic/card.js`, tests |
| `w4-seasonal` | Seasonal stops data | `data/build-plan-stops.mjs`, `data/plan-stops.json`, `data/drive-times.json`, new `docs/seasonal-notes.md`, `tests/seasonal*.test.mjs` |
| `w4-safety` | Repair helper + backup | `js/screens/arguments.js`, `css/arguments.css`, `js/logic/arguments.js`, `js/screens/settings.js`, `css/settings.css`, new `js/logic/backup.js`, tests |

Groundwork done by manager: rules + `LISTS` allow `followUps`, `savedPlans` (deployed, 54/54); empty `card` screen registered (app.js, index.html, sw.js).
