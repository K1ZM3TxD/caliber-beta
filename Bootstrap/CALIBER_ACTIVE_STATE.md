# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Extension-first operating model.** Calibration page is a launchpad; browser extension sidecard is the primary decision surface.

## Top Blocker
**Extension session handshake bug.** Fresh install or refresh causes "no active session" on LinkedIn until user manually refreshes both Caliber and LinkedIn tabs. This blocks reliable extension-first flow.

## Latest Shipped / Verified State
- Calibration flow runs end-to-end: resume → prompts → single hero title direction → extension CTA.
- Extension Phase 1 MVP verified working (LinkedIn job detail → fit score in popup).
- Production/dev environment split active and verified. Production: `caliber-app.com`. Dev: `localhost:3000`. No cross-environment contact.
- Title scoring baseline stable: 45/45 smoke tests pass (Chris, Jen, Fabio, Dingus fixtures).
- `/calibration` page layout canonical: Calibration Complete → Extension CTA → hero title card → "How we score this".

## Locked Task Order
1. Fix extension handshake / session discovery reliability
2. Hiring Reality Check (extension feature)
3. Compact sidecard UX polish
4. Bottom line / explanation polish (as needed)
5. Phase 2 overlay/list scoring (deferred)

Do not re-sequence without new blocking evidence.

## Product Surface Priority
1. **Extension reliability** — handshake, session discovery, scoring stability
2. **Hiring Reality Check** — next product feature for extension
3. **Sidecard UX polish** — compact, decision-first layout

Calibration page remains a launchpad, not a scoring engine.

## Open Issues (summary — see CALIBER_ISSUES_LOG.md for detail)
- #21 Extension session handshake (OPEN, top blocker)
- #22 Hiring Reality Check implementation (ACTIVE)
- #23 Sidecard compact UX redesign (ACTIVE)
- #26 Market-job scores low despite high calibration title scores (OPEN)
- #27 Search-surface / adjacent-title discovery gap (OPEN)
- #15 Bottom line paragraph repetition (OPEN)

## Next PM Decision Needed
Unblock extension handshake fix — determine root cause and assign coder task.

---

_Last updated: 2026-03-09_
