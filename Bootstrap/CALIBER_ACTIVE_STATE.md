# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Action layer launch-ready; shell visual baseline anchored to a211182.** Extension remains the primary discovery surface; strong-fit jobs (8.0+) feed the tailor/pipeline action workflow. Tailor page is complete with copy action, retry-on-error, and polished result area. Pipeline board has DnD card movement, fit score display, and visibility reload on tab focus. Upload page simplified. A shared/reusable shell framework is not yet locked — pages use page-local gradient and spacing ownership with the a211182 visual baseline (lowered header + lowered ambient gradient, centered at 50% 12%). Product validation of the 4-column board model is the primary remaining decision.

## Top Blocker
**Shell framework not yet locked.** The three-zone shell framing was attempted this season but introduced documentation/implementation drift and has been rolled back. Visual baseline is stable (a211182), but the broader shared-shell architecture — who owns gradient, hero offset, and content width — is an open design decision. Extension handshake (#31) remains known friction (may require manual tab refresh on first install).

## Latest Shipped / Verified State
- Calibration flow runs end-to-end: resume → prompts → single hero title direction → extension CTA.
- Calibration results page received final polish pass (2026-03-10):
  - Smaller hero title (text-[1.7rem] / text-[2.4rem])
  - Lighter section label (font-light)
  - Green primary CTA ("Search on LinkedIn"), scoring-yellow secondary ("See why it fits")
  - Explanation dropdown rewritten: human-friendly language, no internal scoring terminology
- Calibration page spacing tightened (2026-03-11): header area 8.5em→5.5em, LANDING mt-14/mt-12→mt-8, dropzone text centered, redundant dividers removed from TITLES step.
- Three-zone shell design attempted (2026-03-11): Zone 1 = Brand field (20vh, CALIBER wordmark + ambient gradient), Zone 2 = Context, Zone 3 = Interaction. This was rolled back — the framing introduced documentation/implementation drift and is not the current canonical shell. Visual baseline restored to commit a211182.
- CALIBER header and ambient gradient lowered ~12% across all pages for visual grounding (a211182 — this remains the current visual baseline).
- Shell is page-local: each page owns its own gradient, hero offset, and content width. A shared shell framework is not yet locked.
- Upload page simplified (2026-03-11): redundant heading removed, layout spacing tightened.
- Tailor page completed (2026-03-11): copy-to-clipboard action, retry-on-error for generation failures, polished result area with copy/download, tightened spacing.
- Pipeline board enhanced (2026-03-11): DnD card movement between columns, fit score displayed on cards, visibility reload on tab focus.
- Extension ZIP v0.6.0 rebuilt with latest source (packaging refresh — label fix, BST thresholds, LinkedIn updates).
- Extension sidecard is compact, decision-first layout with:
  - Two-column header: company + job title (left), fit score + decision badge (right)
  - Hiring Reality Check (collapsible, with band badge)
  - Bottom line (collapsible)
  - Supports fit (green toggle, collapsible with bullet count)
  - Stretch factors (yellow toggle, collapsible with bullet count)
- Extension v0.6.0 built, zipped, and deployed.
- Extension feedback row includes separate bug-report action with "🐛 Report" text label, distinct from thumbs-down quality feedback.
- Strong-match contextual card (8.0+) renders above sidecard — triggers "Tailor resume for this job" workflow.
- Pipeline entry is created at `/api/tailor/prepare` time for `strong_match` jobs — pipeline persistence begins before tailoring, not after.
- Pipeline dedupe is based on canonical/normalized job URL.
- Extension suppresses the 8.0+ tailor CTA for jobs already present in the user's pipeline (baseline CTA noise control).
- Tailor page recomposed (2026-03-11): "Tailor Resume" is the primary heading, job title/company card appears first, pipeline confirmation banner is secondary/below, CaliberHeader removed from this page.
- Pipeline rebuilt as 4-column board (2026-03-11): Resume Prep → Submitted → Interview Prep → Interview. Cards are moveable between columns. Legacy stages auto-map to board columns. NOTE: code is implemented; product-level validation of the board model is active/next.
- Global layout max-width widened to 960px for board; tailor/build-resume self-constrain to 600px.
- All "Back to Caliber" links route to /calibration.
- Better Search Title promoted above sidecard as standalone recovery banner (v0.4.7).
- Better Search Title logic adjusted: suggests calibration primary title or adjacent search-surface titles, not listing-specific titles.
- Beta feedback loop active: thumbs up/down + structured signals + JSONL event log (v0.4.6).
- Production/dev environment split active and verified. Production: `caliber-app.com`. Dev: `localhost:3000`. No cross-environment contact.
- Title scoring baseline stable: 45/45 smoke tests pass (Chris, Jen, Fabio, Dingus fixtures).
- `/extension` page serves current extension build as the primary user install path.

## Approved Visual Primitives (2026-03-11, design-system baseline)
These are the approved shell traits. Shell ownership is currently page-local — a shared shell framework is not yet locked.
- **Visual baseline:** Commit a211182 — lowered CALIBER header and ambient gradient (~12% lower, centered at 50% 12%), page-local radial gradients over #050505 dark surface.
- **Shell ownership:** Page-local. Each page owns its own gradient size/intensity, hero offset (pt-[10vh] typical), and content width. No shared shell component enforced.
- **Background:** Wide subtle ambient gradient band over #050505 dark surface
- **Buttons (primary CTA):** Outlined green (rgba(74,222,128,0.06) bg, #4ADE80 text, rgba(74,222,128,0.45) border). No solid green fills.
- **Line motif:** No small sharp centered line. Removed.
- **Shell feel:** Calm, cinematic, premium. Dark with subtle warmth from gradient.
- **Typography:** CALIBER wordmark at 2.2rem, tracking-[0.25em], muted zinc color with subtle green text shadow. Header positioned ~12% lower than prior iterations for grounding.
- **Form fields:** Must remain usable — dark shell styling must not reduce field clarity. Textarea bg rgba(255,255,255,0.06), border rgba(255,255,255,0.13).
- **What is NOT approved:** Three-zone shell (Zone 1 20vh / Zone 2 / Zone 3) as a canonical framework. That framing was attempted and rolled back. Do not introduce Zone 1 wrappers, CaliberHeader compact/noGradient props, or fixed gradient overlays.

## Known Visual Drift (baseline anchored, framework not locked)
- Visual baseline restored to commit a211182 (7b03a18): lowered header + lowered ambient gradient across all pages.
- The three-zone shell framing was attempted this season but introduced drift; it has been rolled back and is not the current shell architecture.
- Shell ownership is page-local — each page carries its own gradient, hero offset, and content width.
- A shared/reusable shell framework (single owner for gradient, hero offset, content width) is not yet designed or locked. This is the next shell decision.
- "Match the pipeline page" is NO LONGER a valid design instruction — design must reference approved primitives and committed a211182 baseline values.

## Real User Flow
```
calibration → results page → /extension → download ZIP → install in Chrome → navigate LinkedIn → extension scores jobs
```
`/extension` must always serve the current extension build — it is the user-facing install path.

## Locked Task Order
1. ~~Recompose global Caliber shell from approved visual primitives~~ — ATTEMPTED (three-zone framing tried, rolled back to a211182 baseline; shared framework not locked)
2. ~~Fix main/upload/ingest/tailor page hierarchy and spacing drift~~ — DONE (upload simplified, header lowered, tailor completed)
3. Decide shared shell architecture or continue page-local ownership (OPEN — next shell decision)
4. Validate pipeline 4-column board product model (product-level decision — code is complete)
5. Clarify extension debug/report affordance (text label shipped; UX may need further refinement)
6. Verify/restore Better Search Title trigger behavior if regressed
7. CTA noise-control refinement (per-session and time-based suppression)
8. No unnecessary expansion of calibration scope — calibration page is stable

## Product Layer Separation
- **Calibration = Direction:** determine job-search direction, display single hero title direction, prompt extension install.
- **Extension = Evaluation:** analyze real job descriptions, provide fit + hiring reality evaluation.
- **Tailor + Pipeline = Action:** resume tailoring for strong matches, minimal job pipeline/tracker.

These layers must not be conflated.

## Better Search Title (Search Surface Recovery)

Product principle: Better Search Title is a **Search Surface Recovery Mechanism**.

It answers: "What title should I search to find better-fit jobs?"

Behavior:
- Renders as a recovery banner **above** the sidecard (not inside it)
- Appears only when weak-fit trigger fires (3/4 recent scores < 6.5, none >= 7.5)
- Suggested title is the clickable control — links directly to LinkedIn search
- Suggests calibration primary title first, then adjacent search-surface titles
- Never suggests exact listing titles or employer-specific phrasing
- Visually calm, compact, does not increase sidecard height

Do not re-sequence without new blocking evidence.

## Product Surface Priority
1. **Extension sidecard** — primary discovery surface; strong matches (8.0+) trigger action workflow
2. **Tailor + Pipeline (web app)** — strong-match action layer: resume tailoring and pipeline board
3. **Extension reliability** — handshake, session discovery (known friction, not blocking)
4. **Calibration page** — stable launchpad, no further expansion planned

## Open Issues (summary — see CALIBER_ISSUES_LOG.md for detail)
- #41 Visual shell drift / inconsistent composition — **REOPENED** (three-zone stabilization was rolled back; visual baseline is a211182 but shared shell framework not locked)
- #42 Tailor page hierarchy mismatch — **SHIPPED** (tailor page now complete with copy/retry/polish)
- #43 Extension debug/report affordance clarity (PARTIALLY RESOLVED — text label added)
- #44 Better Search Title trigger verification needed (OPEN)
- #45 Pipeline board product validation (OPEN — code complete incl. DnD/fit score, product validation next)
- #46 Upload/ingest page shell alignment — **PARTIALLY RESOLVED** (heading removed, header lowered; shared shell framework not locked)
- #47 Shared shell framework decision (NEW — page-local ownership vs reusable shared shell)
- #37 Noise control for strong-match CTA (PARTIALLY RESOLVED)
- #31 Extension session handshake friction (OPEN, known — not top blocker)
- #26 Market-job scores low despite high calibration title scores (OPEN)
- #27 Search-surface / adjacent-title discovery gap (OPEN)
- #15 Bottom line paragraph repetition (OPEN)

## Next PM Decision Needed
1. **Shared shell framework** — decide whether to build a true shared shell component (single owner for gradient, hero offset, content width) or continue page-local ownership with the a211182 baseline. This is the top open design question.
2. **Pipeline board model** — validate 4-column board (Resume Prep / Submitted / Interview Prep / Interview). Is this the right stage decomposition? Are the column names correct? Code is complete including DnD and fit score display.
3. **Better Search Title** — verify trigger behavior with current thresholds (< 6.5 weak, >= 7.5 strong). If regressed, prioritize fix.
4. **CTA noise-control** — decide on per-session / time-based suppression rules for first-time 8.0+ exposures.
5. **Tailor page quality** — tailor page is launch-ready; validate tailoring output quality and determine text vs PDF download.

---

_Last updated: 2026-03-11 (shell baseline correction — three-zone framing rolled back, a211182 visual baseline restored, documentation truth pass)_
