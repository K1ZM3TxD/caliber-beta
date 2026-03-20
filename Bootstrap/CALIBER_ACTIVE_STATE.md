# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Desktop Stabilization & Beta Preparation (entered 2026-03-15).** All Signal & Surface Intelligence (SSI) subsystems are implemented. The project is now in structured validation before beta launch.

SSI subsystems: Signal Gap Detection (SGD), Surface Quality Banner, Better Search Trigger (BST), BST Loop Prevention, Pipeline Trigger (>=7), Score Labeling.

Beta remains defined by five core functional gates: (1) BST working, (2) sidecard stable, (3) pipeline solid, (4) sign-in/memory operational, (5) tailor resume works. Desktop Stabilization must complete before beta gates are evaluated. Production deploys from `stable` branch; development on `main`.

**Scope freeze note (2026-03-13):** No new feature scope before beta ships. Alternate career-signal uploads (personality assessments, strengths reports, skills profiles) have been reviewed and explicitly deferred to post-beta. Resume-first flow is the only active upload path.

**Extension Build Host Rule (2026-03-16):** Production extension source (`extension/`) is locked to `https://www.caliber-app.com`. No localhost references in env.js, manifest.json, or runtime code. Localhost is only allowed for explicitly declared dev builds. Violation = regression. See `CALIBER_EXECUTION_CONTRACT.md`.

**Durable Telemetry Infrastructure (2026-03-17):** Telemetry and feedback persistence is now durable via Postgres (Neon) through Prisma. File-backed JSONL and SQLite paths are superseded. Both `/api/events` and `/api/feedback` write to `TelemetryEvent` and `FeedbackEvent` tables. Experiment condition is queryable via `sessionId`, `signalPreference`, and `meta` fields. PM can rerun the controlled signal-injection ON/OFF experiment once production `DATABASE_URL` is confirmed set in Vercel and the current code is deployed. Extension dev/prod host split is restored — source `extension/` defaults to localhost:3000 for dev validation.

