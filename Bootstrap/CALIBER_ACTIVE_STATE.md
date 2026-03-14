# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Overlay shipped + BST updated — approaching beta readiness.** Phase-2 overlay scoring is shipped and stable. Extension now operates as a two-layer surface: discovery badges on LinkedIn search result cards + decision sidecard on the selected job. BST doctrine updated to zero-strong-match window rule (2026-03-14). The project is in a validation-driven sequenced pipeline — each main step is soft-locked behind completion of the previous step. Small, narrow UI bug squashes may proceed at any time without breaking the sequence.

**Scope freeze note (2026-03-13):** No new feature scope before beta ships. Alternate career-signal uploads (personality assessments, strengths reports, skills profiles) have been reviewed and explicitly deferred to post-beta. Resume-first flow is the only active upload path.

## Active Current Fix
None currently in flight. Sidecard collapsed height (#48) resolved (2026-03-11). Badge placement normalized (27932b1). Badge discovery coverage fixed (5133cd7). BST trigger doctrine updated (7b20781).

## Top Blocker
**Action-layer completion.** Sidecard sizing is stable. Next queued step is auto-save strong-match jobs (score >= 8.5) into pipeline, followed by post-save confirmation and account prompt. These are soft-locked in order.

## Latest Shipped / Verified State
- Calibration flow runs end-to-end: resume → prompts → single hero title direction → extension CTA.
- Calibration results page received final polish pass (2026-03-10), then two-sentence copy structure (2026-03-11):
  - Two-sentence context → market translation structure replaces explanation section
  - Sentence 1: human alignment context from synthesis patternSummary
  - Sentence 2: "The closest market label for the kind of work you're naturally aligned with is:"
  - Hero title rendered as the visual conclusion to the two-sentence context
  - Hero title card styling preserved (text-[1.3rem] / text-[1.7rem])
- Calibration page spacing tightened (2026-03-11): header area 8.5em→5.5em, LANDING mt-14/mt-12→mt-8, dropzone text centered, redundant dividers removed from TITLES step.
- Three-zone shell design attempted (2026-03-11): Zone 1 = Brand field (20vh, CALIBER wordmark + ambient gradient), Zone 2 = Context, Zone 3 = Interaction. This was rolled back — the framing introduced documentation/implementation drift and is not the current canonical shell. Visual baseline restored to commit a211182.
- CALIBER header and ambient gradient lowered ~12% across all pages for visual grounding (a211182 — this remains the current visual baseline).
- Shell is page-local: each page owns its own gradient, hero offset, and content width. A shared shell framework is not yet locked.
- Upload page simplified (2026-03-11): redundant heading removed, layout spacing tightened.
- Tailor page completed (2026-03-11): copy-to-clipboard action, retry-on-error for generation failures, polished result area with copy/download, tightened spacing.
- Pipeline board enhanced (2026-03-11): DnD card movement between columns, fit score displayed on cards, visibility reload on tab focus.
- Extension ZIP v0.8.5 rebuilt with overlay badge system, badge placement normalization, discovery coverage fixes, BST doctrine update, and fetch stability fixes.
- Extension sidecard is compact, decision-first layout with:
  - Two-column header: company + job title (left), fit score + decision badge (right)
  - Hiring Reality Check (collapsible, with band badge)
  - Bottom line (collapsible)
  - Supports fit (green toggle, collapsible with bullet count)
  - Stretch factors (yellow toggle, collapsible with bullet count)
- Extension v0.8.5 built, zipped, and deployed.
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

## Locked Task Order (Stabilization Phase — updated 2026-03-14)

These steps are soft-locked in order. Each main step is treated as blocked by the previous main step until that previous step is validated complete.

**Exception:** Small UI bug squashes may be handled at any time if they are narrow, local, and do not break sequencing.

1. ~~**Fix extension scorecard collapsed sizing stability**~~ — **DONE** (2026-03-11, #48 resolved)
2. ~~**Restore / verify Better Search Title trigger behavior**~~ — **DONE** (2026-03-14, doctrine updated to zero-strong-match window rule, 7b20781)
3. **Auto-save strong-match jobs (score >= 8.5) into pipeline with canonical URL dedupe** — QUEUED (next up)
   - Blocked by: step 2 validated complete
4. **Add post-save confirmation / action state in sidecard** — QUEUED
   - Blocked by: step 3 validated complete
5. **Add account prompt for durable pipeline saving** — QUEUED
   - Blocked by: step 4 validated complete
6. **Continue pipeline/action-layer refinement** — QUEUED
   - Only after steps 1–5 are stable
   - Includes: CTA noise control, pipeline board validation, shared shell decision

### Previous task order (historical)
- ~~Recompose global Caliber shell from approved visual primitives~~ — ATTEMPTED (three-zone framing tried, rolled back to a211182 baseline)
- ~~Fix main/upload/ingest/tailor page hierarchy and spacing drift~~ — DONE
- Decide shared shell architecture or continue page-local ownership (OPEN — deferred to step 6)
- Validate pipeline 4-column board product model (OPEN — deferred to step 6)
- No unnecessary expansion of calibration scope — calibration page is stable

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
- **Trigger (updated 2026-03-14):** Fires when zero jobs in the badge cache score >= 8.0, evaluated after a minimum window of 5 scored jobs. Re-evaluable per chunk — auto-hides if a strong match appears in a later batch.
- Named constants: `BST_STRONG_MATCH_THRESHOLD = 8.0`, `BST_MIN_WINDOW_SIZE = 5`
- Suggested title is the clickable control — links directly to LinkedIn search
- Suggests calibration primary title first, then adjacent search-surface titles
- Never suggests exact listing titles or employer-specific phrasing
- Visually calm, compact, does not increase sidecard height

Do not re-sequence without new blocking evidence.

## Product Surface Priority
1. **Extension sidecard** — primary decision surface; strong matches (8.0+) trigger action workflow
2. **Tailor + Pipeline (web app)** — strong-match action layer: resume tailoring and pipeline board
3. **Extension reliability** — handshake, session discovery (known friction, not blocking)
4. **Calibration page** — stable launchpad, no further expansion planned

## Open Issues (summary — see CALIBER_ISSUES_LOG.md for detail)
- #48 Extension sidecard collapsed height instability — **RESOLVED** (2026-03-11)
- #44 Better Search Title trigger — **UPDATED** (doctrine changed to zero-strong-match window, 2026-03-14)
- #60 Badge placement normalization — **SHIPPED** (27932b1)
- #61 Badge discovery coverage fix — **SHIPPED** (5133cd7)
- #62 BST doctrine update (zero-strong-match window) — **SHIPPED** (7b20781)
- #49 Auto-save strong-match jobs into pipeline — **QUEUED** (next up)
- #50 Post-save confirmation / action state in sidecard — **QUEUED** (blocked by #49)
- #51 Account prompt for durable pipeline saving — **QUEUED** (blocked by #50)
- #41 Visual shell drift / inconsistent composition — **REOPENED** (deferred to step 6)
- #42 Tailor page hierarchy mismatch — **SHIPPED**
- #43 Extension debug/report affordance clarity (PARTIALLY RESOLVED — text label added)
- #45 Pipeline board product validation (OPEN — deferred to step 6)
- #46 Upload/ingest page shell alignment — **PARTIALLY RESOLVED**
- #47 Shared shell framework decision (OPEN — deferred to step 6)
- #37 Noise control for strong-match CTA (PARTIALLY RESOLVED — deferred to step 6)
- #31 Extension session handshake friction (OPEN, known — not top blocker)
- #26 Market-job scores low despite high calibration title scores (OPEN)
- #27 Search-surface / adjacent-title discovery gap (OPEN)
- #15 Bottom line paragraph repetition (OPEN)

## Next PM Decision Needed
1. **Sidecard collapsed sizing** — validate the fix once it lands; confirm no visual jumping between scored jobs in collapsed state.
2. **Better Search Title verification** — test trigger with 4 low-scoring jobs in a real extension flow after sidecard sizing is stable.
3. **Auto-save threshold** — confirm score >= 8.5 as the auto-save threshold for pipeline entry (distinct from the 8.0 tailor CTA threshold).
4. **Account prompt design** — decide account/auth requirements for durable pipeline saving before implementing.
5. **Shared shell framework** — deferred to step 6; decide after action-layer stabilization.
6. **Pipeline board model** — deferred to step 6; validate 4-column board after action-layer basics are stable.

## Future Planning Notes (not active tasks)

**Beta readiness definition (2026-03-14):**
- Beta = core flow stable enough for outside users without PM guidance. Not "feature complete."
- PM must answer readiness questions (documented in `Bootstrap/milestones.md`) before declaring beta.
- Once declared, project shifts to stability/testing mode — no major feature expansion on main.
- This decision is upcoming but not yet active. Current active work is action-layer completion (auto-save → post-save → account prompt).

**Release model (implemented 2026-03-14):**
- Two-branch model active: `main` = development iteration, `stable` = production deploy target.
- Vercel production deploy: `stable` branch → caliber-app.com. Preview deploys: `main` → preview URL.
- Promotion workflow: validate on main → fast-forward merge into stable → push → Vercel auto-deploys.
- Extension ZIP on `/extension` served from stable branch deploy — outside testers always get the validated build.
- Operator must change Vercel production branch from `main` to `stable` in the Vercel dashboard (Settings → Git → Production Branch).

**Post-beta product metrics (2026-03-14):**
- Telemetry event instrumentation shipped (2026-03-14). Lightweight append-only JSONL capture via `POST /api/events`.
- Events: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used.
- Primary future metric supported: Time-to-Strong-Match (TTSM) — time from search surface open to first job scored >= 8.0.
- Dashboard and cohort analysis remain future work — event capture only for now.

---

_Last updated: 2026-03-14 (stable branch release model implemented, extension v0.8.5 — approaching beta readiness)_
