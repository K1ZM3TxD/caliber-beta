---

Milestone — Post-Beta: Canonical Job Inventory Expansion (ACTIVE)
---
STATUS: ACTIVE — entered 2026-03-29. Beta is live; extension surface is stable; Canonical Job Cache and first ingestion paths are shipped. Next focus: build out the job inventory layer so Caliber can surface scored jobs without requiring user-initiated sidecard clicks.

PROCESS NOTE (2026-03-29): Branch policy now explicit in coder handoff template. All implementation commits land on `main` first; PM validates on preview / `main`; promotion to `stable` is a separate PM-controlled release action. See `Bootstrap/session_pack/PM_BOOTSTRAP.md` § Black-Box Template for Coder Handoff.

PROCESS NOTE (2026-03-30 — Post-Cache Decision Consolidation):
Seven categories of post-cache product/architecture decisions documented across session-pack. Key principles now encoded as durable doctrine:
- **Score speed first:** Score speed is the first priority on the fit path. Cache/telemetry writes must remain detached from the primary fit response. Cosmetic fields must not justify blocking DB reads on the scoring path.
- **Canonical jobs global, fit per-user:** Canonical jobs are global/shared records. Fit judgments are user-specific. Shared job knowledge (JD text, company, metadata) can be reused; user-specific fit scores must not be blindly reused across different users.
- **Job acquisition ≠ job intelligence:** The scoring engine does not depend on how jobs arrive. Source-adapter architecture is the intended backend direction for all future ingestion.
- **Cross-surface platform:** Canonical job inventory makes Caliber cross-surface: extension, web app, and future mobile experiences can consume the same job intelligence layer. Extension is one acquisition/interaction surface, not the only surface.
- **No scraper-first:** Preferred acquisition expansion path is provider-aware, low-risk, user-directed. Safer sources: ATS/public APIs, employer JSON-LD, user imports. Broader inventory is a later sourcing problem.
- **UX: no halo/glow:** Shared radial-gradient green glow artifact removed from all pages. Simpler near-black background preferred. Future intentional redesign may revisit, but conspicuous glow is not the default.
See `Bootstrap/session_pack/KERNEL.md` for durable invariants; `Bootstrap/session_pack/EXECUTION_CONTRACT.md` for scoring-path performance constraints.

ARCHITECTURAL FOUNDATION (settled — do not reopen):
- Sidecard-primary scoring is the confirmed working model. Extension scores jobs from full JDs; overlays/backfill are reactive.
- Canonical Job Cache is the strategic backend substrate. Job records and per-session score caches accumulate as users interact; `textSource` quality guard enforces trusted-write-only invariant.
- Unsafe DOM prescan is not the long-term acquisition path. Card DOM contains only title/company/location — no JD is available. Prescan produces structurally inflated, unreliable scores (7.1 prescan vs 2.6 full-JD on the same job). Suppressed since v0.9.42.
- Job acquisition and job intelligence are separate concerns. The scoring/fit engine does not depend on how jobs arrive into the cache.
- Inventory sources should be pluggable. No source type (sidecard click, user paste, structured feed, partner API) is privileged in the schema. The `textSource` field distinguishes trust levels.
- Scraper-first is not the default acquisition strategy. Scrapers are brittle, legally risky, and produce unreliable JD text. Structured feeds or partner APIs are the intended path for non-user-initiated supply.

NEXT SEQUENCE (in order — do not resequence without PM decision):
1. ✅ Release stabilization + stable promotion — DONE (2026-03-29)
2. ✅ Strengthen /jobs into a more useful ready-list — sort, filter, richer cards — DONE (2026-03-29)
3. ✅ First low-risk ingestion path — user-directed URL + text paste via /api/jobs/ingest — DONE (2026-03-29)
4. Observe real usage — confirm /jobs engagement, measure voluntary ingest rate, identify what job types users submit manually. No architecture decisions before this signal exists.
5. ✅ Source-adapter interface — define a pluggable `JobSourceAdapter` contract (interface + textSource + adapter shape). Enables structured feeds without changing the core cache/score stack. — DONE (2026-03-30)
5b. ✅ Provider-aware URL ingestion — URL-only mode on `/api/jobs/ingest` classifies URLs by provider (Greenhouse/Lever/Ashby/SmartRecruiters via public APIs, employer JSON-LD extraction) and fetches job data server-side. Restricted boards (LinkedIn/Indeed) fail immediately with guidance. Unknown pages attempt JSON-LD extraction. — DONE (2026-03-30)
6. First structured job source — evaluate lowest-friction job data source that provides full JD text (cost, reliability, coverage as decision criteria). Ship one adapter behind the interface.
7. Scored job recommendations on /jobs — once per-user inventory exceeds a useful threshold, surface ranked recommendations from canonical inventory. Keep calibration as the personalization layer.

NOT NEXT (settled — do not start without explicit PM decision):
- Broad DOM-based acquisition — resolved not viable. Requires backend inventory layer (step 6+) that does not yet exist. Zero-click broad overlay is a display-layer feature that depends on inventory, not the other way around.
- Scraper-first acquisition — explicitly deferred. Not the default path. See architectural foundation above.
- Supply expansion before observing usage — do not build acquisition infrastructure before validating that users engage with what already exists.

BREAK + UPDATE — 2026-03-30
Job Source Adapter layer shipped. `lib/job_source_adapter.ts` defines the adapter interface, provenance/trust/rights types, and canonicalization entry. `lib/job_source_adapters.ts` provides concrete adapters for all current + planned source types (extension_sidecard, extension_pipeline, user_import, ats_api, employer_jsonld, licensed_feed). 44 tests pass. Existing write paths unchanged — adapter layer bridges to `writeTrustedScore` for backward compat. DONE.
NEXT: Observe real usage (step 4), then first structured job source (step 6).

BREAK + UPDATE — 2026-03-30 (Provider-Aware URL Ingestion)
Provider-aware URL intake shipped. `POST /api/jobs/ingest` now supports two modes: Mode 1 (URL + pasted text, existing) and Mode 2 (URL only, provider-aware fetch). Provider detection (`lib/job_url_provider.ts`) classifies URLs into supported ATS (Greenhouse/Lever/Ashby/SmartRecruiters), restricted boards (LinkedIn/Indeed), or unknown. ATS fetch (`lib/job_url_fetch.ts`) routes to public APIs or JSON-LD extraction. Restricted boards fail immediately with user guidance. Unknown pages attempt JSON-LD extraction. Updated `lib/job_ingest_validation.ts` (extracted `validateIngestUrl`) and `app/api/jobs/ingest/route.ts` (dual-mode handler). 40 new tests pass (provider classification + fetch + JSON-LD extraction). Existing Mode 1 flow unchanged.
NEXT: Observe real usage, then first structured job source (step 6).

BREAK + UPDATE — 2026-03-30 (/jobs Ready-List Improvements)
`/jobs` upgraded from flat history to a practical ready-list. Pipeline state badges (Saved/Tailored/Applied/Interviewing/Offer) on job cards via batch pipeline-stage lookup. URL-only ingest mode in the "Score a job" form (leverages provider-aware fetch for ATS URLs). Stretch factors shown on strong-match cards alongside fit reasons. Web platform filter pill. Better freshness display (month+day for older items). Score tier badges. Better empty state with URL-only guidance. Richer stats bar. Files: `app/jobs/page.tsx`, `app/api/jobs/known/route.ts`, `lib/pipeline_store_db.ts`. Existing tests: 373 pass, 3 pre-existing failures unchanged. DONE.
NEXT: Observe real usage (step 4), then first structured job source (step 6).

PHASE COMPLETION CRITERIA:
- [ ] Real-user engagement on /jobs confirmed (≥1 job viewed or ingest-submitted per active session across first 50 post-beta sessions)
- [x] Source-adapter interface defined, documented, and reviewed by PM (2026-03-30: `lib/job_source_adapter.ts` + `lib/job_source_adapters.ts`)
- [ ] First non-user-paste job source delivering full-JD records successfully stored in CanonicalJob
- [ ] /jobs surfaces scored job recommendations from canonical inventory (not just user-touched jobs)

---

Milestone — Desktop Stabilization & Beta Readiness (COMPLETE)
---
STATUS: COMPLETE — entered 2026-03-15, closed 2026-03-29 at commit `de42c02`. All five beta gates CLOSED on production (`stable` = `main` = `de42c02`). Extension v0.9.45 live, Canonical Job Cache shipped, /jobs page live, user-directed ingestion live.

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
- Verify extension build stability (current version: 0.9.29)

TESTING FOCUS:
- Jen regression profile (primary — covers SGD triggering, BST loop prevention, surface intelligence)
- Calibration ingest behavior across all 4 fixture profiles (Jen, Chris, Dingus, Fabio)
- LinkedIn search surfaces (aligned, out-of-scope, ambiguous classifications)
- Fixture classification contracts: Chris=builder_systems(high), Fabio=analytical_investigative(high), Jen=operational_execution(low), Dingus=operational_execution(low). Jen and Dingus retain `expectedMode: null` in fixture code as legacy anchors; tests assert actual classified mode.

SSI SUBSYSTEMS UNDER VALIDATION:
1. **Signal Gap Detection (SGD)** — detects professional signals from prompt answers not in resume; requires explicit user choice before calibration advances.
2. **Surface Quality Banner** — BST slot shows strong-match count + best job when surface has >=1 job scoring >=7.0.
3. **Better Search Trigger (BST)** — surface-classification-driven recovery suggestion; must never repeat previously suggested or searched titles in a session.
4. **BST Loop Prevention** — session-level title dedup tracking; all title selection paths filter against seen titles.
5. **Pipeline Trigger (>=7)** — action thresholds lowered from 8.0 to 7.0; pipeline/tailor buttons fire at 7.0+.
6. **Score Labeling** — six-band label system (Excellent Match through Poor Fit); decimal score display.

