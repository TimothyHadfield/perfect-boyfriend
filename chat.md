# Perfect Boyfriend — chat log (for Claude)

_One entry per session, newest at the bottom, capped at 60 KB. Older entries are in `docs/archive/chat-archive.md`. The current state is in `progress.md`._

## 2026-10-15 · Kickoff
- **Asked:** a relationship-helper app (dates, info about her, gifts, common arguments, date planning, smart cheap Orem dates with the Starving Student Card); make the GitHub repo and md files; find similar apps with links. Mid-turn: "deploy many sub-agents".
- **Decided (Tim, interview):** me now/public later; private login + cloud; hand-built Orem list, no paid AI; he'll send SSC screenshots; first slice = dates + profile; arguments = private log; iPhone first, match his apps; plan and build slice 1.
- **Built:** direction.md, progress.md, docs/research.md, docs/slice1-plan.md, README; repo + Pages; Firebase project `perfect-boyfriend-th`.
- **Also asked (same chat):** transcribe 10 SSC photos + his date notes; date plans with total price, bring, drive times, wear; recurring gift reminders; home page (last date/gift, upcoming dates, ideas); Flo-like period tracker with fertile days + how to treat her; design/wording pass.
- **Built:** slice 1 (Home, Dates + .ics, About her, Account); SSC data (421 deals); Orem spots (110) + plan stops (134); wave 2a (design polish, 5-tab nav); wave 2b by 4 parallel builders: Gifts, Arguments, Cycle, Plan. Email auth enabled via `firebase deploy --only auth`.
- **Verified how (2026-10-15):** `node tests/run.mjs` 119/119; rules emulator 35/35; live @ 9b11a4d checked with phone-view (WebKit 393×659) on home/plan/gifts/cycle/arguments: no overflow, no page scroll, no console errors. Plan "We did this" in guest mode dropped "3 left" → "2 left" (local server, phone-view eval).
- **Open:** nothing on a real iPhone yet; Tim to review the unspecified design choices (listed in progress.md Decisions).