## Active Systems Under Validation
- **Signal Gap Detection (SGD)** — detects professional signals from prompt answers not in resume; polling pause gate ensures calibration waits for explicit Yes/No user choice before advancing. Signal normalization layer converts raw tokens to professional labels. When user selects Yes, detected signals are mapped to scoring-vocabulary keywords via SIGNAL_SCORING_KEYWORDS dict; these become anchor boosts applied directly to the anchor weight map in generateTitleRecommendation (bypassing the normal weight-5 cap), plus a signal-affinity bonus adjusts title scores for signature-term overlap. Included signals are displayed on the calibration result page. **Scoring-vector influence verified** (Jen: 8.4→9.0 with YES). **Signal injection impact validated — PASS (2026-03-17):** 28 matched jobs analyzed via Neon telemetry; mean delta +0.02, 27/28 identical, 0 threshold crossings. Signal injection does not distort scoring. **This validation is complete — signal injection is no longer an active uncertainty for beta.**
- **Surface Quality Banner (SMC)** — BST slot shows "{count} strong matches · Best: {title} ({score})" using true page max score (not filtered max). Fixed in v0.9.7 (issue #73). **Stale boot state regression** (issue #74): durable prescan restore was rehydrating `prescanSurfaceBanner` on init, causing stale best-score display on fresh surfaces. Fixed in v0.9.10 — SMC now renders only from fresh current-surface scoring. Validation pending.
- **Better Search Trigger (BST)** — surface-classification-driven recovery suggestion with session-level title dedup preventing loops. Self-suggestion suppression added (v0.9.7): BST will not render if suggested title equals current query. Weak-job sidecard click no longer overrides page-level BST suppression on aligned surfaces with strong matches. **Current blocker:** premature refresh-time evaluation (issue #72). Fix shipped (`initialSurfaceResolved` gate). Post-fix validation pending in both baseline and signal-injected modes. BST is NOT yet fully passed.
- **Pipeline Trigger >=7** — action thresholds lowered from 8.0 to 7.0 for pipeline/tailor actions. **Manual add-to-pipeline write regression** (issue #75): empty company from DOM extraction failure caused silent API 400. Fixed — both manual and auto-add paths re-extract DOM meta at action time with sentinel fallbacks; `background.js` now forwards error details. Validation pending.
- **Score Interpretation Labels** — six-band system: Excellent Match (9–10), Very Strong Match (8–9), Strong Partial Match (7–8), Viable Stretch (6–7), Adjacent Background (5–6), Poor Fit (<5).

## Primary Regression Profile: Jen
Jen is the primary regression profile for Desktop Stabilization. It validates:
- SGD triggering (prompt-heavy behavioral signals not in resume)
- BST title loop prevention (weak surfaces must not recycle titles)
- Surface intelligence behavior (correct surface classification + banner rendering)
- Signal detection coverage (behavioral/conversational keyword dictionary)

All 4 fixture profiles (Jen, Chris, Dingus, Fabio) are used for broader regression.

## Fixture Classification Contracts (validated 2026-03-20)
| Fixture | Regression Role | Classifier Output | Notes |
|---------|----------------|-------------------|-------|
| **Chris** | Builder/Systems anchor | `builder_systems` (high) | Anchors compatible-job preservation (9.9 untouched). Conflicting sales jobs drop to ~2.6. |
| **Fabio** | Analytical/Investigative anchor | `analytical_investigative` (high) | Compatible with security analyst. Conflicting with both sales and ops. |
| **Jen** | Blended/ops-enablement anchor | `operational_execution` (low) | Legacy `expectedMode: null` preserved as blended-anchor contract. Classifier resolves ops from customer-service/coordination/management signals. Compatible with ops jobs; adjacent to sales. |
| **Dingus** | Weak-control anchor | `operational_execution` (low) | Legacy `expectedMode: null` preserved as weak-control contract. Classifier resolves ops from customer-service/scheduling/organizing signals. Compatible with ops jobs; conflicting with analytical. |

**Key contract distinction:** `expectedMode` in fixtures marks the *regression role* (design intent), not the classifier output. Tests assert against actual classified mode. Jen and Dingus both resolve `operational_execution` in practice — this is correct classifier behavior, not a bug.

## Recent Implementation History
- **Chip-Enabled Fixture Regression Matrix — PASS (2026-03-20):** Full regression validation across 4 canonical fixtures × 5 job families × 3 chip configs. 39 test assertions pass; 300 determinism repetitions identical. Chip suppression enforces hard caps (sales ≤3.5, ops ≤4.0) when avoidedModes set. Role-type classification (SYSTEM_BUILDER/SYSTEM_OPERATOR/SYSTEM_SELLER) feeds implicit mismatch penalties. Chris anchor preserved (9.9 on builder job). Notable findings: Dingus and Jen both classify as operational_execution (not null) — fixture contracts updated to document this. Files: `lib/work_mode_regression.test.ts` (new, 39 tests), `lib/__fixtures__/work_mode_fixtures.ts` (comments), `Bootstrap/milestones.md`, `Bootstrap/CALIBER_ACTIVE_STATE.md`.
- **Chip-Based Suppression + Role-Type Separation (2026-03-20):** Chip avoidedModes from workPreferences now flow through evaluateWorkMode pipeline. Three-layer suppression: (1) role-type mismatch penalty (implicit), (2) chip-based hard cap (explicit avoidedModes), (3) tightened builder triggers (removed generic words like "workflow", "platform", "implementation"). New types: RoleType, ChipSuppressionResult, WorkPreferencesInput. New functions: classifyRoleType(), applyChipSuppression(), getRoleTypePenalty(). 68 work_mode tests pass. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`.
- **Weighted Scoring Adjustments + Execution Intensity Layer (2026-03-19):** BREAK+UPDATE. Cap-based work-mode governance (hard cap 6.5, soft cap 8.5) replaced with proportional weighted adjustments. Score now reflects lived-fit reality including daily-work factors. (1) Work mode mismatch produces additive negative adjustments: compatible=0, adjacent=-0.8, conflicting=-2.5. (2) New execution-intensity detection layer scans job text for grind indicators (outbound calls, quota/commission pressure, door-to-door, rejection-heavy environments, high-volume execution). Intensity tiers: mild=-0.5, heavy=-1.5, extreme=-2.5. (3) When both layers fire (conflicting + intense), intensity is dampened 50% to avoid double-counting. (4) Target score semantics re-centered: 9=ecstatic, 8=great, 7=good/worth doing, 5-and-below=avoid, 3-4=actively wrong. (5) Property Max house-buying-specialist style grind jobs now land in actively-wrong zone (3-5) for misaligned profiles. (6) API debug output exposes full scoring composition: preAdjustmentScore, workModeAdjustment, executionIntensityAdjustment, finalScore, intensity triggers. 41 tests passing. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`.
- **Dominant Work Mode + Adjacent Compression + Pipeline Fix + DOM Hardening (v0.9.21, 2026-03-19):** BREAK+UPDATE. (1) Post-scoring classification layer: 5 work modes, weighted lexical triggers, 5×5 compatibility map. Conflicting modes hard-capped at 6.5; adjacent modes soft-capped at 8.5 (mild compression). Both require confidence ≥ low on both sides. 30 regression tests. (2) Pipeline save regression fix: generation guards added to CALIBER_PIPELINE_CHECK and auto-save callbacks, preventing stale cross-job pipeline state. Full diagnostic logging with source tracing and state transitions. (3) LinkedIn DOM extraction hardening: `cleanCardText()` replaces duplicated title text in card innerText before scoring, preventing keyword inflation. Issues #83, #83b, #83c. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`, `extension/content_linkedin.js`.
- **Adjacent Search Terms module replaces BST popup (v0.9.20, 2026-03-19):** BREAK+UPDATE. BST popup banner (`showPrescanBSTBanner`) disabled — returns early as no-op. Replaced by persistent collapsible "Adjacent Searches" section inside sidecard (between Bottom Line and pipeline row). Terms sourced from calibration title + nearby_roles. Chip-styled links navigate to LinkedIn search. Pulse/glow triggers only after ≥20 scored jobs + "bst" surface classification. BST evaluation engine preserved for surface intelligence. Functions added: `getAdjacentSearchTerms()`, `updateAdjacentTermsModule()`, `updateAdjacentTermsPulse()`. Issue #82. Files: `extension/content_linkedin.js`.
- **Sidecard score-flip fix (v0.9.19, 2026-03-19):** BREAK+UPDATE. Sidecard score could visibly change shortly after click (e.g. 7.7→6.6) due to LinkedIn multi-stage DOM hydration causing partial-text scoring followed by full-text rescoring. Fix: (1) Text stability wait — 500ms delay + re-extraction for short initial text prevents partial scoring. (2) Request versioning — `sidecardGeneration` + `sidecardRequestId` with 4 stale-response checkpoints discard cross-job and stale within-job responses. (3) Provisional labeling — partial-text scores shown as "(preview)" with distinct styling. (4) Comprehensive debug logging for each scoring cycle (identity, phase, fingerprint, verdict). Issue #81. Files: `extension/content_linkedin.js`.
- **Durable telemetry storage + experiment tagging** (2026-03-17): BREAK+UPDATE. File-backed JSONL/SQLite telemetry replaced by Postgres (Neon) via Prisma. `/api/events` → `TelemetryEvent`, `/api/feedback` → `FeedbackEvent`. Experiment condition queryable via sessionId/signalPreference/meta. Extension dev/prod host split restored (source defaults to localhost:3000 for dev). Local validation passed. Production pending `DATABASE_URL` in Vercel + deploy. Files: `lib/telemetry_store.ts`, `lib/feedback_store.ts`, `app/api/events/route.ts`, `app/api/feedback/route.ts`, `prisma/schema.prisma`, `extension/env.js`, `extension/manifest.json`.
- **Surface/UI clarification + UX polish batch** (2026-03-17, v0.9.15): BREAK+UPDATE. (1) Surface-quality banner popup removed from sidecard-adjacent flow — `showSurfaceQualityBanner` returns early, all underlying state preserved. (2) Landing hero strengthened: new tagline, product-preview card, LinkedIn context line, CTA support copy. (3) Sidecard skeleton immediate render with score pop animation + 2.5s timeout. (4) Telemetry dedupe guard (`telemetryEmittedIds`). (5) Pipeline add visual feedback (Saving→Saved✓→In pipeline). (6) Pipeline highlight on navigate from extension (scroll-to-card + green glow). (7) Tailor panel progressive 3-step generating UI with skeleton preview. (8) High-confidence match label + panel glow for scores ≥8.5. (9) Sign-in page min-h-screen flex centering. Files: `app/calibration/page.tsx`, `app/pipeline/page.tsx`, `app/signin/page.tsx`, `extension/content_linkedin.js`, `extension/background.js`, `extension/manifest.json`, `lib/extension_config.ts`.
- **SMC stale boot state + manual pipeline write fix** (2026-03-16, v0.9.10+): BREAK+UPDATE stabilization. (1) Removed durable `prescanSurfaceBanner` restore — SMC renders only from fresh scoring, eliminating stale best-score on fresh surfaces. (2) Manual & auto-add pipeline save paths re-extract DOM meta at action time with sentinel fallbacks, fixing silent 400 rejection on empty company. (3) `background.js` forwards error/httpStatus in pipeline save response. (4) `chrome.runtime.lastError` checked. Issues #74, #75. Files: `extension/content_linkedin.js`, `extension/background.js`.
- **BST surface-truth + self-suggestion fix** (2026-03-16, v0.9.7): Three defects from Jen validation fixed: (1) Surface Quality Banner now uses true page max score (`pageMaxScore`/`pageBestTitle`) not filtered strong-match max. (2) Sidecard weak-job click no longer triggers BST when page cache has strong matches. (3) `showPrescanBSTBanner()` suppresses self-suggestion via `titlesEquivalent()` guard. Diagnostic logging added for surface-truth tracing. File: `extension/content_linkedin.js`.
- **SGD anchor-boost injection + result display** (2026-03-15): Signal labels are mapped via SIGNAL_SCORING_KEYWORDS to scoring-vocabulary terms. generateTitleRecommendation accepts optional anchorBoosts map that applies direct weight boosts (bypassing normal cap of 5, max 7) plus signal-affinity bonus (+0.25/required, +0.15/optional overlap, capped at 1.2) that adjusts post-scoring title rankings. Validation logging (JSON) confirms baseline vs new title and score shifts. Result page shows "Signals influencing this calibration" when user selected Yes. Yes/No buttons centered. Files: `lib/calibration_machine.ts`, `lib/title_scoring.ts`, `app/calibration/page.tsx`.
- **SGD normalization + title influence** (2026-03-15): Signal normalization dictionary (75+ entries) maps raw tokens to professional labels. SET_SIGNAL_PREFERENCE re-generates title recommendation when user includes signals, capped at 30% weight. File: `lib/calibration_machine.ts`.
- **v0.9.6** (2026-03-15): SGD polling pause gate + BST session-level title dedup + manifest bump. Commit `693d5b0`.
- **v0.9.6-surface** (2026-03-15): Surface-quality banner in BST slot.
- **v0.9.6-signals** (2026-03-15): Detected signals choice in calibration PROCESSING screen.
- **v0.9.5-t** (2026-03-15): Action thresholds lowered 8.0→7.0. Six-band score labels. Decimal score display.
- **v0.9.5** (2026-03-15): BST suggestion fixes (empty title, overlay badges, bartender inflation, specialist no-BST).
- **v0.9.4** (2026-03-15): Calibration title persistence, session discover enrichment, 4-level suggestion fallback.
- Files changed: `extension/content_linkedin.js`, `extension/background.js`, `app/api/extension/fit/route.ts`, `app/calibration/page.tsx`, `lib/calibration_machine.ts`.

## Top Blocker
**Sign-in / memory (beta gate 4).** Scoring pipeline stabilization complete — chip suppression, role-type classification, and fixture regression all validated (2026-03-20). BST and sidecard stability are in validation. Pipeline is functional (Add to Pipeline working, visual feedback shipped v0.9.15). Telemetry infrastructure is now durable (Postgres/Neon) — no longer a gap. Signal injection validated PASS — no longer an active uncertainty. The next major gate to close is sign-in / durable session persistence so pipeline and calibration data survive across browser restarts. Tailor resume also needs end-to-end validation (beta gate 5). Overlay work continues in parallel but does not block beta.

## Product Surface Doctrine (2026-03-17)
- **Sidecard** = current-job decision surface. Displays: this job's score, decision label, hiring reality, supports/stretch, bottom line, pipeline action. No page-level comparison signals.
- **Surface layer** = page/search intelligence. Displays: strong match count, best job on surface, BST recovery suggestions. These are aggregate signals about the search surface, not about any single job.
- **Rule:** Surface intelligence must not be presented in current-job decision UI. Combining them creates confusion. "Best so far" is a surface-layer construct — it may be reused by overlay/future surface-summary UI, but not by sidecard-adjacent decision UI.
- **"Best so far" popup status:** Popup/banner presentation in sidecard flow is disabled (v0.9.15). All underlying state (`prescanSurfaceBanner`, `pageMaxScore`, `pageBestTitle`, `strongCount`) remains tracked. CSS retained. Concept available for future overlay feature work.

## Beta Landing-Page Media Decision (2026-03-17)
- Pre-beta landing page uses lightweight hero: tagline ("See which jobs actually fit you"), product-preview card (3 scored roles), LinkedIn context line, CTA support copy.
- Full animated "Career → Decision → Engine" narrative system is explicitly deferred to post-beta.
- This is a leverage decision — simple proof-of-product hero is sufficient for beta launch.

## Latest Shipped / Verified State
- Calibration flow runs end-to-end: resume → prompts → single hero title direction → extension CTA.
- Calibration results page received final polish pass (2026-03-10), then two-sentence copy structure (2026-03-11), then title-reveal refinement positively validated by PM (2026-03-17 — "landed", "excellent layout"):
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
- Extension ZIP v0.8.9 rebuilt with overlay badge system, badge placement normalization, discovery coverage fixes, BST surface-classification trigger, score color band lock, and fetch stability fixes.
- Extension v0.9.15 shipped with: (1) Sidecard skeleton immediate render + score pop animation + 2.5s timeout fallback. (2) Telemetry dedupe guard (`telemetryEmittedIds`). (3) Pipeline add visual feedback (Saving→Saved✓→In pipeline / Save failed—retry). (4) Pipeline highlight on navigate from extension (scroll-to-card + green glow 2.5s). (5) High-confidence match label + panel glow for scores ≥8.5. (6) Surface-quality banner popup disabled — returns early, all state preserved. (7) `lastSavedPipelineId` passed to background for pipeline highlight.
- Extension v0.9.14 shipped with: (1) guardrail removed from prescan badge scoring — raw scores flow into badge cache for BST/SMC evaluation; guardrail retained on sidecard path only. (2) `scoreSource` tagging on all badge cache entries (`card_text_prescan`, `sidecard_full`, `restored_cache`). (3) `restored_cache` entries excluded from `strongCount`. (4) `lastScoredScore` reset on surface change to prevent stale sidecard score leak. (5) `[Caliber][SCORE_CAPPED]` diagnostic logging on guardrail function. (6) Per-entry surface-truth diagnostic logging with source breakdown.
- Extension sidecard is compact, decision-first layout with:
  - Two-column header: company + job title (left), fit score + decision badge (right)
  - Hiring Reality Check (collapsible, with band badge)
  - Bottom line (collapsible)
  - Supports fit (green toggle, collapsible with bullet count)
  - Stretch factors (yellow toggle, collapsible with bullet count)
- Extension v0.8.9 built, zipped, and deployed.
- Extension v0.9.15 built, zipped, and deployed (latest).
- Extension feedback row includes separate bug-report action with "🐛 Report" text label, distinct from thumbs-down quality feedback.
- Strong-match contextual card (7.0+) renders above sidecard — triggers “Tailor resume for this job” workflow.
- Pipeline entry is created at `/api/tailor/prepare` time for `strong_match` jobs — pipeline persistence begins before tailoring, not after.
- Pipeline dedupe is based on canonical/normalized job URL.
- Extension suppresses the 7.0+ tailor CTA for jobs already present in the user's pipeline (baseline CTA noise control).
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

## Locked Task Order (Beta Gate Focus — updated 2026-03-14)

Beta gates are the priority. Each gate must be validated before declaring beta. Overlay work is non-blocking and may proceed in parallel.

**Beta Gates (must all pass):**
1. **BST working** — IN VALIDATION (surface-classification trigger shipped v0.8.9, replaces zero-strong-match window rule)
2. **Sidecard stable** — IN VALIDATION (collapsed height #48 resolved 2026-03-11, fetch stability fixed v0.8.5)
3. **Pipeline solid** — FUNCTIONAL (board implemented, DnD, fit scores; product validation ongoing)
4. **Sign-in / memory operational** — NOT YET IMPLEMENTED (next major work item)
5. **Tailor resume works** — FUNCTIONAL (copy/download, retry-on-error; needs end-to-end validation)

**Parallel (non-blocking):**
- Overlay scoring (discovery badges) — shipped and stable, continues to improve, not a beta gate
- Auto-save strong-match jobs into pipeline — enhancement, not a gate
- Post-save confirmation in sidecard — enhancement, not a gate

**Exception:** Small UI bug squashes may be handled at any time if they are narrow, local, and do not break sequencing.

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

### Presentation (updated 2026-03-20)
- **Popup banner is DISABLED.** BST recovery suggestions are delivered via the persistent **Adjacent Searches** module inside the sidecard.
- The Adjacent Searches section starts hidden; a BST badge in the sidecard header becomes visible when terms are available, and pulses when the surface is classified as weak (20+ scored jobs, `surfaceClassificationState === "bst"`).
- User clicks the badge to reveal/hide the section. Terms link directly to LinkedIn search.
- No popup/banner is rendered. `showPrescanBSTBanner()` and `showSurfaceQualityBanner()` are disabled with early returns; underlying surface intelligence state is preserved.

### Classifier: Two-Phase Composite (v0.9.17, canonical)
Supersedes the simple-threshold model from v0.8.x. All previous doc references to simple weak/strong thresholds are outdated.

**Named constants:**
- `BST_STRONG_MATCH_THRESHOLD = 7.0` — a job at or above this score counts as a "strong match"
- `BST_MIN_WINDOW_SIZE = 5` — minimum scored cards before any classification
- `BST_AMBIGUOUS_AVG_CEILING = 6.0` — ambiguous surfaces with avg below this lean BST
- `BST_HEALTHY_MIN_STRONG = 2` — healthy requires 2+ strong matches
- `BST_HEALTHY_SINGLE_HIGH = 8.0` — OR 1 job at 8.0+ qualifies as healthy
- `BST_FORCE_CLASSIFY_WINDOW = 10` — force classification after 10 scored jobs

**Phase 1 (pre-evidence):** `scoredCount < 5` → no banner, no classification.

**Phase 2 (evidence-based):** `scoredCount >= 5`, provisional until 10+.
- **Healthy** (suppress BST): `strongCount >= 2` OR `pageMaxScore >= 8.0`
- **BST trigger** (show recovery): `strongCount === 0`
- **Neutral** (no banner): exactly 1 strong in [7.0, 7.9] — waits for more evidence
  - At `scoredCount >= 10`, forced to BST (insufficient for healthy)

**Secondary context:** `classifySearchSurface()` returns `aligned` / `out-of-scope` / `ambiguous` — used for diagnostic logging and trigger-reason annotation, not for the primary decision.

### Surface Truth Stability (v0.9.20)
- Badge-score cache is **never pruned** based on DOM presence. LinkedIn virtualizes off-screen cards; pruning caused scroll-dependent classification oscillation.
- Cache is only cleared on explicit surface change (`clearAllBadges()`).
- `initialSurfaceResolved` gate defers classification until the initial scoring queue is fully drained.
- 800ms debounce on BST show with re-check prevents flicker from late-arriving scores.

### Adjacent Terms Pre-population (v0.9.20)
- `updateAdjacentTermsModule()` is called from `evaluateBSTFromBadgeCache()` when classification is bst/healthy and no terms are rendered yet, using `lastKnownCalibrationTitle` and `lastKnownNearbyRoles`.
- This ensures the badge pulse can activate on weak surfaces even before the user clicks a job for sidecard scoring.

### Title Suggestion Logic
- Calibration primary title first, then nearby roles, then `lastKnownCalibrationTitle`, then `lastKnownNearbyRoles`
- Never suggests the current search query or a previously-searched/suggested title (session-scoped dedup via `bstSuggestedTitles` + `bstSearchedQueries`)
- Never suggests exact listing titles or employer-specific phrasing

Do not re-sequence without new blocking evidence.

## Product Surface Priority
1. **Extension sidecard** — primary decision surface; strong matches (8.0+) trigger action workflow
2. **Tailor + Pipeline (web app)** — strong-match action layer: resume tailoring and pipeline board
3. **Extension reliability** — handshake, session discovery (known friction, not blocking)
4. **Calibration page** — stable launchpad, no further expansion planned

## Open Issues (summary — see CALIBER_ISSUES_LOG.md for detail)
- #76 Guardrail over-capping prescan scores (21×5.0 collapse) — **FIX SHIPPED** (v0.9.14, 2026-03-16)
- #48 Extension sidecard collapsed height instability — **RESOLVED** (2026-03-11)
- #44 Better Search Title trigger — **RESOLVED** (v0.9.20: cache pruning fix, adjacent-terms pre-population, docs aligned to two-phase classifier)
- #60 Badge placement normalization — **SHIPPED** (27932b1)
- #61 Badge discovery coverage fix — **SHIPPED** (5133cd7)
- #62 BST doctrine update — **SHIPPED** (surface-classification trigger v0.8.9, supersedes zero-strong-match window)
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
1. **Sign-in / memory implementation** — decide auth approach (NextAuth, simple token, etc.) for durable pipeline and calibration persistence. This is beta gate 4.
2. **Beta gate validation** — run end-to-end flow validating all five gates before declaring beta.
3. **Auto-save threshold** — confirm score >= 8.5 as the auto-save threshold for pipeline entry (enhancement, not gate).
4. **Shared shell framework** — deferred; decide after beta gates are met.
5. **Pipeline board model** — deferred; validate 4-column board after beta gates are met.

## Future Planning Notes (not active tasks)

**Beta readiness definition (updated 2026-03-14):**
- Beta = five core functional gates all passing. Not "feature complete."
- Gates: (1) BST working, (2) sidecard stable, (3) pipeline solid, (4) sign-in/memory operational, (5) tailor resume works.
- Overlay scoring is NOT a beta gate. It is shipped and continues as parallel improvement work.
- PM must answer readiness questions (documented in `Bootstrap/milestones.md`) before declaring beta.
- Once declared, project shifts to stability/testing mode — no major feature expansion on main.

**Release model (implemented 2026-03-14):**
- Two-branch model active: `main` = development iteration, `stable` = production deploy target.
- Vercel production deploy: `stable` branch → caliber-app.com. Preview deploys: `main` → preview URL.
- Promotion workflow: validate on main → fast-forward merge into stable → push → Vercel auto-deploys.
- Extension ZIP on `/extension` served from stable branch deploy — outside testers always get the validated build.
- Operator must change Vercel production branch from `main` to `stable` in the Vercel dashboard (Settings → Git → Production Branch).

**Post-beta product metrics (2026-03-14):**
- Telemetry event instrumentation shipped (2026-03-14). Events captured via `POST /api/events`, persisted to Neon (Postgres) via Prisma.
- Events: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used.
- Primary future metric supported: Time-to-Strong-Match (TTSM) — time from search surface open to first job scored >= 8.0.
- Dashboard and cohort analysis remain future work — event capture only for now.

---

_Last updated: 2026-03-17 (v0.9.15 — surface/UI doctrine, signal validation PASS, UX polish batch, "Best so far" popup removed from sidecard flow)_
