# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Extension-first operating model — sidecard is primary product surface.** Calibration page is a polished launchpad; browser extension sidecard is the primary decision surface with job identity, Hiring Reality Check, and collapsible detail sections. Better Search Title recovery banner renders above the sidecard as a search-surface recovery mechanism.

## Top Blocker
**None blocking.** Extension handshake bug (#31) is a known friction point (may require manual tab refresh on first install) but does not block the primary user flow. No critical blockers remain.

## Latest Shipped / Verified State
- Calibration flow runs end-to-end: resume → prompts → single hero title direction → extension CTA.
- Calibration results page received final polish pass (2026-03-10):
  - Smaller hero title (text-[1.7rem] / text-[2.4rem])
  - Lighter section label (font-light)
  - Green primary CTA ("Search on LinkedIn"), scoring-yellow secondary ("See why it fits")
  - Explanation dropdown rewritten: human-friendly language, no internal scoring terminology
- Extension sidecard is compact, decision-first layout with:
  - Two-column header: company + job title (left), fit score + decision badge (right)
  - Hiring Reality Check (collapsible, with band badge)
  - Bottom line (collapsible)
  - Supports fit (green toggle, collapsible with bullet count)
  - Stretch factors (yellow toggle, collapsible with bullet count)
- Extension v0.4.7 built, zipped, and deployed.
- Better Search Title promoted above sidecard as standalone recovery banner (v0.4.7).
- Better Search Title logic adjusted: suggests calibration primary title or adjacent search-surface titles, not listing-specific titles.
- Better Search Title is now explicitly a **Search Surface Recovery Mechanism** — answers "What title should I search to find better-fit jobs?"
- Beta feedback loop active: thumbs up/down + structured signals + JSONL event log (v0.4.6).
- Production/dev environment split active and verified. Production: `caliber-app.com`. Dev: `localhost:3000`. No cross-environment contact.
- Title scoring baseline stable: 45/45 smoke tests pass (Chris, Jen, Fabio, Dingus fixtures).
- `/extension` page serves current extension build as the primary user install path.

## Real User Flow
```
calibration → results page → /extension → download ZIP → install in Chrome → navigate LinkedIn → extension scores jobs
```
`/extension` must always serve the current extension build — it is the user-facing install path.

## Locked Task Order
1. Extension compact scanline UX refinement
2. Extension decision trust / scoring clarity
3. No unnecessary expansion of calibration scope

## Better Search Title (Search Surface Recovery)

Product principle: Better Search Title is a **Search Surface Recovery Mechanism**.

It answers: "What title should I search to find better-fit jobs?"

Behavior:
- Renders as a recovery banner **above** the sidecard (not inside it)
- Appears only when weak-fit trigger fires (3/4 recent scores < 6.0, none > 7.0)
- Suggested title is the clickable control — links directly to LinkedIn search
- Suggests calibration primary title first, then adjacent search-surface titles
- Never suggests exact listing titles or employer-specific phrasing
- Visually calm, compact, does not increase sidecard height

Do not re-sequence without new blocking evidence.

## Product Surface Priority
1. **Extension sidecard** — compact scanline refinement, decision trust, scoring clarity
2. **Extension reliability** — handshake, session discovery (known friction, not blocking)
3. **Calibration page** — stable launchpad, no further expansion planned

Calibration page remains a launchpad, not a scoring engine.

## Open Issues (summary — see CALIBER_ISSUES_LOG.md for detail)
- #31 Extension session handshake friction (OPEN, known — not top blocker)
- #26 Market-job scores low despite high calibration title scores (OPEN)
- #27 Search-surface / adjacent-title discovery gap (OPEN)
- #15 Bottom line paragraph repetition (OPEN)

## Next PM Decision Needed
Extension compact scanline UX refinement — determine which visual/interaction details need tuning for decision trust.

---

_Last updated: 2026-03-10 (v0.4.7)_
