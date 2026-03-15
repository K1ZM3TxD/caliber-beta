# BREAK_AND_UPDATE.md

## Purpose
This file defines the Caliber change-control contract for any change that:
- breaks an existing workflow, invariant, interface, or expectation, OR
- requires an update to process, documentation, enforcement rules, or “how we work”.

The goal is to prevent silent drift and keep repo operating rules consistent.

---

## Trigger
**TRIGGER = the command `load BREAK_AND_UPDATE.md` (case-insensitive).**

When the user says `load BREAK_AND_UPDATE.md` (or `load break_and_update.md`), the assistant MUST:
1) Treat this file as the active contract, and
2) Immediately execute the workflow below.

The user does **NOT** need to type “break + update”.
Typing “break + update” is allowed but redundant.

---

## BREAK + UPDATE Workflow

### Step 1 — Chat Snapshot (required)
Write a compact snapshot that includes:
- What changed (the “break”)
- Why it changed (reason / constraint)
- What behavior is now expected
- What behavior is explicitly no longer expected
- Risk / fallout (who/what could be impacted)
- The smallest observable proof that the new behavior works

### Step 2 — Coder Task (required)
Produce a structured Coder Task block that MUST include:
  - Explicit scope lists:
    - scope.code_files (explicit)
    - scope.doc_files (explicit)
    - scope.season_files_touched (explicit list of every file changed in this BREAK+UPDATE episode)
  - An explicit "Doc Patch Plan" section inside the task block:
    - For EACH doc in scope.doc_files, list exact edits (replace/insert bullets; no vague "update docs")
  - **No Archaeology Rule:**
    - If the fix depends on user-specific artifacts (resume text, prompt answers, anchors, screenshots, etc.), the task MUST include:
      - either (i) exact repo path(s) to the artifact(s), OR
      - (ii) a pasted fixture input blob in the task
    - Coder must NOT hunt through the repo to find user content.

The task block MAY be a fenced code block or a structured multi-line object — this is the standard "black box" handoff format from PM to Coder.
Single-line plain text is also acceptable for trivial or docs-only tasks.

### Step 3 — Required Doc Updates (always)
Update these files every time:
1) `Bootstrap/milestones.md`
	- Add a dated block: `BREAK + UPDATE — YYYY-MM-DD`
	- Include DONE / BLOCKED / NEXT (tight bullets)
2) `Bootstrap/kernel.md`
	- Update ONLY if a new durable enforcement invariant is established (this change qualifies)
3) `Bootstrap/CALIBER_ISSUES_LOG.md`
	- Add/update/resolve issues tied to this break/update
PLUS: Update any other docs touched/relied on in this BREAK+UPDATE season_files_touched list, and include them in scope.doc_files.

### Step 4 — Definition of Done (report-out)
When the change lands, report:
  - Commit + push required
  - `git status -sb`
  - `git diff --name-only`
  - the pushed commit SHA

---

## Notes / Scope
- This workflow is for process + enforcement + contract drift control.
- It is not required for routine implementation that doesn't change expectations.
- Architecture shifts, release-model changes (e.g., prod/dev environment separation), and roadmap re-sequencing qualify as breaks and should use this workflow.
- If unsure whether something is a "break", treat it as a break and run the workflow.

---

## Recent BREAK+UPDATE Log (newest first)

### 2026-03-15 — SGD Anchor-Boost Injection + Result Display

**What changed:**
- Prior text-injection approach (issue 70, commit a06dec0) did NOT change title output. Root cause: multi-word signal labels don't map through extractBroadTokens, and anchor weight cap of 5 prevents score shifts.
- New two-layer approach: (a) anchorBoosts map applied directly to anchor weights in generateTitleRecommendation (bypassing cap 5, max 7), (b) signal-affinity bonus adds +0.25/required and +0.15/optional term overlap (capped 1.2) to post-scoring title scores.
- SIGNAL_SCORING_KEYWORDS dictionary (~100 entries) maps signal labels → scoring-vocabulary terms.
- SET_SIGNAL_PREFERENCE handler captures baseline title, logs before/after JSON comparison.
- Result page shows "Signals influencing this calibration: X · Y · Z" when user selected Yes.
- Yes/No buttons on PROCESSING screen centered.

**Why it changed:**
- Prior text-injection was cosmetic — Yes/No produced identical output. Weight cap at 5 and reqCov cap at 1.0 prevented any score shift.

**What is now expected:**
- Yes → anchor boosts + affinity bonus shift title scores. Jen: 8.4→9.0, secondary candidates reshuffled.
- No → no title re-generation, no signals displayed.
- Result page shows included signals in green accent text below "Why this fits" dropdown.
- Console logs `sgd_title_influence` (with anchorBoosts) and `sgd_title_influence_result` JSON.
- Yes/No buttons centered on PROCESSING screen.

