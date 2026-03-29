# CALIBER_ISSUES_LOG


## Current Open Issues

117. Product capability boundary — unsafe DOM prescan is not a supported product behavior — **CLOSED** (2026-03-29)
  - **What this tracks:** Whether Caliber can reliably prescore broad LinkedIn/Indeed search surfaces from card DOM alone (no sidecard click, no full job description).
  - **Answer (definitive):** No. LinkedIn card DOM contains only title/company/location at list-view time. Scoring from card snippet text produces title-similarity-only scores that are structurally inflated (e.g., 7.1 prescan vs 2.6 full-JD on the same job). `scoreSource=card_text_prescan` entries are cached for BST evaluation but explicitly never rendered as user-visible badges (v0.9.42).
  - **Product truth:** Zero-click broad overlay coverage requires backend job inventory + score cache infrastructure, not more DOM probing. This capability is not currently built.
  - **Working model confirmed:** Sidecard-primary. Click a job → sidecard scores from full JD → trusted score written to cache → list card receives backfill badge. Stable on both LinkedIn and Indeed (v0.9.38–v0.9.45).
  - **Status:** CLOSED — capability boundary documented. Prescan suppression already in place since v0.9.42. No code change needed.

116. LinkedIn card badge backfill — href-walk second pass — **RESOLVED** (2026-03-29)
  - **Symptom:** Job cards with trusted cached scores (sidecard_full or prescan) did not always receive a badge when they reappeared after LinkedIn virtual-scroll recycled their DOM node. The badge was deferred to the next API scoring round instead of restored from cache instantly.
  - **Root cause:** `scanAndBadgeVisibleCards` calls `stampCard(card)` which calls `cardJobId(card)` to get the job ID. `cardJobId` prefers `data-occludable-job-id`, then the inner `<a href>`. If neither is populated yet (LinkedIn lazy-hydrates card content after the container appears), `cardJobId` falls back to a text hash: `"hash-{x}"`. The main scan loop's cache-hit path checks `badgeScoreCache["hash-{x}"]` — no match — so the card is queued for fresh scoring even though `badgeScoreCache["job-{id}"]` already holds a trusted score.
  - **Fix (this commit):** Added a second pass at the end of `scanAndBadgeVisibleCards`, after the main DOM→cache loop. The second pass iterates all `badgeScoreCache` entries whose keys start with `"job-"` (numeric IDs, not text hashes). For each entry not yet stamped in the DOM (`findCardById` returns null), it queries `a[href*="/jobs/view/{numericId}"]` and walks up ≤8 ancestor levels to find the card container — identical logic to the existing `backfillBadgeFromSidecard` IIFE. On match: stamps the element, calls `setBadgeOnCard(el, "scored", score)`. `setBadgeOnCard` handles all badge states: creates a new scored badge, or upgrades a loading badge (written by the same scan cycle) to scored.
  - **Invariants:** Only `job-{id}` cache entries are processed — no text-hash or speculative matches. `setBadgeOnCard` is guarded by `!BADGES_VISIBLE`, so `stable` (where `BADGES_VISIBLE = false`) is unaffected. No new API calls, no new scoring — purely cache restoration.
  - **File:** `extension/content_linkedin.js` (`main` only)
  - **Status:** RESOLVED — this commit (2026-03-29)

119. `/jobs` ready list improvements — **RESOLVED** (2026-03-29)
  - **What:** `/jobs` improved from flat history list to sort/filter ready list using existing Canonical Job Cache data only. Sort (date|score), platform filter, tier filter (strong only ≥7.0), stats bar, richer cards with `workModeCompat` + `supportsFit[0]` for strong matches, no-results state, improved empty state.
  - **Scope:** `app/jobs/page.tsx` (UI), `app/api/jobs/known/route.ts` (add 3 fields to `toApiShape`), `lib/job_cache_store.ts` (add `sortKnownJobs`/`filterKnownJobs` pure helpers), `lib/job_cache_store.test.ts` (25 new tests).
  - **Status:** RESOLVED — this commit.

118. Release Stabilization + stable Promotion — 2026-03-29 — **RESOLVED** (2026-03-29)
  - **What:** `stable` promoted to current `main` (overlay/backfill convergence + Canonical Job Cache + `/jobs` page + EXTENSION_BETA_VERSION fix). Pre-release fix applied: stale `EXTENSION_BETA_VERSION = "0.9.34"` corrected to `"0.9.45"` in `lib/extension_config.ts` to match shipped artifact.
  - **Validation:** 291/293 tests passing (2 pre-existing `signal_classification` abstraction drift — unrelated). Extension artifact `caliber-extension-beta-v0.9.45.zip` verified: correct file set, production host `https://www.caliber-app.com`. LinkedIn/Indeed overlay/backfill, sidecard, pipeline/tailor, cache flows — no test regressions.
  - **Status:** RESOLVED — this release commit.

115. LinkedIn overlay re-enabled for PM evaluation — **RESOLVED** (2026-03-29)
  - **Scope:** `extension/content_linkedin.js` on `main` only. `BADGES_VISIBLE` flipped to `true`. Score overlays are now visible on LinkedIn job cards in a `main`-based build.
  - **Background:** Overlays were hidden at `BADGES_VISIBLE = false` since v0.9.5 due to reliability concerns (positioning, stale scores, layout jitter). Not a beta gate. PM now wants to evaluate whether overlays are reliable enough to expose permanently.
  - **`stable` unchanged:** Production retains `BADGES_VISIBLE = false`. This is intentionally a test track only until PM evaluates and decides.
  - **PM evaluation criteria:** (1) Visual stability and legibility across surfaces. (2) Sidecard parity: badge score matches sidecard score. (3) No surface types where overlay should remain suppressed. (4) No scroll/layout regressions.
  - **Revert path:** One-line change back to `BADGES_VISIBLE = false` on `main` if evaluation fails.
  - **Resolution:** PM testing (v0.9.38–v0.9.45) confirmed that the reactive/backfill overlay model is stable on both LinkedIn and Indeed. Sidecard-primary with reactive backfill on click is the confirmed product truth. Unsafe DOM-wide prescan (card_text_prescan) was explicitly suppressed in v0.9.42. `stable` now promoted to include overlay/backfill (this release). See BREAK+UPDATE 2026-03-29.
  - **Status:** RESOLVED — `stable` now includes overlay/backfill. Working model confirmed and shipped.

112. `stable` branch not promoted — production is 60 commits behind `main` — **RESOLVED** (2026-03-28)
  - **Symptom:** All recent stabilization and beta-readiness fixes (sidecard jitter, Executive Summary, specialist_craft guardrail, recalibrate fix, PDF/DOCX export cluster, tailor contamination fix, extension context freshness fix, work-family routing fix, extension v0.9.30–v0.9.34) are on `main` only. Production (`stable`) is running the 2026-03-24 build at `04cecd3`.
  - **Impact:** Beta cannot be launched from production until `stable` is promoted. Users accessing the live site receive the pre-jitter-fix, pre-Executive-Summary, pre-PDF-export build.
  - **Required action:** Operator must fast-forward `stable` to `main` after PM declares beta-ready (see EXECUTION_CONTRACT.md → Production Branch Promotion Protocol).
  - **Blocking:** Yes — beta launch from production is blocked until resolved.
  - **Status:** RESOLVED — `main` fast-forward merged to `stable` at commit `31ab6a1`, pushed to `origin/stable` 2026-03-28. Vercel production confirmed on `stable`.

111. Recalibrate button redirected authenticated users to `/pipeline` — **RESOLVED** (2026-03-27)
  - **Symptom:** Clicking "Recalibrate" on the calibration results page (COMPLETE step) or "Restart" on the TITLES step redirected authenticated users to `/pipeline` instead of the calibration landing page.
  - **Root cause:** A `useEffect` in `app/calibration/page.tsx` (line ~259) redirects authenticated users to `/pipeline` unless the `?direct=1` URL query parameter is present. The prior button handlers called `setStep("LANDING")` + `window.history.replaceState(null, "", "/calibration")` — this kept the URL at `/calibration` (no `?direct=1` param). On the next render, the auth guard fired and redirected to `/pipeline` before the user could see the calibration landing step.
  - **Fix (commit `5a1d9bf`):** Both buttons now call `router.replace("/calibration?direct=1")`. The `?direct=1` param is already the established bypass convention for this guard (used on the initial direct calibration load path). Clean navigation with param intact prevents the auth redirect from firing.
  - **Files:** `app/calibration/page.tsx`
  - **Status:** RESOLVED — commit `5a1d9bf` (2026-03-27)

110. Cross-user resume contamination in tailor flow — **RESOLVED** (2026-03-26)
  - **Symptom:** On a Jen tailor run, the generated tailored resume contained Fabio Bellini's resume content — his name, cybersecurity background, and certifications — instead of Jen's content.
  - **Classification:** Source-binding bug. Not a generation error, model hallucination, or server-wide user mixing. The system loaded the wrong resume before the LLM was ever called.
  - **Conditions of occurrence:** User calibrated as Fabio, then recalibrated as Jen. Extension's `caliberSessionId` was not updated between recalibrations (handoff missed). Subsequent pipeline save and tailor prep write used the stale Fabio sessionId. Tailor generation then loaded Fabio's resume via `storeGet(staleId)`.
  - **Root cause — Path A (primary — stale extension `caliberSessionId`):**
    1. `CALIBER_SESSION_HANDOFF` fires `chrome.storage.caliberSessionId = fabio_session`
    2. User recalibrates as Jen. Handoff only fires when `caliber:session-ready` event is received from `app/calibration/page.tsx` (dispatched at the TITLES step). If user navigates away, closes tab, or handoff times out → `caliberSessionId` stays as `fabio_session`.
    3. Extension `CALIBER_PIPELINE_SAVE` uses `chrome.storage.caliberSessionId` directly → pipeline entry saved with `sessionId = fabio_session`.
    4. `tailorPrepSave({ sessionId: fabio_session, jobUrl: jenJobUrl, ... })` — prep file written under Fabio's sessionId for Jen's job.
    5. Tailor generate: `tailorPrepFindByJob(fabio_session, jenJobUrl)` finds the prep → `resolvedSessionId = fabio_session` → `storeGet(fabio_session)` → Fabio's resume.
  - **Root cause — Path B (secondary — web-created entries missing sessionId in DB):**
    1. Web-auth user creates pipeline entry via `POST /api/pipeline`. The `dbPipelineCreate` call in `app/api/pipeline/route.ts` was not passing `sessionId` to the DB function.
    2. `pipelineCreate()` in `lib/pipeline_store_db.ts` did not include `sessionId` in the Prisma `create` data, so `sessionId = null` in the DB.
    3. `resolveEntry()` in tailor route saw `entry.sessionId = ""`, fell back to `getLinkedCaliberSession(userId)` which could return a stale linked session.
    4. `tailorPrepFindByJob(staleId, jobUrl)` finds wrong prep or no prep → `resolvedSessionId = staleId` → `storeGet(staleId)` → wrong resume.
  - **Fix (commit `892a45a`):**
    1. `app/api/pipeline/tailor/route.ts` — reads `caliber_sessionId` cookie as primary resume-session source: `resumeSessionId = cookieSessionId || resolvedSessionId || null`. Cookie is set by the calibration page and cannot be modified by the extension — provides a tamper-resistant trust anchor.
    2. `app/api/pipeline/route.ts` — web-auth POST now passes `sessionId` from request body into `dbPipelineCreate`.
    3. `lib/pipeline_store_db.ts` — `pipelineCreate` now includes `sessionId` in `prisma.pipelineEntry.create` data.
  - **Tests:** `lib/tailor_contamination.test.ts` — 10 tests covering sessionId isolation in `tailorPrepFindByJob`, cookie priority behavior, and Fabio→Jen profile-switch contamination scenario.
  - **Implication for validation:** Any tailor output generated before commit `892a45a` must not be used as a quality baseline. Post-fix runs are the only valid baseline for tailor quality validation. Gate 5 closure (functionality, 2026-03-24) stands; integrity validation requires post-fix runs.
  - **Status:** RESOLVED — commit `892a45a` (2026-03-26)

109. Stale extension calibration context across re-calibration in open LinkedIn tabs — **RESOLVED** (2026-03-25)
  - **Symptom:** After a Fabio → Jen re-calibration, extension Adjacent Searches in open LinkedIn tabs continued showing Fabio/security-oriented roles ("Security Analyst", "Security Operations Lead", "Technical Security Consultant") even though Jen calibration was active and the scoring API was correctly returning Jen's calibration title and adjacent roles.
  - **Conditions of occurrence:** LinkedIn tab open during or before Jen re-calibration. Extension content script had already initialized and populated in-memory context variables from Fabio's session. New calibration completed in a separate tab.
  - **Root cause:** Three overly-restrictive guards in `extension/content_linkedin.js` prevented `lastKnownCalibrationTitle` and `lastKnownNearbyRoles` from ever being refreshed once populated:
    1. Scoring batch callback: `&& lastKnownNearbyRoles.length === 0` — nearbyRoles from API only written on first set
    2. Session discover hydration: `!lastKnownCalibrationTitle` and `&& lastKnownNearbyRoles.length === 0` — same empty-check guards
    3. `CALIBER_SESSION_READY` handler: no mechanism to re-read `chrome.storage.local` on session change
  - **Important:** The API truth was correct throughout. `chrome.storage.local` was also correctly overwritten by `background.js` on each `CALIBER_SESSION_HANDOFF`. The stale state was purely client-side — runtime variables that were never refreshed.
  - **Fix (commit `da6e5ec`):** Removed all three guards; added unconditional `chrome.storage.local.get` refresh in `CALIBER_SESSION_READY` handler. `nearbyRoles` storage write guarded by `rolesChanged` diff-check to avoid unnecessary I/O.
  - **Implication for past surface runs:** Any extension surface experiment run in an open tab with a prior calibration context may have shown incorrect Adjacent Search suggestions. Post-fix runs should be treated as the valid baseline.
  - **Status:** RESOLVED — commit `da6e5ec` (2026-03-25)

108. LinkedIn search-page unresponsiveness during dense extension scoring run — **OPEN** (2026-03-25)
  - **Symptom:** LinkedIn jobs search page became unresponsive / Chrome showed "Wait / Exit Page" dialog during a Jen surface experiment rerun on a dense surface (`strategy and operations manager`, ~75 cards). The rerun could not be completed.
  - **Conditions of occurrence:** Jen fixture, signals ON, chips skipped, dense search result surface. User environment included hotspot latency and possible thermal pressure — exact contribution of environment vs extension is uncertain.
  - **Root cause (identified, fix shipped):** `logSurfaceValidationState()` called `getBoundingClientRect()` on every DOM card in a loop — a layout-reflow-forcing read — inside a `MutationObserver` callback (`hydrationObserver`). On a 75-card surface with multiple DOM expansion events, this produced N forced main-thread layout reflows per callback, which can block the main thread for seconds.
  - **Secondary issue (fixed):** The `badgeInjecting` guard in `badgeListObserver` was structurally bypassed — MutationObserver callbacks are async microtasks, so the flag was always `false` by the time the callback fired. Every badge write triggered an unnecessary `restoreBadgesFromCache + scanAndBadgeVisibleCards` rescan.
  - **Fix shipped:** Commit `ce204b1` — removed `getBoundingClientRect()` loop from `logSurfaceValidationState`; replaced `badgeInjecting` flag check with mutation-record inspection in `badgeListObserver`.
  - **Uncertainty remaining:** It is not confirmed whether the stability fix fully resolves the unresponsiveness under all conditions (e.g., slow machine + hotspot). The environment may have amplified the issue. The Jen rerun should be re-attempted under stable machine conditions before drawing further conclusions.
  - **Status:** Fix shipped, outcome unverified. Rerun required to confirm resolution.
  - **Required action:** Re-run Jen surface experiment after confirming extension behavior is stable on a dense surface (no page unresponsive dialog) with the patched build.

