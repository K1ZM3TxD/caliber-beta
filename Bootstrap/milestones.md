---

Milestone — Desktop Stabilization & Beta Readiness (ACTIVE)
---
STATUS: ACTIVE — entered 2026-03-15. Core SSI features implemented; validating before beta launch.

PHASE DEFINITION:
- "Desktop Stabilization" means all Signal & Surface Intelligence (SSI) subsystems are implemented and under structured validation.
- The project does not advance to beta until every completion criterion below is met.
- This phase replaces ad-hoc chat-based status tracking with durable documentation-driven state.

GOALS:
- Validate Signal & Surface Intelligence (SSI) end-to-end
- Confirm extension behavior on real LinkedIn search surfaces
- Eliminate BST title loops
- Confirm SGD prompt logic (explicit user input before advancing)
- Confirm pipeline threshold behavior (>=7)
- Verify extension build stability (current version: 0.9.6)

TESTING FOCUS:
- Jen regression profile (primary — covers SGD triggering, BST loop prevention, surface intelligence)
- Calibration ingest behavior across all 4 fixture profiles (Jen, Chris, Dingus, Fabio)
- LinkedIn search surfaces (aligned, out-of-scope, ambiguous classifications)

SSI SUBSYSTEMS UNDER VALIDATION:
1. **Signal Gap Detection (SGD)** — detects professional signals from prompt answers not in resume; requires explicit user choice before calibration advances.
2. **Surface Quality Banner** — BST slot shows strong-match count + best job when surface has >=1 job scoring >=7.0.
3. **Better Search Trigger (BST)** — surface-classification-driven recovery suggestion; must never repeat previously suggested or searched titles in a session.
4. **BST Loop Prevention** — session-level title dedup tracking; all title selection paths filter against seen titles.
5. **Pipeline Trigger (>=7)** — action thresholds lowered from 8.0 to 7.0; pipeline/tailor buttons fire at 7.0+.
6. **Score Labeling** — six-band label system (Excellent Match through Poor Fit); decimal score display.

COMPLETION CRITERIA (all must pass before declaring beta):
- [ ] SGD requires explicit user input (Yes/No) before calibration advances past PATTERN_SYNTHESIS
- [ ] BST never repeats previously suggested or previously searched titles in a session
- [ ] Surface quality banner displays correct strong match count
- [ ] Surface quality banner displays correct best job title and score
- [ ] Pipeline trigger fires at score >= 7.0
- [ ] No extension crashes during page scans on LinkedIn
- [ ] All 4 fixture profiles (Jen, Chris, Dingus, Fabio) pass signal detection regression
- [ ] Score band labels render correctly across all score ranges

IMPLEMENTATION LOG:
- 2026-03-15: SGD scoring-keyword injection fix — SIGNAL_SCORING_KEYWORDS maps ~100 labels → scoring vocab terms. Prior label-text injection was ineffective. Result page now shows "Signals influencing this calibration" when user selected Yes. Files: `lib/calibration_machine.ts`, `app/calibration/page.tsx`.

---

Milestone — Beta Release Readiness + Post-Beta Product Metrics (PLANNED)
---
STATUS: FUTURE — blocked by Desktop Stabilization phase completion.

BETA DEFINITION:
- "Beta" means the core functional loop is stable enough for outside users to use without PM hand-holding:
  calibration → extension install → sidecard scoring on LinkedIn → BST recovery → pipeline → tailor resume
- Beta is NOT "feature complete." It is "stable enough for meaningful outside testing."
- Overlay scoring (discovery badges on search result cards) is valuable but NOT required for beta launch. Overlay work may continue in parallel as a post-gate improvement.
- Once beta threshold is reached, the project shifts modes:
  - No major feature expansion
  - Focus: stability, user observation/testing, bug fixing, release/testing workflow
  - New features are queued and developed on branches, not shipped to the live build

BETA READINESS GATES (all five must be met before declaring beta):
1. **BST working** — Better Search Title fires reliably and suggests useful recovery titles.
2. **Sidecard stable** — Extension sidecard renders correctly, scores jobs, and handles all score states without layout instability.
3. **Pipeline solid** — Pipeline board persists entries, supports stage movement, and does not lose data.
4. **Sign-in / memory operational** — User sessions persist across browser restarts; pipeline and calibration data are durable.
5. **Tailor resume works** — Resume tailoring generates useful output, copy/download functional, no fabrication.

BETA READINESS QUESTIONS (PM must answer YES to all before declaring beta):
- Do all five gates above pass in a real end-to-end user flow?
- Is the core flow (calibration → extension → sidecard scoring → BST → tailor → pipeline) understandable without PM guidance?
- Are major regressions low enough that outside testing produces useful feedback (not just bug reports about broken basics)?
- Is the extension installable and activatable by a non-technical user following the /extension page instructions?

NOTE: Overlay scoring (discovery badges) is NOT a beta gate. It is active improvement work that may ship during or after beta, but does not block beta declaration.

RELEASE MODEL (implemented 2026-03-14):
- Two-branch model active: `main` = development iteration, `stable` = production deploy.
- Vercel production deploy target: `stable` branch → caliber-app.com.
- Vercel preview deploys: `main` branch → preview URL for internal testing.
- Promotion workflow: when main is validated stable, fast-forward merge `main` into `stable` and push.
- Extension ZIP on `/extension` page is built from `stable` — outside testers always get the validated build.
- No feature flags needed at this stage — branch separation provides the gate.

POST-BETA METRICS DASHBOARD:
- This work begins AFTER beta is stable and outside-user testing has started. Not before.
- Primary metric: Time-to-Strong-Match (TTSM)
  - Definition: elapsed time from opening a job search surface to first viewed job with score >= 8.0
  - Measures how quickly Caliber helps a user find a strong-fit job
  - Lower is better; baseline to be established from first beta cohort
- Supporting metrics:
  - Strong Match Rate — percentage of scored jobs that reach >= 8.0
  - Pipeline Save Rate — percentage of strong matches that get saved to pipeline
  - Tailor Usage Rate — percentage of pipeline entries where user generates a tailored resume
  - Calibration Completion Rate — percentage of users who complete calibration (resume + prompts → title)
