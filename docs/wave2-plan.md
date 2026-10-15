# Wave 2 plan (2026-10-15)

Slice 1 is live. Tim kept adding scope in the same chat and said "remember to deploy many sub-agents". Order: **2a** (polish + nav skeleton) first, then **2b** (four features in parallel on top of it).

## 2a · Design polish + navigation skeleton (one builder)
Tim: "Also pay attention to the design and formating of the cite as well as any places wording is dense or could be summarized"
Findings from screenshots at 393px and 1440px:
1. Account: the holiday switches push the page into scrolling (taste rule 1), and they're app settings mixed into Account (rule 8). → Separate "Settings" (holiday switches in a compact 2-column grid) from account sign-in. No page scroll on the phone.
2. Laptop Home uses ~75% of the width with small text and a big empty right side. → Use the width (rule 2).
3. About her: 8 tall empty section rows; it will scroll once filled. → Tighter rows; 2 columns on laptop.
4. Wording sweep: labels 1–3 words, any sentence under ~15 words, explanations behind a small ?.
5. Nav for what's coming: phone bottom tabs **Home · Dates · Plan · Gifts · Her**, with Plan (the Orem date planner, the app's special feature) as the bigger center hub. **Her** holds sub-tabs **Profile · Cycle · Arguments**. New screens are empty placeholders (title only). Each screen lives in its own `js/screens/<name>.js` and `css/<name>.css`, so the 2b builders don't collide.

## 2b · Features (four builders in parallel, each owns its own screen files)
- **Gifts**: ideas, given (date, reaction), plus recurring reminders ("flowers every 2 weeks", "candy monthly"), each downloadable as a repeating `.ics` so iPhone Calendar alerts. Home "Last gift" reads it.
- **Plan (Orem date planner + date log)**: builds plans from `data/orem-spots.json` + `data/ssc-deals.json`. Stops are close together and cheap. Each plan shows **total expected price**, **drive time between stops** (haversine × road factor ÷ city speed, labeled estimate), **what to bring**, **what to wear**, time slots, and day-of-week limits. Tim's example plans (`docs/tim-date-notes.md`) must be reproducible. Track SSC uses left (punched circles). "We did this" logs it to `dateLog` (Home "Last date").
- **Cycle**: follows `docs/cycle-research.md` and `docs/sketches/cycle.mjs`. He logs her period start/end; it predicts the next period (range), phases, and **fertile window (shown, labeled "not birth control")** (Tim chose "Show them"), plus per-phase "how to help" notes from the research.
- **Arguments**: private log of a recurring argument: topic, trigger, what helped, what made it worse, date. Pattern view: most frequent topics and what worked.

## Verify (each)
Node tests for logic (seen failing first), rules emulator for any new collection shape, phone-view at 393px + `--desktop`, no page scroll, no console errors.
