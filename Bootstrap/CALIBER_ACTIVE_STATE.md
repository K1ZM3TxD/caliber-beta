# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Strong-match action workflow.** Extension remains the primary discovery surface; strong-fit jobs (8.0+) now feed an action workflow. Calibration page is a stable launchpad. Extension sidecard evaluates jobs. Strong matches trigger a contextual "Tailor resume for this job" card above the sidecard, leading to resume tailoring and a simple job pipeline/tracker on the web app. Better Search Title recovery banner continues to render above the sidecard for weak-search recovery.

## Top Blocker
**None blocking.** Extension handshake bug (#31) is known friction (may require manual tab refresh on first install). Strong-match pipeline + tailoring workflow is the active product initiative.

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
- Extension v0.6.0 built, zipped, and deployed.
- Strong-match contextual card (8.0+) renders above sidecard — triggers "Tailor resume for this job" workflow.
- Pipeline entry is created at `/api/tailor/prepare` time for `strong_match` jobs — pipeline persistence begins before tailoring, not after.
- Pipeline advances to `tailored` stage during `/api/tailor/generate`.
- `/tailor` confirmation banner is gated by actual pipeline existence — only shown when backed by a real pipeline entry.
- Extension suppresses the 8.0+ tailor CTA for jobs already present in the user's pipeline (baseline CTA noise control).
- Resume tailoring: extension POSTs job context → `/api/tailor/prepare` → web `/tailor` page generates tailored resume via OpenAI using existing Caliber resume + job context.
- Simple job pipeline/tracker: `/pipeline` page with stages (Strong Match → Tailored → Applied → Interviewing). Intentionally minimal — not a CRM.
- Extension feedback row now includes a separate bug-report action, distinct from thumbs-down quality feedback.
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
1. Strong-match resume-tailoring workflow (8.0+ contextual CTA → tailor page → download)
2. Simple job pipeline/tracker (minimal stages, anti-bloat)
3. CTA noise-control refinement — baseline suppression (jobs already in pipeline) is live; remaining work is per-session / time-based refinement
4. Extension compact scanline UX refinement (ongoing)
5. No unnecessary expansion of calibration scope — calibration page is stable

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
1. **Extension sidecard** — primary discovery surface; strong matches (8.0+) trigger action workflow
2. **Tailor + Pipeline (web app)** — strong-match action layer: resume tailoring and minimal job pipeline
3. **Extension reliability** — handshake, session discovery (known friction, not blocking)
4. **Calibration page** — stable launchpad, no further expansion planned

Calibration page remains a launchpad, not a scoring engine. The action layer (tailor + pipeline) is the next product surface — intentionally minimal.

## Open Issues (summary — see CALIBER_ISSUES_LOG.md for detail)
- #35 Strong-match resume-tailoring workflow (ACTIVE — current initiative)
- #36 Simple job pipeline/tracker (ACTIVE — current initiative)
- #37 Noise control for strong-match CTA (OPEN)
- #31 Extension session handshake friction (OPEN, known — not top blocker)
- #26 Market-job scores low despite high calibration title scores (OPEN)
- #27 Search-surface / adjacent-title discovery gap (OPEN)
- #15 Bottom line paragraph repetition (OPEN)

## Next PM Decision Needed
1. **Strong-match tailoring workflow** — validate end-to-end flow quality; determine if text download is sufficient or PDF generation is needed.
2. **Simple pipeline/tracker** — confirm stage model is sufficient; decide whether pipeline entries should auto-populate on 8.0+ scores or only after explicit user action.
3. **CTA noise-control refinement** — baseline suppression is live (CTA suppressed for jobs already in pipeline). Remaining work: per-session and time-based suppression rules for jobs not yet in pipeline.

Keep the action layer low-noise and non-bloated. Pipeline must not creep toward CRM.

---

_Last updated: 2026-03-10 (v0.6.0 — pipeline truthfulness, CTA suppression baseline, extension bug-report action)_