107. Vercel production branch alignment — **RESOLVED** (2026-03-28)
  - **Symptom:** No `vercel.json` or `.vercel/` config in the repo. Vercel production branch setting cannot be read from the codebase — it must be verified manually in the Vercel dashboard.
  - **Current git state (verified 2026-03-25):**
    - `origin/stable` = `04cecd3` — last intentional stable push (2026-03-24 21:55 UTC) — "feat: add landing page, /score web scoring interface, wire CTAs"
    - `origin/main` = `e0d0af5` — 6 commits ahead of `origin/stable`
    - Commits in `main` NOT yet in `stable`: `c7bf6e3` (fix: restore calibration CTA order), `3bdcfd3` (revert: remove Score Breakdown debug panel) + 4 docs-only
  - **Intended model:** Vercel production (`caliber-app.com`) deploys from `stable`; preview deploys from `main`.
  - **Required operator actions (manual — cannot be done from repo):**
    1. Log into Vercel dashboard → confirm production branch is `stable` (not `main`).
    2. If it is set to `main`, change it to `stable` before beta launch.
    3. After all beta gates pass and PM declares readiness, promote `main` → `stable` to include the 2 pending code fixes:
       - `c7bf6e3` fix: restore calibration complete page CTA order
       - `3bdcfd3` revert: remove Score Breakdown debug panel
    4. Run: `git checkout stable && git merge --ff-only origin/main && git push origin stable`
  - **Status:** RESOLVED — Vercel dashboard confirmed production branch = `stable` 2026-03-28. `stable` promoted to `main` at commit `31ab6a1`. Issue #112 resolved in same operation.

106. PM reload drift from oversized repo + stale workflow docs — **RESOLVED** (2026-03-25)
  - **Symptom:** PM sessions picking up stale context: obsolete Claude-agent workflow instructions, `ENVIRONMENT_SPLIT.md` references (old build-script model), "Cloud agent policy" wording, no single canonical reload path.
  - **Resolution:** Created `Bootstrap/session_pack/` with single canonical loader. Stale workflow/env refs removed. `ENVIRONMENT_SPLIT.md` → superseded stub. Canonical workflow: ChatGPT = PM, Claude = builder.
  - **Files:** `Bootstrap/session_pack/` (9 files), `CALIBER_SYSTEM.md`, `Bootstrap/PM_bootstrap.md`, `ENVIRONMENT_SPLIT.md`, `Bootstrap/CALIBER_EXECUTION_CONTRACT.md`

105. DOCX export TS BodyInit type incompatibility — **FIX SHIPPED** (2026-03-24)
  - **Symptom:** Vercel production build failed: `Buffer<ArrayBufferLike>` not assignable to `BodyInit` parameter type in `app/api/tailor/export-docx/route.ts`.
  - **Root cause:** `Buffer` is a valid `BodyInit` in Node.js but not in Vercel's stricter TS build (Edge runtime compatibility). The `new NextResponse(buffer, ...)` call rejected `Buffer` as parameter type.
  - **Fix:** Wrapped `buffer` with `new Uint8Array(buffer)` — `Uint8Array` is a valid `BodyInit` type in all environments while preserving binary content.
  - **Files:** `app/api/tailor/export-docx/route.ts`

103. Minor contrast tuning across cards — **OPEN**
  - **Symptom:** Some card elements have near-threshold contrast on bright screens.
  - **Status:** Known non-blocking. Flagged for post-stabilization polish pass.

102. Score band labels render verification — **CLOSED** (2026-03-24)
  - **Symptom:** Six-band label system (Excellent Match through Poor Fit) not yet validated across all score ranges in live extension.
  - **Resolution:** Static inspection of `extension/content_linkedin.js` `getDecision()` function (line ~2923) confirms all six bands present with correct labels and thresholds: Excellent Match (≥9.0), Very Strong Match (≥8.0), Strong Partial Match (≥7.0), Viable Stretch (≥6.0), Adjacent Background (≥5.0), Poor Fit (<5.0). Boundary values at 5.0, 6.0, 7.0, 8.0, 9.0 all correctly handled by sequential `if (score >= N)` guards — no gaps or overlaps. Execution-evidence gate validation harness (`analysis/execution_evidence_gate_validation.js`) exercised boundary scores at 5.0, 6.5, 7.0, 7.5 and confirmed cap at 7.0 does not break label logic.
  - **Validated:** 2026-03-24 as part of Scoring Gate And Extension Go Or No-Go task brief.

104. Prompt input dock — fixed-bottom textarea on PROMPT steps — **FIX SHIPPED** (2026-03-23)
  - **Symptom:** Typewriter question text pushed the textarea down during character reveal, causing visual jitter and positional instability on prompt steps.
  - **Fix:** Fixed-bottom dock pattern applied. See `kernel.md` Prompt Input Dock Invariant and `LAYOUT_SYSTEM.md` §2 for durable rules.
  - **File:** `app/calibration/page.tsx`

101. System stabilization — header, layout, depth, typography, resume border — **FIX SHIPPED** (2026-03-23)
  - **Symptom:** Multiple visual consistency issues across calibration flow: header on calibration steps, weak chip typography, neutral resume border, flat card depth.
  - **Fix:** Header gated to landing+Saved Jobs only (see `kernel.md` Calibration Immersive Flow Invariant). Chip labels → text-lg. Resume border → green accent. Card depth → 3-layer model (see `LAYOUT_SYSTEM.md` §3–4).
  - **Validation:** TSC clean, 179/181 tests pass (2 pre-existing).
  - **Files:** `app/calibration/page.tsx`

100. Calibration-to-extension terminology inconsistency — "pipeline" vs "saved jobs" — **FIX SHIPPED** (2026-03-23)
  - **Symptom:** Extension sidecard uses "Save this job" / "View saved jobs →" / "✓ Saved", but web app surfaces still use "pipeline" terminology: pipeline page heading ("Your Pipeline"), confirmation banner ("Added to your pipeline" / "View Pipeline"), sign-in page ("Save your pipeline"), tailor page ("View pipeline →"), remove tooltip ("Remove from pipeline"). Creates a mental model break when users transition from calibration → extension → web app.
  - **Root cause:** Extension was updated to "saved jobs" language earlier, but web app surfaces were never aligned.
  - **Fix:** Unified all user-facing text to "saved jobs" language:
    1. Pipeline page heading: "Your Pipeline" → "Saved Jobs"
    2. Pipeline sign-in CTA: "save your pipeline across sessions" → "keep your saved jobs across sessions"
    3. Pipeline remove tooltip: "Remove from pipeline" → "Remove"
    4. Confirmation banner: "Added to your pipeline" → "Job saved", "View Pipeline" → "View saved jobs"
    5. Tailor page nav: "View pipeline →" → "View saved jobs →"
    6. Sign-in page: "Save your pipeline and pick up where you left off" → "Save your scored jobs and pick up where you left off"
    7. Calibration error: "Pipeline did not reach results" → "Analysis did not reach results"
  - **No feature changes.** Copy alignment only. URL routes (`/pipeline`) unchanged.
  - **Validation:** TSC clean, 179/181 tests pass (2 pre-existing).
  - **Files:** `app/pipeline/page.tsx`, `app/components/pipeline_confirmation_banner.tsx`, `app/tailor/page.tsx`, `app/signin/page.tsx`, `app/calibration/page.tsx`

99. Sidecard accordion section consistency — uneven body padding and structural HTML — **FIX SHIPPED** (2026-03-23)
  - **Symptom:** Five collapsible sidecard sections (HRC, Supports, Stretch, Bottom Line, Adjacent Searches) had inconsistent inner padding and structural variance: Adjacent body used `2px 0 5px` vs `1px 0 3px` elsewhere, bullet lists used `padding-bottom: 2px` instead of uniform shorthand, Adjacent empty-state padding was `2px 0`, and Adjacent toggle used a superfluous `<span class="cb-adjacent-label">` wrapper not present in other sections.
  - **Root cause:** Sections were authored at different times with no shared padding contract. Adjacent Searches section was added later with slightly different padding values and extra wrapper markup.
  - **Fix (4-part):**
    1. **Adjacent body padding:** `.cb-adjacent-body` changed from `padding: 2px 0 5px` to `padding: 0` (collapsed) / `1px 0 3px` (open via `.cb-open .cb-adjacent-body`), with `transition: padding 0.2s ease-out` for smooth expand.
    2. **Bullet list padding:** `.cb-bullets` changed from `padding-bottom: 2px` to `padding: 1px 0 3px` (matches HRC reason, Bottom Line text).
    3. **Adjacent empty-state padding:** `.cb-adjacent-empty` changed from `padding: 2px 0` to `padding: 1px 0 3px`.
    4. **HTML simplification:** Removed `<span class="cb-adjacent-label">` wrapper from Adjacent toggle — replaced with plain `<span>` matching all other sections. Removed unused `.cb-adjacent-label` CSS rule.
  - **No content or scoring changes.** Pure visual consistency pass.
  - **Validation:** TSC clean, 179/181 tests pass (2 pre-existing), sidecard stability 52/52.
  - **Files:** `extension/content_linkedin.js`

98. Score label flicker on sidecard reopen — skeleton flash on cached jobs — **FIX SHIPPED** (2026-03-23)
  - **Symptom:** Reopening a previously scored job (close → reopen, navigate away → back) briefly flashes skeleton state (score "—", "Analyzing fit…") before re-displaying the same score. Score entrance animation replays even when value is identical. Creates distrust even though score is technically correct.
  - **Root cause:** Three flicker vectors: (1) URL change always clears `lastScoredText` and calls `showSkeleton()` before the API call, even for already-scored jobs — there was no sidecard-level result cache. (2) `showResults()` unconditionally replays `cb-score-reveal` animation via `void scoreEl.offsetWidth` reflow trick on every call, even when score value is unchanged. (3) Text-dedup early return (`text === lastScoredText`) exits `scoreCurrentJob` without restoring results, leaving orphaned skeleton state.
  - **Fix (4-part):**
    1. **Sidecard result cache:** New `sidecardResultCache` object stores `{ data, scoreMeta, displayScore }` keyed by job ID (from URL `/jobs/view/{id}`). Written after non-provisional API responses. Cleared on surface change (via `clearAllBadges()`).
    2. **Cache-first rendering in `scoreCurrentJob()`:** Before showing skeleton, checks `sidecardResultCache[jobId]`. On cache hit, calls `showResults()` immediately with cached data — API call still runs in background and updates seamlessly if score changes.
    3. **Animation dedup in `showResults()`:** New `sidecardDisplayedScore` variable tracks the currently rendered score. `cb-score-reveal` animation only plays when `sidecardDisplayedScore !== displayScore`. Reset to `null` on URL change and in `showSkeleton()` so genuinely new jobs still animate.
    4. **Text-dedup orphan fix:** When `text === lastScoredText` early return fires, restores cached results if skeleton was shown (prevents orphaned skeleton state).
  - **No scoring algorithm changes.** Cache is render-only; API always runs and cache updates if score changes.
  - **Validation:** TSC clean, 179/181 tests pass (2 pre-existing), sidecard stability 52/52.
  - **Files:** `extension/content_linkedin.js`

97. Sign-in provider resolution — `signIn()` ignores `redirect:false` on transient failure — **FIX SHIPPED** (2026-03-23)
  - **Symptom:** User clicks "Continue with email" and intermittently sees "Sign-in service is starting up" (mapped from `?error=Configuration` URL param). Refreshing the page shows the same error persistently. Server-side auth works perfectly — full E2E test (CSRF → POST → session) confirmed 302 → /pipeline, session cookie set, valid user session.
  - **Root cause:** `next-auth/react@5.0.0-beta.30`'s `signIn()` function calls `getProviders()` internally before every sign-in attempt. When `getProviders()` returns null (transient network error, cold start, Vercel edge timeout), the function does `window.location.href = "/api/auth/error"` — **completely ignoring the `redirect: false` option** (source code has a `// TODO: Return error if redirect: false` comment). The error page redirects to `/signin?error=Configuration`, and the `?error=Configuration` URL param persists across page refreshes, showing the "starting up" message indefinitely.
  - **Fix (3-part):**
    1. **Bypassed buggy `signIn()` with direct fetch:** New `directBetaSignIn()` function POSTs directly to `/api/auth/callback/beta-email` with `X-Auth-Return-Redirect: 1` header (same header the real signIn uses). Gets CSRF token first, sends credentials, parses JSON `{ url }` response. Safe `.json().catch(() => ({}))` fallback. Checks redirect URL for error params using `new URL(data.url, window.location.origin)` (handles relative URLs). Returns typed `{ ok, url?, error? }`. This eliminates the internal `getProviders()` call that was the failure vector.
    2. **Clear stale `?error=` URL params on mount:** Added `useEffect` that captures `errorCode` from URL params, then immediately clears it via `window.history.replaceState()`. Error is displayed once but doesn't persist across refreshes.
    3. **Better error message for "Configuration":** Changed from "Sign-in service is starting up. Please try again in a moment." → "Unable to connect. Please try again." — more accurate and actionable.
  - **Nodemailer path unchanged:** The magic-link `signIn("nodemailer", ...)` flow uses `redirect: true` (default) which works correctly — it navigates directly. Only the Credentials `redirect: false` path was affected.
  - **Validation:** TSC clean (0 errors), 179/181 tests pass (2 pre-existing signal_classification).
  - **Files:** `app/signin/page.tsx`

96. Chips page interaction clarity — weak contrast, cognitive load, premature reveal — **FIX SHIPPED** (2026-03-22)
  - **Symptom (from live PM validation):** (1) Plus/minus affordances have weak contrast — nearly invisible on bright/outdoor screens (unselected: `rgba(161,161,170,0.45)` color, `rgba(255,255,255,0.06)` border, 11px text). (2) "Most prominent chip" (primary selection) adds cognitive load — 3-tier model (primary/preferred/avoided) is not intuitive; users confused about the difference between clicking the chip body vs clicking +. (3) Chip options visible before typewriter heading finishes — violates pacing model used on other pages.
  - **Root cause:** (1) Plus/minus buttons used minimal contrast colors designed for dark-room reading, not real-world lighting. Button size (px-2 py-1, 11px text) too small for reliable touch. (2) Three-tier chip state (selectedPrimary + selectedPreferred + selectedAvoided) forced users to learn the distinction between "primary focus" and "also preferred" — unnecessary complexity for what's fundamentally a binary preference signal (+/-). (3) Chip list rendered immediately with no gating on `chipHeadingDone`, unlike other calibration pages that gate content on typewriter completion.
  - **Fix:**
    1. **Contrast strengthened:** Plus/minus buttons enlarged to 32×32px (`w-8 h-8`), `text-base font-bold`. Unselected state: `rgba(200,200,210,0.7)` color (was 0.45), `rgba(255,255,255,0.15)` border (was 0.06), `rgba(255,255,255,0.07)` background (was 0.04). Active green: border 0.5 opacity (was 0.30), background 0.18 (was 0.12). Active red: border 0.45 (was 0.30), background 0.15 (was 0.10). Chip card unselected border raised to 0.08 (was 0.06).
    2. **Primary mode removed:** `selectedPrimary` state and `selectPrimary()` function eliminated. Model simplified to 2-state: positive selection (preferred) and negative selection (avoided). Clicking chip body or + button toggles preferred. Clicking − toggles avoided. Mutual exclusion preserved (selecting + clears −, vice versa). Submit sends only `preferredModes` and `avoidedModes` — no `primaryMode`. Backend `WorkPreferencesInput.primaryMode` field remains optional; scoring unaffected (only `avoidedModes` drives chip suppression).
    3. **Deferred chip reveal:** Chip list wrapped with `opacity: chipHeadingDone ? 1 : 0` and `pointerEvents: chipHeadingDone ? "auto" : "none"` with 0.5s ease transition. Options populate only after typewriter heading completes, matching pacing model on LANDING and RESUME pages.
    4. **Copy updated:** Subtitle changed from "Tap to select your primary focus. You can also mark modes to prefer or avoid." → "Use + and − to mark what you want more or less of." Summary labels changed from "Primary/Also open to/Avoiding" → "Want more/Want less". Button titles "Prefer/Avoid" → "Want more/Want less".
    5. **Continue gate changed:** Was gated on `selectedPrimary` (requires primary). Now gated on any selection (`selectedPreferred.length > 0 || selectedAvoided.length > 0`).
  - **No scoring logic changes.** `applyChipSuppression()`, `getRoleTypePenalty()`, `evaluateWorkMode()` pipeline untouched. 179/181 tests pass (2 pre-existing).
  - **Validation:** TSC clean (0 errors), 179/181 tests pass (2 pre-existing signal_classification).
  - **Files:** `app/calibration/page.tsx`

