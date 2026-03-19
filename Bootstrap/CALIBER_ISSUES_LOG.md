# CALIBER_ISSUES_LOG


## Current Open Issues

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

82. BST popup replaced by persistent Adjacent Search Terms module — **SHIPPED** (2026-03-19)
  - **Symptom:** The BST (Better Search Trigger) popup banner was an interruptive UI element that appeared above the sidecard, competing for attention and mixing page-level surface intelligence with per-job decision UI.
  - **Change:** Replaced the BST popup banner with a persistent, collapsible "Adjacent Searches" section inside the sidecard, positioned between Bottom Line and the pipeline row. Adjacent terms are populated from calibration title + nearby roles data (same source as BST). Section uses chip-styled links that navigate to LinkedIn search.
  - **Pulse/glow behavior:** The section applies a subtle border glow animation only when: (1) at least 20 jobs have been scored on the current surface, AND (2) the surface is classified as "bst" (weak/poor match-wise). Before those thresholds, the section is calm and inert.
  - **BST evaluation preserved:** `evaluateBSTFromBadgeCache()` still runs and classifies surfaces (healthy/bst/neutral). Only the popup banner presentation (`showPrescanBSTBanner`) is disabled. Surface classification state drives the adjacent-terms pulse.
  - **Functions added:** `getAdjacentSearchTerms()`, `updateAdjacentTermsModule()`, `updateAdjacentTermsPulse()`.
  - **Status:** Shipped. `showPrescanBSTBanner()` returns early (no-op). Sidecard weak-job BST trigger block replaced with `updateAdjacentTermsModule(data)` call.
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

77. Sign-in / durable memory — **OPEN / ACTIVE** (beta gate 4)
  - **Symptom:** User sessions do not persist across browser restarts. Pipeline and calibration data are not durable without sign-in.
  - **Impact:** Beta gate 4 cannot be met without this. Users lose pipeline entries and calibration state when they close and reopen the browser.
  - **Status:** Open. This is the top remaining beta blocker.

77b. Tailor resume end-to-end validation — **OPEN** (beta gate 5)
  - **Symptom:** Tailor resume feature is functional (copy/download, retry-on-error, progressive step UI) but has not been validated end-to-end in a real user flow.
  - **Impact:** Beta gate 5 cannot be met without explicit validation.
  - **Status:** Open. Needs explicit end-to-end validation after sign-in is working.

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

48. Extension sidecard collapsed height instability — **RESOLVED** (2026-03-11)
  - The sidecard previously changed height between scored jobs when optional sections (stretch, bottom line, HRC) were conditionally hidden.
  - Fix: all collapsible section toggles are now always rendered regardless of content. Empty sections show fallback text (“—”). Results body has min-height: 240px.
  - "Saved to pipeline" row moved to top of results (before score row) for strong matches.
  - Bullet circles aligned with explicit top: 0 positioning.
  - Collapsed card height is now stable across all score states.

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

44. Better Search Title trigger verification — **OPEN** (2026-03-11)
  - Better Search Title thresholds were widened: weak < 6.5 (was < 6.0), strong >= 7.5 (was > 7.0).
  - Need to verify the feature still triggers correctly with these thresholds.
  - If regressed, this is a priority fix — the recovery banner is an important product surface.

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
  - This is a product/architecture decision, not just a code task.