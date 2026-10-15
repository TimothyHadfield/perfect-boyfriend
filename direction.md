# Perfect Boyfriend — direction

_Tim's intent, from the kickoff interview (2026-10-15). **This overrules every other file.** Rerun the interview (`/kickoff`) if the goal changes. Items marked (assumed) weren't answered yet._

## What it's for
Tim's words: "an app that aids partners with everything they might need to help manage their relationship with their partner. It should help with remembering important dates, information about the specific person, getting gifts, common arguments, planning dates, etc. I also want it to come up with smart dates specifically in your area. Right now we'll just focus on Orem Utah and Pair it with the Starving Student Card specifically so that you can combine it with different options that are close to each other and cheap."

"Done" for v1: on his iPhone he can see every important date coming up, look up anything about his partner, track gift ideas, log recurring arguments and what fixed them, and tap for a cheap Orem date plan that chains nearby spots and Starving Student Card deals.

## Who uses it, and where
- Users: **Tim now, public later** · accounts: yes (private login), built so other people could sign up later
- Devices: **iPhone first** (home-screen web app), laptop too

## Hard constraints
- Money: $0, free tiers only, no card on file. **No paid AI**: date plans come from a hand-built Orem list, combined by code.
- Data: partner info, dates, gift ideas, argument log. **Private login + Firebase cloud** (free Spark plan), readable only by the signed-in owner. It's sensitive: never shown to anyone else, never in the public repo.
- Repo is public (for free GitHub Pages), so no secrets and no real partner data in it.

## Scope, in priority order
1. Important dates with reminders, plus a partner profile ("about her": favorites, sizes, likes/dislikes, notes)
2. Gift ideas tracker (ideas, given, how it went)
3. Common arguments: **private log** of recurring arguments, what set them off, what resolved them, to spot patterns
4. Orem date planner: real spots + Starving Student Card deals (Tim sends screenshots of the deals), combined into cheap plans of stops close to each other
5. Date log / planning (what we did, what she liked)

## Parking lot (explicitly later / out)
- Other cities · Orem first
- Paid AI date writer · costs money
- Shared couples mode (partner logs in) · Tim picked "me now, public later", not a couples app

## Taste
iPhone first, **match his other apps** (clean, compact). He decides visuals, wording and names. Load `design-taste` before any new screen.

## Working agreement
- Act on the recommendation; ask only for his decisions (visuals, wording, names, privacy, money).
- Use sub-agents freely to spread the work ("remember to deploy many sub-agents to help ease the work if you need").