95. Tailor context retrieval fails — "No job context available for tailoring" — **FIX SHIPPED** (2026-03-21)
  - **Symptom:** Extension saves a job with jobText. User visits pipeline, clicks Tailor. Panel shows "No job context available. Use the extension to tailor this job." despite jobText being sent during save.
  - **Root cause:** TailorPrep was stored as files in `/tmp/.caliber-tailor` on Vercel. Ephemeral serverless storage means files written during pipeline POST don't persist to the serverless instance handling the tailor GET/POST. Additionally, `normalizeJobUrl` didn't handle LinkedIn slug-style URLs (e.g., `/jobs/view/title-at-company-12345/`), and the function was duplicated across `pipeline_store.ts` and `pipeline_store_db.ts`.
  - **Fix (3-part):**
    1. **DB-backed jobText**: Added `jobText` column to `PipelineEntry` Prisma model. `pipelineCreateForSession` now stores jobText directly in the DB. If an existing entry is found without jobText but the new request has it, the record is updated.
    2. **Tailor fallback chain**: `pipeline/tailor/route.ts` GET and POST now try: (a) file-based TailorPrep lookup, then (b) `entry.jobText` from DB. This eliminates dependency on ephemeral `/tmp` storage. File-based TailorPrep kept as secondary for backward compat.
    3. **Unified normalizeJobUrl**: Removed duplicate from `pipeline_store_db.ts`, re-exported from single source in `pipeline_store.ts`. Added slug-style URL handling (`/jobs/view/title-at-company-{id}/` → canonical `/jobs/view/{id}`).
  - **Validation:** TSC clean (0 errors), 179/181 tests pass (2 pre-existing), normalizeJobUrl 6/6 patterns including slug URLs.
  - **Files:** `prisma/schema.prisma`, `lib/pipeline_store.ts`, `lib/pipeline_store_db.ts`, `lib/tailor_store.ts`, `app/api/pipeline/route.ts`, `app/api/pipeline/tailor/route.ts`

93. Sign-in page hangs on "Signing in\u2026" — unhandled promise rejection in signIn flow — **FIX SHIPPED** (2026-03-21)
  - **Symptom:** User clicks "Continue with email" on sign-in page. Button shows "Signing in\u2026" and never completes. Page stuck indefinitely.
  - **Root cause:** `handleEmail()` in `app/signin/page.tsx` called `signIn()` without try/catch. If the call threw (DB connection error, network failure, CSRF issue), `setSending(false)` was never reached. UI showed "Signing in\u2026" forever. Also: beta-email failure path (`result?.ok === false`) set `emailSent(false)` but showed no error message.
  - **Fix:** Wrapped both Nodemailer and beta-email signIn paths in try/catch. Added `authError` state for inline error display. Catch block always calls `setSending(false)`. No-provider edge case returns user-facing error. Cleared `authError` on new attempt.
  - **Files:** `app/signin/page.tsx`

