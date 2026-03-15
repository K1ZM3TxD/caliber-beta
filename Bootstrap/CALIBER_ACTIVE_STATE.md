# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Desktop Stabilization & Beta Preparation (entered 2026-03-15).** All Signal & Surface Intelligence (SSI) subsystems are implemented. The project is now in structured validation before beta launch.

SSI subsystems: Signal Gap Detection (SGD), Surface Quality Banner, Better Search Trigger (BST), BST Loop Prevention, Pipeline Trigger (>=7), Score Labeling.

Beta remains defined by five core functional gates: (1) BST working, (2) sidecard stable, (3) pipeline solid, (4) sign-in/memory operational, (5) tailor resume works. Desktop Stabilization must complete before beta gates are evaluated. Production deploys from `stable` branch; development on `main`.

**Scope freeze note (2026-03-13):** No new feature scope before beta ships. Alternate career-signal uploads (personality assessments, strengths reports, skills profiles) have been reviewed and explicitly deferred to post-beta. Resume-first flow is the only active upload path.

## Active Systems Under Validation
- **Signal Gap Detection (SGD)** — detects professional signals from prompt answers not in resume; polling pause gate ensures calibration waits for explicit Yes/No user choice before advancing.
- **Surface Quality Banner** — BST slot shows "{count} strong matches · Best: {title} ({score})" when surface has >=1 job scoring >=7.0.
- **Better Search Trigger (BST)** — surface-classification-driven recovery suggestion with session-level title dedup preventing loops.
- **Pipeline Trigger >=7** — action thresholds lowered from 8.0 to 7.0 for pipeline/tailor actions.
- **Score Interpretation Labels** — six-band system: Excellent Match (9–10), Very Strong Match (8–9), Strong Partial Match (7–8), Viable Stretch (6–7), Adjacent Background (5–6), Poor Fit (<5).

## Primary Regression Profile: Jen
Jen is the primary regression profile for Desktop Stabilization. It validates:
- SGD triggering (prompt-heavy behavioral signals not in resume)
- BST title loop prevention (weak surfaces must not recycle titles)
- Surface intelligence behavior (correct surface classification + banner rendering)
- Signal detection coverage (behavioral/conversational keyword dictionary)

All 4 fixture profiles (Jen, Chris, Dingus, Fabio) are used for broader regression.

## Recent Implementation History
- **v0.9.6** (2026-03-15): SGD polling pause gate + BST session-level title dedup + manifest bump. Commit `693d5b0`.
- **v0.9.6-surface** (2026-03-15): Surface-quality banner in BST slot.
- **v0.9.6-signals** (2026-03-15): Detected signals choice in calibration PROCESSING screen.
- **v0.9.5-t** (2026-03-15): Action thresholds lowered 8.0→7.0. Six-band score labels. Decimal score display.
- **v0.9.5** (2026-03-15): BST suggestion fixes (empty title, overlay badges, bartender inflation, specialist no-BST).
- **v0.9.4** (2026-03-15): Calibration title persistence, session discover enrichment, 4-level suggestion fallback.
- Files changed: `extension/content_linkedin.js`, `extension/background.js`, `app/api/extension/fit/route.ts`, `app/calibration/page.tsx`, `lib/calibration_machine.ts`.

## Top Blocker
**Sign-in / memory (beta gate 4).** BST and sidecard stability are in validation. Pipeline is functional. The next major gate to close is sign-in / durable session persistence so pipeline and calibration data survive across browser restarts. Overlay work continues in parallel but does not block beta.

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
- Extension ZIP v0.8.9 rebuilt with overlay badge system, badge placement normalization, discovery coverage fixes, BST surface-classification trigger, score color band lock, and fetch stability fixes.
- Extension sidecard is compact, decision-first layout with:
  - Two-column header: company + job title (left), fit score + decision badge (right)
  - Hiring Reality Check (collapsible, with band badge)
  - Bottom line (collapsible)
  - Supports fit (green toggle, collapsible with bullet count)
  - Stretch factors (yellow toggle, collapsible with bullet count)
- Extension v0.8.9 built, zipped, and deployed.
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

Behavior:
- Renders as a recovery banner **above** the sidecard (not inside it)
- **Trigger (updated 2026-03-15, v0.8.9):** Uses query-level surface classification via `classifySearchSurface(query, calibrationTitle, nearbyRoles)` which returns `"aligned"` / `"out-of-scope"` / `"ambiguous"`. Decision tree:
  - **aligned + strongCount > 0** → SUPPRESS (good surface with real strong matches)
  - **aligned + strongCount === 0** → TRIGGER (right surface but no strong match yet)
  - **out-of-scope** → TRIGGER (wrong job family entirely)
  - **ambiguous** → TRIGGER only if strongCount === 0 AND avgScore < 6.0
- Evaluated after a minimum window of 5 scored jobs. Re-evaluable per chunk — auto-hides if a strong match appears in a later batch.
- Named constants: `BST_STRONG_MATCH_THRESHOLD = 8.0`, `BST_MIN_WINDOW_SIZE = 5`, `BST_AMBIGUOUS_AVG_CEILING = 6.0`
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
- #44 Better Search Title trigger — **UPDATED** (surface-classification trigger v0.8.9, supersedes zero-strong-match window)
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
- Telemetry event instrumentation shipped (2026-03-14). Lightweight append-only JSONL capture via `POST /api/events`.
- Events: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used.
- Primary future metric supported: Time-to-Strong-Match (TTSM) — time from search surface open to first job scored >= 8.0.
- Dashboard and cohort analysis remain future work — event capture only for now.

---

_Last updated: 2026-03-15 (BST surface-classification trigger + score color bands locked, extension v0.8.9)_