COMPLETION CRITERIA (all must pass before declaring beta):
- [x] SGD requires explicit user input (Yes/No) before calibration advances past PATTERN_SYNTHESIS (2026-03-24: polling pause gate in `app/calibration/page.tsx` L684-688; `detectedSignals.length > 0 && includeDetectedSignals == null` halts ADVANCE until Yes/No choice is made)
- [x] BST never repeats previously suggested or previously searched titles in a session (2026-03-24: `bstSuggestedTitles`/`bstSearchedQueries` session vars L784-785; `bstTitleAlreadySeen()` checks both L3336; `getAdjacentSearchTerms()` seeds seen-set from both L3374-3380)
- [x] Surface quality banner displays correct strong match count (2026-03-24: `isFreshEvidence = entry.scoreSource !== "restored_cache"` guards `strongCount` L1620-1622; restored_cache entries excluded per v0.9.16 fix)
- [x] Surface quality banner displays correct best job title and score (2026-03-24: `pageMaxScore`/`pageBestTitle` computed in live scoring loop L1602-1614; `prescanSurfaceBanner` never restored from durable state on init L487 — values always from fresh scoring run)
- [ ] Pipeline trigger fires at score >= 7.0 — OPEN: pipeline CTA (`updatePipelineRow("add")`) shows for ALL scored jobs regardless of score (PM decision v0.9.23 removed >= 7.0 gate). Current threshold is only `PIPELINE_AUTO_SAVE_THRESHOLD = 8.5` for auto-save. If criterion requires exclusive >= 7.0 gate (hidden below 7.0), this is not implemented. If criterion means CTA is available at >= 7.0 (inclusive of lower scores), behavior satisfies it. Needs PM clarification.
- [x] No extension crashes during page scans on LinkedIn (2026-03-24: `scoreCurrentJob()` fully wrapped in try/catch L4038/4268; badge DOM ops use try/finally L1091/1109; `chrome.runtime.lastError` checked in all message callbacks)
- [x] All 4 fixture profiles (Jen, Chris, Dingus, Fabio) pass chip-enabled scoring regression (2026-03-20: 39/39 tests, 300 determinism reps)
- [x] BST surface truth stable across scroll states (v0.9.20: cache pruning removed, adjacent-terms pre-populated, 2026-03-20)
- [x] BST post-fix validation PASS (v0.9.21: 62/62 simulation scenarios across baseline + signal-injected modes, 162/162 unit tests, 2026-03-20)
- [x] Sidecard collapsed height identical across all score states (v0.9.21: toprow absolute high-conf, pipeline-row visibility slot, skeleton preserves sections, 2026-03-20). **Post-fix validation PASS:** 52/52 assertions across 10 scenarios — 309px uniform height across 7 score bands, zero reflow on skeleton→results, zero delta across 20-job rapid switching, expand/collapse persistence confirmed.
- [x] Pipeline solid gate end-to-end (v0.9.21, 2026-03-21): 111/111 assertions across 12 scenarios. Save reliability, canonical URL dedupe, session migration, 4-column board, DnD persistence, generation guards, IDOR fix, telemetry trigger fix. **Pipeline is validated for beta.**
- [x] Sign-in / memory gate end-to-end (2026-03-21): 67/67 assertions across 16 areas. NextAuth v5 (3 providers), sign-in UI, SessionProvider, pipeline dual-mode + session→user migration, TelemetryEvent + FeedbackEvent userId binding, events/feedback API userId resolution, extension session chain. **Sign-in/memory is validated for beta.**
- [x] Magic-link sign-in hardening (2026-03-22): Product alignment — removed Google OAuth, email-only auth. Fixed file→DB migration losing sessionId. Tailor store userId binding. Pipeline/tailor route sessionId fallback via linked caliberSessionId.
- [x] Magic-link sign-in & durable memory E2E validation (2026-03-22): 114/114 assertions across 16 areas + 5 scenario simulations. No defects found. Script: `analysis/magic_link_e2e_validation.js`.
- [x] Score band labels render correctly across all score ranges
- [x] Vercel production branch verified and aligned — RESOLVED (2026-03-28): Vercel dashboard confirmed production branch = `stable`. Issue #107 resolved.
- [x] `stable` branch promoted to `main` — RESOLVED (2026-03-28): Fast-forward merge at commit `31ab6a1` — `stable` = `main` = `31ab6a1`. Issue #112 resolved.

IMPLEMENTATION LOG:

- 2026-03-29: User-Directed Job Ingestion — First Intentional Ingestion Path (WEB_APP). Added `POST /api/jobs/ingest` and "Score a job manually" form on `/jobs`. Design: URL + user-pasted job description text (LinkedIn/Indeed are JS-rendered SPAs — simple HTTP fetch cannot extract JD text; user paste is the only reliable trusted-text path). DONE: (1) `lib/job_ingest_validation.ts` — pure `validateIngestInput({ url, jobText })` helper; enforces https/http-only, no localhost/private-IP (SSRF guard), ≥200-char text gate. (2) `lib/job_ingest_validation.test.ts` — 26 tests: valid URLs, ftp/localhost/127.x/10.x/192.168.x/172.16-31.x rejection, text length boundary, trim normalization, early-termination order. (3) `app/api/jobs/ingest/route.ts` — POST route: validates → resolves session (same 3-tier pattern as fit route) → `runIntegrationSeam` → `computeHiringRealityCheck` → `evaluateWorkMode` → `writeTrustedScoreSafe(textSource:"sidecard_full")` → returns score+hrcBand+workModeCompat+supportsFit+canonicalKey+alreadyKnown. No new DB schema. (4) `app/jobs/page.tsx` — removed duplicate dead component (old version was appended after Task 2 rewrite); added "Score a job manually" collapsible form (URL input + textarea + character counter + inline submit result with score/band/compat display). Tests: 332/334 (2 pre-existing signal_classification). BLOCKED: None. NEXT: PM may consider title/company auto-extract from pasted text. Files: `lib/job_ingest_validation.ts`, `lib/job_ingest_validation.test.ts`, `app/api/jobs/ingest/route.ts`, `app/jobs/page.tsx`.

- 2026-03-29: /jobs Ready List Improvements — sort, filter, richer cards (WEB_APP). Turned `/jobs` from a flat history list into a more useful ready list using only existing Canonical Job Cache data. DONE: (1) `/api/jobs/known` `toApiShape` extended with `workModeCompat`, `hrcReason`, `supportsFit[0..1]` — richer payload from existing `ScorePayload` cache without any new DB calls. (2) `lib/job_cache_store.ts` — exported pure helpers `sortKnownJobs(entries, "date"|"score")` and `filterKnownJobs(entries, platform, minScore)` for testable sort/filter logic. (3) `lib/job_cache_store.test.ts` — 25 new tests for sort/filter helpers (sort=date, sort=score, non-mutation, empty, platform filter, minScore filter, combined, boundary, empty result). (4) `app/jobs/page.tsx` — full UI overhaul: sort pills (Recent | Best Score), platform filter pills (All | LinkedIn | Indeed), tier filter pill (All | Strong only), stats bar (X scored · Y strong), richer job cards with `workModeCompat` badge + first `supportsFit` bullet on strong matches, no-results-for-filter state with clear-filters action, improved empty/first-use state with extension link, deduped retry logic. Tests: 306/308 (2 pre-existing signal_classification). BLOCKED: None. NEXT: Issue #108 (LinkedIn dense-surface unresponsiveness) PM risk. Files: `app/jobs/page.tsx`, `app/api/jobs/known/route.ts`, `lib/job_cache_store.ts`, `lib/job_cache_store.test.ts`.

- 2026-03-29: Release Stabilization + stable Promotion — cache consumption + overlay/backfill convergence (MIXED). DONE: (1) `EXTENSION_BETA_VERSION` corrected from stale `0.9.34` → `0.9.45` in `lib/extension_config.ts` — display label now matches shipped artifact. (2) Canonical docs updated to reflect production state: `stable` promoted to current `main` (release commit), ACTIVE_STATE/ISSUES_LOG/CONTEXT_SUMMARY/milestones/BREAK_AND_UPDATE all aligned. (3) Test suite confirms 291/293 pass (2 pre-existing `signal_classification` abstraction drift — unrelated, documented). (4) Artifact verified: `public/caliber-extension-beta-v0.9.45.zip` — 12 files, production host `https://www.caliber-app.com`, all extension source files dated 2026-03-29. (5) Issue #118 opened and closed (this release promotion). VALIDATION NOTES: LinkedIn overlay/backfill — confirmed stable (v0.9.38–v0.9.45). Indeed overlay/backfill — confirmed stable. Sidecard — working on both platforms. Save/pipeline/tailor — no regressions in test suite. Canonical Job Cache write path — wired in `/api/extension/fit` + `/api/pipeline`; 15/15 store tests pass. `/jobs` page — renders from `app/jobs/page.tsx` against `GET /api/jobs/cache`. BLOCKED: None. NEXT: Post-fix tailor validation (post-`892a45a`) recommended. Issue #108 (LinkedIn dense-surface unresponsiveness) carries forward as open PM risk item. Files: `lib/extension_config.ts`, `Bootstrap/BREAK_AND_UPDATE.md`, `Bootstrap/milestones.md`, `Bootstrap/session_pack/ACTIVE_STATE.md`, `Bootstrap/session_pack/ISSUES_LOG.md`, `Bootstrap/session_pack/CONTEXT_SUMMARY.md`.

- 2026-03-29: BREAK+UPDATE — Product Truth Reset: Sidecard Primary, Overlays/Backfill Reactive, No Unsafe Prescore (DOCS_ONLY). DONE: (1) Extension working model confirmed through v0.9.38–v0.9.45 testing — sidecard-primary scoring, reactive/backfill overlays on LinkedIn and Indeed, unsafe DOM prescan suppressed (v0.9.42). (2) Canonical docs updated — BREAK_AND_UPDATE.md, milestones.md, session_pack/ACTIVE_STATE.md, ISSUES_LOG.md, CONTEXT_SUMMARY.md, PROJECT_OVERVIEW.md, KERNEL.md. Issue #117 added (capability boundary documented). Issue #115 resolved (overlay working model confirmed). BLOCKED: None. NEXT: PM decision on `stable` promotion of overlay feature; backend job inventory + score cache for future zero-click broad overlay support.