- Implementation approach: instrumentation layer added to existing API endpoints and extension events. No separate analytics service until volume justifies it.
- Dashboard is a web app page (likely /metrics or /admin/metrics), not a third-party tool.

TELEMETRY INSTRUMENTATION (prerequisite layer — DONE 2026-03-14):
- PM decision: telemetry event capture implemented before beta release so outside-user testing starts with usable product data.
- Lightweight append-only JSONL event log at `data/telemetry_events.jsonl`.
- POST /api/events endpoint accepts events from both extension and web app.
- Initial event set: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used.
- Each event includes: timestamp, sessionId, surfaceKey, job identity fields, score, source (extension/web).
- Telemetry is non-blocking: failures never break user-facing flows.
- This event layer is the prerequisite for all future metrics/dashboard work.
- Dashboard and cohort analysis remain future work — not included in this implementation.

---

BREAK + UPDATE — 2026-03-15 (SGD Signal Normalization + Calibration Title Influence)
---
DONE:
- Signal normalization dictionary (SIGNAL_NORMALIZATION, 75+ entries) maps raw tokens to professional labels
- formatSignalLabel() checks normalization dict before title-case fallback
- Dedup by normalized label in detectAdditionalSignals() result pipeline
- SET_SIGNAL_PREFERENCE re-generates title recommendation when user includes signals
- Detected signal terms injected as synthetic prompt text, capped at 30% of total weight
- Resume signals remain dominant (>=70% weight)

BLOCKED:
- None

NEXT:
- Live validation: verify signal labels display as professional terms for Jen profile
- Live validation: verify Yes selection shifts calibration title
- Live validation: verify No selection preserves original title

---

BREAK + UPDATE — 2026-03-15 (Desktop Stabilization & Beta Readiness Phase)
---
DONE:
- Project formally enters Desktop Stabilization phase — all SSI subsystems implemented
- SSI classified in kernel.md: Signal Gap Detection (SGD), Surface Quality Banner, Better Search Trigger (BST)
- New Desktop Stabilization milestone with explicit completion criteria checklist
- CALIBER_ACTIVE_STATE.md updated: phase = Desktop Stabilization, Jen = primary regression profile
- CALIBER_ISSUES_LOG.md updated: #68 SGD auto-advance (resolved candidate), #69 BST title loop (under validation)
- SGD polling pause gate shipped (v0.9.6, commit 693d5b0): calibration waits for explicit user choice
- BST session-level title dedup shipped (v0.9.6, commit 693d5b0): prevents title suggestion loops

BLOCKED:
- None

NEXT:
- Live validation of all SSI subsystems against Jen regression profile
- Validate completion criteria checklist items
- Close remaining beta gates after stabilization passes

---

BREAK + UPDATE — 2026-03-15 (Surface-Quality Banner in BST Slot, v0.9.6-surface)
---
DONE:
- BST slot shows surface-quality banner when loaded surface has ≥1 job scoring ≥7.0
- Banner content: "{count} strong matches · Best: {title} ({score})"
- Green accent variant of recovery banner with checkmark icon
- Best job tracking in `evaluateBSTFromBadgeCache` scoring loop
- Durable state persistence via `surfaceBanner` field in prescan state
- Debounce upgrade: strong matches during BST debounce trigger surface-quality banner
- Normal BST recovery behavior preserved when zero strong matches

BLOCKED:
- None

NEXT:
- Live validation: verify banner appears on healthy surfaces with strong matches
- Verify BST still fires correctly on weak surfaces
- Verify banner updates as more jobs are scored

---

BREAK + UPDATE — 2026-03-15 (Detected Signals Choice in Calibration Progress Flow, v0.9.6-signals)
---
DONE:
- `detectAdditionalSignals()` function compares prompt vs resume keyword frequency + cross-source anchors, returns up to 5 human-readable labels
- Detection runs in `synthesizeOnce()` during ENCODING_RITUAL → PATTERN_SYNTHESIS transition
- `SET_SIGNAL_PREFERENCE` event added to CalibrationEvent union; allowed ENCODING_RITUAL through TERMINAL_COMPLETE
- PROCESSING screen UI module shows detected signals with explicit yes/no choice (no hidden default)
- `COMPUTE_ALIGNMENT_OUTPUT` annotates result with `signalPreference` metadata
- Extension fit API passes `signal_preference` in response

BLOCKED:
- None

NEXT:
- Live validation: verify signal detection triggers for profiles with prompt-heavy signals
- Verify UI module renders correctly on PROCESSING screen and preference persists
- Future: use signal preference to adjust personVector weighting or recompute resume-only vector

---

BREAK + UPDATE — 2026-03-15 (Action Threshold Recalibration + Score-Band Labels, v0.9.5-t)
---
DONE:
- Action thresholds lowered from 8.0 to 7.0: BST_STRONG_MATCH_THRESHOLD, pipeline/tailor banner, telemetry strong_match_viewed
- Sidecard score display changed: integer → 1-decimal, "/10" → em dash separator, six-band label system
- Band labels: Excellent Match (9–10), Very Strong Match (8–9), Strong Partial Match (7–8), Viable Stretch (6–7), Adjacent Background (5–6), Poor Fit (<5)
- Overlay badge system and auto-save threshold (8.5) intentionally unchanged

BLOCKED:
- None

NEXT:
- Live validation: verify BST suppression at 7.0+, pipeline button at 7.0+, band labels render correctly
- Continue closing remaining beta gates

---

