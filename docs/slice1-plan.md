# Slice 1 plan: important dates + partner profile (2026-10-15)

## Tim's words
"remembering important dates, information about the specific person" — picked "Dates + partner profile" as the first slice, "Private login + cloud", "iPhone first, match my apps", and "Plan and build slice 1".

## Goal
A home-screen web app on his iPhone where he signs in privately and can:
1. **Dates**: add important dates (birthday, anniversary, first date, her family birthdays, custom). Yearly repeat on/off. Home shows the next ones with "in N days". Countdown math handles Feb 29 and "today".
2. **Reminders**: free, no server. Each date gets an **"Add to iPhone Calendar"** button that downloads an `.ics` with a yearly repeat and alerts (1 week + 1 day before). Calendar does the notifying. (Web push needs a paid server function; parked.)
3. **About her**: a profile with sections (basics, favorites, sizes, likes, dislikes, love language, allergies, notes). Each item is a label + value, editable, addable.

## Stack
- Plain HTML/CSS/JS ES modules, no build step, on GitHub Pages. Firebase Auth + Firestore (project `perfect-boyfriend-th`, Spark, free) via the gstatic CDN SDK.
- Sign-in: anonymous on first visit, upgrade to email/password (link keeps the data). Same pattern as Fitness Tracker (`js/firebase-backend.js` there).
- Firestore: `users/{uid}/dates/{id}`, `users/{uid}/profile/main`. Rules: owner-only, everything else denied.
- Offline: Firestore local cache + service worker + manifest (installable).
- Logic (countdowns, .ics text) in pure modules with Node tests.

## Not in slice 1
Gifts, arguments log, Orem date planner, date log (next slices; direction.md order).

## Verify
- `node tests/*.test.mjs` pass (and each new test seen failing first).
- phone-view at 393px and `--desktop`: no console errors, no overflow, add-date flow visible without scrolling.
- Rules: unauthenticated read/write of `users/x` denied.