- 2026-03-29: Backend Canonical Job Record + Score Cache (WEB_APP). First-ingestion backend layer for durable job inventory and per-session score caching. DONE: (1) `CanonicalJob` + `JobScoreCache` Prisma models added to schema and pushed to Neon DB. (2) `lib/job_cache_store.ts` — canonical key strategy (LinkedIn numeric ID / Indeed jk / url:normalized), upsert + dedup logic, payload quality guard (sidecard_full > pipeline_save), fire-and-forget `writeTrustedScoreSafe` wrapper. (3) `app/api/extension/fit/route.ts` — fire-and-forget write after trusted sidecard score (non-prescan, sourceUrl present, score > 0). (4) `app/api/pipeline/route.ts` — fire-and-forget write when extension saves job with jobText. (5) `extension/background.js` — threads sourceUrl/title/company from content script message through `callFitAPI` body. (6) `extension/content_linkedin.js` + `extension/content_indeed.js` — CALIBER_FIT_API messages now include sourceUrl, title, company. (7) `app/api/jobs/cache/route.ts` — GET lookup by url or key + sessionId. (8) `lib/job_cache_store.test.ts` — 15/15 tests passing (canonicalization + dedup). TRUSTED WRITE PATH ONLY — unsafe prescan sources may not write CanonicalJob or JobScoreCache (see KERNEL.md invariant). Files: `prisma/schema.prisma`, `lib/job_cache_store.ts`, `lib/job_cache_store.test.ts`, `app/api/extension/fit/route.ts`, `app/api/pipeline/route.ts`, `app/api/jobs/cache/route.ts`, `extension/background.js`, `extension/content_linkedin.js`, `extension/content_indeed.js`.

- 2026-03-29: LinkedIn card badge href-backfill second pass (EXTENSION, `main` only). Added trusted-score href-backfill pass to `scanAndBadgeVisibleCards()` in `extension/content_linkedin.js`. After the main DOM→cache loop, iterates `badgeScoreCache["job-{id}"]` entries not yet stamped in DOM. For each unstamped entry, queries `a[href*="/jobs/view/{numericId}"]` + ≤8-level ancestor walk to find the card container, stamps it, calls `setBadgeOnCard(el, "scored", score)`. Covers cards whose `data-occludable-job-id` / inner `<a href>` was not yet populated when `stampCard` ran (LinkedIn virtual-scroll lazy hydration causes `cardJobId` to fall back to a text hash, missing the real cache key). No new API calls. Issue #116. File: `extension/content_linkedin.js`.
- 2026-03-29: LinkedIn overlay re-enabled on `main` testing track (EXTENSION). `BADGES_VISIBLE = false` → `true` in `extension/content_linkedin.js` on `main` only. Score badges now visible on LinkedIn job cards for PM evaluation. `stable` (production) unchanged. PM evaluation criteria: visual stability, sidecard parity, surface coverage, go/no-go for `stable` promotion. Files: `extension/content_linkedin.js`, `public/caliber-extension-beta-v0.9.34.zip`.
> Invariants and layout rules are defined in `kernel.md` and `LAYOUT_SYSTEM.md`. This log records what shipped and when — not the durable rules.

- 2026-03-25: Vercel Production Branch Alignment Audit (DOCS_ONLY). Verified: `origin/stable` = `04cecd3` (2026-03-24 21:55 UTC); `origin/main` = `e0d0af5` (6 commits ahead — 2 code fixes + 4 docs-only). No `vercel.json` in repo; Vercel production branch cannot be read from code — requires manual dashboard verification. Issue #107 added. EXECUTION_CONTRACT.md updated with Production Branch Promotion Protocol. ACTIVE_STATE.md updated with Production Deployment Status. milestones.md completion criterion added. Required operator action: (1) verify Vercel dashboard production branch = `stable`, (2) promote stable when PM declares beta-ready. Files: `Bootstrap/session_pack/ISSUES_LOG.md`, `Bootstrap/session_pack/ACTIVE_STATE.md`, `Bootstrap/session_pack/EXECUTION_CONTRACT.md`, `Bootstrap/milestones.md`.
- 2026-03-25: Telemetry Experiment Instrumentation Patch (WEB_APP). Audit found telemetry insufficient for controlled search-surface experiments: (1) `searchQuery` was not a standalone field — embedded inside composite `surfaceKey`, requiring brittle string-split to extract; (2) `positionIndex` (card DOM rank) was set on badge cache entries but never emitted — made "avg score of first 10 jobs" metric impossible. Fix: patched 4 emit sites in `extension/content_linkedin.js` to include `meta: { searchQuery: getSearchKeywords(), positionIndex }` on `job_score_rendered` and `meta: { searchQuery }` on `strong_match_viewed` + both `search_surface_opened` sites. No schema, route, or store changes needed — `meta` JSON column already exists and is fully persisted. Files: `extension/content_linkedin.js`.
- 2026-03-25: Telemetry Production Observability Patch (WEB_APP). Full observability audit: (1) FeedbackEvent (thumbs_down/bug_report) had no link back to the scored job or surface — added `surfaceKey`, `jobUrl`, `sessionId` fields to FeedbackEvent schema, store, and route; added DB indices; (2) `background.js` CALIBER_FEEDBACK handler now injects sessionId (same `::signal_on/off` tagging as telemetry); (3) `background.js` CALIBER_TELEMETRY handler now reads `caliberExperimentMeta` from chrome.storage.local and merges it into event meta — enables PM fixture/chips/query_set tagging per run; (4) `job_opened` now includes `meta.badgeScore` (pre-score from card cache) for false-negative detection; (5) `pipeline_save` trigger field moved into meta (was silently dropped) + `meta.searchQuery` added. PM operator guide written in CONTEXT_SUMMARY.md. Files: `extension/background.js`, `extension/content_linkedin.js`, `prisma/schema.prisma`, `lib/feedback_store.ts`, `app/api/feedback/route.ts`, `Bootstrap/session_pack/CONTEXT_SUMMARY.md`.
- 2026-03-25: Jen Surface Experiment — First controlled run (ANALYSIS_ONLY). Session: `sess_b412c36f2e242_19d25dc5622::signal_on`. Fixture: Jen, signals ON, chips skipped. Three surfaces compared from badge + sidecard telemetry. Key findings: (1) `partnerships manager` — 31 unique jobs, avg badge 7.08, 93.5% ≥7.0, best 8.3; densest surface. (2) `partner ecosystem process analytics cross-functional` — 22 unique jobs, avg 6.61, 77.3% ≥7.0, best badge 7.7 but best sidecard **9.4** (Sr Business Strategy & Operations @LendingClub); highest ceiling, more diverse titles including ops/strategy/consulting. (3) `outbound founder relations` — 7 unique jobs (limited), avg 7.46, surfaced "Founder's Office, Strategy & Operations" and "Chief of Staff" archetypes at 8.3 sidecard. Infra gap identified: `telemetryEmittedIds` is global per page-session (not per-surface) — recommended follow-up: reset on surfaceKey change for clean cross-surface comparison in future runs. Product signal: Jen's profile maps strongly to ops-strategy hybrid titles; ecosystem/analytics framing surfaces higher-ceiling individual matches despite lower average badge density. Follow-up queries recommended: `strategy and operations manager`, `chief of staff operations`, `gtm strategy operations`.
- 2026-03-25: Post-Fix Jen Surface Experiment — valid baseline run (ANALYSIS_ONLY). Session `sess_fd37b355bf65c8_19d27242644::signal_on`. Fixture: Jen, signals ON, chips skipped, v0.9.30 extension, clean tab load. Three surfaces compared: `partnerships manager` (badge avg 7.18, best sidecard 8.3, 1 pipeline save), `strategy and operations manager` (badge avg 7.57, best sidecard 8.8×3, 3 pipeline saves), `gtm strategy operations` (badge avg 6.81, 4 non-qualifying jobs, best sidecard 7.7, 0 pipeline saves). Key finding: `strategy and operations manager` outperforms baseline `partnerships manager` on ceiling, quality, and product outcome. `gtm` is a weaker stretch surface. Adjacent search generation gap identified — synthesis-derived nearby titles do not reflect empirical surface quality ordering. Follow-up product task recommended for adjacent term ranking. Full results in CONTEXT_SUMMARY.md.
- 2026-03-26: Tailor Cross-User Resume Contamination Fix (WEB_APP). High-severity tailor integrity bug fixed. Observed failure: Jen tailor run generated resume using Fabio Bellini's resume content (name, cybersecurity background, certifications). Source-binding bug — not model hallucination. Two root-cause paths: (A) Extension stale `caliberSessionId` — `CALIBER_SESSION_HANDOFF` missed on profile switch; extension used prior session ID for pipeline saves + tailor prep writes; `storeGet(staleId)` loaded wrong resume. (B) Web-created pipeline entries silently dropped `sessionId` in DB persistence — `pipelineCreate` did not include it in Prisma write; `resolveEntry` fell back to stale `getLinkedCaliberSession`. Fix: tailor POST now uses `caliber_sessionId` cookie (server-set, extension-immune) as primary resume-session source; web POST threads sessionId into `dbPipelineCreate`; `pipelineCreate` persists sessionId. Contamination tests added: 10 assertions in `lib/tailor_contamination.test.ts`. Suite: 230/232 passing (2 pre-existing). Commit `892a45a`. **Any tailor output before this fix is potentially contaminated. Post-fix runs are the valid baseline for tailor quality validation.** Issue #110 resolved. Files: `app/api/pipeline/tailor/route.ts`, `app/api/pipeline/route.ts`, `lib/pipeline_store_db.ts`, `lib/tailor_contamination.test.ts`.

- 2026-03-26: StrategyOps Cluster — Adjacent Search Surface Improvement (WEB_APP). New `StrategyOps` title cluster added to `lib/title_scoring.ts` — includes "Strategy & Operations Manager" and related ops-strategy hybrid titles. Addresses empirical surface evidence gap from post-fix Jen experiment: `strategy and operations manager` is Jen's strongest surface (7.57 badge avg, 8.8 sidecard ceiling, 3 pipeline saves) but was not appearing in recovery terms. StrategyOps cluster added to CLUSTER_MODE_MAP, DOMAIN_GROUNDING, and trusted adjacency pairs (ClientGrowth↔StrategyOps, OpsProgram↔StrategyOps). Post-fix recovery terms for Jen: Strategy & Operations Manager (8.1), Account Manager (7.4), Brand & Content Strategist (6.5). 9 new recovery term tests; 220 passing. Commit `f3a3d08`. Files: `lib/title_scoring.ts`, `lib/title_scoring_recovery.test.ts`.

- 2026-03-27: Scoring Guardrail Expansion — Domain Overclaim + Title-Shape Overfitting (WEB_APP). (1) Domain overclaim guardrail tightened (`59ecd39`): headline/summary generation restrained from claiming domain expertise absent from the profile. Snaplii fintech fixture added. (2) Title-shape overfitting guardrail added (`69b9ca7`): prevents calibration headlines from mirroring job-posting title shapes rather than recognized professional labels. Design Technology Manager stretch fixture added. Commit `69b9ca7`. Files: `lib/tailor_store.ts`, `app/api/tailor/generate/route.ts`, `lib/__fixtures__/work_mode_fixtures.ts`.