BREAK + UPDATE — 2026-03-15 (BST Surface Classification + Score Color Band Lock, v0.8.7→v0.8.9)
---
DONE:
- BST trigger doctrine replaced: "zero-strong-match window" rule superseded by query-level surface classification via `classifySearchSurface()`
- Surface classification returns aligned / out-of-scope / ambiguous; BST decision tree uses classification + strongCount
- Aligned surfaces require strongCount > 0 to suppress BST (no false suppression on weak aligned surfaces)
- Score color bands locked across all four rendering locations: Green 8.0+ (#4ADE80) / Yellow 6.0–7.9 (#FBBF24) / Red 0–5.9 (#EF4444)
- Old gray badge class removed, replaced with red
- Extension version v0.8.9 (three rounds of live-validation fixes: v0.8.7 → v0.8.8 → v0.8.9)

BLOCKED:
- None — surface classification and color bands are shipped and stable

NEXT:
- Validate BST surface classification across diverse calibration profiles
- Continue closing remaining beta gates (sign-in/memory is the next major item)

---

BREAK + UPDATE — 2026-03-14 (Beta Gate Resequencing: Overlay Deblocked)
---
DONE:
- Overlay scoring removed from beta launch gate — beta readiness now defined by five core functional gates
- Beta gates locked: (1) BST working, (2) sidecard stable, (3) pipeline solid, (4) sign-in/memory operational, (5) tailor resume works
- Overlay remains active parallel work — not cancelled, just not a beta blocker
- Stable-branch release model confirmed as locked: `main` = development, `stable` = production
- All Bootstrap docs updated to reflect new beta gate definition and remove stale overlay-blocking wording

BLOCKED:
- Sign-in / memory (#51 account prompt) not yet implemented — this is the next major gate to close

NEXT:
- Implement sign-in / durable session persistence (beta gate 4)
- Validate all five beta gates in a real end-to-end flow
- Continue overlay work in parallel without blocking beta declaration

---

BREAK + UPDATE — 2026-03-14 (Beta Readiness + Telemetry Instrumentation)
---
DONE:
- Beta readiness definition formalized: four threshold questions PM must answer YES to before declaring beta (see milestone block above)
- PM decision: telemetry event capture is a prerequisite for beta launch — outside-user testing must start with usable product data
- Telemetry instrumentation implemented (commit e835fcb): POST /api/events endpoint, lib/telemetry_store.ts, append-only JSONL at data/telemetry_events.jsonl
- Six events wired: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used
- Extension emits 5 events (content_linkedin.js → background.js relay); web app emits tailor_used (app/tailor/page.tsx)
- All telemetry is non-blocking / fire-and-forget — failures never break user-facing flows

BLOCKED:
- None

NEXT:
- Begin beta stability testing with telemetry instrumentation active
- Monitor telemetry_events.jsonl for event flow validation during real usage
- Resume action-layer pipeline: auto-save strong matches → post-save confirmation → account prompt

---

BREAK + UPDATE — 2026-03-14 (Stable Branch Release Model)
---
DONE:
- Two-branch release model implemented: `main` = development iteration, `stable` = production deploy target
- `stable` branch created from current main HEAD (v0.8.5) and pushed to origin
- Vercel production deploy target must be changed from `main` to `stable` in Vercel dashboard (manual operator step)
- Vercel preview deploys continue on `main` for internal testing
- Promotion workflow defined: validate on main → fast-forward merge into stable → push stable → Vercel deploys to caliber-app.com
- All Bootstrap docs updated to reflect the new release model
- RELEASE MODEL FOLLOW-UP section in milestones.md replaced with implemented model

BLOCKED:
- Vercel dashboard production branch setting must be changed manually by the operator (Settings → Git → Production Branch → `stable`)

NEXT:
- Operator changes Vercel production branch to `stable`
- First promotion cycle: validate current main, merge to stable, confirm Vercel deploys from stable
- Extension ZIP on `/extension` page verified serving from stable branch deploy

---

BREAK + UPDATE — 2026-03-14 (Phase-2 Overlay Scoring — LinkedIn Job Card Badges)
---
DONE:
- Phase-2 overlay badge system fully implemented and stabilized across 4 commits (3c18f30 → 6d2ef28 → 5bb8565 → 82742a7)
- Badge injection into LinkedIn search results: CSS injected into page, badges render next to company logo on each job card
- Visible-job scoring engine: `scanAndBadgeVisibleCards()` stamps identity, deduplicates via cache, queues new cards for progressive scoring
- Chunked batch scoring: `CALIBER_PRESCAN_BATCH` message to background.js, `BADGE_CHUNK_SIZE=5` per chunk, sequential `callFitAPI()` calls with `{ prescan: true }`
- Stable card identity: `cardJobId()` with 4-level priority chain (data-occludable-job-id → /jobs/view/{id} href → data-job-id → text hash), cards stamped with `data-caliber-job-id` attribute
- Session score cache: `badgeScoreCache` keyed by job ID, `badgeCacheSurface` for surface binding, cache-hit badges restored instantly without API call
- Search-surface reset: `clearAllBadges()` on surface change, `getSearchSurfaceKey()` normalizes pathname + keywords + location + filters
- Scroll listener with stored handler ref for clean detach, MutationObserver with module-level debounce for DOM rerender recovery
- BST evaluation migrated to badge cache: `evaluateBSTFromBadgeCache()` replaces separate prescan — badge scoring IS the prescan
- 8 lifecycle/stability bugs fixed: surface key normalization, scroll listener lifecycle, observer debounce leak, batch generation counter for stale responses, active guard on processBadgeQueue, cache surface empty-string check, style element parentNode check, same-surface URL change badge restoration
- Loading placeholder format: `[diamond icon] …` — matches Caliber brand
- Score color bands (updated v0.8.9): Green (8.0+), Yellow (6.0–7.9), Red (0–5.9)
- Self-mutation guard: `badgeInjecting` flag prevents MutationObserver from re-triggering during badge writes

BLOCKED:
- None — overlay badge system is stable and shipped

NEXT:
- Auto-save strong-match jobs (score >= 8.5) into pipeline with canonical URL dedupe
- Post-save confirmation / action state in sidecard
- Account prompt for durable pipeline saving

---

BREAK + UPDATE — 2026-03-13 (OPENAI_API_KEY Runtime Contract)
---
DONE:
- Created shared environment guard `lib/env.ts` with `requireOpenAIKey()` helper
- All OpenAI usage points (`lib/tailor_store.ts`, `lib/resume_skeleton.ts`, `lib/semantic_synthesis.ts`) now use the shared guard instead of inline checks
- Tailor API routes return clean 503 + user-facing message when key is missing; real error logged server-side
- `OPENAI_API_KEY` documented in `.env.development` and `.env.production` with operator comments
- No secrets committed; key is server-side only; no NEXT_PUBLIC exposure

BLOCKED:
- None — operator must add real OPENAI_API_KEY to .env.local / deployment settings

NEXT:
- Operator supplies key; tailor generation works end-to-end

---

BREAK + UPDATE — 2026-03-13 (Defer Alternate Career-Signal Uploads Until Post-Beta)
---
DONE:
- PM reviewed and captured future product ideas for non-resume career document uploads (personality assessments, strengths reports, skills profiles)
- Product decision made: defer all alternate career-signal upload features until after beta
- Scope-control entry added to BREAK_AND_UPDATE.md, CALIBER_ISSUES_LOG.md, CALIBER_ACTIVE_STATE.md

BLOCKED:
- None — this is a scope-freeze decision, not an implementation task

NEXT:
- Resume-first beta scope continues as the only active upload path
- Revisit alternate career-signal ingestion as a post-beta exploration item once core flow is shipped and stable

---

BREAK + UPDATE — 2026-03-11 (UX Task Contract: UI Constitution + Layout Skeleton Required)
---
DONE:
- Identified UX task under-specification as a process break causing repeated visual drift
- Formalized UI Constitution (`docs/ui-constitution.md`) as mandatory attachment for all UX/UI coder tasks
- Formalized Layout Skeleton (`docs/layout-skeleton.md`) as mandatory attachment for layout/composition tasks
- Added mandatory PM operating rule to `Bootstrap/PM_bootstrap.md` under coder handoff rules
- Promoted UX shared-primitives governance to durable enforcement invariant in `Bootstrap/kernel.md`
- Logged process issue in `Bootstrap/CALIBER_ISSUES_LOG.md`

BLOCKED:
- Constitution and skeleton docs need to be adopted in live PM handoffs (first real usage pending)

NEXT:
- Use UI Constitution + Layout Skeleton references in the next UX/UI coder task
- Verify reduced visual drift compared to prior sessions
- Refine constitution/skeleton content based on first adoption cycle

---

BREAK + UPDATE — 2026-03-11 (Pipeline Dashboard Inline Tailor)
---
DONE:
- Pipeline card actions expanded: larger archive (X) control with proper hit area + accessibility
- "Tailor resume" action visible on every pipeline card
- Inline TailorPanel component opens inside pipeline page (no navigation to /tailor)
- TailorPanel shows job title, company, generation state, tailored output, copy + download
- Generate route extended to accept pipelineId (resolves prep via session+jobUrl lookup)
- Pipeline board layout preserved: Resume Prep → Submitted → Interview Prep → Interview
- Drag-and-drop disabled on card when tailor panel is open

NEXT:
- Evaluate dashboard expansion features
- Pipeline card UX refinements based on usage

---

BREAK + UPDATE — 2026-03-11 (Calibration Result Copy Structure)
---
DONE:
- Calibration results now use two-sentence structure:
  1. Human alignment context (derived from synthesis patternSummary)
  2. Market translation introducing title reveal: "The closest market label for the kind of work you're naturally aligned with is:"
- Explanation section replaced by two-sentence context → market label flow
- Hero title card styling preserved
- Title scoring logic unchanged
- Fixture validation confirmed: Chris → Product Development Lead, Jen → Creative Operations Lead, Fabio → Technical Security Consultant

---

BREAK + UPDATE — 2026-03-11 (Stabilization Phase: Debug/Polish Before Action-Layer Expansion)
---
DONE:
- Extension feedback controls restored: SVG icons, GitHub-issue bug report (6fad8b7)
- Extension tailor banner state logic fixed: no premature "Opened ✓", pipeline routing (6fad8b7)
- Calibration results hero spacing improved: button centered in lower half of hero card (5d3c91a)
- Calibration explanation copy replaced with structured summary template (5d3c91a, 25c7752)
- Signal normalization layer added for explanation copy (25c7752)
- Better Search Title rolling window fixed to documented spec: window=4, diagnostic logging (ec32fe6)
- Extension ZIP rebuilt with all fixes
- Soft-locked task sequencing documented across all Bootstrap docs

ACTIVE (in flight):
- Extension sidecard collapsed height stability — card should remain fixed height when all sections closed; only expand on dropdown open

BLOCKED:
- All subsequent action-layer tasks are soft-locked behind current fix + BST verification:
  - Auto-save strong matches (>= 8.5) into pipeline — blocked by BST verification
  - Post-save confirmation in sidecard — blocked by auto-save
  - Account prompt for durable pipeline saving — blocked by post-save confirmation
  - Pipeline/action-layer refinement — blocked by account prompt

NEXT (soft-locked in order):
1. Fix extension scorecard collapsed sizing stability (ACTIVE)
2. Restore / verify Better Search Title trigger behavior (rolling window fix shipped; needs real-flow verification)
3. Auto-save strong-match jobs (score >= 8.5) into pipeline with canonical URL dedupe
4. Add post-save confirmation / action state in sidecard
5. Add account prompt for durable pipeline saving
6. Continue pipeline/action-layer refinement only after the above are stable

SEQUENCING RULE:
- Each main step is treated as blocked by the previous main step until validated complete.
- Exception: small UI bug squashes may be handled at any time if narrow, local, and do not break sequencing.

---

BREAK + UPDATE — 2026-03-11 (Shell Baseline Correction + Documentation Truth Pass)
---
DONE:
- Three-zone shell framing rolled back — all 6 shell files restored to commit a211182 visual baseline (7b03a18)
- Visual baseline documented: lowered header + lowered ambient gradient (50% 12%), page-local gradient ownership, simple CaliberHeader with pt-4
- All core Bootstrap docs corrected: three-zone references amended/superseded, a211182 established as named shell baseline
- Issues #41 and #46 reopened to reflect actual state; new issue #47 tracks shared shell framework decision
- Historical season work preserved with _(Superseded)_ annotations — not deleted

BLOCKED:
- Shared shell architecture lock — the broader question of a reusable shared shell vs page-local ownership is an open design decision
- No code changes in this pass (DOCS_ONLY)

NEXT:
- Decide shared shell framework vs page-local ownership (new #47)
- Validate pipeline board model (product-level decision — code complete)
- Verify Better Search Title trigger behavior
- CTA noise-control refinement

---

BREAK + UPDATE — 2026-03-11 (Three-Zone Shell Stabilization + Tailor Completion + Upload Simplification) _(SUPERSEDED — shell framing corrected above)_
---

> **NOTE (2026-03-11):** The three-zone shell claims in this block have been superseded. Visual baseline was restored to a211182. Non-shell work (tailor, pipeline, upload, extension) remains current.

DONE:
- ~~Three-zone shell design stabilized across ALL pages~~ _(Superseded — rolled back to a211182 baseline)_
- CALIBER header and ambient gradient lowered ~12% across all pages for visual grounding _(a211182 — still current baseline)_
- Upload page simplified: redundant heading removed, layout spacing tightened
- Tailor page completed as launch-ready flow: copy-to-clipboard action, retry-on-error, polished result area with copy/download, tightened spacing
- Pipeline board enhanced: DnD card movement between columns, fit score on cards, visibility reload on tab focus
- Calibration results page rhythm polished, upload contrast adjusted
- Extension ZIP v0.6.0 rebuilt with latest source (packaging refresh — label fix, BST thresholds, LinkedIn updates)
- ~~Visual shell drift (#41) resolved via three-zone stabilization~~ _(Superseded — #41 reopened)_
- Upload/ingest shell alignment (#46) partially resolved (heading removed, header lowered)
- PM docs refreshed to reflect all shipped work and updated issue states

REMAINING / ACTIVE NEXT:
- Product validation of pipeline 4-column board model (column names, stage decomposition) — code is complete
- Validate tailor page output quality (text vs PDF download decision)
- Verify Better Search Title trigger behavior with widened thresholds
- CTA noise-control refinement (per-session, time-based)

---

BREAK + UPDATE — 2026-03-11 (Visual Shell Re-Lock + Pipeline Board + Tailor Recompose)
---
DONE:
- Visual shell re-lock: abandoned "match the pipeline page" approach, anchored design to explicit approved primitives
- Approved primitives codified: wide ambient gradient over #050505, outlined green buttons, no sharp centered line, calm dark premium shell
- Global layout: top padding pt-16→pt-10, max-width widened to 960px for board (pages self-constrain to 600px)
- Calibration page: header area 8.5em→5.5em, LANDING spacing mt-14/mt-12→mt-8, dropzone text centered, redundant dividers removed
- Tailor page recomposed: "Tailor Resume" as primary heading, job context first, CaliberHeader removed, pipeline banner demoted
- Pipeline rebuilt from list to 4-column board: Resume Prep → Submitted → Interview Prep → Interview
- Pipeline API + store updated with new stages (resume_prep, submitted, interview_prep, interview) with legacy auto-mapping
- Extension bug-report button: icon-only → "🐛 Report" text label
- All "Back to Caliber" links → /calibration
- PM docs refreshed to reflect current shipped state vs planned-next behavior

REMAINING / ACTIVE NEXT:
- ~~Tighten remaining visual shell drift across all pages~~ — DONE (three-zone shell stabilization)
- Product validation of pipeline 4-column board model (column names, stage decomposition)
- Verify Better Search Title trigger behavior with widened thresholds
- CTA noise-control refinement (per-session, time-based)
- ~~Upload/ingest page shell alignment~~ — DONE (heading removed, shell lowered, three-zone applied)

---

BREAK + UPDATE — 2026-03-10 (Pipeline Truthfulness + Extension v0.6.0)
---
DONE:
- Pipeline entry now created at `/api/tailor/prepare` time in `strong_match` stage — persistence begins before tailoring, not after
- Pipeline advances to `tailored` during `/api/tailor/generate`
- `/tailor` confirmation banner gated by actual pipeline existence (truthful — only shown when backed by real entry)
- Extension suppresses 8.0+ tailor CTA for jobs already present in user's pipeline (baseline CTA noise control)
- Extension feedback row includes separate bug-report action, distinct from thumbs-down quality feedback
- Extension bumped to v0.6.0
- PM docs refreshed to reflect current shipped product truth

REMAINING:
- CTA noise-control refinement: per-session and time-based suppression for jobs not yet in pipeline
- Pipeline is still intentionally minimal — not a CRM

---

BREAK + UPDATE — 2026-03-10 (Strong-Match Action + Resume Tailoring + Job Pipeline)
---
DONE:
- Extension-first scoring UX stabilized (sidecard, HRC, compact layout, feedback loop)
- Contextual title recovery direction established (Better Search Title as search-surface recovery mechanism)
- Calibration/web visual polish direction established (brand-color, green CTAs, hero simplification)
- Product decision: Caliber expands from evaluation-only to strong-match action workflow

NEXT:
- Strong-match contextual resume-tailoring flow: 8.0+ jobs trigger "Tailor resume for this job" action
- Resume tailoring uses the user's existing uploaded Caliber resume + live job context from the extension
- Simple job pipeline/tracker for strong-fit opportunities:
  - Stages: Strong Match → Tailored → Applied → Interviewing (+ optional Offer / Archived)
- Extension contextual card (above sidecard) for 8.0+ jobs replaces in-sidecard CTA
- Tailor page + pipeline page on web app

BLOCKED / GUARDRAILS:
- Avoid CRM-style pipeline expansion — pipeline must remain intentionally minimal
- Keep pipeline stage model minimal (no subtasks, no notes, no timeline features)
- Strong-fit action ONLY on 8.0+ jobs — lower scores do not get tailoring CTAs
- Tailoring must never fabricate experience; only reorder, emphasize, and adjust language
- No generic feature sprawl — this is the next focused product layer, not a platform play

---

Milestone: Extension-First UX Stabilization (2026-03-10)
---

**Status:** COMPLETE

Extension sidecard and calibration results page received final polish pass, completing the extension-first operating model stabilization.

**What shipped:**

Extension sidecard (primary decision surface):
- Compact two-column header: company + job title (left), fit score + decision badge (right)
- Hiring Reality Check: collapsible with High/Possible/Unlikely band badge
- Bottom line: collapsible, collapsed by default
- Supports fit: green toggle, bullet count, collapsible
- Stretch factors: yellow toggle, bullet count, collapsible
- Panel dimensions: 320px × 420px max
- Extension v0.4.1 deployed

Calibration results page (final polish):
- Hero title reduced ~10% (text-[1.7rem] / sm:text-[2.4rem])
- Section label font-light (300 weight)
- "Search on LinkedIn" = green primary CTA
- "See why it fits" = scoring-yellow secondary
- Explanation dropdown: "WHY IT FITS" label removed, opens with "Your pattern matches on 4 core signals.", human-language bullets, no technical/internal scoring terminology
- summary_2s and bullets_3 generation rewritten for plain language

Extension delivery:
- Stale v0.3.5 zip replaced via version bumps (v0.4.0, then v0.4.1)
- New filename on each build to bust Vercel CDN cache
- `/extension` page serves current build as primary user install path

**Real user flow (canonical):**
calibration → results page → /extension → download ZIP → install in Chrome → LinkedIn → extension scores jobs

**Issues resolved:** #28, #32, #33, #35, #36, #37
**Issues downgraded:** #31 (handshake: BLOCKING → known friction)

---

BREAK + UPDATE — 2026-03-10 (Job Board Adapter Architecture)
---
DONE:
- Decision recorded: Job Board Adapter Architecture is the required foundation before expanding to additional job boards
- Architecture contract: site-specific adapters call extractJobData() → normalized job object (title, company, location, description)
- Adapter roster defined: linkedinAdapter, indeedAdapter, glassdoorAdapter, ziprecruiterAdapter, monsterAdapter
- Scoring engine contract: MUST consume only the normalized job object, NEVER site-specific DOM logic
- This is the required approach for Phase 1 multi-board coverage
- kernel.md updated with Job Board Adapter Invariant
- CALIBER_ISSUES_LOG updated with tracking issue
- decisions.md updated

BLOCKED:
- Implementation not yet started — architecture decision documented first

NEXT:
1. Implement adapter interface + linkedinAdapter extraction refactor
2. Implement indeedAdapter (first expansion target)
3. Scoring engine refactor to consume normalized job object only
4. Adapter smoke tests per board

---

BREAK + UPDATE — 2026-03-10 (Extension-First UX Stabilization)
---
DONE:
- Extension sidecard shipped as primary decision surface with job identity, HRC, collapsible sections
- Calibration results page final polish: smaller hero, lighter label, green/yellow button hierarchy, human-language explanation
- Explanation generation (title_scoring.ts) rewritten to remove all internal scoring language
- Extension v0.4.1 deployed with CDN cache-bust discipline
- Stale extension download artifacts eliminated
- Repo consolidated to single mainline (main)
- Issues #28, #32, #33, #35, #36, #37 resolved; #31 downgraded from blocking

BLOCKED:
- Nothing currently blocking

NEXT:
1. Extension compact scanline UX refinement
2. Extension decision trust / scoring clarity
3. No unnecessary expansion of calibration scope

---

Milestone: Repository Stabilization — Single Mainline (2026-03-10)
---

**Status:** COMPLETE

Multiple parallel extension branches (`extension-panel-persistence-restore`,
`extension-upgraded-panel-restore`, `extension-market-navigation`,
`extension-beta-download-page`, `docs-extension-beta-workflow`) caused
renderer/persistence/packaging regressions and made it unclear which branch
held the source of truth for the extension.

**Actions taken:**
- Stable extension changes consolidated onto main in a single commit.
- Regression-prone identity-key tracking and `updateIdentityHeader()` removed;
  identity rendering inlined into `showResults()`.
- All stale local and remote extension branches deleted.
- Hiring Reality Check display confirmed intact after consolidation.
- Extension build (`scripts/build-extensions.sh`) verified producing correct
  prod and dev outputs from the consolidated main.

**Rule going forward (during development):**
- `main` is the single integration branch.
- One extension feature branch at a time — no parallel extension branches.
- Extension testing uses the `extension/` source folder or `dist/extension-dev/`
  build, never stale zip artifacts.

---

Milestone: Beta Launch Infrastructure Lock (FUTURE — activates at beta launch)
---

**Status:** NOT YET ACTIVE — documenting the operational rule now so it is not
forgotten when beta launch arrives. Current behavior (main auto-deploys to
production) remains unchanged until this milestone activates.

**Trigger:** This milestone activates when the team declares "beta launch."
Until then, the current workflow (push to main → auto-deploy) continues.

### Deployment Workflow After Beta Launch

1. **main = stable production branch.**
   - `main` auto-deploys to `https://www.caliber-app.com` via Vercel.
   - After beta launch, nothing merges to main without passing staging
     verification first.

2. **Feature branches for all development.**
   - All new work happens on feature branches off main.
   - No direct commits to main after beta launch.

3. **Staging / preview deployment for testing.**
   - Every PR to main gets a Vercel preview deployment URL.
   - QA and PM verify the preview deployment before approving merge.
   - Extension dev builds (`dist/extension-dev/`) test against
     `http://localhost:3000`; production extension (`dist/extension-prod/`)
     is only updated after main merges.

4. **Production deploys only from main after verification.**
   - Merge to main = production deploy.
   - No hotfix pushes without at least one preview verification pass.

### Why This Matters

During early development, main-as-dev is acceptable because the product is
still forming. At beta launch, real users depend on production stability.
The staging gate prevents half-finished work from reaching users.

### Checklist (activate at beta launch)

- [ ] Branch protection rule on main (require PR + at least one approval)
- [ ] Vercel preview deployments confirmed working for PRs
- [ ] Team notified: no direct pushes to main
- [ ] Extension build script verified against preview URL if needed

---

BREAK + UPDATE — 2026-03-08 (Extension-First Operating Model)
---
DONE:
- Calibration results page repositioned as extension-first launchpad
- Single hero title direction replaces multi-title scored list on calibration page
- Title scores removed from calibration page
- Manual paste scoring removed from calibration primary flow
- Extension sidecard is now the primary decision surface for real-role evaluation
- Canonical scoring fixtures created and committed (Chris / Jen / Fabio / Dingus)
- Title scoring baseline verified and considered stable
- Fabio scoring correction validated (SecurityAnalysis cluster)
- Jen scoring correction validated (CreativeOps / partnerships outputs)
- Smoke test aligned to canonical scoring library (stale inlined logic removed)
- Baseline smoke passes 45/45
- /calibration extension-first hero-title layout merged and documented as canonical surface contract

BLOCKED:
- Extension fresh-install / refresh handshake still unreliable (user calibrates → installs/refreshes extension → opens LinkedIn → extension says no active session until manual Caliber and LinkedIn refresh)

NEXT:
1. Fix handshake/session discovery bug
2. Add Hiring Reality Check to extension
3. Compact sidecard UX polish

---

Phase-2 Extension Overlay UX Contract Finalized (2026-03-08)
---
DONE:
- Phase-2 LinkedIn overlay UX design locked and documented
- Listing badge: Caliber icon + color score under company logo on each job card
- Color bands: Green (8.0–10.0) · Yellow (6.5–7.9) · Gray (0–6.4)
- Loading placeholder: immediate `[Icon] …` badge before scoring completes
- Progressive visible-job scoring: ~10 visible jobs first, then on scroll
- Sidecard trust header: Job Title + Company Name (location excluded)
- Sidecard content: score + supports + stretch + bottom line, no extra metadata
- Future ideas documented but explicitly out of Phase-2 scope

BLOCKED:
- Implementation blocked until scoring credibility (#25) is resolved and PM unblocks

NEXT:
- Scoring credibility fix remains top priority
- Phase-2 overlay implementation only after PM explicitly unblocks

---

BREAK + UPDATE (2026-03-08)
---
DONE (this sprint):
- Production/dev environment split implemented and deployed
  - Production: `https://www.caliber-app.com` (Vercel from main)
  - Dev: `http://localhost:3000` only
  - Extension builds hard-separated: no host fallback, no cross-environment permissions
- Stable beta deployed and verified live on production domain
- Production extension verified working after build/reload
- Roadmap order locked: scoring credibility → beta stability → trust polish → Phase 2 (deferred)
- Product understanding captured: calibration titles are starting search terms, extension is the real decision engine
- Environment split documented in `ENVIRONMENT_SPLIT.md`

BLOCKED:
- Scoring credibility for Jen (5.3 / 4.6 / 4.6) and Fabio (low relative to expected strong-profile behavior)
- Market-job scores low despite high calibration title scores (jobs under calibrated terms often below 6)
- Possible search-surface / adjacent-title discovery gap (acknowledged, not current scope)

NEXT:
1. Scoring calibration / credibility fix (Jen + Fabio) — top priority
2. Bottom line polish only as needed for beta credibility
3. Extension sidecard: active job identity (title, company, location) for trust
4. Phase 2 overlay/list scoring — deferred until PM unblocks

---

BREAK + UPDATE (2026-03-06)
---
DONE (this sprint):
- Extension Phase 1 MVP verified working end-to-end on LinkedIn job detail pages
- Live confirmed: extract job description → call production API → render fit score in popup (4.3/10)
- Resolved: stale extension package, missing scripting permission, localhost API base, bare-domain redirect/CORS, exact chrome-extension origin echo
- Canonical production host locked: https://www.caliber-app.com
- Key commits: a9565d9, 66d1bf4, dd5da13

BLOCKED:
- (none)

NEXT:
- Bottom line doctrine polish (anti-repetition / paraphrase rule)
- Extension popup explanation rendering completeness
- Extension Phase 2: listings-page overlay scores next to job posts
---

Milestone: Stabilize /calibration UI shell + typewriter tagline; restore RESUME_INGEST UI; add / -> /calibration redirect; establish single-file guardrails.

BREAK + UPDATE (2026-02-28)
---
DONE (this sprint):
- Build/type fixes across backend and UI
- /calibration UI: no blank screens, no false results
- PDF bad-xref now returns RESUME_PARSE_FAILED

BLOCKED:
- Smoke integration stalls in CONSOLIDATION_RITUAL and does not reach PATTERN_SYNTHESIS within step cap

NEXT:
- Make CONSOLIDATION_RITUAL advance deterministically per ADVANCE call (remove wall-clock gating)
- Re-run smoke to confirm it reaches PATTERN_SYNTHESIS
---

Next milestone:
- Backend wiring via hook: add useCalibrationSession and refactor page.tsx to call hook only; then resume-upload -> prompt 1.
## ⚠️ PHASE SHIFT — Calibration Core First (Temporary Freeze on Summary Engine)

As of this milestone update, development priority has shifted.

The product flow is now locked as follows:

Primary focus:

1. Resume upload
2. Title suggestion + job description paste (same screen; no user title editing; no confirmation gate)
3. Fit score (0–10) + summary
4. LLM dialogue opens after score+summary (next phase)

Older calibration-core steps (anchors, overlap/gap, mechanical title producer) are deprecated in the current flow.

Narrative summary and dialogue mode will be enabled after score+summary.

This prevents over-investment in surface polish before structural alignment logic is proven.

Caliber — MILESTONES (Anchor-First Architecture)



This document defines the active execution runway.



It changes only when architectural direction changes or new enforcement discoveries occur.



This file governs execution sequencing only.



For philosophy → CALIBER\_DOCTRINE.md  

For execution rules → KERNEL.md  



---



\## OPERATIONAL BASELINE (COMPLETED RECORD)



\### Core Architecture



\- Deterministic event-driven state machine  

\- Externally visible states only  

\- JSON-only API responses  

\- No hidden transitions  

\- Strict ADVANCE allowlist  

\- Resume upload is file-only  

\- No paste path  



Status: COMPLETED



---



\### Structural Cadence Backbone (COMPLETED RECORD)



Pattern Synthesis must follow 4-layer cadence:



1\. Identity Contrast  

2\. Intervention Contrast  

3\. Construction Layer  

4\. Conditional Consequence Drop (earned only)  



Cadence invariant.  

Not adjustable.  

Not prompt-dependent.  



Status: COMPLETED



---



\## ARCHITECTURAL FORK



Milestone 5.1 (Hybrid Semantic Synthesis) is superseded.



Caliber now operates under Anchor-First Architecture.



We are no longer tuning guardrails.  

We are implementing structural grounding.



---



Milestone 6 — Lexical Anchor System (Deterministic)
6.0 Anchor Extraction — Deterministic Ordering (Complete)
Objective

Extract lexical anchors (verbs + nouns) from resume text and prompt answers in a deterministic, stable way suitable for downstream enforcement.

Implementation Guarantees

Deterministic tokenization

Deterministic sorting:

Primary: frequency (descending)

Secondary: term (ascending)

Stable top slices:

topVerbs (<= 12)

topNouns (<= 12)

anchorTerms (<= 24 combined)

No randomness. No semantic model involvement.

Contract

Anchor extraction must:

Produce identical output for identical input.

Never depend on runtime order or object key order.

Never mutate session state.

Be pure and synchronous.

Status: Complete

6.1 Anchor Injection + Overlap Enforcement (Complete)
Objective

Force semantic synthesis to meaningfully reuse user language without allowing the model to drift into abstraction or praise.

This is enforced via overlap scoring and retry logic.

Injection Layer

The synthesis prompt includes a LEXICAL ANCHORS block:

Verbs: (top verbs)

Nouns: (top nouns)

Anchors are advisory but scored.

Constraint:

Anchors must not override structural grammar rules.

Required line starters must never change.

Never switch to first-person voice.

Anchors should not create noun collisions (“protocol delegation” style artifacts).

Anchors assist structure. They do not define structure.

Overlap Enforcement

After first LLM response:

Build a concatenated synthesis string.

Perform whole-word matching (\bterm\b, case-insensitive).

Compute:

score = overlapCount / anchorTerms.length

Threshold:

MIN_OVERLAP = 0.35
Decision Tree
Case A — score >= 0.35

Accept.

Log:

synthesis_source=llm ...
Case B — score < 0.35

Retry once with injected missing anchors.

Log:

synthesis_source=retry ...
Case C — retry still < 0.35

Deterministic fallback synthesis.

Log:

synthesis_source=fallback ...

Retry occurs at most once.

Logging Contract (Strict)

All synthesis logs must:

Be single-line physical strings.

Contain:

synthesis_source

anchor_overlap_score (2 decimals)

missing_anchor_count

praise_flag=false

abstraction_flag=false

Emit exactly once per attempt.

Never emit llm if first attempt fails threshold.

This ensures deterministic observability.

Known Behavioral Observations

Overlap pressure can produce grammatical degradation if anchor set is low quality.

Raising threshold increases anchor forcing.

Quality improvements should focus on:

Anchor selection refinement

Prompt structure clarity

Allowlist discipline

Grammar preservation

Threshold tuning should occur only after anchor quality stabilizes.

Status: Complete and Stable

skillAnchors[]

Milestone 6.2 — Deterministic Signal Classification
Status: COMPLETED
Notes: Deterministic signal/skill classification + weighted alignment scoring + tests (landed on main).

Milestone 6.3 — Anti-Abstraction Enforcement
Status: PARTIAL
Notes: Drift detection + retry injection present; validator outcome/log fields/tests not yet fully satisfied.


\## Milestone 6.3 — Anti-Abstraction Enforcement



Objective:



Prevent identity inflation and archetype drift not grounded in anchors.



Implementation:



\- Detect praise framing.

\- Detect identity inflation language.

\- Detect archetype terms not present in anchor set.

\- Flag abstraction\_flag=true/false.

\- Retry path must explicitly remove drift terms.



Status: NEXT



---



\## Milestone 6.4 — Validator Outcome Matrix (Refactor)



Purpose:



Replace silent validator branches with explicit classification.



Allowed outcomes:



\- PASS

\- REPAIR\_APPLIED

\- RETRY\_REQUIRED

\- FALLBACK\_ANCHOR\_FAILURE

\- FALLBACK\_STRUCTURE\_INVALID

\- FALLBACK\_BLACKLIST\_PHRASE



No empty returns permitted.



Status: PLANNED



---



\## Milestone 6.5 — Observability Upgrade



Every synthesis must log:



\- synthesis\_source

\- anchor\_overlap\_score

\- missing\_anchor\_count

\- praise\_flag

\- abstraction\_flag

\- fallback\_reason (if applicable)



Logs must be:



\- machine-parseable

\- minimal

\- deterministic

\- non-verbose



Status: PARTIALLY IMPLEMENTED  

(Anchor count logging exists; overlap enforcement logging pending full stabilization.)



---



\# EXTENSION PHASE



Once top 3-line synthesis consistently produces D-level mechanical specificity:



---



\## Milestone 7.0 — Bullet Grounding Extension



Apply anchor enforcement to:



\- operateBest bullets

\- loseEnergy bullets



Constraints:



\- No identity inflation

\- No semantic drift beyond anchor band

\- No cross-engine blending



Status: BLOCKED until 6.x stable



---



\# Deterministic Fallback Doctrine (UNCHANGED)



Fallback exists only to:



\- Preserve cadence

\- Prevent invalid state

\- Protect downstream engines



If fallback rate increases → anchor extraction or overlap enforcement is failing.



Status: STABLE (structure preserved; anchor-based fallback under 6.1 build)



---



\# Definition of Done — 6.x



A milestone is complete only when:



\- Anchor extraction deterministic.

\- Overlap threshold enforced.

\- Retry path functional.

\- Fallback deterministic.

\- Logs present.

\- Regression tests pass.

\- Output feels mechanically specific under diverse inputs.

\- Anchor overlap metrics confirm grounding.



“Feels better” without anchor overlap metrics is not completion.