94. Tailor panel shows "Pipeline entry not found" for valid visible cards — resolveEntry DB lookup gated behind auth — **FIX SHIPPED** (2026-03-21)
  - **Symptom:** User saves a job via extension, visits pipeline page, sees the card. Clicks "Tailor resume" — slide-over panel shows error "Pipeline entry not found". Entry visibly exists on the board.
  - **Root cause:** `resolveEntry()` in `app/api/pipeline/tailor/route.ts` only checked DB (`dbPipelineGet`) inside `if (userId)` block. Unauthenticated users with session-based DB entries (created via extension) were never found in DB because the lookup was skipped. Fallback only checked legacy file store (empty for new entries). Additionally, PATCH ownership check `existing.userId !== session.user.id` rejected entries with null `userId` (pre-migration session entries).
  - **Fix:** `resolveEntry()` now calls `dbPipelineGet()` unconditionally for all users (auth'd or not). Linked caliberSession fallback for sessionId only attempted when authenticated. PATCH ownership check changed to `existing.userId && existing.userId !== session.user.id` — allows null-userId entries.
  - **Files:** `app/api/pipeline/tailor/route.ts`, `app/api/pipeline/route.ts`

91. Adjacent Searches recovery term quality — weak-surface recovery strengthening — **FIX SHIPPED** (2026-03-21)
  - **Symptom:** Adjacent search terms were underpowered — only 3 titles from calibration's `selectTwoPlusOne()` (primary + 2 adjacent), not work-mode-aware, no cluster diversity enforcement. Insufficient for weak-surface recovery.
  - **Root cause:** Term generation used calibration output directly (nearby_roles = same 2-3 titles from pattern synthesis). Full 25-title candidate pool from `scoreAllTitles()` was available but never used. Work-mode compatibility data existed but wasn't applied to term ranking.
  - **Fix:** New `generateRecoveryTerms()` function in `lib/title_scoring.ts`. Pipeline: `scoreAllTitles()` → filter primary → filter base score < 1.5 → apply work-mode bonus (compatible +1.5, adjacent +0.5, conflicting -2.0 via `CLUSTER_MODE_MAP`) → filter recovery score < 2.0 → sort by recovery score descending → select 3 with quality-aware cluster diversity (max 1 per cluster unless score gap > 5.0 — prevents forcing weak cross-cluster picks over strong same-cluster candidates) → fallback fill if < 3. Returns `RecoveryTerm[]` with title/score/recoveryScore/cluster/source + `RecoveryDebug` with candidatePool/filtered/selected.
  - **API changes:** `app/api/extension/fit/route.ts` computes and returns `recovery_terms` (array of {title, score, recoveryScore, cluster, source}) and `debug_recovery_terms` (full debug object) alongside existing `nearby_roles`.
  - **Extension changes:** `background.js` relays `recoveryTerms`. `content_linkedin.js` `getAdjacentSearchTerms()` prefers recovery terms over calibration title + nearby roles (fallback preserved for pre-API paths). `updateAdjacentTermsModule()` passes recovery terms through.
  - **Thin-profile support:** Base score floor 1.5, recovery score floor 2.0 (handles Dingus where max title score is 2.3 — all titles scored below original 4.0 floor).
  - **Validation:** `analysis/recovery_term_validation.js` — 85/85 assertions across 10 categories × 4 fixtures. Chris: 3 clusters (ProductDev/CreativeOps/DesignSystems), all ≥9.2. Fabio: 3 SecurityAnalysis (quality-aware diversity), all ≥10.0. Jen: 2-cluster diversity, conflicting penalized. Dingus: 3 terms via thin-profile thresholds.
  - **Regression:** BST 62/62, sidecard 52/52, adjacent 36/36, unit 179/181 (2 pre-existing).
  - **Files:** `lib/title_scoring.ts`, `app/api/extension/fit/route.ts`, `extension/background.js`, `extension/content_linkedin.js`, `analysis/recovery_term_validation.js`, `analysis/adjacent_interaction_validation.js`.

90. Adjacent Searches interaction model — calm-default behavior — **FIX SHIPPED** (2026-03-21)
  - **Symptom (2 UX misses from live PM validation):** (1) Adjacent Searches module exposed only 1 suggestion in practice — `getAdjacentSearchTerms()` capped at 5 but `nearbyRoles[i].title` access missed plain-string entries, and the self-suppression + dedup chain reduced yield below usable count with no debug visibility. (2) Module auto-expanded on repeated BST triggers instead of staying calm — no session flag tracked user intent, so badge pulse re-triggered indefinitely.
  - **Root cause:** (1) Old cap was 5 with display logic `Math.max(3, Math.min(terms.length, 5))` but actual yield was 1 because `nearbyRoles` entries that were plain strings (not objects with `.title`) silently failed. (2) `updateAdjacentTermsPulse()` had no memory of user interaction — pulsed every time classification was "bst" regardless of whether user had already acknowledged the section.
  - **Fix:** (1) `ADJACENT_TARGET_COUNT = 3` constant replaces old cap. `tryAdd()` handles both `nearbyRoles[i].title` and plain string entries. Debug logging emits detailed filter breakdown (selfSuppressed, alreadySearched, duplicate, sanitizeFail, preSeenCount) when fewer than 3 terms available. (2) New `adjacentUserOpened` session flag set on first badge click. `updateAdjacentTermsPulse()` suppresses all pulse when flag is true. Section never auto-expands — stays `display:none` until user clicks badge. (3) Session dedup and self-suggestion suppression preserved intact.
  - **Validation:** `analysis/adjacent_interaction_validation.js` — 36/36 assertions: target count constant, cap enforcement, loop break, self-suppression, session dedup, debug logging (5 filter categories), adjacentUserOpened lifecycle (declare, set, suppress pulse), no auto-expand in updateAdjacentTermsModule or updateAdjacentTermsPulse, showPrescanBSTBanner still disabled, finite badge pulse, no programmatic .click(), surface-change reset (section hidden but session flag retained), plain-string nearby-roles handling, 8 functional simulations.
  - **Regression:** BST 62/62 PASS, sidecard 52/52 PASS, 179/181 unit tests (2 pre-existing).
  - **Files:** `extension/content_linkedin.js`, `analysis/adjacent_interaction_validation.js`.

89. Cap-based mismatch scoring too forgiving for actively bad jobs — **FIX SHIPPED** (2026-03-19)
  - Hard cap 6.5 (conflicting) and soft cap 8.5 (adjacent) prevented false-positive strong matches but did not push truly bad jobs (grind-heavy, rejection-heavy, commission-only) into the obviously-wrong score zone.
  - Property Max house-buying-specialist style roles scored ~6.0-6.5 for Builder profiles — not clearly "avoid" territory.
  - Fixed by replacing caps with weighted scoring adjustments: conflicting=-2.5, adjacent=-0.8, compatible=0. Added execution-intensity detection layer for grind indicators. Combined adjustments push misaligned grind jobs into 3-5 zone.
  - Files: `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`.

88. LinkedIn card title extraction duplication — **SHIPPED** (2026-03-19) → see #83c
  - Duplicate title text in card DOM (e.g. "Sales SpecialistSales Specialist") polluting scoring, BST, and clustering.
  - Fixed by `cleanCardText()` + `canonicalizeCardTitle()`. Applied in both `getVisibleJobCards()` and `scanAndBadge()`.

87. Pipeline save regression (post-sidecard changes) — **FIX SHIPPED** (2026-03-19) → see #83b
  - Pipeline saves failing intermittently after sidecard refactor. Stale async callbacks from previous job executing against wrong sidecard state.
  - Fixed with `sidecardGeneration` guards on pipeline check + auto-save callbacks. Full diagnostic logging added.

86. Sidecard score instability (multi-pass overwrite) — **FIX SHIPPED** (2026-03-19) → see #81
  - Score visibly changes shortly after render (e.g. 7.7 → 6.6). LinkedIn DOM hydration stages cause partial→full rescore.
  - Fixed with text stability wait, request versioning (4 stale checkpoints), and provisional labeling.

85. BST recovery model mismatch (popup vs persistent recovery) — **SHIPPED** (2026-03-19) → see #82
  - BST popup was interruptive, brittle under DOM hydration, and caused loop/empty states.
  - Replaced by persistent "Adjacent Searches" sidecard module. BST evaluation engine preserved for surface intelligence.

84. False-positive strong matches due to missing dominant work mode constraint — **SHIPPED** (2026-03-19) → see #83
  - Execution-heavy roles (sales, support, coordinator) scoring ≥7.0 for misaligned profiles due to keyword overlap without mode awareness.
  - Fixed by dominant work mode classification (5 modes) + 3-tier score governance: conflicting=6.5 cap, adjacent=8.5 soft cap, compatible=no change. 30 tests.

83. Dominant Work Mode Classification + Score Ceiling Override — **SHIPPED** (2026-03-19)
  - **Symptom:** Alignment scoring uses 6 structural dimensions (structuralMaturity, authorityScope, revenueOrientation, roleAmbiguity, breadthVsDepth, stakeholderDensity). Jobs with overlapping process/cross-functional vocabulary could score 7.0+ against misaligned profiles — e.g. an inside-sales role scoring 7.0+ for a Builder/Systems user — because the 6-dim vector doesn't capture *what kind of work* the job fundamentally requires.
  - **Root cause:** Dimension overlap: sales roles with cross-functional stakeholder needs, process improvement language, and low ambiguity scored similarly to systems/product roles on the 6-dim vector. No mechanism existed to detect that the dominant operating mode of the job (sales execution) conflicted with the user's dominant operating mode (builder/systems).
  - **Fix:** Post-scoring classification layer (`lib/work_mode.ts`) classifies both user profile and job into one of 5 work modes via weighted lexical triggers, checks compatibility via deterministic 5×5 map, and enforces a hard ceiling of 6.5 for conflicting modes when both sides have sufficient confidence.
  - **5 modes:** `builder_systems`, `sales_execution`, `operational_execution`, `analytical_investigative`, `creative_ideation`.
  - **User classification source:** Resume text + prompt answers 1, 3, 4, 5 (prompt_2 excluded — it's the "drain" prompt, which contains anti-mode signals that would incorrectly boost conflicting mode scores).
  - **Job classification source:** Full job description text.
  - **Compatibility map (key entries):** builder↔sales=conflicting, analytical↔sales=conflicting, creative↔sales=conflicting, builder↔ops=adjacent, same mode=compatible.
  - **Ceiling rules:** Conflicting modes: hard cap at 6.5 when both modes have confidence ≥ "low" and rawScore > 6.5. Adjacent modes: soft cap at 8.5 (mild compression) when both modes have confidence ≥ "low" and rawScore > 8.5. Compatible modes: no adjustment.
  - **Confidence thresholds:** HIGH ≥ 4 weighted hits, LOW ≥ 2, NONE < 2 (NONE = no ceiling applied).
  - **Debug output:** API response includes `debug_work_mode` object with: userMode, userModeConfidence, userModeScores, userModeMatches, jobMode, jobModeConfidence, jobModeScores, jobModeMatches, compatibility, preScore, postScore, ceilingApplied, ceilingReason.
  - **Functions added:** `classifyText()`, `classifyUserWorkMode()`, `classifyJobWorkMode()`, `getWorkModeCompatibility()`, `applyWorkModeCeiling()`, `evaluateWorkMode()`.
  - **Tests:** 30 regression tests covering classification accuracy (Chris→builder, Fabio→analytical, Jen≠builder), compatibility map, conflicting + adjacent ceiling enforcement, and end-to-end scenarios (Chris vs inside-sales capped <7.0, Chris vs systems role uncapped at 8.2, Fabio vs sales capped, Fabio vs security uncapped, adjacent soft cap at 8.5).
  - **Status:** Shipped. All 30 tests passing, Next.js build verified.
  - **Files:** `lib/work_mode.ts`, `lib/work_mode.test.ts`, `app/api/extension/fit/route.ts`.

83b. Pipeline save regression — generation guards + diagnostic logging — **FIX SHIPPED** (2026-03-19)
  - **Symptom:** Pipeline save (manual and auto) failing intermittently in live usage after sidecard refactoring. Likely caused by stale async callbacks executing against the wrong job's sidecard state when user switches jobs while pipeline check or auto-save is in flight.
  - **Root cause:** `CALIBER_PIPELINE_CHECK` callback and auto-save (`CALIBER_PIPELINE_SAVE`) callback in `showResults()` had no generation guard. If user clicked a new job before the async response returned, the stale callback could call `updatePipelineRow()` against the new job's sidecard, showing wrong pipeline status or silently failing.
  - **Fix:** (1) Captured `sidecardGeneration` at callback-setup time for both pipeline check and auto-save flows. (2) Added stale guard in each callback: if `sidecardGeneration !== capturedGeneration`, the callback is discarded with a diagnostic log. (3) Enhanced logging with source tracing: manual save logs `titleSource`/`companySource` (lastJobMeta vs freshExtract vs sentinel), auto-save logs the same. (4) All save callbacks log `CONFIRMED`/`FAILED` with entry ID, `alreadyExists` flag, and generation context. (5) `updatePipelineRow()` now logs every state transition with current generation.
  - **Status:** Fix shipped. Requires live validation to confirm no more stale cross-job pipeline writes.
  - **Files:** `extension/content_linkedin.js`.

83c. LinkedIn DOM extraction hardening — duplicated title cleanup — **FIX SHIPPED** (2026-03-19)
  - **Symptom:** LinkedIn sometimes renders job card titles as duplicated text (e.g. "Sales SpecialistSales Specialist") in the DOM. While `sanitizeJobTitle` catches and deduplicates the extracted title, the full card `innerText` (used as `jobText` for scoring) still contained the duplicated title, inflating keyword match scores.
  - **Root cause:** `cardText` was the raw `innerText` of the job card element, which included the title area. If the title was duplicated in the DOM, the scoring text contained double the title keywords, affecting scoring, BST evaluation, and clustering.
  - **Fix:** Added `cleanCardText(cardText, rawTitle, canonicalTitle)` function that detects when the title was deduplicated by `canonicalizeCardTitle` and replaces the first occurrence of the raw duplicated title in the full card text with the canonical form. Applied in both `getVisibleJobCards()` and `scanAndBadge()` extraction paths.
  - **Functions added:** `cleanCardText()`.
  - **Status:** Shipped. Diagnostic logging on card text cleanup.
  - **Files:** `extension/content_linkedin.js`.

82. BST popup replaced by persistent Adjacent Search Terms module — **SHIPPED** (2026-03-19, **interaction model locked** 2026-03-21)
  - **Symptom:** The BST (Better Search Trigger) popup banner was an interruptive UI element that appeared above the sidecard, competing for attention and mixing page-level surface intelligence with per-job decision UI.
  - **Change:** Replaced the BST popup banner with a persistent, collapsible "Adjacent Searches" section inside the sidecard, positioned between Bottom Line and the pipeline row. Adjacent terms are populated from calibration title + nearby roles data (same source as BST). Section uses chip-styled links that navigate to LinkedIn search.
  - **Pulse/glow behavior:** The section applies a subtle border glow animation only when: (1) at least 20 jobs have been scored on the current surface, AND (2) the surface is classified as "bst" (weak/poor match-wise). Before those thresholds, the section is calm and inert. Once the user has opened the section (badge click), pulse is permanently suppressed for the session (`adjacentUserOpened` flag).
  - **Interaction model (2026-03-21):** Exactly 3 suggestions displayed (`ADJACENT_TARGET_COUNT=3`). Section collapsed by default. Pulse/glow for attention only — never auto-expand. Debug logging emits filter breakdown when fewer than 3 terms available (selfSuppressed, alreadySearched, duplicate, sanitizeFail counts). Handles both object and plain-string `nearbyRoles` entries. See issue #90.
  - **BST evaluation preserved:** `evaluateBSTFromBadgeCache()` still runs and classifies surfaces (healthy/bst/neutral). Only the popup banner presentation (`showPrescanBSTBanner`) is disabled. Surface classification state drives the adjacent-terms pulse.
  - **Functions added:** `getAdjacentSearchTerms()`, `updateAdjacentTermsModule()`, `updateAdjacentTermsPulse()`.
  - **Status:** Shipped. `showPrescanBSTBanner()` returns early (no-op). Sidecard weak-job BST trigger block replaced with `updateAdjacentTermsModule(data)` call. Interaction model locked (2026-03-21): calm-default, 3 terms, no auto-expand.
  - **Files:** `extension/content_linkedin.js`.

81. Sidecard score flip (High→Low / multi-pass overwrite) — **FIX SHIPPED** (2026-03-19)
  - **Symptom:** Selected-job sidecard score visibly changes shortly after click (e.g. 7.7 → 6.6 within ~1 second). Most noticeable when an initially high score drops lower.
  - **Root cause:** LinkedIn renders job descriptions in multiple DOM hydration stages. `waitForJobDescription()` resolved immediately on finding any text ≥80 chars (partial). First scoring cycle completed with partial text → displayed score A. LinkedIn finished hydrating → poll/observer detected text growth → second scoring cycle ran with full text → displayed score B, overwriting A. The user experienced a visible score flip for the same job.
  - **Contributing factors:** (1) No text stability mechanism — extraction resolved on first DOM hit. (2) No request versioning — stale responses from previous jobs could theoretically overwrite newer results. (3) No visual distinction between partial-text and full-text scores.
  - **Fix (v0.9.19):**
    - **Text stability wait:** After initial extraction, if text < 800 chars, `tryExpandDescription()` is called and a 500ms stability delay allows LinkedIn DOM to finish hydrating. Text is re-extracted and the longer version used. Prevents scoring partial descriptions.
    - **Request versioning:** `sidecardGeneration` (increments on job/URL change) and `sidecardRequestId` (increments per scoring call) are captured at cycle start. Four stale-response checkpoints verify generation/request match before applying results. Mismatched responses are discarded with debug logs.
    - **Provisional labeling:** Scores from text below 400 chars are labeled "(preview)" in the sidecard UI with distinct styling. Authoritative scores replace provisional transparently.
    - **Debug logging:** Each scoring cycle logs: job identity, request ID, generation, extraction phase (full/partial), stability source, text length, payload fingerprint, score returned, and apply/discard verdict with reason.
    - **Trigger logging:** Poll and MutationObserver triggers now log text length changes and generation context before initiating re-scoring.
  - **Authority rule:** Sidecard score comes from one authoritative path only. Prescan/listing scores never overwrite sidecard state. Provisional scores are visually distinct and replaced only by authoritative scores.
  - **Status:** Fix shipped (v0.9.19). Requires validation on repeated clicks across ≥5 jobs.
  - **Files:** `extension/content_linkedin.js`.

80. Landing-page hero communication scope — **DECIDED** (2026-03-17)
  - **Decision:** Pre-beta landing page uses lightweight hero: tagline ("See which jobs actually fit you"), product-preview card (3 scored roles with stagger animation), LinkedIn context line, CTA support copy.
  - **Deferred:** Full animated "Career → Decision → Engine" narrative system deferred to post-beta.
  - **Rationale:** The full animation concept is not the highest-leverage pre-beta use of time. Simple proof-of-product is sufficient for beta launch.
  - **Status:** Decision made. Lightweight hero implemented (v0.9.15). Full animation concept deferred.

79. Surface/job signal mixing via "Best so far" popup — **RESOLVED** (2026-03-17)
  - **Symptom:** Surface-quality banner ("Best so far" popup) attached to sidecard experience mixes page-level comparison signals with current-job decision UI, creating user confusion.
  - **Root cause:** The surface-quality banner renders in the BST slot adjacent to the sidecard. While technically separate from the sidecard template, it occupies the same visual/interaction moment. PM clarified that surface intelligence and job-decision UI are distinct surfaces that should not be mixed.
  - **Fix (v0.9.15):** `showSurfaceQualityBanner` returns early before rendering any DOM. All underlying state preserved: `prescanSurfaceBanner` tracked at all call sites, `pageMaxScore`/`pageBestTitle` computation untouched, `strongCount` evaluation untouched, CSS retained.
  - **Resolution path:** Popup presentation removed. Surface intelligence logic preserved for future overlay/surface-summary features.
  - **Status:** Fix shipped (v0.9.15). Underlying concept available for future reuse.
  - **Files:** `extension/content_linkedin.js`.

78. Signal injection scoring impact uncertainty — **RESOLVED** (2026-03-17)
  - **Symptom:** Uncertainty about whether SGD signal injection (anchor boosts + signal-affinity bonus) could destabilize scoring or surface intelligence behavior at scale.
  - **Validation:** Neon telemetry comparison of signal_off vs signal_on on 28 matched jobs. Mean delta +0.02, 27/28 identical scores, one +0.6 shift, zero threshold crossings (no job crossed >=7.0 boundary).
  - **Conclusion:** Signal injection has negligible scoring impact. Resume/calibration anchors remain the dominant factor. Signal injection PASS for beta.
  - **Status:** Resolved. No longer an active beta risk.

77. Sign-in / durable memory — **FIX SHIPPED** (beta gate 4, 2026-03-21)
  - **Symptom:** User sessions did not persist across browser restarts. Pipeline and calibration data were not durable without sign-in.
  - **Impact:** Beta gate 4 — now closed.
  - **Fix:** Auth system audit confirmed ~85% complete. Two gaps fixed: (1) Added `userId String?` + `@@index([userId])` to TelemetryEvent and FeedbackEvent Prisma models. (2) Added `resolveUserId()` to `/api/events` and `/api/feedback` — resolves via `auth()` for web, then `caliberSessionId→User` lookup for extension.
  - **Validation:** 67/67 assertions across 16 areas (`analysis/auth_gate_validation.js`).
  - **Status:** Shipped and validated. Gate 4 closed.
  - **Files:** `prisma/schema.prisma`, `lib/telemetry_store.ts`, `lib/feedback_store.ts`, `app/api/events/route.ts`, `app/api/feedback/route.ts`.

77c. Magic-link sign-in hardening — **FIX SHIPPED + E2E VALIDATED** (2026-03-22)
  - **Symptom:** Auth included Google OAuth (product decision: no social auth for beta). File→DB migration dropped `sessionId`, breaking tailor prep lookups for migrated users. Tailor store had no userId awareness.
  - **Impact:** Product alignment (email-only auth) + durability fix for tailor lookups after session migration.
  - **Fix:** (1) Removed Google OAuth from `lib/auth.ts`. (2) Simplified sign-in page to email-only flow. (3) `migrateFileEntriesToUser()` now preserves `sessionId`. (4) Added optional `userId` to tailor store interfaces. (5) `pipeline/tailor` route resolves sessionId with fallback to linked `caliberSessionId`.
  - **Validation:** `tsc --noEmit` clean, Next.js build clean, 179/181 tests pass. E2E: `analysis/magic_link_e2e_validation.js` — 114/114 assertions across 16 areas + 5 scenario simulations. No defects found.
  - **Files:** `lib/auth.ts`, `app/signin/page.tsx`, `lib/pipeline_store_db.ts`, `lib/tailor_store.ts`, `app/api/pipeline/tailor/route.ts`.

77b. Tailor resume end-to-end validation — **OPEN** (beta gate 5)
  - **Symptom:** Tailor resume feature is functional (copy/download, retry-on-error, progressive step UI) but has not been validated end-to-end in a real user flow.
  - **Impact:** Beta gate 5 cannot be met without explicit validation.
  - **Status:** Open. Needs explicit end-to-end validation after sign-in is working.

78. Pipeline save not available for low-score jobs — **FIX SHIPPED** (v0.9.23, 2026-03-21)
  - **Symptom:** Pipeline save action was gated behind score ≥7.0 — users couldn't save jobs to pipeline unless the job scored high enough. During PM testing, no job scored high enough to show the pipeline action.
  - **Impact:** Pipeline feature untestable/unusable when browsing poorly-matched searches.
  - **Fix:** Removed score threshold gate from `showResults()`. "Save to pipeline" now available for all scored jobs. Auto-save at 8.5+ preserved. Dedupe rules unchanged.
  - **Files:** `extension/content_linkedin.js`.

79. Adjacent Searches hidden behind cryptic blue-dot — **FIX SHIPPED** (v0.9.23, 2026-03-21)
  - **Symptom:** Adjacent Searches / BST recovery was represented by a small blue ⦿ dot in the sidecard header — too cryptic and not discoverable.
  - **Impact:** Users never discovered adjacent search suggestions. Weak-surface attention was invisible.
  - **Fix:** Removed BST badge from header. Adjacent Searches is now a permanent collapsible section in the sidecard content stack below Bottom Line. Weak-surface attention uses border-glow animation on the section. 3-title output preserved.
  - **Files:** `extension/content_linkedin.js`.

76. Guardrail over-capping prescan scores (21×5.0 collapse) — **FIX SHIPPED** (2026-03-16)
  - **Symptom:** On a real LinkedIn search surface, 21 out of 25 jobs scored exactly 5.0 during prescan. Only 1 scored above 6.0 (7.7). "Best so far" started at 7.1 and only updated to 7.7 at position 23.
  - **Root cause:** `applyDomainMismatchGuardrail()` ran per-card during the badge prescan path. The 3-tier cap (HRC=Unlikely, role-family mismatch, cluster-vs-unclustered) flattened scores to 5.0 before BST/SMC could evaluate the full surface. BST saw a monotone 5.0 wall and could not distinguish genuinely weak jobs from guardrail-flattened ones. Surface quality metrics were destroyed before they could be used.
  - **Fix (v0.9.14):** Removed `applyDomainMismatchGuardrail()` call from badge prescan scoring path entirely. Raw alignment scores now flow into `badgeScoreCache` for BST/SMC evaluation. Guardrail retained on sidecard `showResults()` path only — user sees the capped score when clicking a specific job, but surface-level intelligence uses uncapped scores. Added `[Caliber][SCORE_CAPPED]` diagnostic logging to guardrail function (rawScore, reason, jobTitle, calibrationTitle, clusters, keywordOverlap).
  - **Additional v0.9.14 fixes in same commit:** (1) `scoreSource` field added to all badge cache entries (`card_text_prescan`, `sidecard_full`, `restored_cache`). (2) `restored_cache` entries excluded from `strongCount` in `evaluateBSTFromBadgeCache`. (3) `lastScoredScore` reset on surface change to prevent stale sidecard score leak. (4) Per-entry surface-truth diagnostic logging with source breakdown.
  - **Status:** Fix shipped (v0.9.14). Validated by user — scores now spread naturally across range instead of collapsing to 5.0.
  - **Files:** `extension/content_linkedin.js`.

75. Manual "Add to pipeline" creates no real entry — **FIX SHIPPED** (2026-03-16)
  - **Symptom:** Clicking manual "Add to pipeline" on 7.0–8.4 jobs appeared to succeed in the TRP UI but no entry was visible in /pipeline.
  - **Root cause:** `lastJobMeta.company` was empty string when LinkedIn DOM extraction failed at scoring time. The `CALIBER_PIPELINE_SAVE` handler in `background.js` sent `company: ""` to `POST /api/pipeline`, which returned 400 (`!company` is falsy). `background.js` forwarded `ok: false` but did NOT include `data.error` or HTTP status, so the content script logged `resp.error: undefined` — effectively a silent failure.
  - **Fix:** (1) Both manual and auto-add paths now re-extract job metadata from DOM at action time via `extractJobMeta()` and fall back to sentinel values ("Untitled Position", "Unknown Company"). (2) `background.js` now forwards `error` and `httpStatus` in the `CALIBER_PIPELINE_SAVE` response. (3) Both handlers check `chrome.runtime.lastError` for messaging failures. (4) Pre-send diagnostic logging added: title, company, URL, score.
  - **Status:** Fix shipped. Validation pending with Jen regression profile.
  - **Files:** `extension/content_linkedin.js`, `extension/background.js`.

74. SMC stale boot state on fresh search surfaces — **FIX SHIPPED** (2026-03-16)
  - **Symptom:** Surface Quality Banner (SMC) initialized with stale best score (7.1) on fresh search surfaces even after v0.9.9 cache-reset fixes.
  - **Root cause:** Durable prescan state restore (`CALIBER_PRESCAN_STATE_GET`) was rehydrating `prescanSurfaceBanner` from storage on script init. When the surface key matched, the old `bestScore` was restored before fresh scoring could override it.
  - **Fix (v0.9.10):** Removed `prescanSurfaceBanner = resp.state.surfaceBanner || null` from the durable restore path. SMC now renders only from fresh current-surface scoring. BST restore fields (`prescanBSTActive`, `prescanStoredTitle`) are unaffected.
  - **Prior related fixes:** v0.9.9 addressed cache-reset gaps (clearAllBadges, DOM-presence pruning, prescan cache clear, race condition). This fix addresses the remaining durable-state restore vector.
  - **Status:** Fix shipped (v0.9.10). Validation pending.
  - **Files:** `extension/content_linkedin.js`.

73. BST surface-truth and self-suggestion bugs — **SHIPPED** (2026-03-16)
  - **Symptom (3 defects from Jen validation):**
    1. Surface Quality Banner/SM reported "best result 7.1" when true page max was 8.8 — `bestJobScore`/`bestJobTitle` only tracked highest among strong matches (≥7.0), not true page max.
    2. On aligned surfaces with strong matches, clicking a weak job (< 7.5) caused BST to populate via `showPrescanBSTBanner(bestNearby.title)` in `showResults()`, bypassing page-level BST suppression.
    3. BST persisted suggesting "Account Manager" when the user was already searching "Account Manager" — `showPrescanBSTBanner()` lacked a self-suggestion guard.
  - **Root cause:** (1) Surface banner used strong-match-filtered max instead of true page max. (2) Sidecard `showResults()` called `showPrescanBSTBanner()` directly without checking page-level strong-match presence. (3) `showPrescanBSTBanner()` had no `titlesEquivalent()` check against current query.
  - **Fix (v0.9.7):**
    - (1) New `pageMaxScore`/`pageBestTitle` variables in `evaluateBSTFromBadgeCache()` track true highest score across ALL cache entries. Surface quality banner and debounce upgrade path both use these.
    - (2) Sidecard weak-job BST trigger now checks `badgeScoreCache` for any score ≥ `BST_STRONG_MATCH_THRESHOLD` before allowing `showPrescanBSTBanner()`. If page has strong matches, BST is suppressed.
    - (3) `showPrescanBSTBanner()` now calls `titlesEquivalent(suggestedTitle, currentQuery)` as first guard — returns immediately if match.
    - Diagnostic logging: `[Caliber][BST][surface-truth]` line emitted on every evaluation with strongCount, pageMaxScore, pageBestTitle, currentSelectedScore, currentQuery, bstSuggestedTitle, suppression reason.
  - **Preserved behavior:** Bartender/out-of-scope persistence, BST loop prevention, debounce gating, `initialSurfaceResolved` gate (issue #72).
  - **Status:** Shipped. Validation pending with Jen regression profile.
  - **Files:** `extension/content_linkedin.js`.

72. BST premature rendering on refresh — **ACTIVE / IN FIX** (2026-03-15)
  - **Symptom:** On refresh, BST banner appears first on healthy surfaces (account manager, calibrated title) before being replaced by strong-match banner. On out-of-scope surfaces (bartender), BST suppresses on first load and only appears after clicking another job.
  - **Root cause:** `evaluateBSTFromBadgeCache()` fires after every 5-card scoring chunk. With `BST_MIN_WINDOW_SIZE=5`, the very first chunk can trigger BST on partial evidence before strong matches in later chunks arrive. On refresh, durable prescan state restored stale banners before fresh scoring could override them.
  - **Investigation note:** Strong-match count instability on refresh was investigated and RULED OUT. Counts are stable by surface (account manager 5/5, calibrated title 5/5, bartender 0/5). The bug is purely timing/state-resolution.
  - **Fix:** `initialSurfaceResolved` gate — BST evaluation deferred until initial visible-card scoring queue fully drains. Durable-state banner restore removed; `runSearchPrescan()` always falls through to fresh scoring.
  - **Validation required:** Must be re-validated in BOTH baseline and signal-injected calibration modes before BST can be marked passed.
  - **Status:** Fix shipped. Post-fix validation pending in both modes.
  - **Files:** `extension/content_linkedin.js`.

71. SGD anchor-boost injection + result page display — **SHIPPED** (2026-03-15)
  - Validation proved that prior signal injection (text-based, issue 70) did NOT change calibration title output because multi-word labels don't map through extractBroadTokens, and the anchor weight cap of 5 prevents score shifts for already-well-represented terms.
  - Fix: Two-layer approach in generateTitleRecommendation:
    (a) SIGNAL_SCORING_KEYWORDS dictionary maps ~100 signal labels → scoring-vocabulary terms. These become anchorBoosts applied directly to the anchor weight map (bypassing normal cap 5, max 7).
    (b) Signal-affinity bonus: titles with required/optional term overlap with boosted terms get +0.25/required, +0.15/optional (capped at 1.2 total). This shifts competitive rankings even when the leader is at reqCov cap.
  - Jen validation: Partnerships Manager score 8.4→9.0 with YES, secondary candidates shifted (Account Manager 6.9→7.5, Marketing Operations Manager appeared at 8.2). Title stays same for Jen because signals reinforce existing match — correct behavior.
  - Result page shows "Signals influencing this calibration: X · Y · Z" in green accent text.
  - Yes/No buttons on PROCESSING screen centered.
  - NO selection preserves original behavior.
  - Files: `lib/calibration_machine.ts`, `lib/title_scoring.ts`, `app/calibration/page.tsx`.

70. SGD signal normalization + calibration title influence — **SHIPPED** (2026-03-15)
  - Detected signals previously appeared as raw tokens (e.g. “Buying”, “Drained”, “Fatiguing”).
  - Signal normalization dictionary (SIGNAL_NORMALIZATION, 75+ entries) maps raw anchor tokens → professional labels (e.g. “Buying” → “Procurement Exposure”, “Drained” → “Energy Drain Pattern”).
  - Fallback: tokens not in dictionary get title-cased. SIGNAL_LABEL_MAP + SIGNAL_NORMALIZATION both checked before fallback.
  - Dedup by normalized label prevents duplicate signals in the list.
  - When user selects “Yes, include them”, SET_SIGNAL_PREFERENCE now re-runs `generateTitleRecommendation()` with detected signal terms injected as synthetic prompt text.
  - 30% weight cap: injected signal text cannot exceed 30% of total prompt+signal volume.
  - When user selects “No”, behavior unchanged (resume signals only).
  - Files: `lib/calibration_machine.ts`.

69. BST title suggestion loop — **UNDER VALIDATION** (2026-03-15) — blocked on #72 post-fix revalidation
  - BST sometimes suggested adjacent titles that led to repeated weak surfaces, creating an infinite loop.
  - Root cause: `determinePrescanSuggestion()` and fallback chains only checked `titlesEquivalent(title, currentQuery)` — no session-level memory of previously suggested or searched titles.
  - Fix (v0.9.6, commit `693d5b0`): Session-level tracking via `bstSuggestedTitles` / `bstSearchedQueries` objects. All title selection paths (`determinePrescanSuggestion`, fallback chains, `getCalibrationTitleFallback`) filter against seen titles. Graceful exhaustion when all candidates filtered.
  - Expected behavior: BST must not suggest previously searched or previously suggested titles in the same session.
  - Status: Under validation with Jen regression profile in Desktop Stabilization phase.
  - Files: `extension/content_linkedin.js`.

68. SGD auto-advance bug — **RESOLVED CANDIDATE** (2026-03-15)
  - SGD prompt appeared during calibration PROCESSING screen but calibration progressed to PATTERN_SYNTHESIS without waiting for user input.
  - Root cause: The PROCESSING screen's 700ms polling loop fired ADVANCE events unconditionally. When `detectAdditionalSignals()` populated `detectedSignals`, the loop advanced past the signal choice prompt.
  - Fix (v0.9.6, commit `693d5b0`): Polling pause gate added — when `detectedSignals.length > 0` and `includeDetectedSignals == null`, polling returns early instead of firing ADVANCE. Once user clicks Yes/No (sets `includeDetectedSignals` to boolean), gate opens and polling resumes.
  - Expected behavior: Calibration pauses until explicit Yes/No user selection on detected signals.
  - Status: Under validation in Desktop Stabilization phase.
  - Files: `app/calibration/page.tsx`.

67. Surface-quality banner in BST slot — **SHIPPED** (2026-03-15)
  - BST slot shows surface-quality banner when loaded search surface has ≥1 job scoring ≥7.0.
  - Content: "{count} strong matches · Best: {title} ({score})". Green accent, checkmark icon.
  - Suppresses BST when active. Normal BST recovery when zero strong matches.
  - Durable state persistence. Debounce upgrade for mid-scoring strong match detection.
  - Files: `extension/content_linkedin.js`, `extension/background.js`.

66. Detected signals choice in calibration progress flow — **SHIPPED** (2026-03-15)
  - Calibration PROCESSING screen now detects professional signals from prompt answers not clearly expressed in resume.
  - Shows compact UI module with explicit yes/no choice. No hidden default (`includeDetectedSignals` starts null).
  - `detectAdditionalSignals()` compares prompt vs resume keyword frequency + anchor extraction. Up to 5 labels.
  - `SET_SIGNAL_PREFERENCE` event persists choice. `COMPUTE_ALIGNMENT_OUTPUT` annotates result with signal preference metadata.
  - Extension fit API includes `signal_preference` in response.
  - Files: `lib/calibration_types.ts`, `lib/calibration_machine.ts`, `app/calibration/page.tsx`, `app/api/extension/fit/route.ts`.

65. BST suggestion rendering + surface classification edge cases — **IN PROGRESS** (2026-03-15) — blocked on #72 post-fix revalidation
  - Follow-up to #64. Multiple rounds of live testing (v0.9.3→v0.9.4→v0.9.5).

  **Round 1 (v0.9.3→v0.9.4):**
  - Three failure modes: BST banner without suggestion title, "bartender" not triggering BST + inflated scores, "specialist" not triggering BST.
  - Root causes: `lastKnownCalibrationTitle` not persisted, session backup `titleRecommendation` not extracted on handoff, ambiguous trigger lacked cluster-alignment evidence.
  - v0.9.4 fixes: calibration title persistence, session discover enrichment, 4-level BST suggestion fallback chain, ambiguous cluster-alignment trigger, guardrail gap diagnostic.

  **Round 2 (v0.9.4 live test → v0.9.5):**
  - Four failures persisted:
    1. **BST suggestion still empty**: On calibrated-title search, BST fires but shows "try different search" with no suggested title. Root cause: `adjacent_titles` from synthesis is usually empty (cross-cluster + score >= 6.2 filter too strict). Both server API and background backup extraction only used `adjacent_titles`. Fix: fall back to `titleRec.titles` (all top-3 enriched candidates) when adjacent_titles is empty.
    2. **Overlay badges still visible**: `BADGES_VISIBLE` was true. Fix: set to `false` (silent scoring only — pipeline + BST still run).
    3. **"Bartender" inflated scores + no BST**: User's calTitle (e.g. "Business Operations Designer") doesn't match any ROLE_FAMILY_CLUSTERS → `isRoleFamilyMismatch` returns false → guardrail doesn't fire. Fix: added Tier 3 guardrail — job in known cluster + calTitle NOT in any cluster + zero keyword overlap → cap to 5.0.
    4. **"Specialist" no BST**: Both "specialist" and calTitle have no cluster → `calClusterForEvidence = null` → `noClusterOverlap` skipped → ambiguous trigger only checks avgScore < 6.0 (fails with inflated scores). Fix: added `bothUnclusteredNoOverlap` tertiary trigger — when neither query nor calTitle has a known cluster AND zero keyword overlap → trigger BST.
  - Also fixed: brace/structure bug in `evaluateBSTFromBadgeCache` — cluster evidence counting code was accidentally nested inside for-loop's else branch. Now runs after the loop.
  - Files changed: `extension/content_linkedin.js`, `extension/background.js`, `app/api/extension/fit/route.ts`.
  - BST doctrine update: ambiguous trigger fires on `avgScore < 6.0 OR noClusterOverlap OR bothUnclusteredNoOverlap`.

64. BST trigger + calibration session reliability in LinkedIn extension — **SHIPPED** (2026-03-15)
  - Beta validation revealed BST not appearing when expected across multiple search scenarios.
  - Root causes identified:
    1. **Session not ready when scoring starts**: `runSearchPrescan()` fires 2s after activation, but `discoverSession()` in background fails if session handoff from Caliber tab hasn't completed. Badge batch returns `{ ok: false }`, so `evaluateBSTFromBadgeCache()` is never called.
    2. **No session-ready notification**: After `CALIBER_SESSION_HANDOFF` completes, LinkedIn content scripts are not notified. Scoring stalls until periodic scan retries, which also fail.
    3. **No-session batch error causes rapid fail loop**: On failure, `processBadgeQueue()` retries next chunk in 200ms (same no-session error), burning through the queue with no useful work.
    4. **Missing calibration title disables guardrail**: Without `calibration_title` in API response, `isRoleFamilyMismatch()` returns false, letting out-of-scope jobs (e.g., bartender) score 6/10 instead of being capped to 5.0.
  - Fixes applied:
    - Session pre-check with exponential backoff before badge scoring starts.
    - `CALIBER_SESSION_READY` broadcast from background.js to LinkedIn tabs after handoff.
    - No-session batch errors now use 5s backoff (was 200ms) and re-queue the chunk.
    - `lastKnownCalibrationTitle` fallback ensures guardrail fires even when API omits calibration_title.
    - Diagnostic logging added throughout session hydration, BST evaluation, and scoring pipeline.
  - BST doctrine preserved: aligned + strongCount > 0 → suppress; aligned + no strong → trigger; out-of-scope → trigger; ambiguous → trigger if no strong AND avg < 6.0.
  - Files changed: `extension/content_linkedin.js`, `extension/background.js`.

63. Score color band normalization — **SHIPPED** (v0.8.9, e4669d0)
  - Score color bands locked across all four rendering locations (badge, sidecard score, badge CSS, decision label).
  - Green (#4ADE80): 8.0–10.0 (Strong Fit). Yellow (#FBBF24): 6.0–7.9 (Stretch). Red (#EF4444): 0–5.9 (Skip).
  - Old gray badge class removed — replaced with red for scores below 6.0.
  - Previous inconsistency: score 5.0 rendered yellow/orange in some locations, gray in others.
  - Decision labels locked: Strong Fit >= 8.0, Stretch >= 6.0, Skip < 6.0.

59. Product telemetry event instrumentation — **SHIPPED** (2026-03-14), **UPGRADED TO DURABLE STORAGE** (2026-03-17)
  - Lightweight event capture implemented before beta release so outside-user testing generates usable product data from day one.
  - POST /api/events endpoint accepts events from extension and web app.
  - **2026-03-17:** File-backed JSONL storage (`data/telemetry_events.jsonl`) superseded by durable Postgres (Neon) via Prisma. `TelemetryEvent` model persists all events to shared Neon database. Prior JSONL and SQLite paths did not survive Vercel serverless deploys — production telemetry was being lost between deploys.
  - **Feedback pipeline also migrated:** `/api/feedback` writes to `FeedbackEvent` table via same durable Prisma path.
  - Six events: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used.
  - Non-blocking: all telemetry is fire-and-forget with swallowed errors. No user-facing flow depends on telemetry.
  - **Experiment tagging available (2026-03-17):** `sessionId`, `signalPreference`, and `meta` (JSON) fields are queryable for PM signal-injection ON/OFF validation. PM can tag conditions via sessionId suffix or `meta.experiment`.
  - Primary metric supported: Time-to-Strong-Match (TTSM).
  - Dashboard / analysis layer remains future work. This issue covers event capture + durable persistence.

58. Product metrics / analytics dashboard not yet implemented — **PLANNED / POST-BETA** (2026-03-14)
  - Telemetry event capture layer is now shipped (#59). No dashboard or analysis UI exists yet.
  - First key product metric: **Time-to-Strong-Match (TTSM)** — elapsed time from opening a job search surface to first viewed job with score >= 8.0.
  - Supporting metrics planned: Strong Match Rate, Pipeline Save Rate, Tailor Usage Rate, Calibration Completion Rate.
  - This work is explicitly scheduled for after beta is stable and outside-user testing has started.
  - Prerequisite (event capture) is complete. Dashboard implementation is the remaining work.

57a. Strong-Match Feed (SMF) — discovery engine initiative — **PLANNED / POST-BETA** (2026-03-21)
  - Evolve Caliber from evaluation layer (sidecard on job boards) into discovery engine (dedicated feed of high-fit-only jobs).
  - Aggregate listings from supported sources (LinkedIn, Indeed, etc.), score against calibrated profile, surface only jobs meeting strong-match threshold (>= 7.0, target >= 7.5).
  - Phased: Phase 1 = manual refresh, limited source integration. Phase 2 = continuous aggregation + auto-pipeline seeding with user confirmation.
  - Key constraint: no below-threshold padding — truthful emptiness is acceptable. Scoring integrity is non-negotiable.
  - Dependencies: stable scoring (done), calibration signal (done), pipeline persistence (done), sign-in/memory (done), post-beta TTSM baseline (required).
  - Full specification documented in `Bootstrap/milestones.md` → "Milestone — Strong-Match Feed (SMF)".
  - Status: documented, not active. Blocked by beta completion + metrics baseline establishment.

57. Beta release model / external testing workflow not yet defined — **RESOLVED** (2026-03-14)
  - Two-branch release model implemented: `main` = development, `stable` = production.
  - Vercel production deploy from `stable` branch → caliber-app.com. Preview deploys from `main`.
  - Promotion workflow: validate on main → fast-forward merge to stable → push.
  - No staging/preview confusion — branch separation provides the gate.
  - See `Bootstrap/milestones.md` RELEASE MODEL section for full details.

62. BST trigger — surface-classification model — **SHIPPED** (v0.8.7→v0.8.9)
  - **Old rule (superseded):** Zero-strong-match window — fires when zero jobs in badge cache score >= 8.0, minimum window of 5.
  - **New rule (v0.8.9):** Query-level surface classification via `classifySearchSurface(query, calibrationTitle, nearbyRoles)` returning aligned / out-of-scope / ambiguous.
  - Decision tree: aligned + strongCount > 0 → suppress; aligned + no strong → trigger; out-of-scope → trigger; ambiguous → trigger if no strong AND avg < 6.0.
  - Classification steps: titleEquivalent → nearbyRole match → keyword overlap → cluster comparison → fallback.
  - Named constants: `BST_STRONG_MATCH_THRESHOLD = 8.0`, `BST_MIN_WINDOW_SIZE = 5`, `BST_AMBIGUOUS_AVG_CEILING = 6.0`.
  - Three rounds of live validation: v0.8.7 (genuineStrong approach), v0.8.8 (surface classification), v0.8.9 (aligned-surface strongCount gate).
  - Commits: fbcf06c (v0.8.7), 7ec39fd (v0.8.8), e4669d0 (v0.8.9).

61. Badge discovery coverage fix — **SHIPPED** (2026-03-14, 5133cd7)
  - Some visible cards missed scores until click triggered secondary population.
  - Four root causes fixed: (1) scroll listener lost after surface change — re-attaches on surface switch, (2) early break after first matching selector group — all groups now scanned with Set dedup, (3) fixed initial delay replaced with retry-poll, (4) no viewport buffer — buffer added for off-screen cards about to scroll in.

60. Badge placement normalization — **SHIPPED** (2026-03-14, 27932b1)
  - Inline score badge moved from afterend of logo container to beforeend of content area (below title/company).
  - Selector renamed: `CARD_LOGO_SELECTORS` → `CARD_CONTENT_SELECTORS` targeting `.artdeco-entity-lockup__content` with fallbacks.
  - Badge styling: block display, 13px font, 800 weight, −0.03em tracking, no diamond icon, no background — matches sidecard typographic feel.

56. Overlay job scoring instability risks — **MITIGATED** (2026-03-14)
  - Phase-2 overlay badges inject DOM elements into LinkedIn's job card listing, which LinkedIn can rerender at any time.
  - Three risk categories identified and mitigated:
    1. **DOM rerender duplication:** LinkedIn replaces card DOM nodes during virtual scroll. Mitigation: `MutationObserver` with debounce restores badges from cache; `badgeInjecting` flag prevents self-triggered mutations.
    2. **Badge placement drift:** Content containers can change selectors across LinkedIn A/B tests. Mitigation: multiple fallback selectors in `CARD_CONTENT_SELECTORS`, with prepend-to-card fallback if none match.
    3. **Progressive scoring race conditions:** Batch responses can arrive after surface change or deactivation. Mitigation: `badgeBatchGeneration` counter invalidates stale responses; `active` guard in `processBadgeQueue()` prevents zombie processing.
  - Additional mitigations: scroll listener stored handler ref for clean detach, surface key normalization to prevent false cache invalidation, same-surface URL change detection with badge restoration.
  - Status: all three risk categories mitigated with tested code. Ongoing monitoring needed as LinkedIn changes their DOM structure.

55. OPENAI_API_KEY runtime contract for AI features — **RESOLVED** (2026-03-13)
  - Tailoring, pattern synthesis, and resume skeleton generation all depend on OPENAI_API_KEY at runtime.
  - Previously: each file did its own inline `process.env.OPENAI_API_KEY` check with inconsistent error handling.
  - Fix: shared `lib/env.ts` with `requireOpenAIKey()` guard used by all three consumers.
  - Tailor routes return 503 with safe user-facing message when key is missing; error logged server-side.
  - Env files (`.env.development`, `.env.production`) now document the variable with operator instructions.
  - No secrets committed. Key is server-side only.

54. Alternate career-signal uploads (personality assessments, strengths reports, skills profiles) — **DEFERRED / POST-BETA** (2026-03-13)
  - PM reviewed future product ideas for allowing users to upload non-resume career documents as additional pattern-engine inputs.
  - Product decision: promising future inputs, but explicitly deferred until after beta ships.
  - No implementation, UI, or API changes during beta. Resume-first flow remains the only active upload path.
  - Revisit as post-beta exploration once core flow is shipped and stable.
  - Scope-control entry logged in `Bootstrap/BREAK_AND_UPDATE.md` (2026-03-13).

53. Visual drift from under-specified PM UX handoffs — **MITIGATED** (2026-03-11)
  - PM-to-coder UX tasks were issued without shared visual primitives, relying on local page-level styling instructions only.
  - Result: repeated visual drift and regressions requiring correction passes after each UX implementation.
  - Root cause: no mandatory contract requiring shared visual rules on UX handoffs.
  - Mitigation: process contract added — UI Constitution (`docs/ui-constitution.md`) is now mandatory for all UX/UI coder tasks; Layout Skeleton (`docs/layout-skeleton.md`) is additionally mandatory for layout/composition tasks.
  - PM operating rule added to `Bootstrap/PM_bootstrap.md`; durable invariant added to `Bootstrap/kernel.md`.
  - Coder must reject UX tasks missing the required references.
  - Status: process fix documented and enforced. Effectiveness to be verified on next UX coder task.

52. Pipeline dashboard lacked direct action workflow — **RESOLVED** (2026-03-11)
  - Users were forced to leave the pipeline dashboard to tailor resumes (redirected to /tailor).
  - Archive (X) control was too small for reliable click/touch targeting.
  - Resolved by adding inline TailorPanel component that opens within pipeline cards.
  - Archive control enlarged to 28×28px hit area with SVG icon and aria-label.
  - Generate route extended to accept pipelineId for pipeline-initiated tailoring.

48. Extension sidecard collapsed height instability — **RESOLVED** (2026-03-20, v0.9.21)
  - The sidecard previously changed height between scored jobs due to three variable elements:
    (a) High-confidence label (8.5+ only) added a block line to toprow (+~20px).
    (b) Pipeline row (7.0+ only) appeared/disappeared via display:none (+~25px).
    (c) Skeleton state hid all collapsible section toggles, causing skeleton→results reflow jump.
  - Fix (v0.9.21): (a) High-conf label absolute-positioned within toprow's reserved 24px padding-bottom — never affects container height. (b) Pipeline row uses visibility:hidden + min-height:24px when hidden — always occupies its layout slot. (c) Skeleton preserves section toggle visibility — clears content without hiding. User's expand/collapse state preserved across job switches.
  - Collapsed card height is now identical across all score states (low, mid, high 8.5+ CTA).

44. Better Search Title trigger — **UPDATED** (surface-classification trigger v0.8.9)
  - **Old rule (superseded):** Rolling window of last 4 scored jobs; 3/4 below 6.5 and none >= 7.5.
  - **Intermediate rule (superseded):** Zero-strong-match window — fires when zero jobs score >= 8.0 in cache of 5+.
  - **Current rule (v0.8.9):** Query-level surface classification via `classifySearchSurface()`. Aligned surfaces with strongCount > 0 suppress BST; all other conditions may trigger.
  - Named constants: `BST_STRONG_MATCH_THRESHOLD = 8.0`, `BST_MIN_WINDOW_SIZE = 5`, `BST_AMBIGUOUS_AVG_CEILING = 6.0`.
  - Threshold separation: 8.0 = discovery strong-match (BST suppression), 8.5 = pipeline auto-save (`PIPELINE_AUTO_SAVE_THRESHOLD`). These must not be conflated.

49. Auto-save strong-match jobs into pipeline — **QUEUED** (2026-03-11)
  - Jobs scoring >= 8.5 should be auto-saved into the pipeline with canonical URL dedupe.
  - Distinct from the 8.0+ tailor CTA threshold.
  - Not active implementation — queued behind #44.
  - Soft-lock: blocked by #44 validated complete.

50. Post-save confirmation / action state in sidecard — **QUEUED** (2026-03-11)
  - After auto-save, the sidecard should show a confirmation / action state (e.g., "Saved to pipeline").
  - Not active implementation — queued behind #49.
  - Soft-lock: blocked by #49 validated complete.

51. Account prompt for durable pipeline saving — **QUEUED** (2026-03-11)
  - Pipeline data currently requires no authentication — ephemeral.
  - Need account/auth prompt so pipeline saving persists across sessions.
  - Not active implementation — queued behind #50.
  - Soft-lock: blocked by #50 validated complete.

25. Job Board Adapter Architecture — **OPEN** (2026-03-10)
  - Decision: site-specific adapters required before expanding to additional job boards.
  - Each adapter exports extractJobData() → normalized job object (title, company, location, description).
  - Scoring engine must consume only the normalized object, never site-specific DOM logic.
  - Adapters: linkedinAdapter (refactor from inline), indeedAdapter, glassdoorAdapter, ziprecruiterAdapter, monsterAdapter.
  - This is the required foundation for Phase 1 multi-board coverage.
  - Implementation not yet started — architecture decision documented first.

21. Extension session handshake requires refresh after installation — **OPEN** (2026-03-08)
  - Fresh install or refresh causes "no active session" on LinkedIn until manual page refreshes of both Caliber and LinkedIn tabs.
  - Top blocker for extension-first flow.

22. Hiring Reality Check implementation — **ACTIVE** (2026-03-08)
  - Add hiring-reality signal to extension sidecard as next product feature after handshake reliability.

23. Sidecard compact UX redesign — **ACTIVE** (2026-03-08)
  - Decision-first compact layout for extension sidecard. Sequenced after Hiring Reality Check.

24. Calibration multi-title scoring confusion — **RESOLVED** (2026-03-08)
  - Calibration page previously showed multiple scored titles, causing users to interpret low scores as failure.
  - Resolved by redesigning calibration page as extension launchpad with a single hero title direction and no scores.

0. PM drift: afterthought additions and premature long tasks violate distilled UX. Enforce No-Afterthoughts + Input-First rules in PM mode. (2026-03-04)
1. TITLES step: session.synthesis.marketTitle/titleExplanation can be null in TITLE_DIALOGUE; Continue may misroute (JOB_REQUIRED/0-10 pending)
2. Title suggestion missing/null blocks job description entry; must surface job description gate reliably
3. Post-score LLM dialogue mode: toggle and UI implementation pending after Fit score + summary page (deferred)
4. Routing/polling fragility: session state checks can be stale, causing UI to hang or misroute (partially mitigated, but still relevant)
5-season. Title scoring calibration — **RESOLVED** (2026-03-05)
  - Strong profiles → top 3 titles ≥7 (at least one ≥8); weak/generic/thin → hard cap ≤5.0
  - lib/title_scoring.ts added; scripts/title_scoring_smoke.ts updated with band assertions
5. Score+summary page contract → **inline results panel on JOB_TEXT step** — **RESOLVED** (2026-03-03)
	- Fix commit: 57f1c68
	- Results now render inline on the JOB_TEXT step in /calibration (no separate score page or /results navigation).
	- Contract:
		- Show **Job Title** (best available title from synthesis / title recommendation)
		- Show **Fit Score** (0–10, deterministic)
		- Show exactly **3 sentences** of "why good/bad fit" summary (truncated if longer)
		- Error surfaces **real error string** from backend (no generic "A terminal error occurred" banner)
6. ALIGNMENT_OUTPUT gate: ADVANCE invalid; must COMPUTE_ALIGNMENT_OUTPUT (2026-03-01)
	- UI/Backend divergence: UI does not consistently execute COMPUTE_ALIGNMENT_OUTPUT or handle TERMINAL_COMPLETE/result

13. Clarifications dialogue panel — **RESOLVED** (2026-03-05)
  - Removed entirely from UI. No "Does this feel accurate?" chat. Titles render clean without dialogue.

14. Results separate page behavior — **RESOLVED** (2026-03-05)
  - Results now render as inline FitAccordion in the job region under titles. No RESULTS step, no page navigation.
  - Unified screen: titles stay visible; job textarea replaced with accordion when results exist.

15. Bottom line paragraph repetition — **OPEN** (2026-03-05)
  - Fit "Bottom line" can repeat phrases verbatim from stretch bullets (e.g., "tenure at scale" appears in both).
  - stretchLabel() de-dup partially mitigates but not fully doctrine-tight.
  - Need anti-repetition / paraphrase rule (no phrase bans; just de-dup).

16. Browser extension Phase 1 MVP — **RESOLVED** (2026-03-06)
  - LinkedIn job detail extraction via Chrome extension: verified working end-to-end.
  - Live confirmed behavior: user clicks LinkedIn job detail → clicks Caliber extension → popup extracts job description → calls production API → renders fit score (4.3/10 confirmed live screenshot).
  - Popup shows: score, supports-fit bullets, stretch factors, bottom line, Recalculate, Open in Caliber.
  - Resolved blockers during development:
    - Stale/old extension package repeatedly loaded instead of current `extension/` folder build.
    - Missing `scripting` permission broke `executeScript` fallback.
    - `localhost` API base caused fetch failure from user machine.
    - Bare-domain (`caliber-app.com`) vs www-domain mismatch caused 307 redirect → CORS preflight failure.
    - `/api/extension/fit` CORS needed exact `chrome-extension://...` origin echo, not wildcard.
  - Canonical production host confirmed: `https://www.caliber-app.com`.
  - Key commits: a9565d9, 66d1bf4, dd5da13 (domain alignment, CORS fix, host_permission cleanup).

17. Extension popup explanation rendering sparse — **OPEN** (2026-03-06)
  - In some runs the popup explanation content (supports-fit, stretch, bottom line) is sparse or incomplete.
  - Likely related to bottom-line doctrine polish (#15).

18. Sister-profile title scoring — **OPEN** (2026-03-06, saved issue)
  - A sister-profile run produced only one low-scoring title with no three options/dropdown.
  - Needs investigation to determine if title scoring bands are too restrictive for certain profile types.

19. Extension Phase 2: listings-page overlay — **SHIPPED / POST-GATE** (2026-03-14)
  - Phase-2 overlay scoring shipped and stable. Extension operates as a two-layer surface: discovery badges on LinkedIn search result cards + decision sidecard on selected job.
  - **Not a beta gate.** Overlay is valuable discovery-layer work that continues in parallel, but beta readiness is defined by five core functional gates (BST, sidecard, pipeline, sign-in/memory, tailor). Overlay completion is not required before declaring beta.
  - Badge placement: below title/company line in `.artdeco-entity-lockup__content` (normalized 27932b1). Block display, 13px/800 weight, no icon.
  - Badge discovery: all selector groups scanned with Set dedup, scroll listener re-attached on surface change, retry-poll replaces fixed delay, viewport buffer added (5133cd7).
  - Original deferral reason (scoring credibility) resolved — badge system is stable with cache, progressive scoring, and mutation observers.

20. Title rows may render without expandable detail — **OPEN** (2026-03-06, regression risk)
  - Intended behavior: each recommended title row is expandable with a ~2-sentence summary and 3 explanatory bullet points (see `PROJECT_OVERVIEW.md`).
  - Failure mode: if `summary_2s` or `bullets_3` are missing/null from the enrichment pipeline, title rows degrade to flat score-only rows with no expandable detail.
  - This can happen silently — the UI renders without error, but the user sees no explanation for the title recommendation.
  - Root cause when it occurs: enrichment data not populated by title scoring or pattern synthesis; or data shape changed without updating the rendering path.
  - This is distinct from issue #18 (sister-profile producing only one title); this issue is about per-title detail completeness regardless of how many titles appear.

## Acceptance Test Snippet (2026-03-01)

```sh
# Create session, submit prompts, submit job text (>=40 chars), reach ALIGNMENT_OUTPUT
# POST COMPUTE_ALIGNMENT_OUTPUT, GET /api/calibration/result returns score_0_to_10 (not always 0 if anchors match)
curl -X POST http://localhost:3000/api/calibration/event \
  -H "Content-Type: application/json" \
  -d '{"type":"COMPUTE_ALIGNMENT_OUTPUT","sessionId":"<SESSION_ID>"}'
curl http://localhost:3000/api/calibration/result?calibrationId=<SESSION_ID> | jq .
```
7. State-gate hazards discovered: SUBMIT_JOB_TEXT invalid in CONSOLIDATION_PENDING and CONSOLIDATION_RITUAL; requires ADVANCE ticks (sleep between ticks in RITUAL)
8. Clarifier hazard: short prompt answers (<40 trimmed chars) can route to PROMPT_n_CLARIFIER and break naive scripts
9. Resume upload MIME hazard: resume fixture must use supported MIME type (e.g., text/plain for .txt)

10. BREAK_AND_UPDATE.md drift: Step 2 "no fenced code blocks / single line" contradicted actual PM→Coder handoff format — **RESOLVED** (2026-03-02)
    - Contract now explicitly allows structured task blocks (fenced or multi-line); kernel.md payload section updated to match.

11. Relationship/team profiles were mis-labeled as Program/PM with low confidence — RESOLVED (2026-03-02)
  - Fix commit: f36dff0
  - Cleanup commit: 166baa4
  - Evidence: Jen fixture now outputs 5 titles >=7; Chris ClientGrowth scores ~1.0 (no bleed)

12. Low-confidence titles need in-flow recovery without editing prompts — RESOLVED (2026-03-02)
  - Fix commit: 057bc39
  - Added RERUN_TITLES event: collects user dialogue messages (max 600 chars), appends as additive anchor source, re-runs title scoring in-place
  - Guardrails: no prompt/resume mutation, no state transition, no job-fit impact; titles-only update

## Mitigations / Working Rules

- Reject any multi-file patch when task expects one file.
- Require git diff --name-only == expected file(s) before applying.
- No ‘compiled/200 OK’ claims without user-provided logs.
- Added Remote Visibility Rule and Divergence Playbook to contract to prevent recurrence.
- Smoke-first: calibration fixes must be proven via smoke terminal complete + result before UI debugging.
---

## Issues Added 2026-03-07

21. Calibration title-quality / low-score issue — **OPEN** (2026-03-07)
  - Fabio and Jen profiles produced weak or low-scoring outputs.
  - Strong profiles should produce top-3 titles scoring 7.0+; these profiles fell below that bar.
  - Title grounding and the 2 + 1 model (2 strong fits + 1 adjacent credible) need improvement.
  - Related: #18 (sister-profile), #20 (missing enrichment).

22. Abstract title-family drift — **OPEN** (2026-03-07)
  - System can over-index on abstract behavioral traits (clarity, systems thinking, communication) and produce role families with no domain support.
  - Example: cybersecurity user → "Brand Systems Designer" output.
  - Root cause: synthesis pipeline weighted pattern signals too heavily relative to domain/resume signals.
  - Guard needed: title selection must verify domain support from resume, not just trait-pattern alignment.
  - See `docs/calibration_product_logic.md` for full description.

23. Calibration results-page regression risk — **OPEN** (2026-03-07)
  - Removed sections (Where You Operate Best / Lose Energy / pattern summary prose) were reintroduced by implementation drift in prior iterations.
  - These sections are intentionally removed from the intended flow.
  - This is a known UX regression to guard against.
  - Intended flow: typewriter intro → title cards → extension CTA. Nothing else.
  - See `docs/calibration_results_ux.md` for canonical spec.

24. Extension panel integration instability — **OPEN** (2026-03-07)
  - Multiple extension branches caused renderer / persistence / packaging regressions.
  - Lesson: only one extension branch at a time should make major changes to `extension/content_linkedin.js`.
  - Integration discipline is required — parallel extension work needs a tightly controlled merge plan.

---

## Issues Added 2026-03-08 (Extension-First Update)

31. Extension handshake / session discovery bug on fresh install or refresh — **OPEN, KNOWN FRICTION** (2026-03-08, updated 2026-03-10)
  - After calibration completes and user installs or refreshes the extension, opening LinkedIn may show "no active session" until the user manually refreshes both the Caliber tab and the LinkedIn tab.
  - Known friction point but no longer top blocker — primary user flow works after initial refresh.
  - Downgraded from BLOCKING to known friction (2026-03-10).

32. Hiring Reality Check — **RESOLVED** (2026-03-10)
  - Hiring Reality Check implemented and shipped in extension sidecard.
  - Shows band (High / Possible / Unlikely) with color-coded badge and reason text.
  - Collapsible section in compact sidecard layout.
  - Resolved as part of extension-first UX stabilization.

33. Sidecard compact / decision-first UX polish — **RESOLVED** (2026-03-10)
  - Compact sidecard layout shipped: two-column header (identity left, score+decision right), collapsible HRC/bottomline/supports/stretch.
  - Panel narrowed 340→320px, max height 480→420px.
  - Decision-first scanline: score and verdict visible at a glance without scrolling.

34. Calibration-page UX simplification (extension-first launchpad) — **RESOLVED** (2026-03-08)
  - Calibration results page is now an extension-first launchpad.
  - Single hero title direction replaces multi-title scored list.
  - Title scores removed from calibration page.
  - Manual paste removed as primary continuation path.
  - Extension CTA is the primary action on this screen.

---

## Issues Added 2026-03-08 (Scoring Credibility)

25. Scoring compression / credibility for Jen and Fabio — **RESOLVED** (2026-03-09)
  - Title scoring baseline verified with canonical fixture profiles (Chris, Jen, Fabio, Dingus).
  - Canonical fixture profiles created and committed to `fixtures/calibration_profiles/`.
  - Smoke test (`scripts/title_scoring_smoke.ts`) now imports the canonical scoring library; stale inlined scoring logic removed.
  - Fabio correctly maps to SecurityAnalysis cluster.
  - Jen correctly maps to CreativeOps / partnerships outputs.
  - Cross-cluster isolation preserved.
  - Thin-input caps preserved (Dingus weak-profile control).
  - Smoke baseline: 45 passed, 0 failed.
  - No longer a blocking issue.

26. Market-job scores low despite high calibration title scores — **OPEN** (2026-03-08)
  - User's own calibration can produce high title scores (7+), but real LinkedIn jobs searched under those same calibrated terms often score mostly below 6, with rare ~7+.
  - This suggests job-score weighting and/or search-surface limitations, not just calibration failure.
  - May require tuning of job-fit scoring weights or expansion of title search surface.
  - Related: #25 (scoring compression), #27 (search-surface gap).

27. Search-surface limitation / adjacent-title discovery gap — **OPEN** (2026-03-08, product learning)
  - Calibration titles are a starting hypothesis, not a complete market-search solution.
  - Real-market discovery may require adjacent/expanded title families to surface strong-fit jobs.
  - Current scope: acknowledge gap, do not solve. Deferred to post-beta-stability phase.
  - Related: #26 (market-job score gap).

28. Extension sidecard ambiguity — active job identity missing — **RESOLVED** (2026-03-10)
  - Resolved: compact sidecard now shows company name and job title in the top row header.
  - Two-column layout: identity left, score+decision right.
  - No longer ambiguous which job the score refers to.

29. Prod/dev environment split — **RESOLVED** (2026-03-08)
  - Production extension locked to `https://www.caliber-app.com` only.
  - Dev extension locked to `http://localhost:3000` only.
  - No host fallback behavior in either build.
  - Production site + extension verified working live.
  - This must not regress. See `ENVIRONMENT_SPLIT.md` and `CALIBER_EXECUTION_CONTRACT.md` environment rules.
  - Guard: if any code change reintroduces multi-host fallback or cross-environment host permissions, treat as regression.

30. Extension Phase 2 — listings-page overlay (UX contract finalized) — **SHIPPED / POST-GATE** (2026-03-14)
  - Phase-2 overlay is shipped and stable. See #19 for current status.
  - **Not a beta gate.** Overlay work continues as parallel improvement; does not block beta declaration.
  - UX design finalized and documented in CALIBER_CONTEXT_SUMMARY.md (Phase-2 Extension Overlay UX Contract).

---

## Issues Added 2026-03-10 (Strong-Match Action + Resume Tailoring + Job Pipeline)

35. Strong-match resume-tailoring workflow — **ACTIVE** (2026-03-10, product initiative)
  - Jobs scoring 8.0+ should trigger a contextual "Tailor resume for this job" action.
  - Workflow: extension detects 8.0+ → shows above-sidecard contextual card → user clicks → extension POSTs job context to `/api/tailor/prepare` → web app `/tailor` page opens → user generates tailored resume via OpenAI → downloads tailored resume text.
  - Tailoring uses the user's existing uploaded Caliber resume (`session.resume.rawText`) plus the live job context (title, company, description) from the extension.
  - Tailoring must NEVER fabricate experience, skills, or accomplishments. Only reorder, emphasize, and adjust language.
  - Language: "Tailor resume for this job" — not "Apply for this job."
  - The contextual card renders above the sidecard (like the recovery banner), not inside it.

36. Simple job pipeline/tracker — **ACTIVE** (2026-03-10, product initiative)
  - Caliber gains a minimal job pipeline/tracker for strong-fit opportunities.
  - Pipeline stage model (intentionally minimal):
    - Strong Match — job scored 8.0+, saved to pipeline
    - Tailored — resume tailored for this job
    - Applied — user self-reports application
    - Interviewing — user self-reports interview stage
    - (optional) Offer / Archived — non-primary stages, available but not featured
  - Pipeline is NOT a CRM. No subtasks, no notes fields, no timeline features, no due dates.
  - Anti-bloat principle: pipeline exists to maintain clarity about strong opportunities, not to manage a job search workflow.
  - Web app `/pipeline` page lists entries with stage badges, advance/archive controls.
  - API: GET/POST/PATCH `/api/pipeline`.

37. Noise control for strong-match CTA — **PARTIALLY RESOLVED** (2026-03-10, updated)
  - Baseline suppression is live: extension suppresses the 8.0+ tailor CTA for jobs already present in the user's pipeline. This eliminates repeated CTA exposure for jobs the user has already acted on.
  - Remaining refinement (OPEN): per-session and time-based suppression rules for jobs not yet in pipeline. Guard against CTA fatigue for first-time 8.0+ exposures across a browsing session.
  - The 8.0+ contextual card must remain low-noise and non-intrusive.
  - Guard against CTA fatigue: contextual action should feel like a helpful next step, not a persistent nag.

---

## Issues Added 2026-03-10 (Extension-First UX Stabilization)

35. Calibration results page final polish — **RESOLVED** (2026-03-10)
  - Hero title reduced ~10% (text-[1.7rem] / text-[2.4rem]).
  - Section label changed to font-light.
  - "Search on LinkedIn" is now green primary CTA.
  - "See why it fits" is now scoring-yellow secondary.
  - "WHY IT FITS" label removed from explanation dropdown.
  - Explanation dropdown opens with "Your pattern matches on 4 core signals."
  - All technical language removed from explanation copy (no "Action-artifact evidence", "Evidence pairs", "Gap areas", "anchor coverage").
  - summary_2s and bullets_3 generation in title_scoring.ts rewritten for human-friendly language.

36. Extension sidecard compact decision-first layout — **RESOLVED** (2026-03-10)
  - Compact two-column header: company+title left, score+decision right.
  - Hiring Reality Check as collapsible section with band badge.
  - Bottom line collapsible, collapsed by default.
  - Supports fit: green toggle, collapsible with bullet count.
  - Stretch factors: yellow toggle, collapsible with bullet count.
  - Panel 320px wide, 420px max height.
  - Extension v0.4.1 built, zipped, deployed.

37. Extension version cache-bust discipline — **RESOLVED** (2026-03-10)
  - Stale v0.3.5 zip was being served due to CDN caching.
  - Bumped to v0.4.0, then v0.4.1 with new filenames to bust Vercel CDN cache.
  - Rule: always bump version AND rename zip file when rebuilding extension for deployment.

---

## Issues Added 2026-03-10 (Pipeline Truthfulness + Extension v0.6.0)

38. Pipeline entry persisted at prepare time — **RESOLVED** (2026-03-10)
  - Pipeline entry is now created at `/api/tailor/prepare` time in `strong_match` stage, not only after tailoring completes.
  - Pipeline advances to `tailored` during `/api/tailor/generate`.
  - `/tailor` confirmation banner is gated by actual pipeline existence — only shown when backed by a real entry.
  - This corrects prior behavior where pipeline persistence began only after tailoring was complete.

39. Extension bug-report feedback action — **RESOLVED** (2026-03-10)
  - Extension feedback row now includes a separate bug-report action, distinct from thumbs-down quality feedback.
  - Bug reporting is for extension issues (crashes, rendering errors, incorrect behavior). Thumbs-down remains for scoring/content quality feedback.
  - Shipped in extension v0.6.0.

40. Extension v0.6.0 — **RESOLVED** (2026-03-10)
  - Extension bumped to v0.6.0 with: pipeline truthfulness (prepare-time persistence), CTA suppression for jobs already in pipeline, separate bug-report action in feedback row.

---

## Issues Added 2026-03-11 (Visual Shell Re-Lock + Pipeline Board + Tailor Recompose)

### Resolved / Annotated (this session)

35 (action). Strong-match resume-tailoring workflow — **SHIPPED** (2026-03-10, updated 2026-03-11)
  - Workflow is end-to-end functional: extension 8.0+ CTA → tailor/prepare → /tailor page → generate → download.
  - Pipeline persistence at prepare-time is live. CTA suppression for pipeline-existing jobs is live.
  - Remaining: validate tailoring quality, determine text vs PDF download.

36 (action). Simple job pipeline/tracker — **SHIPPED → EVOLVING** (2026-03-10, updated 2026-03-11)
  - Original list view shipped 2026-03-10.
  - Rebuilt as 4-column board (2026-03-11): Resume Prep → Submitted → Interview Prep → Interview.
  - Legacy stages auto-map to new board columns. Cards moveable between columns.
  - Code is implemented. Product-level board model validation is active/next. See #45.

38 (pipeline). Pipeline entry persisted at prepare time — **RESOLVED** (2026-03-10, confirmed 2026-03-11)
  - Pipeline entry created at prepare time. Pipeline dedupe based on canonical/normalized job URL.
  - `/tailor` confirmation banner truthfully gated by actual pipeline existence.
  - CTA suppression prevents repeat Tailor CTA for jobs already in pipeline.
  - These are all shipped and confirmed as current behavior.

### New Issues

41. Visual shell drift / inconsistent composition — **REOPENED** (2026-03-11, corrected)
  - Shell composition was inconsistent across calibration main page, upload/ingest steps, results/TITLES step, tailor page, and pipeline pages.
  - Visual drift accumulated from repeated incremental UI tweaks across sessions.
  - Three-zone shell stabilization was attempted (e408b64) but introduced further documentation/implementation drift. That framing has been superseded.
  - Visual baseline restored to commit a211182 (7b03a18): lowered header + lowered ambient gradient across all pages. This is the current stable visual baseline.
  - Broader shared-shell framework (single owner for gradient, hero offset, content width) is NOT yet locked. Pages use page-local shell ownership.
  - Approved primitives still apply: wide ambient gradient over #050505, outlined green buttons, no sharp centered line, calm dark premium feel.
  - "Match the pipeline page" is NO LONGER a valid design instruction — must reference approved visual primitives and a211182 baseline values.
  - **Remaining:** Shared shell framework decision (see #47).

42. Tailor page hierarchy mismatch — **SHIPPED** (2026-03-11, complete)
  - Prior state: CaliberHeader dominated the tailor page, job context secondary, pipeline banner at top.
  - Fixed: "Tailor Resume" is now the primary heading, CaliberHeader removed, job title/company card first, pipeline confirmation banner demoted.
  - Additionally completed (2026-03-11): copy-to-clipboard action, retry-on-error for generation failures, polished result area with copy/download actions, tightened spacing. Tailor page is launch-ready.

43. Extension debug/report affordance clarity — **PARTIALLY RESOLVED** (2026-03-11)
  - Prior state: bug-report button was icon-only (🐛) — unclear affordance.
  - Fixed: button now shows "🐛 Report" with explicit text label.
  - Bug reporting remains distinct from thumbs-down quality feedback.
  - May need further UX refinement if the combined icon+text is still not clear enough in the compact feedback row.

44. Better Search Title trigger verification — **RESOLVED** (2026-03-20)
  - Validation audit found three live issues, all fixed in v0.9.20:
  - **(a) Cache pruning scroll instability:** `evaluateBSTFromBadgeCache()` pruned cache entries when LinkedIn virtualized cards out of the DOM on scroll. This caused classification to oscillate (healthy→bst→healthy) as the user scrolled. Fix: cache entries are no longer pruned during BST evaluation; cache is only reset on explicit surface change (`clearAllBadges`).
  - **(b) Adjacent-terms pulse invisible until first sidecard click:** `updateAdjacentTermsModule()` was only called from `showResults()` (sidecard scoring), so the BST badge never pulsed if the user hadn't clicked a job yet. Fix: `evaluateBSTFromBadgeCache()` now pre-populates adjacent terms from `lastKnownCalibrationTitle` / `lastKnownNearbyRoles` when classification transitions to bst/healthy and terms are not yet rendered.
  - **(c) Phantom suggestion consumption:** `bstMarkSuggested(title)` was called before the disabled `showPrescanBSTBanner()`, recording titles as "used" even though the popup is disabled. Fix: `bstMarkSuggested()` removed from this path; titles are not consumed unless actually presented to the user.
  - **(d) Threshold doc mismatch:** Docs referenced simple thresholds (weak < 6.5, strong >= 7.5) but code uses a two-phase composite classifier (`BST_STRONG_MATCH_THRESHOLD = 7.0`, `BST_AMBIGUOUS_AVG_CEILING = 6.0`, healthy requires >=2 strong or >=1 at 8.0+). Docs updated to describe actual composite behavior — no threshold constants changed.
  - The v0.8.x simple-threshold model is fully superseded by the v0.9.17 two-phase classifier. All doc references updated.

45. Pipeline board product validation — **OPEN** (2026-03-11, active/next)
  - Pipeline rebuilt from list to 4-column board: Resume Prep → Submitted → Interview Prep → Interview.
  - Code is fully implemented with legacy stage auto-mapping, new API stages, DnD card movement between columns, fit score display on cards, and visibility reload on tab focus.
  - Product validation needed: Are these the right columns? Are the names correct? Is the board the right metaphor?
  - Board must remain lightweight and anti-CRM in spirit — no subtasks, notes, timelines, due dates.
  - This is a product-level decision, not just a code task.

46. Upload/ingest page shell alignment — **PARTIALLY RESOLVED** (2026-03-11, corrected)
  - Upload page redundant heading removed (3651ac1), layout spacing tightened.
  - CALIBER header and gradient lowered ~12% across all pages (a211182).
  - ~~Three-zone shell applied consistently including upload/ingest pages (e408b64).~~ _(Superseded — three-zone framing rolled back.)_
  - Upload support text ("PDF, DOCX, or TXT") alignment corrected (centered).
  - Interactive surfaces remain clearly visible and usable against dark shell.
  - Visual baseline from a211182 applies; shared shell framework not yet locked (see #47).

47. Shared shell framework decision — **OPEN** (2026-03-11, new)
  - Current state: each page owns its own shell locally (gradient, hero offset, content width). No shared shell component.
  - The three-zone shell framing was attempted this season as a shared organization model but introduced drift; rolled back to a211182 baseline.
  - Decision needed: build a true shared shell component (single owner for gradient, hero offset, content width) OR continue with page-local ownership and the a211182 baseline as the visual anchor.
  - If shared: define who owns it, what it controls, and how pages opt in.
  - If page-local: accept that per-page visual consistency must be maintained manually and document the a211182 baseline values as the coordination reference.

48. Pipeline PATCH IDOR — **RESOLVED** (2026-03-21, v0.9.21)
  - PATCH /api/pipeline accepted any entry ID without verifying the authenticated user owned that entry (Insecure Direct Object Reference).
  - An authenticated user could theoretically update another user's pipeline entries by guessing `pl_` IDs.
  - Fix: Added ownership verification — `dbPipelineGet(id)` loads the entry and checks `entry.userId === session.user.id` before allowing PATCH for authenticated requests. Unauthenticated/session-based entries (no userId) still update by ID only (no cross-user risk since they have no userId).
  - File: `app/api/pipeline/route.ts`.

49. Auto-save telemetry missing trigger field — **RESOLVED** (2026-03-21, v0.9.21)
  - Auto-save pipeline telemetry event (`emitTelemetry("pipeline_save", ...)`) was missing the `trigger` field, making it impossible to distinguish manual vs auto pipeline saves in telemetry data.
  - Manual save already had `trigger: "manual_sidecard"`.
  - Fix: Added `trigger: "auto_8.5"` to the auto-save telemetry call.
  - File: `extension/content_linkedin.js`.

50. Pipeline dedupe — no DB uniqueness constraint — **NOTED** (2026-03-21)
  - Pipeline entry deduplication is app-level only (check-then-insert). No `@@unique` constraint on `(sessionId, jobUrl)` or `(userId, jobUrl)` in the Prisma schema.
  - Under extreme concurrency (two identical saves in the same millisecond), duplicates could theoretically be created.
  - Practical risk: extremely low — UI state machine prevents concurrent manual + auto save for the same job.
  - Status: Noted for post-beta schema improvement. Not a beta blocker.

51. Auth provider "temporarily unavailable" — **RESOLVED** (2026-03-21, v0.9.26)
  - `getProviders()` could return null or an empty map (network error, cold-start timeout, NextAuth initialization failure) → both `hasNodemailer` and `hasBetaEmail` false → "Sign-in is temporarily unavailable" error shown.
  - Since `beta-email` Credentials provider is unconditionally pushed in auth.ts, sign-in should always be available.
  - Fix: (a) Added `.catch()` handler to `getProviders()` — on failure, falls back to synthetic beta-email provider entry. (b) `hasBetaEmail` now defaults to true when providers loaded but Nodemailer absent (since beta-email is always server-configured).
  - File: `app/signin/page.tsx`.

52. Tailor "No job context available" for pipeline-saved jobs — **RESOLVED** (2026-03-21, v0.9.26)
  - When saving a job via extension pipeline (CALIBER_PIPELINE_SAVE), only metadata (title, company, url, score) was sent. Job description text (jobText) was not included.
  - TailorPrep (required for tailor flow) was only created via the separate `/api/tailor/prepare` endpoint, which is never called during pipeline save.
  - Result: pipeline entries had no TailorPrep file → `tailorPrepFindByJob()` returned null → "No job context available" error.
  - Fix: (a) Extension content script now includes `extractJobText()` output (sliced to 15KB) in CALIBER_PIPELINE_SAVE messages. (b) Extension background.js forwards `jobText` in the pipeline POST body. (c) Pipeline POST handler creates TailorPrep alongside PipelineEntry when `jobText` is present and >50 chars.
  - Files: `extension/content_linkedin.js`, `extension/background.js`, `app/api/pipeline/route.ts`.
  - This is a product/architecture decision, not just a code task.

53. Auth "Server error — problem with the server configuration" — **RESOLVED** (2026-03-21)
  - Sign-in redirected to NextAuth built-in error page (`/api/auth/error?error=Configuration`) showing "Server error — There is a problem with the server configuration."
  - Root causes: (a) `authorize()` in beta-email Credentials provider had no try/catch — any Prisma/DB failure threw an unhandled exception, which NextAuth v5 interprets as a "Configuration" error. (b) No `pages.error` configured — auth errors redirected to generic NextAuth error page. (c) No env validation — missing `AUTH_SECRET` or `DATABASE_URL` on Vercel produces opaque failures.
  - Fix: (a) Wrapped `authorize()` in try/catch — DB failures now return null (CredentialsSignin) instead of throwing (Configuration). (b) Added `pages.error: "/signin"` — all auth errors redirect to sign-in page with error query param. (c) Sign-in page maps error codes (CredentialsSignin, Configuration, AccessDenied) to user-friendly messages. (d) Added env validation logging at auth init (AUTH_SECRET, DATABASE_URL). (e) Added `logger` config for structured error/warn logging. (f) Added comprehensive server + client diagnostic logging throughout auth flow.
  - Validation: 5/5 end-to-end tests pass: providers endpoint, successful sign-in (302 → /pipeline + session cookie), invalid email → controlled CredentialsSignin (not server error page), error page redirect to /signin, returning user re-sign-in.
  - Files: `lib/auth.ts`, `app/signin/page.tsx`.

54. Tailor output under-adapts to target role (weak specificity) — **RESOLVED** (2026-03-26, bee6e83)
  - **Observed:** Tailored resumes for product-manager / strategy / consulting-adjacent roles were close to a polished default resume. Output was not role-targeted — headline preserved generic identity title, single flagship project dominated output, cross-functional / roadmap / launch evidence was buried.
  - **Bug 1 — Score never passed:** `app/api/tailor/generate/route.ts` called `generateTailoredResume` without the `score` argument. `matchBand` always resolved to `"WEAK"` regardless of actual job fit. STRONG-path adaptation (headline adaptation, assertive bullet elevating, summary rewrite) never fired in production.
  - **Bug 2 — Prompt lacked decomposition mechanics:** System prompt had no instruction to (a) decompose the JD into capability themes, (b) map themes to specific resume evidence, (c) reorder bullets within sections, (d) adapt headline to role function, or (e) prevent single-project dominance. Model had only a loose directive to "elevate relevant evidence."
  - **Fix:** (a) `route.ts` now passes `prep.score`. (b) `tailor_store.ts` system prompt adds: PRE-WORK ROLE DECOMPOSITION (3–5 JD themes → evidence mapping), HEADLINE & SUMMARY ADAPTATION (STRONG matches), EVIDENCE DISTRIBUTION & BULLET ORDERING (front-load relevant bullets, anti-single-project dominance), SECTION ORDERING for product/ops/strategy roles.
  - **Validation:** Chris IEM Product Manager fixture (score 7.5, STRONG) added to `analysis/tailor_quality_validation.ts`. Anti-fabrication guardrails unchanged; 29/29 contamination tests pass.
  - **Source-truth grounding preserved:** BLOCKED field in debug trace enforces that no JD term lacking resume evidence appears in output. Fabrication guardrail not modified.
  - Files: `app/api/tailor/generate/route.ts`, `lib/tailor_store.ts`, `analysis/tailor_quality_validation.ts`.
---

## 2026-03-29 — Canonical Job Cache Consumer Surfaces

**Status: CLOSED**

**Deliverable A — Cache-first hydration in extension sidecard:** DONE
- `lookupJobCacheForSession` added; cache-first guard in `callFitAPI`; non-fatal fallback
- Session binding: same `sessionId` only — cross-session reuse blocked

**Deliverable B — Known-jobs landing view:** DONE
- `GET /api/jobs/known` endpoint + `app/jobs/page.tsx`
- Pipeline page links to `/jobs`

**No regressions:** prescan excluded, existing scoring path unchanged, TypeScript clean, 25 tests pass.
