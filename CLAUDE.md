# Perfect Boyfriend — notes for Claude

A private, iPhone-first relationship helper Tim uses himself (built so others could sign up later): important dates with calendar reminders, everything about his partner, gift ideas + recurring gift reminders, a private argument log, a period tracker, and cheap Orem, Utah date plans built from real spots and his Starving Student Card (SSC) deals.

- Live: https://timothyhadfield.github.io/perfect-boyfriend/ (GitHub Pages, served from `main`, repo root; no build step)
- Cloud: Firebase project `perfect-boyfriend-th` (Spark, free): anonymous + email/password auth, Firestore. Data is `users/{uid}/...`, readable only by its owner (`firestore.rules`).
- Read first: `direction.md` (overrules everything), then `progress.md` (state, Traps, Rejected), last entries of `chat.md`.

## Files
- `index.html` → `js/app.js` (screen registry, routing `#/<key>`, the contract for screens is at its top), `js/ui.js` (shared UI: top bar, editors, help bubble, toast), `js/backend.js` (Firebase: auth, dates, profile, settings, generic lists).
- `js/screens/<key>.js` + `css/<key>.css`: home, dates, plan, gifts, profile, cycle, arguments, account, settings, card.
- `js/logic/*.js`: pure logic, no DOM/Firebase, all unit-tested (plan, cycle, gifts, history, share, backup, capture, card, weather, ...).
- `data/`: `plan-stops.json` (built by `node data/build-plan-stops.mjs`), `drive-times.json` (`node data/build-drive-times.mjs`, OSRM, needs internet; rerun after changing stops), `ssc-deals.json`, `orem-spots.json`.
- `sw.js`: offline service worker (app files network-first, Firebase SDK cache-first). `firestore.rules`, `firebase.json` (emulator on 8085).
- `docs/`: plans per wave (`wave2-plan.md` … `wave4-plan.md`), research, SSC transcription, Tim's date notes.

## Run and test
- Local: `python -m http.server <port>` in this folder (start it in the background), open `http://localhost:<port>/`. Local still talks to the real Firebase; each fresh browser makes one anonymous user (accepted as harmless). `?emu` on localhost points Firestore at a local emulator on 8085.
- Tests: `node tests/run.mjs` (~2 min, plain Node, no packages; 23+ files). Add tests in the same style (`tests/harness.mjs`: `test`, `eq`, `ok`).
- Rules: `firebase emulators:exec --only firestore --project demo-pb "node tests/rules.emulator.mjs"` (never the real project).
- Phone check: `node ~/.claude/tools/phone-view.mjs <url>` (+ `--desktop`). Logged-in checks use the existing test account in `.claude/test/` (gitignored); never sign up new accounts.

## Deploy
- **Every release: bump the build stamp** in `js/version.js` (`BUILD = 'YYYY-MM-DD.N'`, N = release number that day) AND the same value in `sw.js` (`const BUILD`). `tests/build.test.mjs` fails if they differ. The stamp shows at the bottom of Settings.
- Push to `main`; GitHub Pages serves it. Then curl `https://timothyhadfield.github.io/perfect-boyfriend/js/version.js` until it shows the new stamp.
- Phones update on their own (no hard refresh): when the app opens or comes back on screen it reads the live `js/version.js` (no-store) and reloads once onto a newer build, but only if no sheet is open, no field is focused and nothing was tapped since it came back; otherwise it waits for the next return. The new `sw.js` bytes make the worker reinstall and refresh the offline copy (`cache: 'reload'`, `updateViaCache: 'none'`).
- Rules deploy: `firebase deploy --only firestore:rules`. Auth providers: `firebase deploy --only auth`.

## Traps
- New `js/logic/*.js` or a new screen must be listed in `sw.js` SHELL (a test checks it). The cache name is `'pb-' + BUILD`, so bumping the build stamp renews it.
- Plan and Card share one `usesLeft` (`js/logic/card.js`); `savedFor` picks the newest by `updatedAt`; gift `added` is ISO now, old rows may hold a plain day (`addedMs` reads both).
- A new screen needs: an import in app.js SCREENS, a css link in index.html, and sw.js entries.
- app.js keeps typed input values across re-renders by element id; an input whose value the screen sets itself needs `data-nokeep`.
- `saveProfile` rewrites the whole profile list: only call it after `S.profileLoaded`, or existing items are wiped.
- Plan and Card fetch their data file on first render; after a failure they wait 30 s before retrying (a re-render loop used to refetch forever).
- Agent worktrees: create them inside this repo (`git worktree add`), not with the Agent tool's isolation (that lands in the parent `Code Projects` repo).
- The repo is public: never commit real partner data, emails or test credentials.
- iPhone home-screen app: Google sign-in redirect can't finish on GitHub Pages; the app uses email only.

## Standing instructions (Tim's words)
- "Right now we'll just focus on Orem Utah and Pair it with the Starving Student Card"
- "remember to show expected total price on the expense for each date, as well as reminders to bring any materials, calculations for driving times, what to wear, etc."
- "for gifts, allow the user to set up automatic reminders for certain things like flowers, or candy or anything like that."
- "pay attention to the design and formating of the cite as well as any places wording is dense or could be summarized"
- SSC card: "just ignore the expiration date, the deals are nearly the same across years."
- $0 only: no paid AI, no Blaze plan, no web push (reminders are `.ics` files for iPhone Calendar).