- 2026-03-27: UX / Navigation Regression Fixes (WEB_APP + EXTENSION). (1) Exclude archived entries from pipeline job-existence check (`e28192d`): archived pipeline entries no longer suppress the "Add to pipeline" CTA for fresh jobs sharing the same URL. (2) Restore hero title card elevated surface (`ec05253`): elevated card surface behind the hero calibration title was inadvertently flattened — restored. LinkedIn CTA spacing tightened. Files: `app/calibration/page.tsx`, `extension/content_linkedin.js`.

- 2026-03-27: PDF/DOCX Export Readiness Cluster (WEB_APP). Full PDF export pipeline reworked across 9 commits (`facddfd` → `49df0f8`). Key fixes: (1) Entry detection — parser now correctly identifies multi-line entries, merges split role-title/company-date lines, prevents section boundary drops. (2) Hierarchy — role title bold on line 1, company·date subdued on line 2; project/item titles in 'other' sections bold; section headings + rules normalized. (3) Summary normal weight — professional summary text renders at normal weight, not bold; heading coverage expanded for common summary labels; PDF safety net added. (4) TailorPanel download generates PDF instead of `.txt`. (5) Persist tailoredText to DB — TailorPanel restores generated content on revisit without re-generation. (6) Back-to-Caliber navigation fixed — two bugs: link was routing to `/` instead of `/calibration`; for signed-in users auth guard redirected to `/pipeline` instead of calibration landing — both fixed. Files: `app/api/tailor/generate/route.ts`, `app/components/TailorPanel.tsx`, `app/pipeline/page.tsx`, `lib/tailor_store.ts`.

- 2026-03-27: Sidecard Jitter/Scroll Stabilization — Two-Layer Guard (EXTENSION). Layer 1 (`adc45e7`): `sidecardResultCache` stores API response by job ID — sidecard reopen uses cache, no skeleton flash. Layer 2 (`b9e527f`): scroll jitter guard — (1) `currentJobIdFromUrl()` parses both `/jobs/view/{id}` and `?currentJobId=` URL formats for stable job ID across scroll; (2) `detailObserver` returns early when a cached complete result is already showing for the current job, preventing redundant skeleton+fetch on DOM updates mid-scroll. Commit `b9e527f`. File: `extension/content_linkedin.js`.

- 2026-03-27: specialist_craft Execution Evidence Category (WEB_APP). New `ExecutionEvidenceCategory` = `specialist_craft` added to `evaluateWorkMode()` in `lib/work_mode.ts`. Hard cap 5.5 (`SPECIALIST_CRAFT_CAP`). Three specialist domains: motion control (servo actuators, PLC, robotics hardware), healthcare integration (HL7, FHIR, EMR/EHR, medical device), construction estimating (takeoff, bid, construction costs, cost codes). Three job fixtures added; 7 regression tests. Cuts score inflation on roles that look keyword-aligned but require deep specialist execution absent from the profile. Total tests: n+7. Commit `ad8ec41`. Files: `lib/work_mode.ts`, `lib/__fixtures__/work_mode_fixtures.ts`, `lib/work_mode_regression.test.ts`.

- 2026-03-27: Bottom Line → Executive Summary Reframe (WEB_APP + EXTENSION). `generateWorkRealitySummary(wm: WorkModeResult)` added to `lib/work_mode.ts` — produces a 1–2 sentence work-reality summary driven by roleType/jobMode/compatibility/executionEvidence/executionIntensity. Priority routing: specialist_craft → domain_locked → SYSTEM_SELLER → SYSTEM_OPERATOR → SYSTEM_BUILDER → jobMode fallback → final fallback. Replaces prior 5-template fit-arithmetic recap that duplicated HRC/Supports/Stretch content. Extension sidecard label "Bottom Line" → "Executive Summary"; 350ms fade-in on content; showSkeleton resets opacity. API route `app/api/extension/fit/route.ts` uses `generateWorkRealitySummary(workMode)` for `bottom_line_2s` field. Extension version 0.9.31 → 0.9.32. Commit `4e6fb71`. Files: `lib/work_mode.ts`, `app/api/extension/fit/route.ts`, `extension/content_linkedin.js`, `extension/manifest.json`.

- 2026-03-27: Recalibrate Button Regression Fix (WEB_APP). Both "Restart" (TITLES step) and "Recalibrate" (COMPLETE step) buttons in `app/calibration/page.tsx` changed to `router.replace("/calibration?direct=1")`. Root cause: auth `useEffect` at line ~259 redirects authenticated users to `/pipeline` unless `?direct=1` param is present. Prior implementation called `setStep("LANDING")` + `window.history.replaceState` — kept URL at `/calibration` (no param), so next render triggered auth redirect to `/pipeline` instead of showing the calibration landing. Issue #111 resolved. Commit `5a1d9bf`. File: `app/calibration/page.tsx`.

- 2026-03-27: Executive Summary copy quality passes + extension v0.9.30–v0.9.34 (EXTENSION + WEB_APP). (1) Executive Summary copy quality: `generateWorkRealitySummary()` branches rewritten for concrete role-centered language — SYSTEM_BUILDER compatible/adjacent variants and final fallback (`e11fa91`, `e858f1c`). (2) Executive Summary indigo accent: `.cb-toggle-insight { color: #A5B4FC }` added to sidecard; body text `#DDE1E7`, line-height 1.45 (`3e13e7d`). (3) Work-family routing fix: Territory Sales Manager and similar roles producing wrong "analysis and investigation / threat or data analysis" executive summary copy — fixed by expanding `SELLER_PATTERNS` (territory/field/regional/account-manager/sales-manager/biz-dev/channel patterns) and `SALES_EXECUTION_TRIGGERS`; removed cybersecurity-specific language from generic `analytical_investigative` jMode fallback; `TERRITORY_SALES_MANAGER_JOB` fixture + 6 regression tests added (`ab3ae2d`). (4) Extension builds: v0.9.30–v0.9.33 (`a90dac6`→`a91783a`); v0.9.34 manifest icons/directory-structure fix (`b70a6a4`, `342cf2a`). Total tests: 268 pass (2 pre-existing signal_classification failures).

- 2026-03-28: Beta Launch — stable promoted to production (DOCS_ONLY). `stable` fast-forward merged to `main` at commit `31ab6a1` by PM operator. Vercel production branch confirmed = `stable`. All five beta gates live in production. Issues #107 and #112 resolved. Files: `Bootstrap/session_pack/ACTIVE_STATE.md`, `Bootstrap/session_pack/CONTEXT_SUMMARY.md`, `Bootstrap/session_pack/ISSUES_LOG.md`, `Bootstrap/milestones.md`, `Bootstrap/BREAK_AND_UPDATE.md`.

- 2026-03-28: Final Beta Readiness Validation Pass (DOCS_ONLY). Validated five-gate status on `main` — all CLOSED. Discovered `stable` is 60 commits behind `main` — NO- GO for beta launch from production until promotion. Production currently runs 2026-03-24 build (`04cecd3`); all stabilization work since then is on `main` only. Issue #112 added. ACTIVE_STATE.md, CONTEXT_SUMMARY.md, ISSUES_LOG.md, milestones.md, BREAK_AND_UPDATE.md updated. **Required next PM action:** (1) Confirm Vercel production branch = `stable`. (2) Accept/escalate Issue #108 risk. (3) Declare beta-ready. (4) Operator promotes `main` → `stable`. (5) Run post-fix tailor validation. (6) Declare beta launched.

- 2026-03-25: Extension Calibration-Context Freshness Fix (EXTENSION). Three `length === 0` / empty-check guards removed from `content_linkedin.js` that blocked `lastKnownCalibrationTitle` / `lastKnownNearbyRoles` from refreshing once populated. Storage refresh added to `CALIBER_SESSION_READY` handler. API truth was correct throughout — stale state was client-side only. Issue #109 resolved. Commit `da6e5ec`. Extension-side adjacent-search trust restored. Post-fix runs are the valid baseline for surface experiments.
- 2026-03-25: Per-surface telemetry dedup fix (EXTENSION). `telemetryEmittedIds` changed from `Set<jobId>` to `Map<surfaceKey, Set<jobId>>` — prevents cross-surface dedup suppression. SHAs `77ae077` (dedup fix) + `ce204b1` (stability: remove forced-layout reflow from observer callback, fix badge observer guard).
- 2026-03-25: BREAK+UPDATE — Telemetry Observability Expansion + Jen Rerun Blocked (DOCS_ONLY). DONE: telemetry observability expansion complete; per-surface dedup fix shipped; first Jen surface experiment produced directional insight; extension stability investigation + patch complete. BLOCKED: Jen surface experiment rerun is incomplete — attempted with Jen fixture, signals ON, chips skipped, revised query set (`strategy and operations manager`, `chief of staff operations`, `gtm strategy operations`); blocked by LinkedIn page unresponsiveness during dense scoring. NEXT: Verify extension stability on dense surface with patched build; re-run Jen experiment under stable machine conditions. Issue #108 added. Files: `Bootstrap/BREAK_AND_UPDATE.md`, `Bootstrap/milestones.md`, `Bootstrap/session_pack/ACTIVE_STATE.md`, `Bootstrap/session_pack/CONTEXT_SUMMARY.md`, `Bootstrap/session_pack/ISSUES_LOG.md`.

- 2026-03-25: BREAK+UPDATE — PM Session Pack Consolidation + Workflow Truth Reset (DOCS_ONLY). DONE: (1) Created `Bootstrap/session_pack/` with 9 files — canonical loader at `Bootstrap/session_pack/CALIBER_LOADER.md`. (2) `CALIBER_SYSTEM.md` and `Bootstrap/PM_bootstrap.md` converted to redirect stubs. (3) `ENVIRONMENT_SPLIT.md` converted to superseded stub (old build-script model; active host rules remain in EXECUTION_CONTRACT.md). (4) Removed Claude-agent / planner-implementer workflow framing from session-pack docs. Canonical workflow: ChatGPT = PM, Claude (Codespaces) = builder. (5) Canonicalized release model in session-pack: main = dev/preview, stable = production. (6) "Cloud agent policy" → "Builder policy" in EXECUTION_CONTRACT.md. BLOCKED: None. NEXT: Keep session-pack copies in sync when source docs receive significant updates. Issue #106 resolved. Files: Bootstrap/session_pack/ (9 new files), CALIBER_SYSTEM.md, Bootstrap/PM_bootstrap.md, ENVIRONMENT_SPLIT.md, Bootstrap/CALIBER_EXECUTION_CONTRACT.md, Bootstrap/BREAK_AND_UPDATE.md, Bootstrap/milestones.md, Bootstrap/CALIBER_ISSUES_LOG.md.

