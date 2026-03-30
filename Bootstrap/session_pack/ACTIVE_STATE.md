# CALIBER_ACTIVE_STATE.md — Current Project State

> This file is the compact reload target for PM sessions. It contains only active/current information. For full project history, see `CALIBER_CONTEXT_SUMMARY.md`.

---

## Current Phase
**Beta Launched + Inventory Foundation Active (2026-03-29).** All five beta gates are CLOSED in production. Extension v0.9.45 live. Canonical Job Cache shipped. `/jobs` ready-list page live. First user-directed ingestion path shipped (`POST /api/jobs/ingest`). Phase transition: Desktop Stabilization→ COMPLETE. Next milestone: Post-Beta Canonical Job Inventory Expansion (ACTIVE).

> **Extension overlay/backfill model confirmed + `stable` promoted (2026-03-29):** Sidecard-primary with reactive/backfill is the confirmed working model on both LinkedIn and Indeed. `BADGES_VISIBLE = true` on `main` and `stable`. Card badges appear only after a sidecard score exists — no unsafe DOM prescan rendered as badges. Canonical Job Cache and `/jobs` page also live. `stable` promoted to this release.

SSI subsystems: Signal Gap Detection (SGD), Surface Quality Banner, Better Search Trigger (BST), BST Loop Prevention, Pipeline Trigger (>=7), Score Labeling.

Beta gates (all CLOSED on `31ab6a1`): (1) BST working, (2) sidecard stable, (3) pipeline solid, (4) sign-in/memory operational, (5) tailor resume works. Production deploys from `stable` branch; development on `main`.

**Tailor Gate Status (2026-03-26):** Gate 5 (Tailor resume works) closed for functionality (59/59 E2E assertions, 2026-03-24). A source-binding integrity bug was subsequently discovered and fixed (cross-user resume contamination, commit `892a45a`). The integrity fix is now in place. **Post-fix tailor validation has not yet been run.** Any tailor output generated before commit `892a45a` must not be treated as a valid quality baseline. Tailor quality validation must use post-fix runs only. This does not revoke the Gate 5 closure — the plumbing is correct — but post-fix validation is required before declaring tailor output trustworthy for beta.

**Production Deployment Status (2026-03-29 — RELEASE STABILIZATION + INGESTION PATH):**
- `origin/stable` = current release commit (2026-03-29) — production. Contains: all five beta gate work, all stabilization through `31ab6a1`, PLUS overlay/backfill convergence (v0.9.38–v0.9.45), Canonical Job Cache + `/jobs` page, `/jobs` ready list improvements (pipeline badges, URL-only ingest, stretch factors, tier badges, web filter, better empty state, richer stats), user-directed job ingestion (`POST /api/jobs/ingest`), `EXTENSION_BETA_VERSION` corrected (0.9.34→0.9.45).
- `origin/main` = development branch. `/jobs` ready-list improvements committed. Development continues here.
- Vercel production branch = `stable` ✓ (confirmed 2026-03-28).
- Extension artifact: `caliber-extension-beta-v0.9.45.zip` — production host `https://www.caliber-app.com` ✓.
- **Carry-forward:** Issue #108 (LinkedIn dense-surface unresponsiveness) remains open. Post-fix tailor validation (post-`892a45a`) still recommended.

**Branch / Release Rule (2026-03-29 — OPERATING CONTRACT):**
- All implementation commits for a coder task must be pushed to `main` first.
- PM validates on preview / `main` before any production promotion.
- Promotion from `main` → `stable` is a separate, explicit PM-controlled release action.
- Builders do NOT push directly to `stable` as part of normal task execution unless PM explicitly instructs it in a separate release step.
- This rule is encoded in the coder handoff template in `Bootstrap/session_pack/PM_BOOTSTRAP.md` as a required BRANCH POLICY block.

**Post-Cache Architecture Doctrine (2026-03-30):**
- **Score speed first:** Score speed is the first priority on the fit path; cache/telemetry must not block primary user-visible scoring. Detached writes only for cache persistence and telemetry. Cosmetic fields must not justify blocking DB reads on the scoring path.
- **Canonical jobs global, fit per-user:** Canonical jobs are global; fit judgments are per user. Shared job knowledge (JD text, company, metadata) can be reused. User-specific fit scores must not be blindly reused across different users.
- **Cross-surface platform:** Canonical job inventory makes Caliber cross-surface: extension, web app, and future mobile experiences can consume the same job intelligence layer. Extension is one acquisition/interaction surface, not the only surface.
- **Job acquisition ≠ job intelligence:** Job acquisition and job intelligence are separate concerns. The scoring engine does not depend on how jobs arrive. Source-adapter architecture is the intended backend direction.
- **UX: near-black background preferred.** Shared radial-gradient green glow artifact removed from all pages (commit `89141f2`). Simpler background is the default.

See `Bootstrap/session_pack/KERNEL.md` for durable invariants; `Bootstrap/session_pack/EXECUTION_CONTRACT.md` for scoring-path performance constraints.

**Next Move (for the next PM session):**
The product is post-beta. The Canonical Job Cache is the foundation for all future job-inventory work. The Job Source Adapter layer is shipped (`lib/job_source_adapter.ts` + `lib/job_source_adapters.ts`), providing a pluggable ingestion contract. Provider-aware URL ingestion is shipped — users can now submit a bare job URL and Caliber will classify the provider and fetch job data server-side. The next implementation sequence is:
1. **Observe real usage** — see what jobs users score manually via the ingest form (both paste and URL-only modes); confirm /jobs has engagement. No architecture decisions before usage signal exists.
2. ~~Source-adapter interface~~ — **DONE (2026-03-30).** `JobSourceAdapter` contract defined with provenance, trust levels, processing rights, and canonicalization entry. Six adapters implemented.
3. ~~Provider-aware URL ingestion~~ — **DONE (2026-03-30).** `POST /api/jobs/ingest` Mode 2: URL-only with provider classification. Supported ATS: Greenhouse, Lever, Ashby, SmartRecruiters (public APIs). Employer pages: JSON-LD extraction. Restricted: LinkedIn/Indeed fail immediately with guidance. 40 tests pass.
4. **First structured job source** — evaluate one low-friction job data source that provides full JD text. Decision criteria: full JD text available, cost, reliability, coverage. Ship one adapter.
5. **Scored recommendations on /jobs** — once inventory exceeds a useful per-user threshold, surface ranked scored-job recommendations. Calibration is the personalization layer.

**What is not next:** Scraper-first acquisition (fragile, legal risk), zero-click broad DOM overlay (requires inventory layer first, not more DOM probing), supply expansion before observing engagement.

See `Bootstrap/milestones.md` → Post-Beta: Canonical Job Inventory Expansion milestone for the full sequence and rationale.

**Scope freeze note (2026-03-13):** No new feature scope before beta ships. Alternate career-signal uploads (personality assessments, strengths reports, skills profiles) have been reviewed and explicitly deferred to post-beta. Resume-first flow is the only active upload path.