**What is no longer expected:**
- Text-based signal injection into prompt answers (doesn't work with scoring pipeline caps).

**Risk / fallout:**
- Scores shift when signals included. Primary title may or may not change depending on whether signals reinforce or diverge from resume match.

**Proof:**
- TypeScript build clean. Tests: 72/74 pass (same 2 pre-existing failures). Jen validation: score 8.4→9.0, candidates shifted, title stays same (signals reinforce existing match).

---

### 2026-03-15 — SGD Signal Normalization + Calibration Title Influence

**What changed:**
- Signal normalization dictionary (SIGNAL_NORMALIZATION, 75+ entries) added to `lib/calibration_machine.ts`. Raw anchor tokens now map to professional labels before entering UI.
- `formatSignalLabel()` checks normalization dict before title-case fallback.
- Dedup by normalized label added to `detectAdditionalSignals()` result pipeline.
- `SET_SIGNAL_PREFERENCE` handler re-generates `generateTitleRecommendation()` when user includes signals. Detected signal labels injected as synthetic prompt text with 30% weight cap.
- When user selects No, title generation is unchanged.

**Why it changed:**
- Raw tokens ("Buying", "Drained", "Fatiguing") were not interpretable professional signals. Users could not make informed Yes/No decisions.
- Selecting Yes had no effect on calibration output, making the feature purely cosmetic.

**What is now expected:**
- SGD signals appear as normalized professional labels (e.g. "Procurement Exposure", "Energy Drain Pattern").
- Maximum 5 signals, deduplicated by label.
- Yes → calibration title may shift toward detected signals (up to 30% influence).
- No → calibration title unchanged (resume signals only).
- Resume signals remain dominant (≥70% weight).

**What is no longer expected:**
- Raw verb/noun tokens displayed to user.
- Yes/No selection with no effect on output.

**Risk / fallout:**
- Title may change slightly for users who include signals. This is the intended behavior.
- No extension changes required.

**Proof:**
- TypeScript build clean. Pre-existing test results unchanged (72/74 pass, same 2 pre-existing failures in signal_classification.test.ts).

---

### 2026-03-15 — Desktop Stabilization & Beta Readiness Phase (Documentation Pass)

**What changed:**
- Project formally enters Desktop Stabilization phase. All Signal & Surface Intelligence (SSI) subsystems are implemented and under structured validation.
- SSI formalized as a system classification in kernel.md: Signal Gap Detection (SGD), Surface Quality Banner, Better Search Trigger (BST).
- New milestone added to milestones.md with explicit completion criteria checklist.
- CALIBER_ACTIVE_STATE.md updated: current phase is Desktop Stabilization, active systems listed, Jen designated as primary regression profile.
- CALIBER_ISSUES_LOG.md updated: #68 SGD auto-advance bug (resolved candidate), #69 BST title suggestion loop (under validation).

**Why it changed:**
- Development reached the point where core SSI features are implemented. Before beta launch, the project needs structured validation captured in documentation so future sessions can load the repo and immediately know project state, testing tasks, and what must pass.

**What is now expected:**
- Loading Bootstrap docs shows the project is in Desktop Stabilization phase.
- Future PM sessions immediately understand: what features exist, what systems are under test, which profile is used for regression, what must pass before beta.
- No additional reading from chat history is required to determine project state.

**What is no longer expected:**
- Ad-hoc chat-based status tracking for SSI validation. Status lives in documentation.

**Risk / fallout:**
- None. Documentation-only change. No code changes.

**Proof:**
- `Bootstrap/milestones.md` contains "Desktop Stabilization & Beta Readiness (ACTIVE)" with completion criteria checklist.
- `Bootstrap/CALIBER_ACTIVE_STATE.md` shows "Desktop Stabilization & Beta Preparation" as current phase.
- `Bootstrap/kernel.md` contains "Signal & Surface Intelligence (SSI) Classification" section.
- `Bootstrap/CALIBER_ISSUES_LOG.md` contains issues #68 and #69.

---

### 2026-03-15 — Surface-Quality Banner in BST Slot (v0.9.6-surface)

**What changed:**
- When the loaded LinkedIn search surface contains ≥1 job scoring ≥7.0, the BST slot now shows a surface-quality banner: "{count} strong matches · Best: {title} ({score})" instead of the BST recovery banner.
- Banner uses the existing `cb-recovery-banner` DOM slot with a green accent variant class (`cb-surface-quality`). Icon switches from search to checkmark.
- Best job is selected as the highest scoring job on the loaded surface (first encountered on tie).
- Surface-quality banner data persisted to durable prescan state via `surfaceBanner` field in `CALIBER_PRESCAN_STATE_SAVE`. Restored on page reload.
- When BST was pending (800ms debounce) and strong matches appear during debounce, the deferred callback now shows the surface-quality banner instead of silently cancelling.
- If no jobs score ≥7, normal BST recovery behavior applies unchanged.

**Why it changed:**
- Users need immediate page-level guidance: "Is this search surface worth exploring?" and "What should I click first?" The BST slot was silently suppressed on healthy surfaces, providing no positive signal. The surface-quality banner gives fast, actionable intelligence before the user scans individual cards.

**What is now expected:**
- Search pages with ≥1 job scoring ≥7: surface-quality banner appears with strong match count + best job title + score.
- Search pages with 0 jobs scoring ≥7: normal BST recovery banner appears.
- Banner updates as more jobs are scored on the surface (re-evaluated on each scoring batch).
- Banner restores from durable state on page reload.

**What is NOT expected:**
- BST recovery banner and surface-quality banner appearing simultaneously.
- Surface-quality banner appearing before minimum scoring window (5 jobs).
- Any change to overlay badge system, scoring model, or pipeline thresholds.

**Files touched:** `extension/content_linkedin.js`, `extension/background.js`, `Bootstrap/CALIBER_ACTIVE_STATE.md`, `Bootstrap/BREAK_AND_UPDATE.md`, `Bootstrap/milestones.md`, `Bootstrap/CALIBER_ISSUES_LOG.md`

### 2026-03-15 — Detected Signals Choice in Calibration Progress Flow (v0.9.6-signals)

**What changed:**
- Calibration PROCESSING screen now detects professional signals from prompt answers that are not clearly expressed in the resume, and presents an explicit yes/no choice to include them in the evaluation.
- New `detectAdditionalSignals()` function compares keyword frequency in prompts vs resume text, using `SIGNAL_LABEL_MAP` (~20 keywords → human-readable labels) and cross-source anchor extraction.
- Detection runs inside `synthesizeOnce()` during ENCODING_RITUAL → PATTERN_SYNTHESIS transition. Results stored as `detectedSignals` (string[]) and `includeDetectedSignals` (boolean | null) on CalibrationSession.
- New `SET_SIGNAL_PREFERENCE` event type added to CalibrationEvent union. Allowed in states ENCODING_RITUAL through TERMINAL_COMPLETE. Handler validates boolean input and persists choice.
- UI module appears on PROCESSING screen below the progress bar when `detectedSignals.length > 0`. Shows signal labels, two buttons ("Yes, include them" / "No, use resume only"), confirmation text after choice. No hidden default — starts null.
- `COMPUTE_ALIGNMENT_OUTPUT` annotates result contract with `signalPreference` metadata (detectedSignals + includeDetectedSignals).
- Extension fit API (`/api/extension/fit`) passes `signal_preference` in response payload.

**Why it changed:**
- Users' prompt answers frequently reveal professional signals (e.g., "Product System Design", "Workflow Automation") that their resume doesn't clearly express. These signals already influence the personVector, but users had no visibility or control. This makes the detection explicit and gives users agency over their evaluation basis.

**What is now expected:**
- PROCESSING screen shows detected signals card when signals are found.
- User must explicitly choose yes or no — no default assumption.
- Choice persisted on session and annotated on scoring output.
- Extension fit response includes `signal_preference` field.

**What is NOT expected:**
- Detected signals silently influencing scoring without user awareness.
- Automatic inclusion or exclusion without explicit choice.
- Signal detection blocking calibration progress (choice is non-blocking).

**Files touched:** `lib/calibration_types.ts`, `lib/calibration_machine.ts`, `app/calibration/page.tsx`, `app/api/extension/fit/route.ts`, `Bootstrap/CALIBER_ACTIVE_STATE.md`, `Bootstrap/BREAK_AND_UPDATE.md`, `Bootstrap/milestones.md`

### 2026-03-15 — Action Threshold Recalibration + Score-Band Labels (v0.9.5-t)

**What changed:**
- User testing revealed scoring distribution centers strong matches at 7–7.5, not 8–9. Lowered action thresholds from 8.0 to 7.0 and added six-band score interpretation labels to the sidecard.
- BST_STRONG_MATCH_THRESHOLD: 8.0 → 7.0. BST recovery banner now triggers only when zero jobs ≥7 in the evaluation window.
- Pipeline/tailor banner threshold: 8.0 → 7.0. "Tailor resume for this job" CTA appears for any score ≥7.
- Telemetry strong_match_viewed threshold: 8.0 → 7.0.
- Sidecard score display: integer → 1-decimal (e.g., "7.2"), score color green threshold 8→7. Separator changed from "/10" to em dash.
- Six-band score label replaces old 3-label system: Excellent Match (9–10), Very Strong Match (8–9), Strong Partial Match (7–8), Viable Stretch (6–7), Adjacent Background (5–6), Poor Fit (<5).
- PIPELINE_AUTO_SAVE_THRESHOLD unchanged (8.5). Overlay badge system unchanged. BST classification logic unchanged. Scoring model unchanged.

**Why it changed:**
- Users see 7.x scores that are legitimately strong matches, but pipeline trigger did not appear (≥8 gate). BST fired too aggressively. Created perception that the system is failing even when matches are good.

**What is now expected:**
- Score ≥7 triggers pipeline/tailor banner and suppresses BST.
- Score <7 hides pipeline button; BST behavior unchanged.
- Sidecard shows decimal score with band label (e.g., "7.2 — Strong Partial Match").

**What is NOT expected:**
- Pipeline button appearing for scores <7.
- BST suppression requiring ≥8 strong matches.
- Integer score display in sidecard.

**Files touched:** `extension/content_linkedin.js`, `Bootstrap/CALIBER_ACTIVE_STATE.md`, `Bootstrap/BREAK_AND_UPDATE.md`, `Bootstrap/milestones.md`

### 2026-03-15 — BST v0.9.5: Adjacent Title Fallback, Silent Scoring, Guardrail Tier 3 (#65 round 2)

**What changed:**
- Live testing of v0.9.4 revealed four persisting failures. All fixed in v0.9.5:
  1. **Adjacent title fallback for BST suggestion**: `adjacent_titles` from synthesis is usually empty (cross-cluster + score >= 6.2 filter). Server API (`route.ts`) and background.js backup extraction now fall back to `titleRec.titles` (all top-3 enriched candidates) when `adjacent_titles` is empty. BST suggestion chain can now always find a concrete title.
  2. **BADGES_VISIBLE = false**: Overlay badges hidden until beta launch. Scoring pipeline + BST continue silently.
  3. **Tier 3 guardrail (cluster-vs-unclustered)**: When job title is in a known ROLE_FAMILY_CLUSTER but calibration title is NOT in any cluster AND zero keyword overlap → cap to `SCORE_CEILING_OUT_OF_SCOPE` (5.0). Catches "Bartender" (hospitality) vs "Business Operations Designer" (no cluster).
  4. **bothUnclusteredNoOverlap tertiary BST trigger**: When NEITHER the search query NOR the calibration title maps to any cluster AND zero keyword overlap → trigger BST regardless of avgScore. Catches "specialist" vs any unclustered calTitle.
- Also fixed: brace/structure bug in `evaluateBSTFromBadgeCache` — cluster evidence counting code was accidentally nested inside for-loop's else branch. Now runs after the loop.

**Why it changed:**
- v0.9.4 live test showed: BST banner said "try different search" with no suggested title (adjacent_titles empty), overlay still rendering score badges on cards, "bartender" scores 6-7 uncapped (calTitle not in any cluster → guardrail missed), "specialist" no BST (both unclustered → cluster logic bypassed).

**What is now expected:**
- BST banner always shows a concrete suggested title when triggered (primary cal title, adjacent role, or candidate from titles array).
- Overlay badges are invisible; scoring pipeline runs silently in background.
- "Bartender"-type searches (job in known cluster, calTitle in no cluster) cap to 5.0 and trigger BST.
- "Specialist"-type searches (neither side in any cluster, zero overlap) trigger BST.
- Ambiguous BST trigger: `avgScore < 6.0 || noClusterOverlap || bothUnclusteredNoOverlap`.

**What is NOT expected:**
- BST banner with no suggestion except on very first install before any calibration data.
- Visible overlay badges on LinkedIn job cards.
- Uncapped scores for clearly out-of-scope searches when calTitle is unclustered.
- Ambiguous queries suppressing BST when no keyword overlap exists between query and calTitle.

**Files touched:** `extension/content_linkedin.js`, `extension/background.js`, `extension/manifest.json`, `app/api/extension/fit/route.ts`, `lib/extension_config.ts`, `public/caliber-extension-beta-v0.9.5.zip`, `Bootstrap/CALIBER_ISSUES_LOG.md`, `Bootstrap/CALIBER_ACTIVE_STATE.md`, `Bootstrap/BREAK_AND_UPDATE.md`

### 2026-03-15 — BST Suggestion Rendering + Classification Edge Cases (#65)

**What changed:**
- Three BST failure modes fixed — all caused by missing or empty calibration context flowing to the BST evaluation and score guardrail:
  1. **Calibration title persistence**: `lastKnownCalibrationTitle` was session-only (lost on page navigation). Now persisted to `chrome.storage.local` as `caliberCalibrationTitle`. Loaded on content script init. Updated whenever scoring returns a new title. Background.js extracts title + nearby roles from session backup during `CALIBER_SESSION_HANDOFF` — available immediately before any scoring.
  2. **Session discover enrichment**: `CALIBER_SESSION_DISCOVER` response now includes `calibrationTitle` and `nearbyRoles` from stored session context, so content script hydrates calibration context as soon as session is confirmed.
  3. **BST suggestion fallback chain extended**: badge cache → recentScores → `lastKnownCalibrationTitle` → `lastKnownNearbyRoles`. Four-level fallback ensures BST banner almost always has a concrete suggested title.
  4. **Ambiguous surface cluster-alignment trigger**: For ambiguous queries, BST now also triggers when the calibration title's cluster is known but ZERO scored job titles share that cluster. This catches "specialist"-type searches where AI scores are generous (6-7) but no jobs are actually in the user's field. Doctrine addition: `shouldTrigger = avgScore < 6.0 || (calCluster known && sameClusterCount === 0)`.
  5. **Guardrail gap diagnostic**: `applyDomainMismatchGuardrail` now logs a WARN when calibrationTitle is empty and a clustered job title passes uncapped — makes the root cause immediately visible in console.
- Enhanced diagnostic logging throughout: classifier inputs/outputs, calibration title sources, nearby roles, sameClusterCount, calCluster evidence.

**Why it changed:**
- Live validation after #64 showed BST partially working but missing suggestion titles (generic "try a different search"), "bartender" not triggering BST with inflated 6-7 scores, and "specialist" suppressed despite no 8.0+ matches. Root cause: calibration context didn't survive page loads and wasn't extracted from session backup.

**What is now expected:**
- BST banner always includes a concrete suggested title (calibration primary title or adjacent role) when triggered.
- Out-of-scope searches trigger BST reliably with capped scores (when calibration context is available).
- Ambiguous searches trigger BST when zero scored jobs share the calibration cluster, regardless of avg score.
- Calibration title persists across page navigations and service worker restarts.
- `CALIBER_SESSION_DISCOVER` returns calibration title + nearby roles pre-extracted from backup.

**What is NOT expected:**
- BST banner showing generic "try a different search" without a clickable suggestion (except extreme edge case: very first extension install with no calibration data yet).
- Ambiguous queries with 6-7 avg scores suppressing BST when no jobs are in the user's role cluster.
- `lastKnownCalibrationTitle` being empty after a page navigation when the user has previously scored jobs.

**Files changed:**
- `extension/content_linkedin.js`
- `extension/background.js`
- `Bootstrap/CALIBER_ISSUES_LOG.md`
- `Bootstrap/CALIBER_ACTIVE_STATE.md`
- `Bootstrap/BREAK_AND_UPDATE.md`

### 2026-03-15 — BST Trigger + Session Reliability Fix (#64)

**What changed:**
- BST was not firing during beta validation due to four interrelated reliability failures in the extension session hydration and scoring pipeline.
- Four fixes applied:
  1. **Session pre-check with backoff**: `runSearchPrescan()` now polls for session readiness (via `CALIBER_SESSION_DISCOVER`) with exponential backoff (up to 8 attempts, ~40s) before starting badge scoring. Previously, scoring started unconditionally 2s after activation and silently failed with no retry.
  2. **Session-ready broadcast**: `background.js` now sends `CALIBER_SESSION_READY` message to all open LinkedIn job tabs after a successful `CALIBER_SESSION_HANDOFF`. Content scripts listen for this and immediately start/resume badge scoring without waiting for periodic scan.
  3. **No-session backoff**: When a prescan batch fails with "no session" error, the retry delay is now 5s (was 200ms). The failed chunk is re-queued instead of burned. Prevents rapid fail-loop that exhausted the queue with no work done.
  4. **Calibration title fallback for guardrail**: `lastKnownCalibrationTitle` is tracked across all scoring batches. When the API omits `calibration_title` (stale session), the cached title is used for `isRoleFamilyMismatch()` / `applyDomainMismatchGuardrail()`. This prevents out-of-scope jobs like "bartender" from receiving inflated 6/10 scores.
- Diagnostic logging added: session hydration status, BST evaluation invocation, calibration title presence, surface classification, strongCount/avgScore/min-window state.

**Why it changed:**
- Beta validation showed BST not appearing on clearly out-of-scope searches ("bartender"), aligned searches with no strong matches, and ambiguous searches. User had to manually refresh LinkedIn to get Caliber session to load. Bartender jobs scored ~6/10 with "High" hiring reality — clear sign of missing calibration context.

**What is now expected:**
- BST banner appears above sidecard on out-of-scope, aligned-no-strong, and ambiguous-weak searches.
- BST suppresses when aligned search has ≥1 strong match (score ≥ 8.0).
- Scoring starts only after session is confirmed (or after 8-attempt timeout).
- Session handoff from Caliber tab triggers immediate scoring on LinkedIn tabs.
- Out-of-scope roles are capped to 5.0 even when API response is missing calibration title.

**What is NOT expected:**
- Scoring no longer fires blindly 2s after activation without session check.
- No-session batch failures no longer cause 200ms rapid retry loops.
- Out-of-scope jobs cannot receive >5.0 scores when calibration context is missing.

**Files changed:**
- `extension/content_linkedin.js`
- `extension/background.js`
- `Bootstrap/CALIBER_ISSUES_LOG.md`
- `Bootstrap/CALIBER_ACTIVE_STATE.md`
- `Bootstrap/BREAK_AND_UPDATE.md`

### 2026-03-15 — BST Surface Classification + Score Color Band Lock (v0.8.7→v0.8.9)

**What changed:**
- BST trigger doctrine replaced: the "zero-strong-match window" rule (fire when zero jobs score >= 8.0 in cache) is superseded by **query-level surface classification** via `classifySearchSurface(query, calibrationTitle, nearbyRoles)`.
- `classifySearchSurface()` returns one of three classifications: `"aligned"` / `"out-of-scope"` / `"ambiguous"`. BST decision tree:
  - **aligned + strongCount > 0** → SUPPRESS (user is on a good surface with real strong matches)
  - **aligned + strongCount === 0** → TRIGGER (right surface but no strong match yet — recovery needed)
  - **out-of-scope** → TRIGGER (wrong job family entirely — recovery needed)
  - **ambiguous** → TRIGGER only if strongCount === 0 AND avgScore < 6.0
- Classification steps: (1) titleEquivalent check, (2) nearbyRole match, (3) ≥50% keyword overlap, (4) ROLE_FAMILY_CLUSTERS comparison via `getClusterForTitle()`, (5) query-in-known-cluster with no overlap → out-of-scope, (6) else → ambiguous.
- Score color bands locked across all four rendering locations (badge, sidecard score, badge CSS, decision label):
  - **Green (#4ADE80):** 8.0–10.0 (Strong Fit)
  - **Yellow (#FBBF24):** 6.0–7.9 (Stretch)
  - **Red (#EF4444):** 0–5.9 (Skip)
- Old gray badge class removed — replaced with red for scores below 6.0.
- Extension version bumped from v0.8.5 to v0.8.9 across three rounds of live-validation fixes.

**Why it changed:**
- v0.8.7: The zero-strong-match rule couldn't distinguish between "wrong job family with flukey high scores" and "right family, just no 8.0+ yet." `genuineStrongCount` approach introduced but couldn't classify titles not in any ROLE_FAMILY_CLUSTERS (e.g., "Business Operations Designer").
- v0.8.8: Live validation showed false positive (BST on "Business Operations Designer" — an aligned surface) and false negative (no BST on "bartender" — an out-of-scope surface). Root cause: per-job mismatch detection fails for unrecognized titles. Fix: moved classification from per-job to per-query level.
- v0.8.9: Live validation showed BST suppressed on aligned surfaces even when no visible job scored >= 8.0. Fix: aligned surfaces now require strongCount > 0 to suppress. Also fixed score color inconsistency (score 5 was showing yellow instead of red).

**What is now expected:**
- BST fires reliably on out-of-scope search surfaces (e.g., bartender when calibrated for software engineering).
- BST fires on aligned surfaces that have zero strong matches (recovery still needed).
- BST is suppressed on aligned surfaces only when at least one job scores >= 8.0.
- Score colors are consistent across all rendering locations: green >= 8.0, yellow >= 6.0, red < 6.0.
- Decision labels: Strong Fit >= 8.0, Stretch >= 6.0, Skip < 6.0.

**What is explicitly no longer expected:**
- "Zero-strong-match window" as the BST trigger rule.
- Per-job `isRoleFamilyMismatch()` as the primary BST classification mechanism (still used as score ceiling guardrail).
- Gray badge color for low scores — replaced with red.
- Yellow badge for scores in 6.0–6.4 range was previously gray — now correctly yellow.

**Risk / fallout:**
- Low — surface classification is additive logic on top of existing badge cache. No API changes.
- Edge case: titles not matching any ROLE_FAMILY_CLUSTERS keyword fall to "ambiguous" — conservative trigger behavior (fires if no strong matches AND avg < 6.0).
- Three rapid version bumps (v0.8.7→v0.8.9) during live validation — all pushed and stable.

**Proof target:**
- BST fires on "bartender" surface when calibrated for software engineering.
- BST does NOT fire on "Business Operations Designer" when calibrated for a business operations role.
- BST fires on aligned surface with zero 8.0+ scores.
- Score 5.0 renders red in all four locations. Score 6.5 renders yellow. Score 8.5 renders green.

**Files touched:** extension/content_linkedin.js, extension/manifest.json, lib/extension_config.ts, Bootstrap/BREAK_AND_UPDATE.md, Bootstrap/milestones.md, Bootstrap/CALIBER_ACTIVE_STATE.md, Bootstrap/CALIBER_CONTEXT_SUMMARY.md, Bootstrap/CALIBER_ISSUES_LOG.md

### 2026-03-14 — Beta Gate Resequencing: Overlay Deblocked + Stable Branch Locked

**What changed:**
- Overlay scoring removed from beta launch gate. Beta readiness is now defined by five core functional gates:
  1. Better Search Title (BST) works reliably
  2. Sidecard is stable
  3. Pipeline is solid
  4. Sign-in / memory is operational
  5. Tailor resume works
- Overlay remains valuable discovery-layer work and may continue in parallel — it is not cancelled, just not a beta blocker.
- Stable-branch release model confirmed as the locked production model: `main` = development, `stable` = production (caliber-app.com).
- All docs updated to reflect the new beta gate and to remove stale wording implying overlay completion is required before beta.

**Why it changed:**
- PM scope decision: beta readiness should be defined by the core functional loop (calibration → sidecard scoring → BST → pipeline → tailor → sign-in), not by the overlay discovery layer. Overlay adds value but is not required for a meaningful outside-user beta test.
- The stable-branch release model was already implemented but some docs still contained stale references to single-main-build or implied overlay was on the critical path.

**What is now expected:**
- Beta can be declared when all five gates are met — overlay completion is not required.
- Overlay work continues as a parallel improvement track, not as a blocking prerequisite.
- Production deploys from `stable` branch only. Development on `main`. No stale "every push to main is live" wording.
- Beta readiness questions in milestones.md updated to reflect the five-gate definition.

**What is explicitly no longer expected:**
- Overlay scoring listed as a prerequisite for beta launch.
- Docs implying that overlay must be complete/stable before beta is declared.
- Any wording suggesting production still deploys from `main`.

**Risk / fallout:**
- Low — this is a scope/sequencing decision, not a code change. Overlay continues to be worked on.
- Outside beta testers will use sidecard-only scoring initially. Overlay badges are a future enhancement to the beta experience, not a gate.

**Proof target:**
- All five Bootstrap docs updated. No remaining wording implies overlay is beta-blocking or production deploys from main.

**Files touched:** Bootstrap/BREAK_AND_UPDATE.md, Bootstrap/milestones.md, Bootstrap/CALIBER_ACTIVE_STATE.md, Bootstrap/CALIBER_CONTEXT_SUMMARY.md, Bootstrap/CALIBER_ISSUES_LOG.md

### 2026-03-14 — Stable Branch Release Model

**What changed:**
- Two-branch release model implemented: `main` = development iteration, `stable` = production deploy target.
- `stable` branch created from current main HEAD (v0.8.5) and pushed to origin.
- Vercel production deploy target changes from `main` to `stable` (manual operator step in Vercel dashboard).
- Vercel preview deploys continue on `main` for internal testing.
- Promotion workflow: validate on main → fast-forward merge into `stable` → push → Vercel auto-deploys production from stable.
- Extension ZIP on `/extension` page served from stable branch deploy — outside testers always get the validated build.
- RELEASE MODEL FOLLOW-UP in milestones.md replaced with implemented release model.

**Why it changed:**
- Single-main-build workflow meant every push was immediately live on caliber-app.com. Outside beta testers would see in-progress/broken work. A stable branch gate was needed before inviting testers.

**What is now expected:**
- Production (caliber-app.com) deploys only from `stable` branch — pushes to main do not affect production.
- Development iteration happens freely on `main`; preview URLs available for internal testing.
- Promotion to production is an explicit merge-and-push to `stable`, not an accident of pushing to main.
- Extension ZIP available at `/extension` is always the validated stable build.

**What is explicitly no longer expected:**
- Every push to main being immediately live for outside testers.
- Single-branch workflow where development and production are the same deploy.
- The RELEASE MODEL FOLLOW-UP section listing this as an unresolved future decision.

**Risk / fallout:**
- Low — additive infrastructure. No code changes, no user-facing behavior change.
- Operator must change Vercel production branch setting manually (Settings → Git → Production Branch → `stable`). Until this is done, Vercel still deploys from main.
- First promotion cycle (main → stable merge) has not yet been validated.

**Proof target:**
- `stable` branch exists on origin (`git branch -r | grep stable`).
- After Vercel config change: caliber-app.com serves from stable branch; main pushes generate preview URLs only.

**Files touched:** Bootstrap/milestones.md, Bootstrap/CALIBER_ACTIVE_STATE.md, Bootstrap/CALIBER_CONTEXT_SUMMARY.md, Bootstrap/BREAK_AND_UPDATE.md

### 2026-03-14 — Docs Truth Pass (Badge + BST + Overlay Alignment)

**What changed:**
- All Bootstrap docs aligned to shipped code truth: CALIBER_ACTIVE_STATE.md, CALIBER_CONTEXT_SUMMARY.md, CALIBER_ISSUES_LOG.md.
- BST doctrine updated everywhere from old "3/4 below 6.5, none >= 7.5" to new "zero 8.0+ in window of 5" rule.
- Badge placement description updated from "next to company logo" / `CARD_LOGO_SELECTORS` to "below title/company" / `CARD_CONTENT_SELECTORS`.
- Discovery layer stability improvements documented (scroll listener lifecycle, selector scanning, retry-poll, viewport buffer).
- Issue #19 (Phase-2 overlay) updated from DEFERRED to SHIPPED. New issues #60–62 added for badge placement, discovery fix, BST doctrine.
- Task order updated: steps 1–2 marked DONE, step 3 (auto-save) is next queued.
- Product Surface Priority corrected: sidecard is "primary decision surface" not "primary discovery surface."
- Extension version references updated from v0.6.0 to v0.8.0.

**Why it changed:**
- Three implementation commits (27932b1, 5133cd7, 7b20781) shipped code changes that docs did not yet reflect. Stale docs create reload drift for PM sessions.

**What is now expected:**
- Bootstrap docs accurately describe the two-layer extension surface (discovery badges + decision sidecard), current BST trigger behavior, and current task sequencing.
- PM sessions reloading from CALIBER_ACTIVE_STATE.md will see current state without needing to cross-reference code.

**What is explicitly no longer expected:**
- Old BST trigger rule (3/4 below 6.5, none >= 7.5) is superseded and should not be referenced.
- `CARD_LOGO_SELECTORS` is no longer the badge placement selector — use `CARD_CONTENT_SELECTORS`.
- Issue #19 is no longer DEFERRED — Phase-2 overlay is shipped.

### 2026-03-14 — Beta Readiness + Telemetry Instrumentation

**What changed:**
- PM established telemetry instrumentation as a prerequisite for beta launch (new enforcement invariant added to kernel.md).
- Beta readiness definition formalized with four concrete threshold questions that must all be answered YES before declaring beta.
- Telemetry event capture implemented: 6 events across extension and web app, append-only JSONL storage, non-blocking.

**Why it changed:**
- Outside-user beta testing without product data is anecdotal-only feedback. Telemetry ensures TTSM and conversion metrics are capturable from day one.
- Beta readiness was previously undefined — formalizing threshold questions prevents premature launch.

**What is now expected:**
- Telemetry is active and capturing events before any outside user receives beta access.
- PM answers all four beta readiness questions affirmatively before declaring beta.
- Event data accumulates at `data/telemetry_events.jsonl` for future dashboard/analysis work.

**What is explicitly no longer expected:**
- Launching beta without telemetry instrumentation active.
- Relying purely on qualitative/anecdotal feedback for beta testing.
- Building a metrics dashboard before beta is stable (dashboard is explicitly post-beta).

**Risk / fallout:**
- Low — telemetry is fire-and-forget with swallowed errors. No user-facing flow depends on it.
- JSONL file growth needs monitoring over time (no rotation/archival yet).

**Proof target:**
- POST /api/events returns 200 for valid events with correct CORS headers.
- Extension emits search_surface_opened on activation; job_score_rendered on badge apply; job_opened, strong_match_viewed, pipeline_save during sidecard flow.
- Web app emits tailor_used after successful resume generation.

**Files touched:** lib/telemetry_store.ts, app/api/events/route.ts, extension/content_linkedin.js, extension/background.js, app/tailor/page.tsx, Bootstrap/milestones.md, Bootstrap/kernel.md, Bootstrap/BREAK_AND_UPDATE.md, Bootstrap/CALIBER_ACTIVE_STATE.md, Bootstrap/CALIBER_ISSUES_LOG.md, Bootstrap/CALIBER_CONTEXT_SUMMARY.md

### 2026-03-13 — Defer Alternate Career-Signal Uploads Until Post-Beta

**What changed:**
- PM reviewed future product ideas around allowing users to upload non-resume career documents (personality assessments, strengths reports, skills profiles) as additional pattern-engine inputs.
- Product decision: these are promising future inputs but are explicitly deferred until after beta ships.
- No new feature scope will be added to the beta flow.

**Why it changed:**
- Current beta priority is shipping and stabilizing the existing core flow (resume → calibration → extension → pipeline). Adding new document-source features would expand scope and risk destabilizing the beta release.

**What is now expected:**
- Resume-first beta scope remains the active and only upload path.
- The calibration flow accepts resumes only (PDF, DOCX, TXT).
- Alternate career-signal upload ideas are captured as a post-beta exploration item, not active roadmap work.

**What is explicitly no longer expected:**
- Implementation of alternate document-source upload features before beta ships.
- PM issuing tasks to build personality assessment, strengths report, or skills profile ingestion during beta.
- Any UI or API changes to support non-resume uploads in the current milestone.

**Risk / fallout:**
- Lower scope risk — deferring reduces the chance of beta delays from feature creep.
- Deferred strategic upside — the idea has product value but is intentionally parked to protect the shipping timeline.
- No code impact. No user-facing change.

**Proof target:**
- No alternate-upload feature work appears in active tasks or milestones until beta ships.

**Files touched:** Bootstrap/BREAK_AND_UPDATE.md, Bootstrap/milestones.md, Bootstrap/CALIBER_ISSUES_LOG.md, Bootstrap/CALIBER_ACTIVE_STATE.md

### 2026-03-11 — UX Task Contract: UI Constitution + Layout Skeleton Required

**What changed:**
- PM-to-coder UX handoffs were allowing visual drift because shared visual rules were not attached as a required contract. Repeated regressions showed that AI coders need explicit shared visual primitives, not only local page instructions.
- A new mandatory PM operating rule has been added: every UX/UI coder task must include the governing UI Constitution (`docs/ui-constitution.md`). Layout/composition tasks must additionally include the Layout Skeleton (`docs/layout-skeleton.md`).
- Two canonical artifacts formalized: UI Constitution (visual primitives) and Layout Skeleton (page composition rules).

**Why it changed:**
- Visual drift accumulated from under-specified UX handoffs. Coders were implementing UI changes without a shared visual contract, leading to per-page style divergence that required repeated correction passes.

**What is now expected:**
- PM attaches or explicitly references `docs/ui-constitution.md` on every UX/UI coder task.
- PM attaches or explicitly references `docs/layout-skeleton.md` on every layout/composition task (in addition to the UI Constitution).
- Coder rejects any UX/UI task missing the UI Constitution reference.
- Coder rejects any layout/composition task missing both references.
- UX tasks are never issued as local visual patches without the governing ruleset.

**What is explicitly no longer expected:**
- UX/UI coder tasks issued with only local page-level styling instructions.
- Coders implementing visual changes without a shared primitives contract.
- PM treating shared visual rules as optional or "recommended when helpful."

**Risk / fallout:**
- Risk is low — this is additive process enforcement, not a code change.
- If PM forgets to attach the references, coder is required to reject the task, which may slow handoff until the habit is established.

**Proof target:**
- Next UX/UI coder task includes explicit UI Constitution reference. Next layout task includes both. Visual drift is reduced compared to prior sessions.

**Files touched:** Bootstrap/PM_bootstrap.md, Bootstrap/BREAK_AND_UPDATE.md, Bootstrap/milestones.md, Bootstrap/CALIBER_ISSUES_LOG.md, Bootstrap/kernel.md, docs/ui-constitution.md, docs/layout-skeleton.md

### 2026-03-11 — Calibration Result Copy Structure

**What changed:**
- Calibration results page now uses a two-sentence structure before the hero title card.
- Sentence 1: human alignment context derived from synthesis patternSummary (first sentence of the pattern synthesis).
- Sentence 2 (exact): "The closest market label for the kind of work you're naturally aligned with is:"
- The recommended title renders as the visual conclusion to that sentence.
- The previous explanation section (headline + intro + bullets + closing from `buildExplanationSummary()`) has been removed and replaced by this two-sentence flow.

**What is now expected:**
- Calibration results page renders: two-sentence context → hero title card → "How we score this" → Recalibrate.
- First sentence is dynamic per user (from `session.synthesis.patternSummary`), with a generic fallback.
- Second sentence is fixed copy.
- Title scoring and recommendation ranking are unchanged.

**What is explicitly no longer expected:**
- The structured explanation section (headline, intro, bullets, closing) no longer renders on the calibration results page.
- `buildExplanationSummary()` is no longer imported or called from the calibration page.

**Files touched:** app/calibration/page.tsx, Bootstrap/milestones.md, Bootstrap/CALIBER_CONTEXT_SUMMARY.md, Bootstrap/CALIBER_ACTIVE_STATE.md, Bootstrap/BREAK_AND_UPDATE.md

### 2026-03-11 — Stabilization Phase: Debug/Polish Before Action-Layer Expansion

**What changed:**
- Project entering a stabilization/debugging phase before the next product-layer additions.
- Extension sidecard, calibration results copy, and Better Search Title trigger all received recent fixes. These fixes must be validated stable before any new action-layer work begins.
- Roadmap for the next action-layer tasks is now explicitly sequenced and soft-locked: each main step is treated as blocked by the previous step until that previous step is validated complete.
- Small, narrow UI bug squashes may still be handled along the way without breaking sequencing — this is the documented exception to the soft-lock rule.

**What is now expected:**
- Active current fix: Extension sidecard collapsed height stability — collapsed card height should remain fixed across scored jobs; card should only expand when collapsible sections are opened.
- Queued next tasks are soft-locked in this order:
  1. Fix extension scorecard collapsed sizing stability (ACTIVE — in flight)
  2. Restore / verify Better Search Title trigger behavior (QUEUED)
  3. Auto-save strong-match jobs (score >= 8.5) into pipeline with canonical URL dedupe (QUEUED)
  4. Add post-save confirmation / action state in sidecard (QUEUED)
  5. Add account prompt for durable pipeline saving (QUEUED)
  6. Continue pipeline/action-layer refinement only after the above are stable (QUEUED)
- Each main step is blocked by the previous main step until validated complete.
- Exception: small UI bug squashes (narrow, local, do not break sequencing) may be handled at any time.

**What is no longer expected:**
- Free parallel movement across the action-layer roadmap.
- Starting auto-save, account prompt, or pipeline expansion work before sidecard sizing and BST trigger are validated.

**Risk / regressions noted:**
- Extension sidecard collapsed height is currently unstable between scored jobs (different score states / label lengths cause visual jumping).
- Better Search Title trigger behavior was recently fixed (ec32fe6) but not yet verified in a real extension flow.
- Auto-save and account prompt are queued — not active implementation.

**Proof:** Documentation pass only. No code changes in this entry.

---

### 2026-03-11 — Shell Baseline Correction + Documentation Truth Pass

**What changed:**
- The three-zone shell framing (Zone 1 = Brand 20vh / Zone 2 = Context / Zone 3 = Interaction) was attempted this season as a shell organization model but introduced documentation and implementation drift. PM direction: that framing is not trusted as a stable product framework.
- All 6 shell-related files restored to the last stable visual baseline from commit a211182 ("Shell alignment: lower CALIBER header and ambient gradient ~12% across all pages"). Zone 1 wrappers, fixed gradient overlays, and CaliberHeader compact/noGradient props removed.
- Documentation corrected across all core Bootstrap files: references to "three-zone shell stabilized" / "canonical" / "applied consistently" superseded or amended to reflect the actual current state.
- The a211182 baseline defines current visual truth: lowered header, lowered ambient gradient (centered at 50% 12%), page-local gradient ownership, simple CaliberHeader with pt-4.
- The broader question of a shared/reusable shell framework remains open — not yet locked.

**What is now expected:**
- Shell visual alignment anchored to commit a211182 baseline values.
- Each page owns its own shell (gradient, hero offset, content width) locally — no shared shell framework enforced.
- Documentation accurately separates historical season work from current approved product truth.
- Three-zone shell is documented as a season attempt, not a current canonical framework.

**What is no longer expected:**
- Three-zone shell treated as the canonical/finalized shell architecture.
- Documentation claiming shell structural inconsistency is "resolved" or "stabilized" via the three-zone model.
- Zone 1 20vh wrappers, CaliberHeader compact/noGradient props, or fixed gradient overlays in page implementations.

**Risk / regressions noted:**
- Shell is page-local, meaning per-page visual consistency must be maintained manually until a shared framework is designed and locked.
- Tailor, pipeline, and extension pages each carry their own gradient/spacing — changes must be coordinated.

**Proof:** All 6 shell files match a211182 baseline (`git diff a211182 -- <file>` returns empty for all). Build clean. Commit 7b03a18.

**Commits:** 7b03a18

---

### 2026-03-11 — Three-Zone Shell Stabilization + Tailor Completion + Upload Simplification _(SUPERSEDED — shell framing corrected in 2026-03-11 Shell Baseline Correction above)_

> **NOTE (2026-03-11):** The three-zone shell framing described in this entry was an attempted organization model during this season. It has been superseded — the visual baseline was restored to commit a211182 and the three-zone framework is not the current canonical shell architecture. The non-shell work in this entry (tailor completion, upload simplification, pipeline DnD, extension rebuild) remains current and shipped.

**What changed:**
- Three-zone shell design attempted across all pages: Zone 1 = Brand field (20vh, CALIBER wordmark + ambient gradient), Zone 2 = Context (page heading/description), Zone 3 = Interaction (forms, cards, actions). _(Superseded — see correction above.)_
- CALIBER header and ambient gradient lowered ~12% across all pages for visual grounding. _(This alignment from a211182 remains the current visual baseline.)_
- Upload page simplified: redundant heading removed, layout spacing tightened.
- Tailor page completed as launch-ready flow: copy-to-clipboard action added, retry-on-error for failed generation, polished result area with copy/download actions, tightened spacing throughout.
- Pipeline board enhanced: drag-and-drop card movement between columns, fit score displayed on cards, visibility reload on tab focus.
- Calibration results page rhythm polished (spacing, visual weight).
- Upload page contrast adjusted for usability.
- Extension ZIP v0.6.0 rebuilt with latest source (bug-report label fix, BST threshold widening, LinkedIn content script updates).

**What is now expected:**
- ~~Every page follows the three-zone shell structure: Brand (20vh) → Context → Interaction.~~ _(Superseded — pages use a211182 baseline shell, not three-zone wrappers.)_
- Tailor page is end-to-end functional with copy action: generate → copy or download → pipeline tracked.
- Pipeline board cards show fit score and are moveable via DnD.
- ~~Shell is visually consistent across calibration, upload, results, tailor, and pipeline pages.~~ _(Visual baseline from a211182 is consistent; shared shell framework is not yet locked.)_

**What is no longer expected:**
- ~~Per-page ad-hoc shell composition — all pages use three-zone structure.~~ _(Correction: pages use page-local shell ownership with a211182 baseline values.)_
- Tailor page without copy action or error retry.
- Pipeline board without fit score or DnD.
- CALIBER header at the prior higher position. _(Still true — a211182 lowered it.)_
- Upload page with redundant heading text.

**Risk / regressions noted:**
- ~~Three-zone shell is a stabilization pass, not a final lock — minor per-page tweaks may still be needed.~~ _(Superseded — three-zone shell was rolled back to a211182 baseline.)_
- Extension ZIP was rebuilt but extension functionality is unchanged from v0.6.0; this was a packaging refresh only.

**Proof:** ~~All pages render with consistent three-zone layout.~~ Tailor page copy action functional. Pipeline board DnD moves cards between columns.

**Commits:** 189032e, eac1a1b, 3651ac1, a211182, e408b64

---

### 2026-03-11 — Visual Shell Re-Lock + Pipeline Board + Tailor Recompose + Docs Re-Anchor

**What changed:**
- Visual shell re-lock: stopped local-patching approach ("match pipeline page") and re-anchored the design system to explicit approved primitives.
- Approved shell traits now codified: wide subtle ambient gradient band, calm dark premium surface (#050505), outlined green buttons, no small sharp centered line motif.
- Global layout: top padding reduced (pt-16→pt-10), max-width widened to 960px to support pipeline board (individual pages self-constrain to 600px where needed).
- Calibration page: header area reduced (8.5em→5.5em), LANDING spacing tightened (mt-14/mt-12→mt-8), dropzone "PDF, DOCX, or TXT" text centered, redundant dividers removed from TITLES step.
- Tailor page recomposed: "Tailor Resume" is now the primary heading, job title/company card appears first, pipeline confirmation banner demoted below job context, CaliberHeader removed from tailor page entirely.
- Pipeline rebuilt from vertical list to 4-column board layout: Resume Prep → Submitted → Interview Prep → Interview. NOTE: this is the code implementation — product-level validation of the board is still active/current-next work.
- Pipeline API and store updated with new stage types (resume_prep, submitted, interview_prep, interview) alongside legacy stages, with automatic mapping from old stages to new board columns.
- Extension bug-report button now shows "🐛 Report" text label (previously icon-only emoji).
- All "Back to Caliber" links now route to /calibration (not /).

**What is now expected:**
- Design changes reference approved visual primitives, not a single live page.
- Tailor page hierarchy: Tailor Resume (focal) → job context card → pipeline confirmation (secondary) → action buttons.
- Pipeline renders as a 4-column board with moveable cards between columns.
- Extension bug-report action has explicit text label for clarity.
- All navigation "Back to Caliber" routes to the resume/calibration page.

**What is no longer expected:**
- "Match the pipeline page" as a design instruction — design is now primitive-based.
- Single-list pipeline view — replaced by board layout.
- CaliberHeader as the dominant element on the tailor page.
- Icon-only bug-report affordance in the extension.
- "Back to Caliber" routing to "/" (now always /calibration).

**Risk / regressions noted:**
- Visual drift occurred from repeated incremental local UI tweaks across sessions.
- Shell composition is still inconsistent across main, ingest, results, tailor, and pipeline pages — further tightening needed.
- Upload page CALIBER mark may sit too high; prompt/question pages need shell alignment.
- Pipeline board is code-implemented but product validation of the 4-column model is ongoing.
- Better Search Title trigger behavior may have regressed — needs verification.

**Files touched:**
- app/layout.tsx
- app/calibration/page.tsx
- app/calibration/build-resume/page.tsx
- app/tailor/page.tsx
- app/pipeline/page.tsx
- app/api/pipeline/route.ts
- lib/pipeline_store.ts
- extension/content_linkedin.js
- Bootstrap/BREAK_AND_UPDATE.md
- Bootstrap/CALIBER_ACTIVE_STATE.md
- Bootstrap/CALIBER_CONTEXT_SUMMARY.md
- Bootstrap/CALIBER_ISSUES_LOG.md
- Bootstrap/milestones.md

### 2026-03-10 — Strong-Match Action + Resume Tailoring + Job Pipeline
**What changed:**
- Caliber expands from evaluation-only to strong-match action workflow.
- Jobs scoring 8.0+ trigger a contextual "Tailor resume for this job" card above the extension sidecard.
- Resume tailoring added: uses the user's existing uploaded Caliber resume + live job context from the extension. OpenAI generates a tailored version — no fabrication, only reorder/emphasize/adjust.
- Simple job pipeline/tracker added: minimal stages (Strong Match → Tailored → Applied → Interviewing; optional Offer / Archived).
- Pipeline is intentionally NOT a CRM — no subtasks, notes, timelines, or due dates.
- Extension v0.5.1: contextual card replaces in-sidecard CTA; background.js POSTs to `/api/tailor/prepare`.
- New API routes: `/api/tailor/prepare`, `/api/tailor/generate`, `/api/pipeline`.
- New web pages: `/tailor` (generate + download tailored resume), `/pipeline` (track strong-fit opportunities).
- New stores: `lib/tailor_store.ts`, `lib/pipeline_store.ts`.
- Strong-Match Action Invariant added to kernel.md.

**What is now expected:**
- Strong matches (8.0+) can be acted on — user can tailor their resume for that specific job.
- Tailoring uses the existing Caliber resume + current job context. No new upload required.
- Pipeline tracks strong opportunities through minimal stages.
- CTA language is "Tailor resume for this job" — not "Apply for this job."
- The contextual card is low-noise: renders above the sidecard, not omnipresent.

**What is no longer expected:**
- Caliber stops at scoring/explanation only — strong matches now feed an action workflow.
- Pipeline becomes a bloated CRM/task system — anti-bloat principle is enforced.
- Tailor CTA lives inside the sidecard — it is now a standalone contextual card above the sidecard.

**Files touched:**
- Bootstrap/milestones.md
- Bootstrap/CALIBER_ISSUES_LOG.md
- Bootstrap/CALIBER_ACTIVE_STATE.md
- Bootstrap/CALIBER_CONTEXT_SUMMARY.md
- Bootstrap/kernel.md
- Bootstrap/BREAK_AND_UPDATE.md

### 2026-03-10 — Better Search Title UX + Logic Adjustment (v0.4.7)
**What changed:**
- Better Search Title moved from sidecard footer to standalone recovery banner above the sidecard
- Suggested title is now the clickable control (navigates to LinkedIn search)
- Title suggestion logic changed: calibration primary title first, then adjacent search-surface titles; listing-specific title fallback removed
- Product principle established: Better Search Title is a Search Surface Recovery Mechanism

**What is now expected:**
- Recovery banner renders above sidecard when weak-fit trigger fires
- Suggestions are broader market-search titles, not listing-specific phrases
- The feature is structurally separated from job evaluation (sidecard)

**What is no longer expected:**
- Suggestion inside sidecard footer
- Exact job listing titles as suggestions
- Best-scored-job-title fallback

**Files touched:** extension/content_linkedin.js, app/api/extension/fit/route.ts, extension/manifest.json

### 2026-03-10 — Beta Feedback Loop (v0.4.6)
**What changed:**
- Structured feedback collection: thumbs up/down + negative-feedback chips + optional text
- Extension sidecard + web results page both collect feedback
- POST /api/feedback endpoint + JSONL append-only store
- Behavioral signals: jobs_viewed, scores_below_6, highest_score, suggest_shown/clicked

**Files touched:** app/api/feedback/route.ts, lib/feedback_store.ts, extension/background.js, extension/content_linkedin.js, app/results/ResultsClient.tsx

### 2026-03-10 — Job Board Adapter Architecture Decision
**What changed:**
- Architecture decision: site-specific adapters required before multi-board expansion
- Adapter contract: extractJobData() → normalized job object (title, company, location, description)
- Scoring engine must consume only normalized object, never site-specific DOM

**Files touched:** Bootstrap/milestones.md, Bootstrap/kernel.md, Bootstrap/CALIBER_ISSUES_LOG.md, decisions.md

### 2026-03-11 — Pipeline Dashboard Inline Tailor
**What changed:**
- Pipeline page transformed into a lightweight career dashboard with inline resume tailoring
- "Tailor resume" action added to every pipeline card — triggers inline TailorPanel without navigation
- Archive (X) control enlarged: 28×28px hit area, SVG icon, aria-label for accessibility
- TailorPanel component created: shows job title, company, generation state, tailored output with copy + download
- Generate API route extended to accept pipelineId (resolves TailorPrep via sessionId + jobUrl lookup)
- Pipeline board layout preserved: Resume Prep → Submitted → Interview Prep → Interview volume columns

**What is now expected:**
- Users can tailor resumes directly from the pipeline page without leaving the dashboard
- Clicking "Tailor resume" opens an inline panel below the card
- Panel supports full generate → copy → download workflow
- Archive button is a clearly tappable 28×28 target with proper aria-label

**What is no longer expected:**
- Users must navigate to /tailor to tailor a resume for a pipeline job
- The small text "✕" as the only archive control

**Files touched:** app/pipeline/page.tsx, app/components/TailorPanel.tsx, app/api/tailor/generate/route.ts, lib/tailor_store.ts, Bootstrap/milestones.md, Bootstrap/CALIBER_ISSUES_LOG.md, Bootstrap/BREAK_AND_UPDATE.md
(See <attachments> above for file contents. You may not need to search or read the file again.)
