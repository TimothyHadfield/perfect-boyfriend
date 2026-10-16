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

## 2026-10-15 · Wave 3 (same chat)
- **Asked:** "what are your ideas for all the possibilities with this cite?" → Claude listed ideas → "alright build everything that you think would be a good improvement."
- **Built:** `docs/wave3-plan.md`; `monthlyBudget` setting (rules deployed); 4 parallel builders: smart Home suggestion + milestones; Plan real drive times (OSRM matrix), weather (Open-Meteo), learn from history, Talk line; Dates Past (rate/note/add) + monthly spending + budget in Settings; gift ideas from her profile + argument patterns.
- **Verified how:** `node tests/run.mjs` 161/161; rules emulator 38/38; live @ c418bf1 phone-view on all 7 screens at 393×659 WebKit and 1440×900 desktop: no page scroll, no overflow, no console errors.
- **Open:** Daylight Donuts PG vs Saratoga (Tim's call); parked items in progress.md.
- **Later same day:** Tim picked the PG Daylight Donuts store (question box); card deals kept there.

## 2026-10-15 · Wave 4 (same chat)
- **Asked:** "really think of all the possible new features we could add to the cite and once you're ready implement the ones that you think we should have."
- **Decided (Claude):** 7 features from a ~20-idea brainstorm (`docs/wave4-plan.md`); rest parked with reasons.
- **Built:** lists followUps + savedPlans (rules deployed); Card screen; quick capture + follow-ups; save/Calendar/Send plans; 20 seasonal stops + planner boost; Before you talk; backup/restore. Manager fix: BYU MOA real hours (closeByDay).
- **Verified how:** `node tests/run.mjs` 208/208; rules emulator 54/54; live @ d815955 phone-view on 9 screens at 393×659 WebKit + 1440×900: no page scroll, no overflow, no console errors.
- **Open:** real-iPhone checks (share sheet, .ics, Files); stop hours audit.
- **2026-10-16:** "prepare md files for chat reset" → checkpoint; tests 208/208 re-run; BUILT sections added to wave3/wave4 plans. Waiting on Tim's next ask.