**Extension Build Host Rule (2026-03-16):** Production extension source (`extension/`) is locked to `https://www.caliber-app.com`. No localhost references in env.js, manifest.json, or runtime code. Localhost is only allowed for explicitly declared dev builds. Violation = regression. See `CALIBER_EXECUTION_CONTRACT.md`.

**Durable Telemetry Infrastructure (2026-03-17):** Telemetry and feedback persistence is now durable via Postgres (Neon) through Prisma. File-backed JSONL and SQLite paths are superseded. Both `/api/events` and `/api/feedback` write to `TelemetryEvent` and `FeedbackEvent` tables. Experiment condition is queryable via `sessionId`, `signalPreference`, and `meta` fields. PM can rerun the controlled signal-injection ON/OFF experiment once production `DATABASE_URL` is confirmed set in Vercel and the current code is deployed. Extension dev/prod host split is restored — source `extension/` defaults to localhost:3000 for dev validation.

## Active Systems Under Validation
- **Signal Gap Detection (SGD)** — detects professional signals from prompt answers not in resume; polling pause gate ensures calibration waits for explicit Yes/No user choice before advancing. Signal normalization layer converts raw tokens to professional labels. When user selects Yes, detected signals are mapped to scoring-vocabulary keywords via SIGNAL_SCORING_KEYWORDS dict; these become anchor boosts applied directly to the anchor weight map in generateTitleRecommendation (bypassing the normal weight-5 cap), plus a signal-affinity bonus adjusts title scores for signature-term overlap. Included signals are displayed on the calibration result page. **Scoring-vector influence verified** (Jen: 8.4→9.0 with YES). **Signal injection impact validated — PASS (2026-03-17):** 28 matched jobs analyzed via Neon telemetry; mean delta +0.02, 27/28 identical, 0 threshold crossings. Signal injection does not distort scoring. **This validation is complete — signal injection is no longer an active uncertainty for beta.**
- **Surface Quality Banner (SMC)** — BST slot shows "{count} strong matches · Best: {title} ({score})" using true page max score (not filtered max). Fixed in v0.9.7 (issue #73). **Stale boot state regression** (issue #74): durable prescan restore was rehydrating `prescanSurfaceBanner` on init, causing stale best-score display on fresh surfaces. Fixed in v0.9.10 — SMC now renders only from fresh current-surface scoring. Validation pending.
- **Better Search Trigger (BST)** — surface-classification-driven recovery suggestion with session-level title dedup preventing loops. Self-suggestion suppression added (v0.9.7): BST will not render if suggested title equals current query. Weak-job sidecard click no longer overrides page-level BST suppression on aligned surfaces with strong matches. Premature refresh-time evaluation fix shipped (`initialSurfaceResolved` gate, issue #72). **Post-fix validation — PASS (2026-03-20):** BST surface simulation validated 62/62 scenarios across baseline (signal_off) and signal-injected (signal_on +0.3 offset) modes. Scenarios validated: weak surface → bst, healthy surface → healthy, scroll stability (no oscillation after cache-pruning removal), neutral zone → forced bst at 10+, adjacent-terms pre-population on bst/healthy surfaces, no phantom suggestion consumption, single-high-score rule, restored-cache exclusion, deep scroll stability (25+ jobs × 5 scroll events), surface transition isolation. Extension v0.9.21 ZIP built (72K). 162/162 unit tests pass (4 relevant suites). 2 pre-existing failures in signal_classification.test.ts (abstraction drift — unrelated). **BST is validated for beta.**
- **Pipeline Trigger >=7** — action thresholds lowered from 8.0 to 7.0 for pipeline/tailor actions. **Manual add-to-pipeline write regression** (issue #75): empty company from DOM extraction failure caused silent API 400. Fixed — both manual and auto-add paths re-extract DOM meta at action time with sentinel fallbacks; `background.js` now forwards error details. **Pipeline solid gate — PASS (2026-03-21):** End-to-end validation (`analysis/pipeline_gate_validation.js`) exercised 111 assertions across 12 scenarios: canonical URL dedupe (LinkedIn job ID extraction + query stripping), save reliability (sentinel fallbacks, field limits, required-field validation), dedupe prevention on create (session isolation, duplicate detection), 4-column board model validation (all 10 stages map correctly), stage movement persistence, async callback safety (generation guards on CHECK/SAVE/auto-save), session→user migration chain (dedupe on merge, session recovery), pipeline row state machine (hidden/add/in-pipeline/auto-added), highlight + navigation (extension→board). Two defects found and fixed: (1) IDOR on PATCH — added ownership verification for authenticated users. (2) Auto-save telemetry missing `trigger: "auto_8.5"` — added. One noted-for-post-beta: no DB-level uniqueness constraint on (sessionId/userId, jobUrl). 179/181 unit tests pass. Extension v0.9.21 ZIP rebuilt. **Pipeline is validated for beta.**
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
> Full implementation changelog: `milestones.md` IMPLEMENTATION LOG. This section carries compact summaries of recent changes only.
> Invariants and layout rules are defined in `kernel.md` and `LAYOUT_SYSTEM.md` — not here.

- **`/jobs` Ready List Improvements (2026-03-29, WEB_APP):** Sort (Recent | Best Score), platform filter pills (All | LinkedIn | Indeed), tier filter (All | Strong only ≥7.0), stats bar (X scored · Y strong), richer cards with `workModeCompat` badge + first `supportsFit` bullet for strong matches, no-results state, improved empty/first-use state. `/api/jobs/known` now returns `workModeCompat`, `hrcReason`, `supportsFit[0..1]` from existing `ScorePayload`. Pure sort/filter helpers added to `lib/job_cache_store.ts` with 25 unit tests. No new ingestion, no new DB queries. Files: `app/jobs/page.tsx`, `app/api/jobs/known/route.ts`, `lib/job_cache_store.ts`, `lib/job_cache_store.test.ts`.
- **Product Truth Reset — Sidecard Primary, Overlays/Backfill Reactive (2026-03-29, DOCS_ONLY):** Extension working model confirmed through v0.9.38–v0.9.45 testing. Sidecard is the primary interaction surface. LinkedIn and Indeed both support reactive/backfilled overlays after a trusted sidecard score exists. Unsafe DOM-wide prescan suppressed in v0.9.42 (card DOM contains no JD — prescan scores structurally inflated). Future zero-click broad overlay requires backend job inventory + score cache, not DOM probing. Canonical docs updated — see BREAK_AND_UPDATE.md 2026-03-29. Issue #117 added, issue #115 resolved.
- **Backend Canonical Job Record + Score Cache (2026-03-29, WEB_APP):** First-ingestion data layer for durable job inventory. `CanonicalJob` + `JobScoreCache` Prisma models; `lib/job_cache_store.ts` with canonical key dedup (LinkedIn ID / Indeed jk / url:normalized); fire-and-forget writes wired in `/api/extension/fit` (sidecard_full) and `/api/pipeline` (pipeline_save); GET lookup at `/api/jobs/cache`; extension threads sourceUrl/title/company to fit API. Payload quality guard: sidecard_full > pipeline_save. Trusted write path only — prescan must not write to cache (KERNEL.md invariant). 15/15 tests passing. Files: `prisma/schema.prisma`, `lib/job_cache_store.ts`, `lib/job_cache_store.test.ts`, `app/api/extension/fit/route.ts`, `app/api/pipeline/route.ts`, `app/api/jobs/cache/route.ts`, `extension/background.js`, `extension/content_linkedin.js`, `extension/content_indeed.js`.
- **LinkedIn Card Badge Href-Backfill (2026-03-29, `main` only):** Second pass added to `scanAndBadgeVisibleCards()`. After the main DOM→cache loop, iterates all `badgeScoreCache["job-{id}"]` entries not yet stamped in DOM (`findCardById` returns null). For each, queries `a[href*="/jobs/view/{numericId}"]` and walks up ≤8 ancestor levels to find the card container — same logic as `backfillBadgeFromSidecard`. On match: stamps element + calls `setBadgeOnCard(el, "scored", score)`. Covers cards whose `data-occludable-job-id` and inner `<a href>` are not yet populated at scan time (LinkedIn virtual-scroll lazy hydration), causing `cardJobId` to fall back to a text hash that misses the trusted cache key. No new API calls. Issue #116. File: `extension/content_linkedin.js`.
- **Recalibrate Button Regression Fix (2026-03-27, commit `5a1d9bf`):** Auth redirect guard bypass. `useEffect` at line ~259 redirects authenticated users to `/pipeline` unless `?direct=1` is present. Prior Restart/Recalibrate buttons called `setStep("LANDING") + window.history.replaceState` — kept URL at `/calibration` (no param), causing auth redirect to `/pipeline` on next render. Fix: both buttons now call `router.replace("/calibration?direct=1")`. Issue #111. File: `app/calibration/page.tsx`.
- **Bottom Line → Executive Summary Reframe (2026-03-27, commit `4e6fb71`):** `generateWorkRealitySummary(wm: WorkModeResult)` added to `lib/work_mode.ts` — produces a 1–2 sentence work-reality summary by roleType/jobMode/compatibility/executionEvidence. Replaces prior fit-arithmetic recap. Extension sidecard label renamed "Executive Summary"; 350ms fade-in. Extension v0.9.31 → v0.9.32. Files: `lib/work_mode.ts`, `app/api/extension/fit/route.ts`, `extension/content_linkedin.js`, `extension/manifest.json`.
- **specialist_craft Guardrail (2026-03-27, commit `ad8ec41`):** New `ExecutionEvidenceCategory` = `specialist_craft` added to scoring pipeline with cap 5.5. Three specialist domains: motion control, healthcare integration, construction estimating. 7 regression tests added. Cuts score inflation on specialist execution roles where the profile has no hands-on craft evidence. File: `lib/work_mode.ts`.
- **Sidecard Jitter/Scroll Stabilization — Two-Layer Guard (2026-03-27, commits `adc45e7` + `b9e527f`):** Layer 1: `sidecardResultCache` eliminates skeleton flash on sidecard reopen. Layer 2: `currentJobIdFromUrl()` parses both `/jobs/view/{id}` and `?currentJobId=` URL formats; `detailObserver` early-exits when cached complete result is showing. File: `extension/content_linkedin.js`.
- **PDF/DOCX Export Readiness Cluster (2026-03-27, commits `facddfd`–`49df0f8`):** 9 commits reworking the full PDF export pipeline. Entry detection fixed, role/date hierarchy corrected, summary normal-weight hardened, project/item titles bold, split-line merging fixed, tailoredText persisted to DB, TailorPanel download generates PDF. Back-to-Caliber navigation fixed (both sign-in and signed-out paths). Files: `app/components/TailorPanel.tsx`, `lib/tailor_store.ts`, `app/pipeline/page.tsx`, `app/calibration/page.tsx`.
- **Scoring Guardrail Expansion — Domain Overclaim + Title-Shape (2026-03-27, commits `59ecd39` + `69b9ca7`):** Headline/summary restrained from claiming domain expertise absent from the profile. Title-shape overfitting guardrail prevents calibration headlines from mirroring job-posting title shapes. Snaplii fintech + Design Technology Manager fixtures added. Files: `lib/tailor_store.ts`, `app/api/tailor/generate/route.ts`.
- **Tailor Cross-User Resume Contamination Fix (2026-03-26, commit `892a45a`):** High-severity tailor integrity bug fixed. Observed failure: on a Jen tailor run, the generated tailored resume used Fabio Bellini's resume content (name, cybersecurity background, certifications). This was a source-binding bug, not model hallucination. Two root-cause paths: (A) Extension stale `caliberSessionId` — if `CALIBER_SESSION_HANDOFF` was missed on recalibration, the extension continued using the prior session's ID for pipeline saves and tailor prep writes, causing `storeGet(staleId)` to load the wrong resume. (B) Web-created pipeline entries silently dropped `sessionId` in DB persistence (`pipelineCreate` did not include it in the Prisma create call), triggering stale `getLinkedCaliberSession` fallback in the tailor route. Fix: tailor POST now reads the `caliber_sessionId` **cookie** (set by the calibration page, not modifiable by extension) as the primary resume-session source — `resumeSessionId = cookieSessionId || resolvedSessionId || null`. Web POST now threads sessionId through. `pipelineCreate` now persists sessionId. 10 contamination tests added. **Any tailor output generated before this fix must not be treated as a valid quality baseline. Post-fix runs are the only valid baseline for tailor validation.** Issue #110 resolved.
- **Extension Calibration-Context Freshness Fix (2026-03-25, commit `da6e5ec`):** High-severity trust bug fixed. In-memory `lastKnownCalibrationTitle` / `lastKnownNearbyRoles` in `content_linkedin.js` were guarded by `length === 0` / `!lastKnownCalibrationTitle` checks that permanently blocked refreshes once populated. Three fixes: (1) scoring batch nearbyRoles guard removed; (2) session discover hydration guards removed; (3) `CALIBER_SESSION_READY` handler now re-reads `chrome.storage.local` immediately. Extension-side adjacent-search trust is restored. **API truth was correct throughout — stale state was client-side only.** Surface experiments run in open tabs with a prior calibration context are suspect; post-fix runs are the valid baseline. Issue #109 resolved.
- **Execution-Evidence Guardrail + HRC Gap Line (v0.9.29+, 2026-03-24):** 7th guardrail layer added to scoring pipeline. `detectExecutionEvidenceGap()` identifies domain-locked ecosystems (7 ecosystems: Salesforce, SAP, Oracle, ServiceNow, Workday, NetSuite, Dynamics 365) and stack-execution roles (31 patterns) where the candidate's resume lacks hands-on evidence. Score capped at 7.0 when triggered (`EXECUTION_EVIDENCE_CAP`). Two new job fixtures added: SALESFORCE_CPQ_ARCHITECT_JOB (domain-locked), SENIOR_PYTHON_DEVELOPER_JOB (stack-execution). 9 regression tests + 12 fixture tests added (+22 total). API route surfaces `execution_evidence_gap` in HRC payload. Extension sidecard renders one-line italic red gap reason (`cb-hrc-gap` element) in Hiring Reality Check section. DOCX export route fixed: `Buffer` → `Uint8Array` for TS BodyInit compatibility (Vercel build fix). 200/202 tests pass. Extension v0.9.29. Files: `lib/work_mode.ts`, `lib/__fixtures__/work_mode_fixtures.ts`, `lib/work_mode_regression.test.ts`, `lib/execution_evidence_gap.test.ts`, `app/api/extension/fit/route.ts`, `extension/content_linkedin.js`, `app/api/tailor/export-docx/route.ts`.
- **System Stabilization + UX Polish + Auth Hardening (v0.9.27, 2026-03-23):** BREAK+UPDATE. Product shift from feature iteration → system stabilization. Core product loop confirmed functional: Calibrate → Discover (LinkedIn) → Evaluate (extension) → Save → Saved Jobs → Continue. Changes: (1) Auth persistence fixed — DB-backed jobText, Tailor fallback chain (file→DB), session persists across refresh/tab. (2) Header system locked — CALIBER header ONLY on landing + Saved Jobs; removed from all calibration flow steps (immersive flow doctrine). (3) Layout centering restored globally via flex. (4) Chip system simplified 3-tier→2-tier (preferred/avoided; primary selection removed). (5) 3-layer depth model (background→green halo→card surface) on chips card + title hero card. (6) Chip category subheading increased to text-lg (18px). (7) Resume ingest dropzone green-tinted border. (8) Calibration UX: typewriter jitter fix via submitLockRef+promptTransitioning, 2-bullet allowance, input contrast strengthened. (9) Saved Jobs: CALIBER as primary header, no separate title, "pipeline"→"saved jobs" everywhere. (10) Extension: sidecard result cache eliminates flicker on reopen, accordion padding normalized, score animation dedup. (11) Sign-in: directBetaSignIn() bypasses buggy signIn(), stale error params cleared. (12) Scoring stable — no drift, deterministic. (13) Tailor guardrails: blocked quota claims, SaaS claims, engineering language for weak matches. (14) Prompt input dock — PROMPT step textarea anchored to viewport bottom (fixed-position, gradient fade), submit button removed (Enter-to-submit, Shift+Enter for newlines), green accent border for visual consistency. Known non-blocking: minor contrast tuning, empty state polish, score band label verification. Issues #96–#104. Files: `app/calibration/page.tsx`, `app/pipeline/page.tsx`, `app/signin/page.tsx`, `app/components/pipeline_confirmation_banner.tsx`, `app/tailor/page.tsx`, `extension/content_linkedin.js`, `lib/auth.ts`, `app/api/pipeline/route.ts`, `app/api/pipeline/tailor/route.ts`, `prisma/schema.prisma`.
- **Calibration-to-Extension Terminology Alignment (2026-03-23):** Unified all user-facing "pipeline" references to "saved jobs" across web app surfaces for continuity with extension language ("Save this job" / "View saved jobs →"). Changes: pipeline page heading → "Saved Jobs", confirmation banner → "Job saved" / "View saved jobs", sign-in page → "Save your scored jobs", tailor nav → "View saved jobs →", remove tooltip → "Remove", calibration error → "Analysis did not reach results". URL routes unchanged (`/pipeline`). No feature changes — copy alignment only. Issue #100. Files: `app/pipeline/page.tsx`, `app/components/pipeline_confirmation_banner.tsx`, `app/tailor/page.tsx`, `app/signin/page.tsx`, `app/calibration/page.tsx`.
- **Sidecard Accordion Section Consistency (2026-03-23):** Pure visual consistency pass across all 5 collapsible sidecard sections (HRC, Supports, Stretch, Bottom Line, Adjacent Searches). Normalized inner body padding to `1px 0 3px` uniformly — Adjacent body was `2px 0 5px`, bullets were `padding-bottom: 2px`, Adjacent empty-state was `2px 0`. Simplified Adjacent toggle HTML by removing superfluous `<span class="cb-adjacent-label">` wrapper (replaced with plain `<span>` matching other sections). Removed unused `.cb-adjacent-label` CSS rule. Added `transition: padding 0.2s ease-out` on Adjacent body for smooth expand. Hover states verified consistent across all color variants (green, yellow, red, blue, default grey). No content or scoring changes. Issue #99. File: `extension/content_linkedin.js`.
- **Score Label Stability — Sidecard Flicker Fix (2026-03-23):** Eliminated skeleton flash on sidecard reopen for previously scored jobs. Three flicker vectors fixed: (1) New `sidecardResultCache` stores full API response by job ID — on cache hit, `showResults()` called immediately instead of `showSkeleton()`, API still runs in background. (2) `showResults()` animation dedup — `cb-score-reveal` only plays when `sidecardDisplayedScore !== displayScore`, preventing visual pop on cache restore or identical re-score. (3) Text-dedup early return now restores cached results instead of leaving orphaned skeleton. Cache cleared on surface change. No scoring algorithm changes. Issue #98. File: `extension/content_linkedin.js`.
- **Sign-in Provider Resolution Fix (2026-03-23):** Final beta blocker — intermittent "Sign-in service is starting up" error. Root cause: `next-auth/react@5.0.0-beta.30`'s `signIn()` calls `getProviders()` internally; when that returns null (cold start, transient failure), it redirects to the error page ignoring `redirect: false` (acknowledged TODO in source). Fix: (1) New `directBetaSignIn()` bypasses `signIn()` entirely — POSTs directly to `/api/auth/callback/beta-email` with `X-Auth-Return-Redirect: 1` header, safe JSON parsing, typed return `{ ok, url?, error? }`. (2) Stale `?error=` URL params cleared on mount via `window.history.replaceState()`. (3) "Configuration" error message improved from "starting up" → "Unable to connect. Please try again." Issue #97. File: `app/signin/page.tsx`.
- **Chips Page Interaction Clarity (2026-03-22):** UX simplification from live PM validation. Three issues fixed: (1) Plus/minus controls had weak contrast — buttons enlarged to 32×32px bold, unselected color/border/background opacity increased across all states for outdoor screen readability. (2) "Most prominent chip" (3-tier primary/preferred/avoided model) removed — simplified to 2-tier: positive (preferred) and negative (avoided). Click chip body or + = preferred, − = avoided. Submit sends preferredModes + avoidedModes only. (3) Chip options now hidden until typewriter heading completes — gated on `chipHeadingDone` with 0.5s fade-in transition. No scoring logic changes. Issue #96. File: `app/calibration/page.tsx`.
- **Auth Server Error Fix + Beta-Email Hardening (2026-03-21):** Sign-in redirected to NextAuth generic error page ("Server error — There is a problem with the server configuration") instead of completing. Root cause: (a) `authorize()` had no try/catch — Prisma/DB failures threw unhandled exceptions interpreted by NextAuth v5 as "Configuration" errors. (b) No `pages.error` defined — errors went to built-in NextAuth error page. (c) No env validation. Fix: (a) Wrapped `authorize()` in try/catch — DB failures return null (CredentialsSignin) instead of throwing. (b) Added `pages.error: "/signin"` — all auth errors redirect to sign-in page with error param. (c) Sign-in page maps error codes to user-friendly messages (Configuration → "service starting up", CredentialsSignin → "check email", AccessDenied → "not authorized"). (d) ENV validation logging at auth init. (e) Structured logger for auth errors/warnings. (f) Client-side logging: signIn request start, result, redirect target. Validation: 5/5 E2E (providers, successful sign-in + session cookie, invalid email → controlled error, error page redirect, returning user). Regression: 179/181 unit tests. Issue #53. Files: `lib/auth.ts`, `app/signin/page.tsx`.
- **Auth Provider Fallback + Tailor Context Persistence (v0.9.26, 2026-03-21):** Two live validation failures fixed: (1) Sign-in returned "temporarily unavailable" when `getProviders()` returned null/empty — since `beta-email` is unconditionally configured server-side, the sign-in page now: catches `getProviders()` failure and falls back to synthetic beta-email entry, and defaults `hasBetaEmail=true` when providers loaded but Nodemailer absent. (2) Tailor flow showed "No job context available" for pipeline-saved jobs — extension pipeline save only sent metadata (title, company, url, score), not job description text, so no TailorPrep file existed for those entries. Fixed: extension `content_linkedin.js` now includes `extractJobText()` (sliced 15KB) in CALIBER_PIPELINE_SAVE messages (both manual and auto paths), `background.js` forwards jobText in POST body, pipeline POST handler creates TailorPrep alongside PipelineEntry when jobText is present (>50 chars). Extension bumped to v0.9.26. Issues #51, #52. Files: `app/signin/page.tsx`, `extension/content_linkedin.js`, `extension/background.js`, `app/api/pipeline/route.ts`.
- **Sign-in Completion Fix + Tailor Pipeline-Entry Resolution (v0.9.25, 2026-03-21):** Two top beta blockers fixed: (1) Sign-in page hung on "Signing in\u2026" when `signIn()` threw (network error, DB error) — no try/catch meant `setSending(false)` never executed. Fixed: wrapped both Nodemailer and beta-email paths in try/catch with finally-style recovery, added `authError` state for inline error display, added no-provider fallback error. (2) Tailor panel showed "Pipeline entry not found" for valid visible cards — `resolveEntry()` only checked DB when authenticated (`if (userId)`), so unauthenticated users with session-based DB entries always fell through to legacy file store. Fixed: DB lookup now runs unconditionally for all users. Also fixed: PATCH ownership check rejected entries with null userId (pre-migration session entries) — changed strict equality to allow null-userId entries to pass. Debug logging added throughout: auth authorize callback, sign-in page, pipeline GET/PATCH, tailor resolveEntry, pipeline page client-side. Validation: 28/28 (`analysis/signin_pipeline_tailor_validation.js`). Regression: sidecard 52/52, pipeline 111/111, BST 62/62, adjacent 36/36, recovery 85/85, unit 179/181 (2 pre-existing). Files: `app/signin/page.tsx`, `app/api/pipeline/tailor/route.ts`, `app/api/pipeline/route.ts`, `lib/auth.ts`, `app/pipeline/page.tsx`.
- **Manual Pipeline Save + Adjacent Searches In-Stack (v0.9.23, 2026-03-21):** Two PM-identified UX issues fixed: (1) Pipeline save was gated behind score ≥7.0 — removed threshold, now available for all scored jobs as "Save to pipeline" (auto-save still at 8.5+). (2) Adjacent Searches was hidden behind a cryptic blue-dot badge in the header — moved into sidecard content stack as a permanent collapsible section after Bottom Line. New sidecard order: HRC → Supports → Stretch → Bottom Line → Save to Pipeline → Adjacent Searches → Feedback. BST badge removed from header. Weak-surface attention now uses `cb-adjacent-attention` class (border glow animation) on the section itself instead of header badge pulse. `adjacentUserOpened` tracked via section toggle click (not badge). Surface change clears adjacent body content instead of hiding section. Adjacent interaction validation updated (36/36). All regression suites pass: BST 62/62, sidecard 52/52, pipeline 111/111, adjacent 36/36, recovery 85/85, magic-link 114/114, unit 179/181. File: `extension/content_linkedin.js`.
- **Magic-Link Sign-In & Durable Memory E2E Validation — PASS (2026-03-21):** End-to-end validation of magic-link auth and durable memory. `analysis/magic_link_e2e_validation.js` — 114/114 assertions across 16 areas + 5 scenario simulations: sign-in flow (12 — email-only, no Google, Nodemailer conditional, beta-email unconditional, JWT 30-day, PrismaAdapter), sign-in UI (10 — no Google button/divider/OAuth errors, email form, magic-link + beta-email paths, confirmation screen), session provider (3), Prisma schema auth models (9), session→user migration (9 — linkCaliberSession, getLinkedCaliberSession, both migrations, sessionId preservation, dedupe, duplicate deletion, unowned-only filter), duplicate prevention (6 — DB/session/file create-dedupe, URL normalization), pipeline API auth routing (8 — auth check, migration triggers, linkage, cookie restoration, session fallback, PATCH ownership), tailor continuity (10 — userId in interfaces, resolveEntry sessionId fallback, getLinkedCaliberSession import, POST userId passthrough), persistence across restart (7 — Postgres storage, JWT stateless, 30-day lifetime, caliberSessionId recovery, cookie restoration), logout data integrity (3 — no delete-on-signout), re-sign-in state restoration (4 — userId-based listing, email uniqueness, same User on re-auth), invalid/expired auth paths (5 — email validation, error display, trustHost), pipeline CTA (4 — non-blocking, callbackUrl, persistence copy), telemetry/feedback binding (3), extension session handoff (4), tailor storage integrity (5). Scenario simulations: Anonymous→SignIn migration, TailorContinuity with sessionId preservation + fallback, DupePrevention on migration, FreshDevice same-email, Logout+Relogin state restoration. **No defects found.** Files unchanged — validation only.
- **Magic-Link Sign-In Hardening (2026-03-22):** Product decision locked: magic-link / email-only auth, no passwords, no social auth, no profile UI. Changes: (1) Removed Google OAuth provider from `lib/auth.ts` — only Nodemailer magic-link + beta-email credentials remain. (2) Simplified `app/signin/page.tsx` — removed Google button, OAuth divider, and OAuthAccountNotLinked error case. Email-first flow: Nodemailer magic-link when SMTP configured, beta-email instant auth as fallback. (3) Fixed `migrateFileEntriesToUser()` in `lib/pipeline_store_db.ts` — now preserves `sessionId` on migrated entries (was dropped, breaking tailor prep lookups for migrated users). (4) Added optional `userId` to `TailorPrep` and `TailorResult` interfaces in `lib/tailor_store.ts` — forward-compatible, passed through on generate. (5) Upgraded `app/api/pipeline/tailor/route.ts` — `resolveEntry()` now returns resolved `sessionId` with fallback to user's linked `caliberSessionId` when entry sessionId is missing; eliminated duplicate sessionId extraction; `tailorResultSave` now includes userId when authenticated. Pipeline sign-in CTA for anonymous users already existed. Validation: `tsc --noEmit` clean, Next.js build clean, 179/181 tests pass (2 pre-existing). Files: `lib/auth.ts`, `app/signin/page.tsx`, `lib/pipeline_store_db.ts`, `lib/tailor_store.ts`, `app/api/pipeline/tailor/route.ts`.
- **Recovery Term Strengthening (2026-03-21):** Adjacent Searches now use work-mode-aware, cluster-diverse recovery terms from full 25-title pool via `generateRecoveryTerms()` in `lib/title_scoring.ts`. Work-mode compatibility bonuses (+1.5/+0.5/-2.0), quality-aware cluster diversity (relaxes 1-per-cluster when score gap >5.0), thin-profile support (1.5/2.0 floors). API returns `recovery_terms` + `debug_recovery_terms`. Extension prefers recovery terms over calibration title + nearbyRoles (fallback preserved). Validation: 85/85 recovery assertions, BST 62/62, sidecard 52/52, adjacent 36/36, unit 179/181. Files: `lib/title_scoring.ts`, `app/api/extension/fit/route.ts`, `extension/background.js`, `extension/content_linkedin.js`.
- **Adjacent Searches Interaction Model Lock (2026-03-21):** Calm-default UX fix. Two PM-observed misses addressed: (1) Only 1 suggestion showing — `nearbyRoles` plain-string entries caused silent sanitizeFail; fixed with dual-shape handling + `ADJACENT_TARGET_COUNT=3`. (2) Section auto-expanding on BST triggers — added `adjacentUserOpened` session flag, permanently suppresses pulse after badge click. Section always collapsed by default, pulse/glow only for attention — never auto-expand. Debug logging emits filter breakdown when < 3 terms. Validation: 36/36 assertions + 8 simulations. Regression: BST 62/62, sidecard 52/52, unit 179/181. Issues #82, #90. File: `extension/content_linkedin.js`.
- **Sign-in / Memory Gate Validation (beta gate 4, 2026-03-21):** Auth system audit + targeted fixes. Infrastructure was ~85% complete — NextAuth v5 (3 providers: Google OAuth, Nodemailer magic-link, beta email-only credentials), sign-in UI, SessionProvider, pipeline dual-mode storage with session→user migration all previously implemented. Two gaps identified and fixed: (1) TelemetryEvent and FeedbackEvent Prisma models missing `userId` field — added `userId String?` with `@@index([userId])` to both models, pushed schema to Neon. (2) `/api/events` and `/api/feedback` POST handlers didn't resolve or persist userId — added `resolveUserId()` function to both routes using two-step resolution: `auth()` for web requests, then `caliberSessionId→User` lookup for extension requests. Updated `TelemetryEvent` and `FeedbackEvent` TypeScript interfaces and `appendTelemetryEvent()`/`appendFeedbackEvent()` functions to include userId. Validation: `analysis/auth_gate_validation.js` — 67/67 assertions across 16 areas: auth config (12), sign-in UI (5), session provider (3), schema auth models (5), pipeline dual-mode (4), telemetry userId (4), feedback userId (3), telemetry store binding (2), feedback store binding (2), events API route (5), feedback API route (6), pipeline migration (4), pipeline API auth-awareness (5), pipeline page (2), extension session chain (4), environment (1). 179/181 unit tests pass (2 pre-existing abstraction drift — unrelated). `tsc --noEmit` clean. **Sign-in/memory beta gate: CLOSED.** Files: `prisma/schema.prisma`, `lib/telemetry_store.ts`, `lib/feedback_store.ts`, `app/api/events/route.ts`, `app/api/feedback/route.ts`, `analysis/auth_gate_validation.js`.
- **Pipeline Solid Gate Validation (v0.9.21, 2026-03-21):** End-to-end pipeline validation passed 111/111 assertions across 12 scenarios. Validated: save reliability (manual + auto-save with sentinel fallbacks), canonical URL dedupe (LinkedIn job ID normalization), session→user migration (dedupe on merge), 4-column board model (Resume Prep → Submitted → Interview Prep → Interview), drag-and-drop stage persistence, async callback generation guards, pipeline row state machine, highlight navigation from extension. Two defects found and fixed: (1) PATCH endpoint IDOR — added ownership verification (`dbPipelineGet(id)` → verify `userId` matches) for authenticated requests. (2) Auto-save telemetry missing `trigger: "auto_8.5"` field — added. One noted for post-beta: no DB-level uniqueness constraint on (sessionId/userId, jobUrl) — app-level dedupe sufficient for beta. Files: `app/api/pipeline/route.ts`, `extension/content_linkedin.js`, `analysis/pipeline_gate_validation.js`.
- **Sidecard Layout Stabilization (v0.9.21, 2026-03-20):** Collapsed sidecard height is now identical across all score states (low, mid, high/8.5+ CTA). Three layout instability sources fixed: (1) High-confidence label ("High-confidence match" for 8.5+) repositioned from block element to absolute-positioned within toprow's reserved padding — never affects container height regardless of display state. (2) Pipeline row (7.0+ "Add to pipeline") now uses `visibility:hidden` with `min-height:24px` instead of `display:none` when inactive — always occupies the same layout slot. (3) Skeleton state no longer hides collapsible section toggles — HRC, Supports, Stretch, Bottom Line toggle buttons remain visible during loading with cleared content, eliminating the skeleton→results reflow jump. User's expand/collapse state is preserved across job switches. File: `extension/content_linkedin.js`. **Post-fix validation — PASS (2026-03-20):** Sidecard stability simulation (`analysis/sidecard_stability_validation.js`) exercised 52 assertions across 10 scenarios: collapsed height consistency across 7 score bands (309px uniform), high-conf absolute positioning (zero height contribution), pipeline row visibility slot preservation, skeleton→results zero-reflow transition, expand/collapse state persistence across job switches, rapid 20-job switching with zero height delta, CSS structural invariants, skeleton content clearing (no ghost content), adjacent section default hiding, full flow simulation (skeleton→low→skeleton→high→skeleton→mid with 0px delta at every phase). 62/62 BST validation pass (no regression). 179/181 unit tests pass (2 pre-existing in signal_classification — unrelated). Extension v0.9.21 ZIP rebuilt (72K). **Sidecard layout is validated for beta.**
- **Chip-Enabled Fixture Regression Matrix — PASS (2026-03-20):** Full regression validation across 4 canonical fixtures × 5 job families × 3 chip configs. 39 test assertions pass; 300 determinism repetitions identical. Chip suppression enforces hard caps (sales ≤3.5, ops ≤4.0) when avoidedModes set. Role-type classification (SYSTEM_BUILDER/SYSTEM_OPERATOR/SYSTEM_SELLER) feeds implicit mismatch penalties. Chris anchor preserved (9.9 on builder job). Notable findings: Dingus and Jen both classify as operational_execution (not null) — fixture contracts updated to document this. Files: `lib/work_mode_regression.test.ts` (new, 39 tests), `lib/__fixtures__/work_mode_fixtures.ts` (comments), `Bootstrap/milestones.md`, `Bootstrap/CALIBER_ACTIVE_STATE.md`.
- **Chip-Based Suppression + Role-Type Separation (2026-03-20):** Chip avoidedModes from workPreferences now flow through evaluateWorkMode pipeline. Three-layer suppression: (1) role-type mismatch penalty (implicit), (2) chip-based hard cap (explicit avoidedModes), (3) tightened builder triggers (removed generic words like "workflow", "platform", "implementation"). New types: RoleType, ChipSuppressionResult, WorkPreferencesInput. New functions: classifyRoleType(), applyChipSuppression(), getRoleTypePenalty(). 68 work_mode tests pass. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`.
- **Weighted Scoring Adjustments + Execution Intensity Layer (2026-03-19):** BREAK+UPDATE. Cap-based work-mode governance (hard cap 6.5, soft cap 8.5) replaced with proportional weighted adjustments. Score now reflects lived-fit reality including daily-work factors. (1) Work mode mismatch produces additive negative adjustments: compatible=0, adjacent=-0.8, conflicting=-2.5. (2) New execution-intensity detection layer scans job text for grind indicators (outbound calls, quota/commission pressure, door-to-door, rejection-heavy environments, high-volume execution). Intensity tiers: mild=-0.5, heavy=-1.5, extreme=-2.5. (3) When both layers fire (conflicting + intense), intensity is dampened 50% to avoid double-counting. (4) Target score semantics re-centered: 9=ecstatic, 8=great, 7=good/worth doing, 5-and-below=avoid, 3-4=actively wrong. (5) Property Max house-buying-specialist style grind jobs now land in actively-wrong zone (3-5) for misaligned profiles. (6) API debug output exposes full scoring composition: preAdjustmentScore, workModeAdjustment, executionIntensityAdjustment, finalScore, intensity triggers. 41 tests passing. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`.
- **Dominant Work Mode + Adjacent Compression + Pipeline Fix + DOM Hardening (v0.9.21, 2026-03-19):** BREAK+UPDATE. (1) Post-scoring classification layer: 5 work modes, weighted lexical triggers, 5×5 compatibility map. Conflicting modes hard-capped at 6.5; adjacent modes soft-capped at 8.5 (mild compression). Both require confidence ≥ low on both sides. 30 regression tests. (2) Pipeline save regression fix: generation guards added to CALIBER_PIPELINE_CHECK and auto-save callbacks, preventing stale cross-job pipeline state. Full diagnostic logging with source tracing and state transitions. (3) LinkedIn DOM extraction hardening: `cleanCardText()` replaces duplicated title text in card innerText before scoring, preventing keyword inflation. Issues #83, #83b, #83c. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`, `extension/content_linkedin.js`.
- **Adjacent Search Terms module replaces BST popup (v0.9.20, 2026-03-19; interaction model locked 2026-03-21):** BREAK+UPDATE. BST popup banner (`showPrescanBSTBanner`) disabled — returns early as no-op. Replaced by persistent collapsible "Adjacent Searches" section inside sidecard (between Bottom Line and pipeline row). Terms sourced from calibration title + nearby_roles. Chip-styled links navigate to LinkedIn search. Pulse/glow triggers only after ≥20 scored jobs + "bst" surface classification. BST evaluation engine preserved for surface intelligence. Functions added: `getAdjacentSearchTerms()`, `updateAdjacentTermsModule()`, `updateAdjacentTermsPulse()`. **Interaction model (2026-03-21):** Exactly 3 suggestions (`ADJACENT_TARGET_COUNT=3`). Collapsed by default — never auto-expand. Pulse/glow only for attention. `adjacentUserOpened` session flag permanently suppresses pulse after badge click. Handles both object and plain-string `nearbyRoles`. Debug logging with filter breakdown when < 3 terms. Validation: 36/36 assertions + 8 simulations. Issue #82, #90. Files: `extension/content_linkedin.js`.
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

## Scoring Pipeline — Current Guardrail Stack
The scoring pipeline (`evaluateWorkMode()` in `lib/work_mode.ts`) applies **8 layered guardrails** after raw alignment scoring:
1. **Work mode adjustment** — additive penalties: compatible=0, adjacent=-0.8, conflicting=-2.5
2. **Execution intensity** — grind-signal detection: mild=-0.5, heavy=-1.5, extreme=-2.5
3. **Dampening** — intensity at 50% when already conflicting
4. **Role-type penalty** — SYSTEM_BUILDER/SYSTEM_OPERATOR/SYSTEM_SELLER classification
5. **Chip suppression** — hard caps from user avoidedModes (sales ≤3.5, ops ≤4.0)
6. **Execution evidence guardrail** — detects domain-locked ecosystems (Salesforce, SAP, Oracle, ServiceNow, Workday, NetSuite, Dynamics 365) and stack-execution roles (31 patterns) where resume lacks hands-on evidence; cap at 7.0 when triggered
7. **HRC gap line** — `execution_evidence_gap` surfaced in Hiring Reality Check section of extension sidecard as a one-line italic red reason (e.g., "This role requires hands-on Salesforce ecosystem experience.")
8. **Specialist craft cap** — `specialist_craft` ExecutionEvidenceCategory detects roles requiring deep specialist execution (motion control, healthcare integration, construction estimating) where the profile has no hands-on craft evidence; hard cap at 5.5 (`SPECIALIST_CRAFT_CAP`)

Tests: 200+ total (2 pre-existing signal_classification failures).

## Top Blocker
**Pipeline CTA threshold criterion — PM clarification needed.** All 5 beta gates are now closed. Gate 5 (tailor resume) closed 2026-03-24 via `analysis/tailor_e2e_validation.js` 59/59 PASS. Completion criteria sweep: 5/6 PASS. One item awaits PM decision: the "Pipeline trigger fires at score >= 7.0" criterion. v0.9.23 (PM decision) removed the >= 7.0 gate — "Save to pipeline" now available for ALL scored jobs. If the criterion means the CTA must be HIDDEN below 7.0 (exclusive gate), the current implementation does not meet it. If it means the CTA is available at >= 7.0 (inclusive, also below), the criterion is met. PM must confirm intended gate semantics before beta can be declared.

**Pending validation (non-blocking):**
- Executive Summary copy quality — `generateWorkRealitySummary()` is shipped; live user testing on varied profiles required to validate that copy is readable and non-redundant with HRC/Supports/Stretch.
- Tailor post-fix quality validation — post-contamination-fix (commit `892a45a`) and tailor-specificity-fix (commit `bee6e83`) together; live STRONG-match tailor run with confirmed single-user calibration needed before declaring tailor output trustworthy for beta.
- PDF export hierarchy — PDF output is application-quality for well-structured inputs; edge cases with unusual section headers or non-standard resume layouts may still produce imperfect hierarchy. Non-blocking for beta but should be validated with real user resumes.

## Product Surface Doctrine
> Canonical rule: `kernel.md` → Surface/Job UI Separation Invariant.

- **Sidecard** = current-job decision surface. **Surface layer** = page/search intelligence. These must not be mixed.
- "Best so far" popup is disabled (v0.9.15). Underlying surface state preserved for future overlay.

## Beta Landing-Page Media Decision
> Canonical rule: `kernel.md` → Beta-Scope Marketing Invariant.

- Pre-beta: lightweight hero (tagline + product preview). Full animated narrative system deferred to post-beta.

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
- Extension v0.9.32 shipped (latest). Includes all prior fixes plus: execution-evidence guardrail HRC gap line rendering, sidecard result cache (no flicker on reopen), two-layer scroll jitter guard (stable cache on scroll + URL format parsing fix), accordion consistency, score animation dedup, Adjacent Searches in-stack, recovery term strengthening, pipeline save for all scores, score-flip fix. "Bottom Line" renamed "Executive Summary" with work-reality copy generator.
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
> Canonical source: `docs/ui-constitution.md`. Layout rules: `Bootstrap/LAYOUT_SYSTEM.md`.

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
> Layout behavioral rules (centering, dock pattern, card depth, transitions): `Bootstrap/LAYOUT_SYSTEM.md`.

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

## Locked Task Order (Beta Gate Focus — updated 2026-03-24)

Beta gates are the priority. Each gate must be validated before declaring beta. Overlay work is non-blocking and may proceed in parallel.

**Beta Gates (must all pass):**
1. **BST working** — **CLOSED** (post-fix simulation 62/62 pass, baseline + signal-injected, v0.9.21 2026-03-20)
2. **Sidecard stable** — **CLOSED** (52/52 assertions, collapsed height identical across all score states, v0.9.21 2026-03-20)
3. **Pipeline solid** — **CLOSED** (111/111 assertions across 12 scenarios, IDOR fix, telemetry trigger fix, v0.9.21 2026-03-21)
4. **Sign-in / memory operational** — **CLOSED** (67/67 assertions, magic-link hardened 114/114, Google OAuth removed, email-only auth, 2026-03-22)
5. **Tailor resume works** — FUNCTIONAL (PDF/DOCX export shipped v0.9.22; copy/download, retry-on-error; needs end-to-end generation validation)

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
1. **Jen surface experiment rerun — BLOCKED** — Rerun was attempted (Jen fixture, signals ON, chips skipped, revised query set: `strategy and operations manager`, `chief of staff operations`, `gtm strategy operations`) and could not be completed. LinkedIn page became unresponsive during dense scoring. Extension stability fix shipped (commit `ce204b1`). **Next action:** verify extension runs cleanly on a dense surface under stable machine conditions, then re-run the experiment.
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

**Post-beta initiative: Strong-Match Feed (SMF) (2026-03-21):**
- Evolve Caliber from evaluation layer into discovery engine. Aggregate job listings from supported sources, score against calibrated profile, surface only jobs above strong-match threshold (>= 7.0, target >= 7.5) in a dedicated feed.
- User experience: "Your Best Matches" feed replaces browse-and-score flow. Users save to pipeline or tailor resume directly from feed. Ranking by highest fit.
- Phased: Phase 1 = manual refresh, limited sources. Phase 2 = continuous aggregation + auto-pipeline seeding.
- Constraints: no below-threshold padding (truthful emptiness > low-quality feed), scoring integrity preserved, cross-source dedup required.
- Dependencies: stable scoring (done), reliable calibration signal (done), pipeline persistence (done), sign-in/memory (done), post-beta metrics baseline (required first).
- Open design questions: source integration mechanism, batch vs per-job scoring, feed staleness policy, ToS compliance.
- Full specification: `Bootstrap/milestones.md` → "Milestone — Strong-Match Feed (SMF)".
- Status: PLANNED. Not active until beta is complete and TTSM baseline is established.

---

## Recently Completed — Tailor Specificity Fix (2026-03-26, bee6e83)

- **Bug 1 resolved:** `prep.score` was never passed to `generateTailoredResume` → `matchBand` always `WEAK` in production → STRONG-path adaptation (headline rewrite, bullet reordering, elevated summary) never fired. Fixed in `app/api/tailor/generate/route.ts`.
- **Bug 2 resolved:** System prompt lacked explicit decomposition mechanics. Model had no instruction to identify JD capability themes, map themes to resume evidence, reorder bullets, or prevent single-project dominance. Fixed in `lib/tailor_store.ts`.
- Chris IEM Product Manager validation fixture added to `analysis/tailor_quality_validation.ts`.
- Anti-fabrication guardrails preserved. All guardrail tests: 29/29 pass.

**Remaining tailor work:** post-fix validation and quality review only. This is not a core specificity bug — it is validation/polish:
- Live user testing on a real STRONG-match job
- Optional decomposition depth tuning
- PDF/DOCX export quality (separate concern)

---

_Last updated: 2026-03-26 (tailor specificity fix shipped; STRONG-path now correctly activates; role decomposition prompt active)_

---

## 2026-03-29 — Canonical Job Cache: Consumer Surfaces Shipped

**Completed this session:**
- Extension cache-first path: `lookupJobCacheForSession` + cache-first guard in `callFitAPI` (prescan excluded, non-fatal fallback)
- `listJobsForSession`, `listJobsForUser`, `buildCachedFitResponse` in `lib/job_cache_store.ts`
- `GET /api/jobs/known` endpoint (session + user-based)
- `/jobs` page: known-jobs landing view (client component, session-bound)
- Pipeline page link to `/jobs`
- 25 tests, TypeScript clean

**Session safety invariant:** Cache hits served only for matching `sessionId`. Cross-session reuse prohibited.

_Last updated: 2026-03-30 (post-cache decision consolidation encoded across session-pack; halo artifact removed from all pages)_