- 2026-03-24: Beta Gate 5 Closure + Completion Criteria Sweep — Gate 5 (Tailor resume) CLOSED. Tailor E2E validation: `analysis/tailor_e2e_validation.js` 59/59 assertions across 8 areas + 5 scenarios: (1) tailor prep creation via pipeline POST with jobText >50 chars — pipelineCreateForSession + tailorPrepSave called, safeJobText guard confirmed. (2) resolveEntry auth paths — DB lookup unconditional (no if(userId) gate), getLinkedCaliberSession fallback for missing sessionId, file-store fallback for unauthenticated. (3) Tailor generation — POST resolves entry/jobText/resumeText, calls generateTailoredResume, strips debug trace, returns { ok, tailoredText, debugTrace, resultId }. (4) DOCX export — Buffer→Uint8Array fix confirmed (new Uint8Array(buffer)), Content-Type docx MIME, status 200. (5) Copy-to-clipboard — copyToClipboard useCallback, navigator.clipboard.writeText(tailoredText), setCopied state. (6) Query param handling — searchParams.get("id"), error on empty prepId, Suspense wrapper for SSR safety. (7) userId passthrough — conditional spread to tailorResultSave, TailorPrep/TailorResult interfaces have userId?. (8) sessionId preservation — migrateFileEntriesToUser copies fe.sessionId with explanatory comment. Completion criteria sweep: 5/6 PASS. SGD gate PASS, BST dedup PASS, banner strongCount PASS, banner bestTitle/score PASS, no-crash PASS. Pipeline CTA threshold — OPEN: v0.9.23 removed the >= 7.0 gate (PM decision); CTA now available for all scored jobs. Criterion "exactly >= 7.0" requires PM clarification (CTA shows below 7.0 too). **Status: Partially Complete — Gate 5 closed, 5/6 completion criteria confirmed, 1 criterion needs PM clarification on pipeline CTA threshold semantics.** Files: `analysis/tailor_e2e_validation.js` (new), `Bootstrap/milestones.md`, `Bootstrap/CALIBER_ACTIVE_STATE.md`.
- 2026-03-24: Scoring Gate And Extension Go Or No-Go — Confirmed complete. (1) Execution-evidence gate: confirmed complete. `detectExecutionEvidenceGap()` in `lib/work_mode.ts` applies `EXECUTION_EVIDENCE_CAP = 7.0`, classifies `domain_locked` and `stack_execution` triggers, wired into `/app/api/extension/fit/route.ts` HRC payload as `execution_evidence_gap`, rendered in `extension/content_linkedin.js` sidecard HRC block (`cb-hrc-gap`). All 12 execution-evidence fixture/unit tests pass (100%). All 171 work-mode + hiring-reality + calibration-result regression tests pass across 4 suites. (2) Execution-evidence validation harness: added — `analysis/execution_evidence_gate_validation.js` 53/53 assertions across 10 scenarios covering all 3 required domains (Salesforce, SAP, ServiceNow), all 5 required stack patterns (Python, Java, React, Django, "write code"), score cap enforcement, silent path, evidence bypass, combined categories, constant verification. (3) Score-band label validation: closed (Issue #102). `getDecision()` in `extension/content_linkedin.js` confirmed six-band system present with correct labels and boundaries at 5.0, 6.0, 7.0, 8.0, 9.0 — sequential `if (score >= N)` guards, no gaps/overlaps. **Overall status: COMPLETED.**
- 2026-03-24: Execution-Evidence Guardrail + HRC Gap Line — 7th guardrail layer added to scoring pipeline (`lib/work_mode.ts`). `detectExecutionEvidenceGap()` scans for domain-locked ecosystems (7: Salesforce, SAP, Oracle, ServiceNow, Workday, NetSuite, Dynamics 365) and stack-execution patterns (31 job patterns) where resume lacks hands-on evidence. Cap at 7.0 when triggered. Two new job fixtures (Salesforce CPQ Architect, Senior Python Developer). API surfaces `execution_evidence_gap` in HRC payload. Extension sidecard renders one-line italic red gap reason in HRC section. DOCX export fix: Buffer→Uint8Array for Vercel TS BodyInit compat. 9 regression + 12 fixture tests added. 200/202 total tests pass (2 pre-existing signal_classification). Extension v0.9.29. Files: `lib/work_mode.ts`, `lib/__fixtures__/work_mode_fixtures.ts`, `lib/work_mode_regression.test.ts`, `lib/execution_evidence_gap.test.ts`, `app/api/extension/fit/route.ts`, `extension/content_linkedin.js`, `app/api/tailor/export-docx/route.ts`.
- 2026-03-23: BREAK+UPDATE — System Stabilization + UX Polish + Auth Hardening (v0.9.27). Product shift from feature iteration → system stabilization. Core loop fully functional: Calibrate → Discover → Evaluate → Save → Saved Jobs → Continue. DONE: (1) Auth persistence fixed — DB-backed jobText, Tailor fallback chain, session persistence across refresh/tab. (2) Header system locked — CALIBER header ONLY on landing + Saved Jobs; removed from all calibration flow steps. (3) Layout centering restored globally (flex-based, no padding hacks). (4) Chip system simplified 3-tier→2-tier (preferred/avoided; removed primary). (5) Chip card + title hero 3-layer depth model (green-tinted halo). (6) Typography: chip category subheading increased to text-lg (18px). (7) Resume ingest green border. (8) Calibration UX: typewriter jitter fix, 2-bullet allowance, input contrast. (9) Saved Jobs page: CALIBER as primary header, no separate title. (10) Extension: sidecard result cache (no flicker), accordion consistency, score animation dedup. (11) Copy: "pipeline"→"saved jobs" across all surfaces. (12) Scoring stable — no drift, no flicker. (13) Sign-in provider fix via directBetaSignIn(). (14) Prompt input dock — fixed-bottom ChatGPT-style textarea on PROMPT steps, gradient fade background, 220px spacer, green accent border, submit button removed (Enter-to-submit). BLOCKED: None. NEXT: Minor contrast tuning, empty state polish, score band label verification. Issues #96–#104. Files: `app/calibration/page.tsx`, `app/pipeline/page.tsx`, `app/signin/page.tsx`, `app/components/pipeline_confirmation_banner.tsx`, `app/tailor/page.tsx`, `extension/content_linkedin.js`, `lib/auth.ts`, `app/api/pipeline/route.ts`, `app/api/pipeline/tailor/route.ts`, `prisma/schema.prisma`.
- 2026-03-22: Chips Page Interaction Clarity — UX simplification from live PM validation. Three issues fixed: (1) Plus/minus controls had weak contrast (nearly invisible on bright screens) — buttons enlarged to 32×32px with bold text, unselected color raised from 0.45→0.7 opacity, border from 0.06→0.15, backgrounds strengthened across all states. (2) "Most prominent chip" (primary selection) removed entirely — 3-tier model (primary/preferred/avoided) collapsed to 2-tier (preferred/avoided). Clicking chip body or + toggles positive, − toggles negative. Submit sends preferredModes + avoidedModes only (no primaryMode). (3) Chip options now hidden until typewriter heading completes — gated on chipHeadingDone with 0.5s fade-in, matching pacing model on LANDING/RESUME pages. Copy simplified: "Use + and − to mark what you want more or less of." No scoring logic changes — applyChipSuppression, getRoleTypePenalty, evaluateWorkMode pipeline untouched. Validation: TSC clean, 179/181 tests (2 pre-existing). Issue #96. File: `app/calibration/page.tsx`.
- 2026-03-22: Auth Server Error Fix + Beta-Email Hardening — Sign-in redirected to NextAuth generic error page ("Server error — There is a problem with the server configuration"). Root cause: `authorize()` had no try/catch — Prisma/DB failures threw unhandled exceptions interpreted by NextAuth v5 as "Configuration" errors; no `pages.error` defined. Fix: (a) Wrapped authorize() in try/catch. (b) Added `pages.error: "/signin"`. (c) Sign-in page maps error codes to user-friendly messages. (d) ENV validation logging (AUTH_SECRET, DATABASE_URL). (e) Structured auth logger. (f) Client-side signIn() diagnostic logging. Validation: 5/5 E2E, 179/181 unit. Issue #53. Files: `lib/auth.ts`, `app/signin/page.tsx`.
- 2026-03-22: Sign-in Completion Fix + Tailor Pipeline-Entry Resolution (v0.9.25) — Two top beta blockers fixed. (1) Sign-in hung on "Signing in\u2026" due to missing try/catch around `signIn()` calls — if the call threw (DB error, network issue), `setSending(false)` never executed, leaving UI stuck. Fixed: try/catch wrapper on both Nodemailer and beta-email paths, `authError` state with inline error display, no-provider fallback. (2) Tailor "Pipeline entry not found" for valid visible cards — `resolveEntry()` in pipeline tailor route only checked DB when `userId` was present (authenticated), so unauthenticated users with session-based DB entries were never found (fell through to legacy file store only). Fixed: DB lookup now runs unconditionally. Also fixed PATCH ownership check: `existing.userId !== session.user.id` rejected pre-migration entries with null userId; changed to `existing.userId && existing.userId !== session.user.id`. Debug logging added: auth authorize callback, sign-in page start/result/error, pipeline GET auth+sessionId resolution, PATCH ownership failures, tailor resolveEntry inputs/hit/miss, pipeline page client-side load. Validation: `analysis/signin_pipeline_tailor_validation.js` 28/28. Regression: sidecard 52/52, pipeline 111/111, BST 62/62, adjacent 36/36, recovery 85/85, unit 179/181 (2 pre-existing). Files: `app/signin/page.tsx`, `app/api/pipeline/tailor/route.ts`, `app/api/pipeline/route.ts`, `lib/auth.ts`, `app/pipeline/page.tsx`.
- 2026-03-22: Manual Pipeline Save + Adjacent Searches In-Stack (v0.9.23) — Two PM-identified product issues fixed in extension sidecard. (1) Pipeline save removed score ≥7.0 gate — "Save to pipeline" now available for all scored jobs regardless of score; auto-save threshold still 8.5+; dedupe rules preserved. (2) Adjacent Searches moved from cryptic header blue-dot badge into permanent collapsible section in sidecard content stack below Bottom Line. BST badge removed from header. Weak-surface attention uses `cb-adjacent-attention` border-glow animation on section instead of badge pulse. New sidecard order: HRC → Supports → Stretch → Bottom Line → Pipeline → Adjacent → Feedback. No scoring changes, no BST classifier changes. Adjacent interaction validation updated (36/36). Regression: BST 62/62, sidecard 52/52, pipeline 111/111, adjacent 36/36, recovery 85/85, magic-link 114/114, unit 179/181 (2 pre-existing). File: `extension/content_linkedin.js`.
- 2026-03-22: Magic-Link Sign-In & Durable Memory E2E Validation — PASS. `analysis/magic_link_e2e_validation.js` — 114/114 assertions across 16 areas + 5 scenario simulations. Areas: sign-in flow (email-only, Nodemailer + beta-email), sign-in UI (no Google/OAuth), session provider, Prisma auth models, session→user migration (linkCaliberSession, both migrations, sessionId preservation, dedupe), duplicate prevention (DB/session/file, URL normalization), pipeline API auth routing (PATCH ownership), tailor continuity (userId, resolveEntry fallback), persistence across restart (Postgres, JWT 30-day, caliberSessionId recovery), logout data integrity, re-sign-in restoration, invalid auth paths, pipeline CTA, telemetry/feedback binding, extension session handoff, tailor storage integrity. Scenarios: Anonymous→SignIn, TailorContinuity, DupePrevention, FreshDevice, Logout+Relogin. No defects found — validation only, no production files changed.
- 2026-03-22: Magic-Link Sign-In Hardening — Product decision locked: magic-link / email-only auth for beta (no social auth, no passwords, no profile UI). (1) Removed Google OAuth provider from `lib/auth.ts` — two providers remain: Nodemailer magic-link (when SMTP configured) + beta-email credentials (instant fallback). (2) Simplified `app/signin/page.tsx` — removed Google button, OAuth "or" divider, OAuthAccountNotLinked error case. Clean email-first flow. (3) Fixed `migrateFileEntriesToUser()` in `lib/pipeline_store_db.ts` — now preserves `sessionId` from file entries when migrating to DB (was dropped, breaking tailor prep lookups for users who signed in after extension use). (4) Added optional `userId` field to `TailorPrep` and `TailorResult` interfaces in `lib/tailor_store.ts` — forward-compatible for future DB migration. (5) Upgraded `resolveEntry()` in `app/api/pipeline/tailor/route.ts` — returns resolved sessionId (entry field first, then fallback to user's linked `caliberSessionId` via `getLinkedCaliberSession()`), passes userId through to `tailorResultSave`. Eliminated redundant sessionId extraction in GET/POST handlers. Pipeline page sign-in CTA for anonymous users already existed. Validation: `tsc --noEmit` clean, Next.js build clean (all 29 routes), 179/181 tests pass (2 pre-existing signal_classification). Files: `lib/auth.ts`, `app/signin/page.tsx`, `lib/pipeline_store_db.ts`, `lib/tailor_store.ts`, `app/api/pipeline/tailor/route.ts`, `Bootstrap/CALIBER_ACTIVE_STATE.md`, `Bootstrap/CALIBER_ISSUES_LOG.md`.
- 2026-03-21: Recovery Term Strengthening — Adjacent Searches now use work-mode-aware, cluster-diverse recovery terms instead of raw calibration `selectTwoPlusOne()` output. New `generateRecoveryTerms()` function in `lib/title_scoring.ts` uses the full 25-title candidate pool from `scoreAllTitles()`, applies work-mode compatibility bonuses (+1.5 compatible, +0.5 adjacent, -2.0 conflicting) via cluster→mode mapping, enforces quality-aware cluster diversity (max 1 per cluster unless score gap > 5.0), and returns 3 ranked terms with source metadata and debug output. Server computes per-request via `/api/extension/fit` route — adds `recovery_terms` and `debug_recovery_terms` to response. Extension: `background.js` relays `recoveryTerms`, `content_linkedin.js` `getAdjacentSearchTerms()` prefers recovery terms over calibration title + nearby roles (fallback preserved for pre-API paths). Thin-profile support: base score floor 1.5, recovery score floor 2.0 (handles weak-control anchors like Dingus where max title score is 2.3). Validation: `analysis/recovery_term_validation.js` — 85/85 assertions across 10 categories × 4 fixtures (Chris, Fabio, Jen, Dingus). Chris: 3 terms from 3 clusters (ProductDev/CreativeOps/DesignSystems), all recovery ≥9.2. Fabio: 3 SecurityAnalysis terms (quality-aware diversity keeps same cluster when gap >5.0), all recovery ≥10.0. Jen: 2-cluster diversity, conflicting modes penalized. Dingus: 3 terms via thin-profile thresholds, no security/analytical titles. Regression: BST 62/62, sidecard 52/52, adjacent 36/36, unit 179/181 (2 pre-existing). Files: `lib/title_scoring.ts`, `app/api/extension/fit/route.ts`, `extension/background.js`, `extension/content_linkedin.js`, `analysis/recovery_term_validation.js`.
- 2026-03-21: Adjacent Searches Interaction Model Lock — calm-default behavior. Two PM-observed UX misses fixed: (1) Only 1 suggestion showing in practice — root cause: `nearbyRoles` entries could be plain strings (not objects with `.title`), causing silent sanitizeFail. Fixed: `getAdjacentSearchTerms()` handles both shapes, targets exactly 3 terms via `ADJACENT_TARGET_COUNT=3`. (2) Section auto-expanding on repeated BST triggers — root cause: no session memory of user interaction. Fixed: `adjacentUserOpened` session flag set on badge click, permanently suppresses pulse for session in `updateAdjacentTermsPulse()`. Section always collapsed by default. Debug logging emits full filter breakdown (selfSuppressed, alreadySearched, duplicate, sanitizeFail) when fewer than 3 terms available. Validation: `analysis/adjacent_interaction_validation.js` — 36/36 assertions + 8 simulations. Regression: BST 62/62, sidecard 52/52, unit 179/181 (2 pre-existing). File: `extension/content_linkedin.js`.
- 2026-03-21: Sign-in / Memory Gate — Validation — PASS. Auth system audit confirmed ~85% complete infrastructure: NextAuth v5 with 3 providers (Google OAuth, Nodemailer magic-link, beta email-only credentials), sign-in UI at `/signin`, SessionProvider in layout, pipeline dual-mode storage (userId + sessionId) with full session→user migration chain (`linkCaliberSession`, `migrateSessionEntriesToUser`, `migrateFileEntriesToUser`), extension session discovery with CALIBER_SESSION_HANDOFF. Two gaps fixed: (1) Added `userId String?` field with `@@index([userId])` to TelemetryEvent and FeedbackEvent Prisma models, pushed to Neon via `prisma db push`. (2) Added `resolveUserId()` to `/api/events` and `/api/feedback` POST handlers — resolves via `auth()` for web requests, then falls back to `caliberSessionId→User` lookup for extension requests. Updated TypeScript interfaces and store functions. Validation: `analysis/auth_gate_validation.js` — 67/67 assertions across 16 areas. `tsc --noEmit` clean. 179/181 unit tests pass (2 pre-existing abstraction drift — unrelated). **Sign-in/memory beta gate: CLOSED.** Files: `prisma/schema.prisma`, `lib/telemetry_store.ts`, `lib/feedback_store.ts`, `app/api/events/route.ts`, `app/api/feedback/route.ts`, `analysis/auth_gate_validation.js`.
- 2026-03-21: Pipeline Solid Gate — End-to-End Validation — PASS. Simulation test (`analysis/pipeline_gate_validation.js`) exercised 111 assertions across 12 scenarios. Validated: (1) canonical URL dedupe — LinkedIn job ID extraction from /jobs/view/{id} and ?currentJobId= patterns, query/hash stripping, different-job isolation. (2) Save reliability — sentinel fallbacks for empty title/company ("Untitled Position"/"Unknown Company"), field length limits (200/2000), required-field API validation. (3) Dedupe on create — same URL+session returns existing entry, different session creates new (session isolation). (4) Board model — 4 columns (Resume Prep, Submitted, Interview Prep, Interview) validated as clean lifecycle flow; all 10 internal stages map to correct column; new entries land in Resume Prep. (5) Stage persistence — PATCH validates stages against whitelist, load() refreshes after move, visibilitychange triggers reload. (6) Async callback safety — sidecardGeneration guards on CALIBER_PIPELINE_CHECK, manual save, and auto-save; stale callbacks discarded; auto-save failure falls back to manual add. (7) Session→user migration — linkCaliberSession persists sessionId to User, migrateSessionEntriesToUser dedupes and deletes duplicates, cookie restored from server. (8) Pipeline row state machine — 4 states (hidden/add/in-pipeline/auto-added) gated by score thresholds. (9) Highlight navigation — ?highlight={id} scroll+glow from extension. Two defects fixed: IDOR on PATCH (added ownership verification via dbPipelineGet), auto-save telemetry missing trigger field (added `trigger: "auto_8.5"`). One noted for post-beta: no DB uniqueness constraint on (sessionId/userId, jobUrl). 179/181 unit tests pass (2 pre-existing abstraction drift). Extension v0.9.21 ZIP rebuilt (72K). **Pipeline beta gate: CLOSED.** Files: `app/api/pipeline/route.ts`, `extension/content_linkedin.js`, `analysis/pipeline_gate_validation.js`.
- 2026-03-20: Sidecard Layout Post-Fix Validation — PASS. Simulation test (`analysis/sidecard_stability_validation.js`) exercised 52 assertions across 10 scenarios in pure layout-model mode. Scenarios: (1) collapsed height consistency across 7 score bands — 309px uniform, 0px delta for Poor Fit through Excellent Match. (2) High-conf label absolute positioning — zero height contribution verified, toprow 24px padding sufficient. (3) Pipeline row visibility slot — min-height 24px confirmed, occupies space in all states. (4) Skeleton→results transition — identical height in both phases, all 6 sections visible in both states. (5) Expand/collapse persistence — .cb-open class never touched by showSkeleton(), zero sections hidden. (6) Rapid 20-job switching — 1 unique height across all score bands, 0px max delta. (7) CSS structural invariants — toprow padding 24px, collapse body max-height 0/600. (8) Skeleton content clearing — 7 elements cleared, toggle class reset, no ghost content. (9) Adjacent section hidden by default — no height impact. (10) Full flow simulation — 6 phases (skel→low→skel→high→skel→mid) all 309px, 0px reflow delta at every transition. 62/62 BST validation pass (no regression). 179/181 unit tests pass (2 pre-existing abstraction drift failures — unrelated). Extension v0.9.21 ZIP rebuilt (72K). **Sidecard beta gate: CLOSED.** File: `analysis/sidecard_stability_validation.js`.
- 2026-03-20: Sidecard Layout Stabilization (v0.9.21). Collapsed sidecard height now identical across all score states. Three instability sources fixed: (1) High-confidence label repositioned absolute within toprow’s reserved 24px padding — never affects container height. (2) Pipeline row uses `visibility:hidden` + `min-height:24px` instead of `display:none` for hidden state — always occupies consistent layout slot. (3) Skeleton no longer hides collapsible section toggles — HRC/Supports/Stretch/Bottom Line buttons stay visible with cleared content during loading, eliminating skeleton→results reflow jump. User’s expand/collapse state preserved across job switches. CSS: toprow position:relative + padding-bottom:24px, high-conf position:absolute + bottom:6px, pipeline-row min-height:24px. JS: updatePipelineRow uses visibility, showSkeleton clears section content without hiding. File: `extension/content_linkedin.js`.
- 2026-03-20: BST Post-Fix Validation — PASS. Simulation test (`analysis/bst_surface_validation.js`) exercised 9 scenarios in both baseline (signal_off) and signal-injected (+0.3 offset) modes — 62/62 pass. Scenarios: (1) weak surface → bst, (2) healthy surface scroll stability, (3) neutral zone → forced bst at 10+, (4) adjacent-terms pre-population on bst/healthy, (5) no phantom suggestion consumption, (6) deep scroll stability (25+ jobs × 5 events), (7) surface transition isolation, (8) single-high-score rule, (9) restored-cache exclusion. Counterfactual test confirms OLD pruning would have caused healthy→neutral oscillation. 162/162 unit tests pass (4 scoring-relevant suites). 2 pre-existing failures in signal_classification.test.ts (abstraction drift — unrelated to BST). Extension v0.9.21 ZIP built (72K). File: `analysis/bst_surface_validation.js`.
- 2026-03-20: BST Surface Truth Stabilization (v0.9.20). Validation audit found three live issues, all fixed: (1) Cache pruning scroll instability — `evaluateBSTFromBadgeCache()` pruned off-DOM cards causing healthy→bst oscillation on scroll; fix removes pruning entirely, cache reset only on surface change. (2) Adjacent-terms pulse invisible until first sidecard click — `updateAdjacentTermsModule()` now called from BST evaluation path using persisted calibrationTitle/nearbyRoles, enabling badge pulse on weak surfaces without requiring a job click. (3) Phantom suggestion consumption — `bstMarkSuggested()` no longer called in the disabled popup path, preventing silent exhaustion of the suggestion pool. (4) Docs updated: CALIBER_ACTIVE_STATE.md BST section rewritten as canonical doctrine for the two-phase composite classifier (v0.9.17), superseding all simple-threshold references. CALIBER_ISSUES_LOG.md #44 resolved. Files: `extension/content_linkedin.js`, `Bootstrap/CALIBER_ISSUES_LOG.md`, `Bootstrap/CALIBER_ACTIVE_STATE.md`, `Bootstrap/milestones.md`.
- 2026-03-20: Fixture Regression Matrix — Chip-Enabled Scoring (PASS). Full regression validation across 4 canonical fixtures (Chris, Fabio, Jen, Dingus) × 5 job families × 3 chip configs = 40 scored combinations. All 39 assertions pass; all 300 determinism repetitions produce identical results. Key findings: (1) Chris anchor preserved: builder_systems job at 9.9 → 9.9 (no adjustments). (2) Chip suppression validated: all sales jobs capped ≤3.5 when sales_execution avoided; ops jobs capped ≤4.0 when operational_execution avoided. (3) Role-type classification correct: sales jobs→SYSTEM_SELLER, builder→SYSTEM_BUILDER, ops→SYSTEM_OPERATOR. (4) Conflicting mode penalties fire correctly: Chris/Fabio vs Inside Sales drop from 7.3→2.6 (WM=-2.5, EI=-1.3, RT=-1.0). (5) NOTABLE FINDING: Dingus classifies as operational_execution (not null) — customer service + scheduling keywords push sufficient ops signal density. Fixture `expectedMode: null` is outdated; actual classifier output is correct. (6) NOTABLE FINDING: Jen classifies as operational_execution — sales resume text triggers ops via customer service/coordination signals. (7) 2 pre-existing failures in hiring_reality_check.test.ts (insurance domain) — unrelated to scoring pipeline. Files: `lib/work_mode_regression.test.ts` (new — 39 tests).
- 2026-03-19: BREAK+UPDATE — Weighted Scoring Adjustments + Execution Intensity Layer. Cap-based work-mode governance replaced with proportional weighted adjustments. (1) Work mode mismatch now produces additive penalties: compatible=0, adjacent=-0.8, conflicting=-2.5. (2) Execution-intensity detection layer added: scans job text for grind signals (outbound calls, quota/commission, door-to-door, rejection-heavy, high-volume). Tiers: mild=-0.5, heavy=-1.5, extreme=-2.5. (3) Dampening: intensity at 50% strength when already conflicting. (4) Target score semantics recentered: 9=ecstatic, 8=great, 7=good, 5-below=avoid, 3-4=actively wrong. 41 tests. DONE: All changes shipped, build verified. BLOCKED: Distribution tuning may require live validation. NEXT: Validate score bands across Chris/Jen/Fabio/Dingus fixtures. Validate Bottom Line language against new score semantics. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`.
- 2026-03-19: BREAK+UPDATE — Dominant Work Mode + Adjacent Compression + Pipeline Fix + DOM Hardening (v0.9.21). (1) Work mode scoring: 5 modes, 3-tier governance: conflicting=hard cap 6.5, adjacent=soft cap 8.5, compatible=no change. 30 tests. (2) Pipeline save regression: generation guards on async callbacks prevent stale cross-job writes. Full diagnostic logging with source tracing. (3) DOM extraction: `cleanCardText()` deduplicates title in full card text before scoring. DONE: All changes shipped, 30 tests passing, build verified. BLOCKED: None. NEXT: Live validation of pipeline save reliability and ceiling activation rates. Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`, `extension/content_linkedin.js`.
- 2026-03-17: SGD Signal Injection Impact Test — PASS. Telemetry analysis compared identical job listings under signal_off vs signal_on calibration modes using Neon event data. 28 matched jobs were analyzed. Mean score delta was +0.02 with 27/28 jobs scoring identically and one job shifting +0.6. No jobs crossed the strong-match threshold (>=7.0). Conclusion: signal injection has negligible scoring impact and does not destabilize surface intelligence behavior. Resume anchors remain the dominant scoring factor. Validation complete.
- 2026-03-17: BREAK+UPDATE — Surface/UI Clarification + Beta Media Scope + Signal Validation + UX Polish (v0.9.15). DONE: (1) Signal injection telemetry validation completed and marked PASS for beta — no longer an active uncertainty. (2) Calibration result/title page refinement positively validated by PM — accepted as landed. (3) Telemetry backend documentation truth clarified — Neon is canonical, JSONL is superseded. (4) Product doctrine clarified — surface intelligence (page-level, e.g. "Best so far") and job-decision UI (sidecard) are distinct surfaces; mixing them is a regression. (5) "Best so far" popup/banner removed from sidecard-adjacent flow — underlying surface intelligence state preserved for future overlay. (6) Beta landing-page scope constrained — lightweight hero with product preview now, full animated system post-beta. (7) UX polish batch shipped — sidecard skeleton, telemetry dedupe, pipeline add feedback, pipeline highlight, tailor progressive steps, high-conf match label, sign-in centering. BLOCKED/OPEN: Sign-in / durable memory still not working (beta gate 4). Tailor resume still needs end-to-end beta validation (gate 5). NEXT: Fix sign-in / durable persistence. Validate tailor resume end-to-end. Implement simple landing-page demo video for beta. Files: `app/calibration/page.tsx`, `app/pipeline/page.tsx`, `app/signin/page.tsx`, `extension/content_linkedin.js`, `extension/background.js`, `extension/manifest.json`, `lib/extension_config.ts`.
- 2026-03-17: BREAK+UPDATE — Durable telemetry storage + experiment tagging. File-backed JSONL/SQLite telemetry replaced by Postgres (Neon) via Prisma. Both `/api/events` and `/api/feedback` write to `TelemetryEvent`/`FeedbackEvent` tables. Experiment condition queryable via sessionId/signalPreference/meta. Extension dev/prod host split restored. DONE: durable storage adopted, feedback pipeline migrated, experiment tagging added. BLOCKED: production `DATABASE_URL` must be set in Vercel. NEXT: deploy, rerun 50/50. Files: `lib/telemetry_store.ts`, `lib/feedback_store.ts`, `app/api/events/route.ts`, `app/api/feedback/route.ts`, `prisma/schema.prisma`, `extension/env.js`, `extension/manifest.json`.
- 2026-03-16: BREAK+UPDATE — SMC stale boot state + manual Add-to-pipeline write fix. (1) prescanSurfaceBanner no longer rehydrated from durable state on init — SMC renders only from fresh scoring. (2) Manual & auto-add pipeline paths re-extract DOM meta at action time with sentinel fallbacks, preventing API 400 on empty company. (3) background.js forwards error/httpStatus in CALIBER_PIPELINE_SAVE response. (4) chrome.runtime.lastError checked in both save handlers. DONE: SMC stale-state fix shipped (v0.9.10). Pipeline write fix ready. BLOCKED: validation pending with Jen profile. NEXT: validate manual add creates entry in /pipeline; validate fresh surface shows no stale SMC score. Files: `extension/content_linkedin.js`, `extension/background.js`.
- 2026-03-16: BREAK+UPDATE — Guardrail over-capping prescan scores (v0.9.14). User testing revealed 21/25 jobs scoring exactly 5.0 — `applyDomainMismatchGuardrail()` was flattening scores during prescan before BST/SMC could evaluate surface quality. (1) Removed guardrail from prescan badge scoring path entirely — raw alignment scores now flow into badge cache. (2) Guardrail retained on sidecard `showResults()` path only. (3) Added `scoreSource` field to all badge cache entries (`card_text_prescan`, `sidecard_full`, `restored_cache`). (4) `restored_cache` entries excluded from `strongCount`. (5) `lastScoredScore` reset on surface change. (6) `[Caliber][SCORE_CAPPED]` diagnostic logging added. (7) Per-entry surface-truth logging with source breakdown. DONE: Fix shipped (v0.9.14), validated by user — natural score spread restored. Files: `extension/content_linkedin.js`.
- 2026-03-15: SGD anchor-boost injection — two-layer approach: anchorBoosts map (bypass weight cap) + signal-affinity bonus (+0.25/req, +0.15/opt, cap 1.2). Jen: score 8.4→9.0, candidates shifted. Result page shows included signals. Yes/No buttons centered. Files: `lib/calibration_machine.ts`, `lib/title_scoring.ts`, `app/calibration/page.tsx`.

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

---

Milestone — Strong-Match Feed (SMF) (POST-BETA)
---
STATUS: PLANNED — not active. Blocked by beta completion + metrics baseline.

INITIATIVE DEFINITION:
Evolve Caliber from an evaluation layer on top of job boards into a discovery engine that surfaces only high-fit opportunities. Instead of requiring users to browse external job boards and evaluate jobs one at a time via the extension sidecard, Caliber aggregates job listings and filters them through the scoring system to present only strong matches directly.

CORE BEHAVIOR:
- Aggregate job listings from supported sources (LinkedIn, Indeed, etc.)
- Score all aggregated jobs against the user's calibrated profile
- Surface only jobs meeting strong-match threshold (>= 7.0, target >= 7.5)
- Present results directly in a dedicated feed and/or pre-populate the pipeline
- No dilution: empty feed is acceptable — truthful emptiness > low-quality padding

USER EXPERIENCE:
- User opens Caliber → sees "Your Best Matches" feed
- Feed contains only high-confidence opportunities above threshold
- Each feed entry provides: job title, company, score, score label, source
- Users can: save to pipeline, tailor resume, act immediately
- Ranking prioritizes highest-fit matches first
- Time-to-Strong-Match significantly reduced vs browse-and-score flow

PHASES:
- Phase 1: Manual refresh feed. Limited source integration. User triggers aggregation. No continuous crawling.
- Phase 2: Continuous aggregation + background scoring. Auto-seeding pipeline with user confirmation.

CONSTRAINTS:
- Do NOT surface jobs below threshold to "fill" the feed — truthful emptiness is a feature
- Do NOT compromise scoring integrity for coverage — scoring system is the source of truth
- Jobs must be deduplicated across sources (canonical URL normalization already exists in pipeline)
- Feed scoring must use the same scoring pipeline as extension sidecard (no separate/simplified scorer)

DEPENDENCIES (all currently met or in progress):
- Stable scoring system (complete — chip suppression, work mode, execution intensity all shipped)
- Reliable calibration signal (complete — SGD + anchor boost + signal injection validated)
- Pipeline persistence (complete — 111/111 gate validation, canonical URL dedupe, session→user migration)
- Sign-in / memory system (complete — 67/67 gate validation, 3 auth providers, userId binding)
- Post-beta metrics baseline (required — TTSM and Strong Match Rate must be established first)

OPEN DESIGN QUESTIONS (to resolve before implementation):
- Source integration mechanism: API-based aggregation vs extension-scraped ingest vs hybrid
- Feed refresh model: on-demand vs scheduled vs event-driven
- Scoring throughput: batch scoring pipeline vs per-job on-demand (current API is per-job)
- Feed presentation surface: dedicated /feed page vs pipeline integration vs both
- Per-source rate limiting and ToS compliance
- Feed staleness policy: how long before a feed entry expires or gets re-scored

SUCCESS CRITERIA:
- TTSM measurably lower than extension-only flow (baseline from beta metrics)
- Strong Match Rate in feed >= 90% (by construction — threshold filter)
- Pipeline Save Rate from feed higher than from extension browse flow
- Zero jobs below threshold appear in feed (enforcement, not approximation)

TELEMETRY INSTRUMENTATION (prerequisite layer — DONE 2026-03-14, UPGRADED 2026-03-17):
- PM decision: telemetry event capture implemented before beta release so outside-user testing starts with usable product data.
- **2026-03-17: File-backed JSONL persistence replaced by durable Postgres (Neon) via Prisma.** Prior JSONL and SQLite paths did not survive Vercel serverless deploys. Both `/api/events` and `/api/feedback` now write to `TelemetryEvent` and `FeedbackEvent` tables in the shared Neon database.
- POST /api/events endpoint accepts events from both extension and web app.
- POST /api/feedback endpoint accepts structured feedback from extension and web app.
- Initial event set: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used.
- Each event includes: timestamp, sessionId, surfaceKey, job identity fields, score, source (extension/web), scoreSource, signalPreference, meta (JSON).
- Experiment tagging: PM can tag signal-injection ON/OFF conditions via sessionId suffix or meta.experiment field. Both are queryable from the database.
- Telemetry is non-blocking: failures never break user-facing flows.
- Production requires `DATABASE_URL` set in Vercel environment variables (same Neon connection string).
- This event layer is the prerequisite for all future metrics/dashboard work.
- Dashboard and cohort analysis remain future work — not included in this implementation.

---

BREAK + UPDATE — 2026-03-26 (Tailor Specificity Fix — Score Pass-Through + Role Decomposition Prompt)
---
DONE:
- Bug 1 resolved: `prep.score` was never passed to `generateTailoredResume` — `matchBand` always `WEAK` in production; STRONG-path adaptation never fired. Fixed in `app/api/tailor/generate/route.ts`.
- Bug 2 resolved: System prompt lacked structured decomposition — no JD theme mapping, no bullet reordering mechanics, no headline adaptation instruction, no anti-single-project-dominance logic. Fixed in `lib/tailor_store.ts`.
- PRE-WORK ROLE DECOMPOSITION added to prompt: model must identify 3–5 JD capability themes and map each to specific resume evidence before writing.
- HEADLINE & SUMMARY ADAPTATION added: STRONG matches adapt headline to role function; summary leads with the top JD themes candidate directly supports.
- EVIDENCE DISTRIBUTION & BULLET ORDERING added: JD-relevant bullets front-loaded within each role; single-project dominance explicitly blocked when the job needs breadth.
- SECTION ORDERING for product/ops/strategy/consulting added: WORK EXPERIENCE before PROJECTS; cross-functional/process/market evidence before task-execution bullets.
- Chris IEM Product Manager fixture (score 7.5, STRONG) added to `analysis/tailor_quality_validation.ts`.
- Anti-fabrication guardrails preserved. Contamination test suite: 29/29 pass.
- Commit: bee6e83

BLOCKED:
- None

NEXT:
- Live user validation on a real STRONG-match job with the new decomposition-driven prompt
- Optional: decomposition depth tuning based on real output review
- PDF/DOCX export quality (separate concern, not blocked by this fix)
- Complete remaining beta gates validation

---

BREAK + UPDATE — 2026-03-17 (Durable Telemetry Storage + Experiment Tagging)
---
DONE:
- File-backed JSONL telemetry replaced by durable Postgres (Neon) via Prisma `TelemetryEvent` model
- Feedback pipeline (`/api/feedback`) migrated to same durable store via `FeedbackEvent` model
- Experiment/session tagging available: `sessionId`, `signalPreference`, `meta` fields are queryable for PM ON/OFF signal validation
- Extension source `env.js` restored to dev defaults (localhost:3000); `manifest.json` host_permissions aligned
- Build script confirmed producing correct host-separated artifacts (prod → caliber-app.com, dev → localhost:3000)
- Local validation passed: both `/api/events` and `/api/feedback` write durably to Neon from localhost:3000
- CORS allows both `caliber-app.com` and `localhost:3000` origins plus chrome-extension origins

BLOCKED:
- Production readiness depends on `DATABASE_URL` being set in Vercel environment variables (operator step, not code)

NEXT:
- Confirm `DATABASE_URL` is set in Vercel dashboard for production environment
- Deploy current main to production (or merge to stable and push)
- Rerun 50/50 signal-injection test with durable telemetry active
- Analyze score deltas + LinkedIn drift using durable TelemetryEvent records

---

BREAK + UPDATE — 2026-03-15 (BST Initial Surface Gating)
---
DONE:
- Identified refresh-time BST misfire as premature evaluation on partial scoring state (first chunk triggers BST before strong matches in later chunks arrive)
- Confirmed strong-match refresh counts are stable by surface (account manager 5/5, calibrated title 5/5, bartender 0/5)
- Confirmed SGD vector influence is validated separately
- Implemented `initialSurfaceResolved` gate: BST evaluation deferred until initial visible-card scoring queue fully drains
- Removed durable-state banner restore on refresh: always re-evaluate from fresh scores

BLOCKED:
- BST cannot be marked fully passed until post-fix validation is complete in both baseline and signal-injected calibration modes

NEXT:
- Re-test BST on baseline calibration state (refresh behavior across surface types)
- Re-test BST on signal-injected calibration state (YES signals selected)
- Proceed to sidecard validation only after BST passes in both modes

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
- Telemetry instrumentation implemented (commit e835fcb): POST /api/events endpoint, lib/telemetry_store.ts. Storage: Neon (Postgres) via Prisma `TelemetryEvent` model
- Six events wired: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used
- Extension emits 5 events (content_linkedin.js → background.js relay); web app emits tailor_used (app/tailor/page.tsx)
- All telemetry is non-blocking / fire-and-forget — failures never break user-facing flows

BLOCKED:
- None

NEXT:
- Begin beta stability testing with telemetry instrumentation active
- Monitor telemetry events in Neon for event flow validation during real usage
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


---

## 2026-03-29 — Canonical Job Cache: First Consumer Surfaces

**Milestone:** Cache-first hydration in extension + known-jobs landing view delivered.

- Extension now checks `/api/jobs/cache` before calling `/api/extension/fit` — cache hits return immediately using `buildCachedFitResponse` (same session only)
- New web page `/jobs` lists jobs scored during the current session with score, HRC band, platform, and time-ago
- Pipeline page now links to `/jobs` ("Scored Jobs History →")
- 25 tests passing; TypeScript clean

**What this unlocks:** Users re-encountering a scored job see instant sidecard hydration instead of a fresh scoring round-trip.
