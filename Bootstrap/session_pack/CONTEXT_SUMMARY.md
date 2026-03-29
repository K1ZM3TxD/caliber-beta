# CALIBER_CONTEXT_SUMMARY

> **Role:** Full project history and session decisions. For a compact current-state reload, see `Bootstrap/CALIBER_ACTIVE_STATE.md`. For the canonical system loader, see `CALIBER_SYSTEM.md`.

## Project Status (2026-03-14, Beta Gate Resequenced)

- **Session decision — 2026-03-29 (Product Truth Reset: Sidecard Primary, Overlays/Backfill Reactive, No Unsafe Prescore):**
  - Extension behavior confirmed through v0.9.38–v0.9.45 testing. Working model: sidecard-primary scoring with reactive/backfilled list-card overlays on both LinkedIn and Indeed.
  - Unsafe DOM-wide prescan suppressed in v0.9.42: LinkedIn card DOM contains only title/company/location (no JD). Prescan scores are title-similarity-only and structurally inflated. `card_text_prescan` results cached for BST evaluation but never rendered as user-visible badges. Indeed cards similarly show no numeric badge until sidecard backfill fires.
  - Backfill confirmed on both platforms: after sidecard produces a trusted score, the corresponding list card immediately receives a color-coded inline badge.
  - Next architectural boundary: zero-click broad overlay coverage requires backend job inventory + score cache, not more DOM probing. Post-current scope.
  - Canonical docs updated. See BREAK+UPDATE 2026-03-29.

- **Session decision — 2026-03-29 (LinkedIn overlay re-enabled on `main` for PM evaluation):**
  - `BADGES_VISIBLE = false` → `true` in `content_linkedin.js` on `main`. PM saw Indeed reactive badge UX and wants to evaluate LinkedIn overlays again. `stable` production unchanged. Evaluation criteria: visual stability, sidecard parity, surface coverage. One-line revert if fails.

**Approaching beta readiness — five-gate model locked.** Beta is defined by five core functional gates: (1) BST working, (2) sidecard stable, (3) pipeline solid, (4) sign-in/memory operational, (5) tailor resume works. Phase-2 overlay scoring is shipped and stable but is NOT a beta gate — it continues as parallel improvement work. Extension operates as a two-layer surface: discovery badges on search result cards + decision sidecard on selected job.

**Beta gates status:**
1. BST working — **CLOSED** (post-fix simulation 62/62 pass, v0.9.21 2026-03-20)
2. Sidecard stable — **CLOSED** (layout stabilized 52/52 pass, v0.9.21 2026-03-20; scroll jitter also fixed 2026-03-27 on `main`)
3. Pipeline solid — **CLOSED** (111/111 assertions, IDOR fix, v0.9.21 2026-03-21)
4. Sign-in / memory — **CLOSED** (67/67 assertions, magic-link hardened 114/114, 2026-03-22)
5. Tailor resume — **CLOSED** (functionality 59/59 E2E 2026-03-24; integrity fix `892a45a` merged into `stable` 2026-03-28; post-fix validation recommended before declaring output trustworthy end-to-end)

**Beta launched (2026-03-28):** `stable` promoted to `main` via fast-forward merge at commit `31ab6a1`, confirmed live in Vercel production. All five-gate fixes + recent stabilization work are now live. Issues #107 and #112 resolved.

**Parallel (non-blocking):**
- Overlay scoring — shipped and stable, continues to improve, not a beta gate
- Auto-save strong matches → post-save confirmation — enhancements, not gates

**Future (after beta stabilization):**
- Beta readiness definition updated (2026-03-14) — five-gate model. See `Bootstrap/milestones.md` for gates and readiness questions.
- Overlay scoring is post-gate parallel work. Shipped and stable but not required for beta declaration.
- Post-beta product metrics planned. First metric: **Time-to-Strong-Match (TTSM)** — time from opening a search surface to first job scored >= 8.0. Computable as `MIN(strong_match_viewed.timestamp) - search_surface_opened.timestamp` grouped by `(sessionId, surfaceKey)`.
- **Session decision — 2026-03-25 (Post-Fix Jen Surface Experiment — Valid Baseline Run):**
  - **This is the post-fix rerun.** Conducted after stale calibration context fix (commit `da6e5ec`, v0.9.30). Extension loaded fresh with Jen session. Adjacent searches confirmed showing Jen-correct context. This run is the valid baseline for Jen surface comparison.
  - **Session:** `sess_fd37b355bf65c8_19d27242644::signal_on` | Fixture: Jen | Signals: ON | Chips: skipped
  - **Segmentation method:** surfaceKey field on TelemetryEvent, confirmed by `search_surface_opened` timestamps (23:32 UTC for surface 2, 23:38 UTC for surface 3). Run 1 inferred from session start (23:27 UTC). `job_opened` event counts (77/77/86) confirm ≈75 jobs browsed per surface as stated.
  - **Data quality notes:** `positionIndex` and `searchQuery` meta fields are null — telemetry patch v0.9.30 was not yet loaded at time of this run (extension was loaded before push). `job_score_rendered` count (15/19/16) reflects unique sidecard first-renders only; cached reopens do not re-fire. TTSM measured from first `job_score_rendered` (badge) to first `strong_match_viewed` since `search_surface_opened` missing for run 1.

  **Per-run metrics (post-fix baseline):**

  | Metric | `partnerships manager` | `strategy and operations manager` | `gtm strategy operations` |
  |--------|----------------------|-----------------------------------|--------------------------|
  | Jobs browsed (`job_opened`) | 77 | 77 | 86 |
  | Badge scores captured | 15 | 19 | 16 |
  | Badge ≥7.0 | 15/15 (100%) | 19/19 (100%) | 12/16 (75%) |
  | Badge avg | 7.18 | **7.57** | 6.81 |
  | Badge max | 7.7 | 7.7 | 7.7 |
  | Sidecard ≥7.0 views | 16 | 10 | 7 |
  | Sidecard avg (≥7.0 views) | 7.51 | **7.83** | 7.49 |
  | Sidecard best | 8.3 | **8.8** | 7.7 |
  | Sidecard ≥8.0 count | 1 | **4** | 0 |
  | Pipeline saves | 1 | **3** | 0 |
  | TTSM | **42s** | 110s | \~instant (cached) |

  **Badge score distribution:**

  | Band | partnerships | strategy ops | gtm |
  |------|-------------|--------------|-----|
  | <5.0 | 0 | 0 | **4** |
  | 5.0–6.9 | 0 | 0 | 0 |
  | 7.0–7.9 | 15 | 19 | 12 |
  | 8.0+ | 0 | 0 | 0 |

  **Sidecard score distribution (strong_match_viewed):**

  | Band | partnerships | strategy ops | gtm |
  |------|-------------|--------------|-----|
  | 7.0–7.9 | 15 | 6 | 7 |
  | 8.0+ | 1 | **4** | 0 |

  **Comparison summary:**
  1. **Strongest ≥7.0 concentration:** `partnerships manager` and `strategy and operations manager` are tied for badge density (both 100%). `gtm` has 4 non-qualifying jobs (4.6 badge scores — genuinely poor fit roles).
  2. **Best single match:** `strategy and operations manager` — sidecard ceiling 8.8 (achieved 3 times). Highest score across all surfaces.
  3. **Fastest TTSM:** `partnerships manager` — 42 seconds to first strong match from session start.
  4. **`strategy and operations manager` vs baseline:** Clear outperformance. Higher badge avg (+0.39), higher ceiling (+0.5 sidecard), 4× more 8.0+ jobs, 3× more pipeline saves. This surface is objectively stronger for Jen than the generic `partnerships manager` baseline query.
  5. **`gtm strategy operations` viability:** Weaker stretch surface. 4 non-qualifying badge scores (4.6 = <5.0 = Poor Fit) indicate role dilution — the GTM framing surfaces sales/marketing roles not aligned with Jen's profile. Sidecard ceiling is 7.7 (no 8.0+ reached). Zero pipeline saves. Viable only as a tertiary Adjacent Search suggestion — not a primary surface.

  **PM interpretation:**
  - Jen's best search surface is `strategy and operations manager`. Confirmed empirically post-fix: higher badge density AND higher quality ceiling AND strongest product outcome signal (pipeline saves).
  - `partnerships manager` is a reliable density anchor with fast TTSM — good as a starting surface but will underperform `strategy ops` in ceiling quality. The calibration page's hero title (`Partnerships Manager`) drives users to this query, but the better-performing surface is the adjacent framing.
  - The calibration session's adjacent titles ("Community & Growth Lead, Account Manager" per calibration result page) are generated from profile synthesis, not from empirical surface quality ordering. The experiment shows `strategy and operations manager` surfaces better jobs for Jen than the synthesis-derived nearby titles. This is a meaningful product gap.
  - **Adjacent search generation implication:** The current `nearby_roles` generation (from `titleRecommendation.adjacent_titles` in session synthesis) does not account for which search framings actually produce quality jobs on LinkedIn. A quality-aware adjacent term ranking layer could improve product outcomes — surfacing `strategy and operations manager` as the primary adjacent suggestion instead of `Community & Growth Lead`.
  - **Follow-up product task: RECOMMENDED.** Justification: 8.8 ceiling jobs and 3 pipeline saves on the strategy-ops surface vs 8.3 ceiling and 1 pipeline save on the baseline. The gap is real, and the Adjacent Search suggestions currently presented to users point toward weaker surfaces. A task to review/revise adjacent term ordering and possibly recalibrate how `nearby_roles` are selected from the synthesis is warranted.

- **Session decision — 2026-03-26 (Tailor Cross-User Resume Contamination Fix):**
  - **Bug discovered:** On a Jen tailor run, the generated tailored resume used Fabio Bellini's resume content — his name, cybersecurity background, and certifications. This is a source-binding failure, not an LLM hallucination or model error. The system loaded the wrong resume before the generation call was ever made.
  - **Root cause — two paths:**
    - **Path A (primary):** Extension stale `caliberSessionId`. The `CALIBER_SESSION_HANDOFF` message is only fired when the `caliber:session-ready` event is received from the calibration page (dispatched at the TITLES step in `app/calibration/page.tsx:289`). If the user navigates away, closes the tab, or the event is missed before the TITLES step, `chrome.storage.caliberSessionId` retains the prior session's ID indefinitely. All subsequent pipeline saves and tailor prep writes use this stale ID. The tailor route then calls `storeGet(staleId)` and loads the wrong user's resume.
    - **Path B (secondary):** Web-created pipeline entries silently dropped `sessionId`. `dbPipelineCreate` in `app/api/pipeline/route.ts` was not passing `sessionId` to the DB function, and `pipelineCreate` in `lib/pipeline_store_db.ts` did not include it in the Prisma write. This meant web-created entries always had `sessionId = null`, triggering a `getLinkedCaliberSession` stale-session fallback in the tailor route.
  - **Fix shape (commit `892a45a`):** (1) Tailor POST route reads the `caliber_sessionId` cookie as the primary resume-session source (`resumeSessionId = cookieSessionId || resolvedSessionId || null`). The cookie is a server-set value reflecting the user's active calibration; the extension cannot override it. (2) Web-auth POST threads `sessionId` through to `dbPipelineCreate`. (3) `pipelineCreate` persists `sessionId` to the Prisma write.
  - **Why cookie priority is safer:** The `caliber_sessionId` cookie is set by the Next.js calibration page at session lock and reflects the authenticated web session's current calibration. It is functionally decoupled from the extension's `caliberSessionId` — even if the extension has a stale ID, the cookie reflects what the calibration page last confirmed. Fallback chain: cookie → prep.sessionId → entry.sessionId → 404.
  - **Implication for beta trust:** Any tailor output generated before commit `892a45a` is potentially contaminated and must not be used as a quality baseline. Post-fix runs with a confirmed single-user calibration are the valid baseline for tailor quality validation. Gate 5 (functionality) closure stands — the plumbing fix is in place; a post-fix end-to-end tailor run is required to validate output quality.
  - **What is not affected:** Scoring API, badge rendering, sidecard scoring, calibration session storage, BST/SGD/surface classification. The contamination was limited to the resume-loading step in tailor generation.

- **Session decision — 2026-03-25 (Extension Calibration-Context Freshness Fix):**
  - **Bug discovered:** In-memory `lastKnownCalibrationTitle` / `lastKnownNearbyRoles` in `extension/content_linkedin.js` had three overly-restrictive guards (`length === 0` / `!lastKnownCalibrationTitle`) that permanently blocked refresh once populated. In a Fabio → Jen re-calibration flow with an open LinkedIn tab, Adjacent Searches continued showing Fabio/security roles even though the scoring API was already returning Jen-correct adjacent roles.
  - **Root cause:** Client-side extension memory/storage refresh bug — not server-side model confusion. `chrome.storage.local` was correctly overwritten by `background.js` on each `CALIBER_SESSION_HANDOFF`; the content script simply never re-read it. The API truth was correct throughout.
  - **Fix shape (commit `da6e5ec`):** (1) Removed `&& lastKnownNearbyRoles.length === 0` guard from scoring batch callback — API responses now always overwrite context; `rolesChanged` diff-check guards unnecessary storage writes. (2) Removed both guards from session discover hydration path — discover response reflects current storage, which is always correct after handoff. (3) Added `chrome.storage.local.get` refresh in `CALIBER_SESSION_READY` handler — context refreshes immediately when a new session handoff arrives, before any badge scanning restarts.
  - **Implication for telemetry/surface testing:** Any extension surface run conducted in an open tab that was previously loaded under a different calibration (e.g., Fabio context → Jen calibration without tab reload) may have had incorrect Adjacent Search suggestions. This does not affect badge scores or sidecard scoring — those use `calibration_title` and `nearby_roles` from the API response directly. Only the fallback path in `updateAdjacentTermsModule` (using `lastKnownNearbyRoles`) was affected. Post-fix runs with a clean tab load are the valid baseline for Adjacent Searches surface experiments.
  - **What is not affected:** All scoring API responses, score values, BST surface classification (which uses fresh API data from `recentScores`), telemetry event fields. The contamination was limited to the fallback context path in Adjacent Searches.

- **Session decision — 2026-03-25 (Telemetry Observability + Jen Rerun Blocked):**
  - Telemetry is now sufficient for controlled surface experiments: `searchQuery` and `positionIndex` added to `job_score_rendered`; `caliberExperimentMeta` tagging via `background.js`; `FeedbackEvent` linked to surface/session/job. PM operator guide in this file (see Procedure 1 below).
  - Per-surface telemetry dedup bug fixed: `telemetryEmittedIds` now `Map<surfaceKey, Set<jobId>>` — cross-surface suppression eliminated.
  - First Jen surface comparison (Run 1) produced directional insight: ops-strategy hybrid titles surface higher-ceiling individual matches; `partnerships manager` has highest badge density; `partner ecosystem process analytics cross-functional` surfaces highest individual ceiling (9.4 sidecard). Results are directional — first run's global dedup infra gap means counts are understated.
  - Jen surface experiment **rerun was attempted** (Jen fixture, signals ON, chips skipped, revised query set including `strategy and operations manager`) and is **incomplete / paused**. LinkedIn page became unresponsive during dense scoring; Chrome showed page unresponsive dialog. Extension stability patch shipped (commit `ce204b1`), but the rerun has not yet been re-attempted.
  - **Active blocker:** Confirm extension stability on dense surface with patched build before rerunning. Issue #108.

- **Telemetry instrumentation is shipped and experiment-ready (2026-03-25).** Event capture via `POST /api/events` (TelemetryEvent) and `POST /api/feedback` (FeedbackEvent), both persisted to Neon (Postgres) via Prisma. Events: `search_surface_opened`, `job_score_rendered`, `job_opened`, `strong_match_viewed`, `pipeline_save`, `tailor_used`. Feedback events: `thumbs_up`, `thumbs_down`, `bug_report`. Non-blocking, fire-and-forget. Signal condition embedded in `sessionId` suffix: `::signal_on` / `::signal_off`. Experiment condition labels (fixture/chips/query_set) injectable via `chrome.storage.local.set({ caliberExperimentMeta: { fixture: "jen", chips: "yes", query_set: "A" } })`.
- Two-branch release model implemented (2026-03-14): `main` = development iteration, `stable` = production deploy. Vercel production deploys from `stable` → caliber-app.com. Preview deploys from `main`. Promotion: validate on main → fast-forward merge to stable → push.
- Dashboard and cohort analysis remain future work.

- **Session decisions — 2026-03-27 (Scoring Quality Guardrails + UX Polish + Tailor Export Cluster):**
  - **Scoring guardrail expansion:** Three guardrail additions this session: (1) domain overclaim tightened in headline/summary (`59ecd39`); (2) title-shape overfitting prevention added (`69b9ca7`); (3) `specialist_craft` ExecutionEvidenceCategory added with 5.5 cap for motion control / healthcare integration / construction estimating roles where the profile lacks hands-on craft evidence (`ad8ec41`). Scoring pipeline now has 8 layered guardrails. Total regression test count: 200+.
  - **PDF/DOCX export readiness:** 9 commits reworking the full export pipeline (`facddfd`–`49df0f8`). Entry detection, role/date hierarchy, summary weight, parser merging, tailoredText persistence to DB, TailorPanel PDF download. Back-to-Caliber navigation fixed on both auth paths.
  - **Sidecard jitter stabilization:** Two-layer guard (`adc45e7` + `b9e527f`) eliminates skeleton flash on reopen and scroll-induced re-fetch. Extension v0.9.32.
  - **Executive Summary reframe:** "Bottom Line" → "Executive Summary". `generateWorkRealitySummary()` produces work-reality copy driven by roleType/jobMode/compatibility, replacing the prior fit-arithmetic recap. 350ms fade-in. Extension v0.9.32.
  - **Recalibrate regression fix:** Recalibrate/Restart buttons now use `router.replace("/calibration?direct=1")` — bypasses auth redirect guard that was sending authenticated users to `/pipeline`. Issue #111 resolved (`5a1d9bf`).
  - **Current beta state:** All 5 gates closed. Two items pending PM validation before beta declaration: (a) Executive Summary copy quality (live user testing on varied profiles); (b) post-fix tailor quality (STRONG-match run needed with confirmed single-user calibration). PDF export is application-quality but edge cases with unusual resume structures may need spot-checking. Issue #107 (Vercel production branch alignment) remains open — requires operator action.

## Telemetry Field Reference (as of 2026-03-25)

### TelemetryEvent — key fields per event

| Event | Required fields | meta fields |
|-------|----------------|-------------|
| `search_surface_opened` | `sessionId`, `surfaceKey`, `timestamp` | `searchQuery` |
| `job_score_rendered` | `sessionId`, `surfaceKey`, `jobId`, `score`, `timestamp` | `searchQuery`, `positionIndex` |
| `job_opened` | `sessionId`, `surfaceKey`, `jobUrl`, `timestamp` | `badgeScore` (pre-score from card cache if available) |
| `strong_match_viewed` | `sessionId`, `surfaceKey`, `jobUrl`, `score`, `scoreSource`, `timestamp` | `searchQuery` |
| `pipeline_save` | `sessionId`, `surfaceKey`, `jobUrl`, `score`, `timestamp` | `searchQuery`, `trigger` (manual_sidecard \| auto_8.5) |

**`surfaceKey`**: pipe-joined composite `path|keywords|location|f_TPR|f_JT|f_E|f_WT|distance|sortBy|geoId` — one durable key per unique search surface. Normalized, lowercase.

**`sessionId`** format: `{caliberSessionId}::signal_on` or `{caliberSessionId}::signal_off`. Strip `::condition` suffix to get raw session. Controlled experiment label fields (fixture, chips, query_set) are in `meta` alongside `searchQuery`.

**`scoreSource`**: `"card_text_prescan"` for card badges (from batch scoring), `"sidecard_full"` for sidecard full descriptions.

### FeedbackEvent — key fields

| Field | Purpose |
|-------|---------|
| `surfaceKey` | Links feedback to `TelemetryEvent.surfaceKey` — enables surface-level scoring-error analysis |
| `sessionId` | Links feedback to session (`::signal_on/off` tagged same as telemetry) |
| `jobUrl` | Links feedback to specific `TelemetryEvent` record for that job |
| `fitScore` | Score at time of feedback — use with `feedbackType = 'thumbs_down'` to find bad scores |
| `feedbackType` | `thumbs_up` / `thumbs_down` / `bug_report` |
| `feedbackReason` | One of: `score_wrong`, `hiring_reality_wrong`, `title_suggestion_wrong`, `explanation_not_helpful`, `other` |
| `bugCategory` | `wrong_job_detected`, `score_failed_to_load`, `panel_not_opening`, `content_missing`, `action_not_working`, `other` |

## PM Operator Guide — Telemetry Procedures

### Procedure 1: Controlled Jen Surface Experiment

**Goal:** Compare multiple search term sets for one fixture under fixed conditions (signal/chips state), identify which queries produce the best-fit surfaces.

**Steps:**

1. Open a Caliber dev session for the Jen fixture (calibrate as Jen, get `caliberSessionId`).
2. Before each test query set, tag the run via DevTools console on LinkedIn:
   ```javascript
   chrome.storage.local.set({ caliberExperimentMeta: { fixture: "jen", chips: "yes", query_set: "A" } })
   ```
   Change `query_set` for each set (A, B, C...). `chips` = "yes" or "no" depending on state.
3. Navigate to each LinkedIn search with the test query. Scroll to score at least 10 jobs. Open 2–3 sidecards.
4. Repeat for each query set, updating `caliberExperimentMeta` between sets.
5. After the run, clear the label: `chrome.storage.local.remove("caliberExperimentMeta")`

**Analysis queries (Postgres / Neon SQL):**

```sql
-- Per-surface score distribution for fixture "jen", query_set "A"
SELECT
  surfaceKey,
  JSON_EXTRACT(meta, '$.searchQuery') AS query,
  COUNT(*) AS jobs_scored,
  COUNT(*) FILTER (WHERE score >= 8.0) AS strong_8,
  COUNT(*) FILTER (WHERE score >= 7.0) AS strong_7,
  MAX(score) AS best_score,
  AVG(score) FILTER (WHERE JSON_EXTRACT(meta, '$.positionIndex')::int < 10) AS avg_first_10
FROM "TelemetryEvent"
WHERE event = 'job_score_rendered'
  AND meta::jsonb @> '{"fixture":"jen","query_set":"A"}'
GROUP BY surfaceKey, JSON_EXTRACT(meta, '$.searchQuery');

-- TTSM (time-to-strong-match) per surface for the same run
SELECT
  sso.surfaceKey,
  MIN(smv.timestamp) - MIN(sso.timestamp) AS ttsm
FROM "TelemetryEvent" sso
JOIN "TelemetryEvent" smv
  ON smv.sessionId = sso.sessionId AND smv.surfaceKey = sso.surfaceKey
WHERE sso.event = 'search_surface_opened'
  AND smv.event = 'strong_match_viewed'
  AND sso.meta::jsonb @> '{"fixture":"jen","query_set":"A"}'
GROUP BY sso.surfaceKey;
```

**Segment dimensions:**

| Question | Use |
|----------|-----|
| Signal condition | `sessionId LIKE '%::signal_on'` vs `'%::signal_off'` |
| Fixture / chips / query_set | `meta::jsonb @> '{"fixture":"jen","chips":"yes","query_set":"A"}'` |
| Surface | `surfaceKey` |
| Raw query text | `JSON_EXTRACT(meta, '$.searchQuery')` on any event |
| Card position | `JSON_EXTRACT(meta, '$.positionIndex')` on `job_score_rendered` |

---

### Procedure 2: Live-User Surface Quality Review

**Goal:** Identify patterns of low quality surfaces, suspicious score distributions, and likely scoring errors from real users.

**Steps:**

1. Run the surface distribution query across all live traffic (no experiment filter).
2. Flag surfaces where `avg_score < 5.5` or `strong_7 / jobs_scored < 0.05` (less than 5% strong matches).
3. Pull `FeedbackEvent` thumbs-down records for those surfaces. Check `feedbackReason` and `fitScore`.
4. Pull `job_opened` events on the flagged surface to see if users still opened low-scoring jobs (signal of false negatives).
5. For likely scoring errors: look for surfaceKey where `feedbackReason = 'score_wrong'` with `fitScore >= 7.0` (user said score was too low) or thumbs-down on `fitScore < 5.0` (user opened low-score job = possible false negative).

**Analysis queries:**

```sql
-- Low-quality surface candidates (real users, last 30 days)
SELECT
  surfaceKey,
  JSON_EXTRACT(meta, '$.searchQuery') AS query,
  COUNT(*) AS jobs_scored,
  AVG(score) AS avg_score,
  COUNT(*) FILTER (WHERE score >= 7.0) AS strong_7,
  MAX(score) AS best_score
FROM "TelemetryEvent"
WHERE event = 'job_score_rendered'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY surfaceKey, JSON_EXTRACT(meta, '$.searchQuery')
HAVING AVG(score) < 5.5 OR COUNT(*) FILTER (WHERE score >= 7.0) = 0
ORDER BY avg_score ASC;

-- Thumbs-down + bug reports linked back to surface (after 2026-03-25 patch)
SELECT
  fe.surfaceKey,
  fe.fitScore,
  fe.feedbackReason,
  fe.bugCategory,
  fe.sessionId,
  fe.jobUrl,
  te.score AS telemetry_score,
  te.jobTitle
FROM "FeedbackEvent" fe
LEFT JOIN "TelemetryEvent" te
  ON te.jobUrl = fe.jobUrl AND te.event = 'strong_match_viewed'
WHERE fe.feedbackType IN ('thumbs_down', 'bug_report')
  AND fe.timestamp > NOW() - INTERVAL '30 days'
ORDER BY fe.timestamp DESC;

-- Jobs users opened despite low badge score (potential false negatives)
SELECT
  jo.surfaceKey,
  jo.jobTitle,
  jo.company,
  jo.jobUrl,
  JSON_EXTRACT(jo.meta, '$.badgeScore') AS badge_score,
  smv.score AS sidecard_score
FROM "TelemetryEvent" jo
LEFT JOIN "TelemetryEvent" smv
  ON smv.jobUrl = jo.jobUrl AND smv.event = 'strong_match_viewed'
WHERE jo.event = 'job_opened'
  AND JSON_EXTRACT(jo.meta, '$.badgeScore')::float < 5.0
  AND smv.score >= 7.0
ORDER BY jo.timestamp DESC;
```

**Scoring-error cluster detection:**

- Repeated `feedbackReason = 'score_wrong'` on the same `surfaceKey` → scoring may be biased against a role family on that query
- `bugCategory = 'wrong_job_detected'` → content extraction issue on a specific job template
- High `avg_score` surface with zero `strong_match_viewed` events → sidecard may be failing silently on that surface
- Badge pre-score (`meta.badgeScore` on `job_opened`) vs sidecard score divergence > 2 points → prescan extraction instability

**What is still missing after this patch:**
- No automated alerting — PM must run queries reactively. A scheduled query or Neon Notify trigger would enable proactive detection (future work).
- No web-app event coverage for `search_surface_opened` or `job_score_rendered` — telemetry is extension-only today. Web app emits `tailor_used` only.
- FeedbackEvent thumbs-down `feedbackReason` = `null` when user submits without selecting a chip — those records are harder to cluster. Consider making chip selection required for thumbs-down (future UX decision).

**Recent completed fixes (this session):**
- Extension feedback controls restored: SVG icons, GitHub-issue bug report (6fad8b7)
- Extension tailor banner state logic fixed: no premature "Opened ✓", pipeline routing (6fad8b7)
- Calibration results hero spacing improved: button centered in lower half of hero card (5d3c91a)
- Calibration explanation copy replaced with structured summary template (5d3c91a, 25c7752)
- Signal normalization layer added for explanation copy (25c7752)
- Better Search Title rolling window fixed to documented spec: window=4, diagnostic logging (ec32fe6)

**Unchanged foundations:**
- Caliber has expanded from evaluation-only to strong-match action workflow.
- The calibration page (`/calibration`) is a launchpad. Output: one hero title direction, extension install CTA, scoring philosophy.
- The browser extension sidecard is the primary decision surface: job identity, fit score, decision badge, Hiring Reality Check, collapsible supports/stretch/bottom line.
- Jobs scoring 8.0+ trigger a contextual card above the sidecard: "Tailor resume for this job."
- Resume tailoring uses the user's existing uploaded Caliber resume + live job context from the extension. Nothing is fabricated.
- All OpenAI-dependent features (tailoring, pattern synthesis, resume skeleton) use a shared `requireOpenAIKey()` guard from `lib/env.ts`. OPENAI_API_KEY must be set in the runtime environment. Missing key returns clean 503 to the user.
- Pipeline entry is created at `/api/tailor/prepare` time — pipeline persistence begins before tailoring, not after. Pipeline dedupe is based on canonical/normalized job URL.
- Tailor page completed (2026-03-11): copy-to-clipboard action, retry-on-error for generation failures, polished result area with copy/download actions.
- Pipeline enhanced (2026-03-11): DnD card movement between columns, fit score displayed on cards, visibility reload on tab focus. Code is complete; product validation deferred to step 6.
- Shell visual baseline anchored to commit a211182. Shared shell framework not yet locked; deferred to step 6.
- Pipeline board is intentionally anti-CRM. No subtasks, notes, timelines, or due dates.
- Extension v0.8.9 deployed (ZIP rebuilt with overlay badge system, BST surface-classification trigger, score color band lock, and fetch stability fixes).
- Extension handshake friction (#31) is known — may require manual tab refresh on first install. Not currently blocking.
- All "Back to Caliber" links route to /calibration.
- Next priorities: validate tailor resume end-to-end (gate 5 — the only remaining open gate) → declare beta. Overlay and auto-save work continue in parallel without blocking.

**Real User Flow:**
```
calibration → results page → /extension → download ZIP → install in Chrome → navigate LinkedIn → extension scores jobs

Discovery layer (search results):
LinkedIn search results → score badges appear on visible job cards → progressive scoring via scroll → cache restores on return navigation → BST fires if too few strong matches

Decision layer (selected job):
Click a job → sidecard scores full description → Fit Score + Hiring Reality Check + Bottom Line

Strong-match action flow (8.0+):
LinkedIn job scores 8.0+ → contextual card above sidecard → "Tailor resume for this job" → /tailor page → generate tailored resume → download → entry tracked in /pipeline
```
`/extension` must always serve the current extension build.

**Scoring Context Separation:**
- **Calibration → Direction:** determine job-search direction, display single hero title direction, prompt extension install.
- **Extension → Evaluation:** analyze real job descriptions, provide fit + hiring reality evaluation (Fit Score, Hiring Reality Check, Bottom Line).
- These are fundamentally different evaluation contexts and must not be conflated.

Calibration flow runs end-to-end: resume upload → prompt answers → title recommendation → extension CTA. Backend smoke reaches TERMINAL_COMPLETE with result. Vercel auto-deploys production from `stable` branch; preview deploys from `main`.

**Stable Beta — Production/Dev Environment Split Active (2026-03-08). Release model updated (2026-03-14).**
- Production web app served from `https://www.caliber-app.com` (Vercel, auto-deployed from `stable` branch).
- Development iteration happens on `main` branch; Vercel generates preview deploys for internal testing.
- Promotion to production: validate on main → fast-forward merge into `stable` → push → Vercel deploys to caliber-app.com.
- Production extension locked to `https://www.caliber-app.com` only — no localhost contact.
- Dev extension locked to `http://localhost:3000` only — no production contact.
- No host fallback behavior in either extension build.
- Production site + production extension verified working live.
- See `ENVIRONMENT_SPLIT.md` for operator instructions and host permission rules.

**Extension Phase 1 MVP: VERIFIED WORKING (2026-03-06).** The Chrome extension extracts job descriptions from LinkedIn job detail pages and calls the production API at `https://www.caliber-app.com/api/extension/fit`. The popup renders a fit score (confirmed live: 4.3/10 screenshot), supports-fit bullets, stretch factors, bottom line, and Recalculate / Open in Caliber actions.

## Current Calibration Page Layout (2026-03-11, canonical)

The `/calibration` page is an extension-first launchpad. It answers "What direction should I search?" — not "Is this specific job a fit?"

Layout from top to bottom:

1. **"Calibration Complete"** — confirmation that calibration is done.
2. **Two-sentence context → market translation:**
   - Sentence 1: Human alignment context derived from synthesis patternSummary (first sentence).
   - Sentence 2: "The closest market label for the kind of work you're naturally aligned with is:"
3. **Hero title card** — single title recommendation rendered as the conclusion to the two-sentence context:
   - Centered title text (text-[1.3rem] / sm:text-[1.7rem])
   - "Start evaluating jobs" CTA (green outlined)
4. **"How we score this"** — scoring philosophy section.
5. **Recalibrate** — restart option.

What is **not** on this page:
- Multiple title suggestions
- Title scores
- Manual job paste / manual scoring
- Fit accordion or inline job results
- "OR" divider between buttons
- Technical internal language in explanations

Job-fit evaluation lives exclusively in the browser extension sidecard.

## Current Extension Sidecard (2026-03-14, canonical)

The extension operates as a two-layer evaluation surface:
- **Discovery layer (listings):** Score badges injected below the title/company line in LinkedIn search result cards. Each card shows a color-coded fit score (Green 8.0+ / Yellow 6.0–7.9 / Red 0–5.9). Progressive scoring via chunked API batches. Scroll, MutationObserver, and viewport buffering detect new/rerendered cards. Badge target uses `CARD_CONTENT_SELECTORS` with multiple fallbacks. Cache restores badges instantly on return navigation.
- **Decision layer (sidecard):** Full evaluation panel for the selected job. Fit score, Hiring Reality Check, supports/stretch/bottom line, nearby roles, feedback controls.

The sidecard is the primary decision surface. Compact, decision-first layout. Collapsed height is stable across all score states — all collapsible section toggles render regardless of content. (**Note:** #48 resolved 2026-03-11; ongoing validation confirms stability.)

**Structure (top to bottom):**

*Inside the sidecard (BST presentation updated v0.9.20):*
0. **Adjacent Searches module (formerly BST popup banner)** — persistent collapsible section showing chip-styled search term links populated from calibration title + nearby roles (v0.9.20, issue #82). Replaces the standalone popup banner that previously rendered above the sidecard. BST evaluation engine (`evaluateBSTFromBadgeCache()`) still runs and classifies surfaces; surface classification drives a subtle pulse/glow when ≥20 jobs scored + "bst" surface classification. Suggests calibration primary title or adjacent search-surface titles — never listing-specific titles.

*Inside the sidecard:*
1. **Header bar** — Caliber logo + refresh + close button
2. **"Saved to pipeline" row** — Appears at top of results for strong matches (score >= 8.5). Shows checkmark + "Saved to pipeline" + Tailor resume / View pipeline actions.
3. **Top row** — Two-column: company name + job title (right), fit score (28px) + decision badge (left)
4. **Hiring Reality Check** — Always rendered; collapsible row with band badge (High/Possible/Unlikely or “—” fallback); reason text color-matched to band
5. **Supports fit** — Green toggle with dot indicators; expands to bullet list
6. **Stretch factors** — Yellow toggle with dot indicators; always rendered (0 dots when empty); expands to bullet list
7. **Bottom line** — Collapsible; always rendered (“—” fallback when empty)
8. **Nearby roles** — Collapsible, blue-tinted (conditional, score < 7.5 only)
9. **Feedback row** — Thumbs up/down; negative feedback expands to chip panel + optional text. Separate bug-report action for reporting extension issues, distinct from quality feedback.

**Dimensions:** 380px wide, 520px max height, 240px min height (results body).
**Version:** v0.9.29.

## Better Search Title — Search Surface Recovery Mechanism (2026-03-10)

Better Search Title is a **Search Surface Recovery Mechanism**. It answers the user question: "What title should I search to find better-fit jobs?"

**Trigger (canonical: see CALIBER_ACTIVE_STATE.md "Better Search Title" section, updated 2026-03-20):** Two-phase composite classifier (v0.9.17). Phase 1: no classification until 5+ scored. Phase 2: healthy (suppress BST) if >=2 strong (>=7.0) or >=1 at 8.0+; BST trigger if zero strong; neutral if exactly 1 in [7.0, 7.9]. Forced classification at 10+ scored. Surface classification (`classifySearchSurface()`) provides diagnostic context only. Named constants: `BST_STRONG_MATCH_THRESHOLD = 7.0`, `BST_MIN_WINDOW_SIZE = 5`, `BST_AMBIGUOUS_AVG_CEILING = 6.0`, `BST_HEALTHY_MIN_STRONG = 2`, `BST_HEALTHY_SINGLE_HIGH = 8.0`, `BST_FORCE_CLASSIFY_WINDOW = 10`.

**UX (updated v0.9.20):**
- Presented as a persistent collapsible "Adjacent Searches" section inside the sidecard (v0.9.20, issue #82). Previously rendered as a popup banner above the sidecard (popup disabled v0.9.20).
- Initial-surface gating (v0.9.7+): BST evaluation deferred via `initialSurfaceResolved` gate until initial scoring queue drains.
- No stale restore (v0.9.10): durable prescan state no longer restores surface banner on init.

**Title suggestion logic:**
- Primary: calibration primary title (the user's strongest fit direction from their calibration session).
- Secondary: adjacent search-surface titles from calibration (cross-cluster alternatives).
- Never: exact listing titles, employer-specific phrasing, long compound titles, or overly narrow job-specific phrases.
- Titles must be broader market-search terms — plausible, reusable across many listings, adjacent to the user's fit zone.

**Product principle separation:**
- Navigation guidance (Better Search Title) is structurally separated from job evaluation (sidecard).
- The sidecard evaluates the current job. The recovery banner redirects the search.

**API support:** `/api/extension/fit` returns `calibration_title` (the user's calibration primary title) and `nearby_roles` (adjacent titles) to power the suggestion logic.

## Beta Feedback Loop (2026-03-10)

Structured feedback collection active across extension and web app.

- Extension sidecard: thumbs up/down row at bottom of scored results.
- Thumbs down expands to chip panel (Score wrong / Hiring reality wrong / Title suggestion wrong / Explanation not helpful / Other) + optional textarea.
- Separate bug-report action in the feedback row for reporting extension issues — distinct from thumbs-down quality feedback.
- Web results page: same thumbs → chips → submit flow.
- Behavioral signals tracked per session: jobs_viewed, scores_below_6, highest_score, suggest_shown, suggest_clicked.
- Backend: `POST /api/feedback` endpoint, persisted to Postgres (Neon) via Prisma `FeedbackEvent` model. File-backed JSONL storage is superseded.
- Session signals reset on search query change and panel deactivate.

## Known Pain Points

- Bottom line paragraph can repeat phrases from stretch bullets verbatim — stretchLabel() de-dup partially mitigates but not fully doctrine-tight yet.
- Extension popup explanation content/rendering is still sparse or incomplete in some runs.
- Sister-profile run produced only one low-scoring title with no three options/dropdown (saved issue).
- Must keep repo/main and extension packaging flow aligned so testing does not drift from source of truth.

## Extension — Working Assumptions

- Production extension targets `https://www.caliber-app.com` only. Dev extension targets `http://localhost:3000` only. No fallback between hosts.
- Extension is the real job-fit decision layer — fit explanations should feel most powerful in the extension, not on the calibration page.
- Calibration titles are initial search terms / starting hypothesis, not the full search surface. Real market discovery may require adjacent/expanded titles later.
- Testing must use the current `extension/` folder build (DEV) or `dist/extension-dev/` — never stale zip artifacts.
- Phase 1 validation flow: open LinkedIn job detail page → click Caliber extension → popup returns score.
- Phase 2 overlay flow: navigate LinkedIn search results → score badges appear on visible cards → scroll triggers progressive scoring → BST evaluates from accumulated badge cache.

## Scoring Pipeline Architecture (current)

The scoring pipeline applies 7 layered guardrails after raw 6-dimensional vector alignment:
1. Work mode adjustment (compatible=0, adjacent=-0.8, conflicting=-2.5)
2. Execution intensity detection (grind signals: mild=-0.5, heavy=-1.5, extreme=-2.5)
3. Dampening (intensity at 50% when already conflicting)
4. Role-type penalty (SYSTEM_BUILDER/SYSTEM_OPERATOR/SYSTEM_SELLER)
5. Chip suppression (hard caps from user avoidedModes)
6. Execution evidence guardrail (domain-locked ecosystems × 7 + stack-execution patterns × 31; cap at 7.0)
7. HRC gap line surfacing (one-line italic red reason in sidecard Hiring Reality Check)

4 canonical fixture profiles: Chris (builder/systems), Fabio (analytical/investigative), Jen (blended/ops-enablement), Dingus (weak-control). 6 job fixture families + 2 execution-evidence job fixtures. 200/202 tests pass (2 pre-existing signal_classification failures).

## Session Decisions (2026-03-14, Lightweight Product Telemetry)

- **Telemetry instrumentation shipped before beta.** PM decision: event capture must be live before outside-user testing starts so beta generates usable product data from day one.
- **Six events instrumented:** search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used. Events fire from extension (via background.js relay) and web app (direct fetch).
- **TTSM is the primary metric this supports.** Time-to-Strong-Match = time from search_surface_opened to first strong_match_viewed (score >= 8.0) on the same surface.
- **Non-blocking by design.** All telemetry calls are fire-and-forget with swallowed errors. No user-facing flow depends on telemetry success.
- **No dashboard yet.** Event capture only. Analysis, aggregation, and visualization are future work.

## Session Decisions (2026-03-14, Beta Definition + Post-Beta Metrics Roadmap)

- **Beta defined operationally (updated 2026-03-14).** Beta = five core functional gates all passing: (1) BST working, (2) sidecard stable, (3) pipeline solid, (4) sign-in/memory operational, (5) tailor resume works. Overlay scoring is NOT a beta gate — it is parallel improvement work. PM must answer readiness questions before declaring beta.
- **Post-beta metrics planned.** Primary metric: Time-to-Strong-Match (TTSM). Supporting: Strong Match Rate, Pipeline Save Rate, Tailor Usage Rate, Calibration Completion Rate. All deferred until beta is stable and outside testing has started.
- **Release model gap resolved (2026-03-14).** Two-branch model implemented: `main` = development, `stable` = production. Vercel production deploy from `stable`. Preview deploys from `main`. Every push to main is no longer immediately live for outside testers.
- **No metrics work during current stabilization.** Metrics instrumentation and dashboard are explicitly post-beta. Current focus remains on closing beta gates (sign-in/memory is the next major item).

## Session Decisions (2026-03-14, Phase-2 Overlay Scoring Shipped)

- **Phase-2 overlay scoring complete.** Extension now provides two evaluation surfaces: score badges on search result cards (discovery) and full sidecard evaluation on selected job (decision). Badge system is stable with identity, caching, progressive scoring, and lifecycle management.
- **Next priorities updated.** With overlay scoring stable, the next product-layer additions are: auto-save strong matches → post-save confirmation → account prompt → pipeline refinement. Soft-locked in order.
- **Card identity uses LinkedIn's native IDs.** Priority chain: data-occludable-job-id → /jobs/view/{id} href → data-job-id → text hash fallback. Native IDs are preferred over composite text identity for stability and O(1) lookup.
- **BST evaluation unified with badge scoring.** `evaluateBSTFromBadgeCache()` replaces the separate prescan pipeline — badge scoring IS the prescan. Reduces API calls and architectural complexity.

## Session Decisions (2026-03-11, Stabilization Phase — Soft-Locked Task Sequencing)

- **Stabilization before expansion.** The project is entering a debug/polish phase before any new action-layer additions. Extension sidecard sizing, BST trigger verification, and recent copy/feedback fixes must be validated stable first.
- **Soft-locked task order established.** The next 6 steps are explicitly sequenced: sidecard sizing → BST verification → auto-save strong matches → post-save confirmation → account prompt → pipeline refinement. Each main step is blocked by the previous step until validated complete.
- **Small UI bug squash exception.** Narrow, local UI fixes may be handled at any time without breaking the sequencing — provided they do not introduce new regressions or expand scope.
- **Active fix: sidecard collapsed height.** The extension sidecard currently changes height between scored jobs when all sections are collapsed. This is being fixed to use a fixed collapsed height. Not yet complete.
- **Recent fixes validated and shipped:** Extension feedback controls restored (6fad8b7), tailor banner state logic fixed (6fad8b7), calibration hero spacing improved (5d3c91a), structured explanation summary (5d3c91a, 25c7752), signal normalization layer (25c7752), BST rolling window fixed (ec32fe6).
- **Auto-save, account prompt, and pipeline expansion are queued — not active.** These are the next product-layer additions but are explicitly blocked until sidecard sizing and BST trigger are validated.

## Session Decisions (2026-03-11, Shell Baseline Correction + Documentation Truth Pass)

- **Three-zone shell rolled back.** The three-zone framing (Zone 1 = Brand 20vh / Zone 2 = Context / Zone 3 = Interaction) was attempted this season as a shell organization model. It introduced documentation and implementation drift — docs overstated it as "stabilized / canonical / applied consistently" while the underlying implementation was fragmented across 5+ page-specific inline patterns. PM direction: roll back to the last stable visual baseline and stop treating the three-zone model as the canonical framework.
- **Visual baseline anchored to a211182.** All 6 shell files (CaliberHeader, calibration, build-resume, extension, pipeline, tailor) restored to exact commit a211182 values. That commit's pattern: lowered CALIBER header + lowered ambient radial gradient (centered at 50% 12%), simple CaliberHeader with pt-4, page-local gradient ownership. Commit 7b03a18.
- **Shell ownership is page-local.** Each page carries its own gradient (size, intensity), hero offset (pt-[10vh] typical), and content width. No shared shell component is enforced. This is accepted as current state; whether to build a shared framework is the next open shell decision.
- **Documentation corrected.** All core Bootstrap files updated to remove or amend claims that the three-zone shell is canonical/stabilized/finalized. Historical references preserved with _(Superseded)_ annotations. Issues #41 and #46 reopened to reflect actual state. New issue #47 tracks the shared-shell-framework decision.
- **Product layer truths unchanged.** Calibration = direction, Extension = evaluation, Tailor + Pipeline = action. These were never affected by the shell experiment and remain locked.

## Session Decisions (2026-03-11, Three-Zone Shell Stabilization + Tailor Completion) _(SUPERSEDED — see Shell Baseline Correction above)_

> **NOTE (2026-03-11):** The three-zone shell decisions in this block have been superseded. The three-zone framing was rolled back to the a211182 visual baseline. The non-shell decisions (tailor completion, pipeline enhancement, upload simplification) remain current.

- **Three-zone shell attempted.** ~~Every page now follows a consistent three-zone structure.~~ _(Superseded — rolled back to a211182 baseline.)_
- **Shell alignment lowered.** CALIBER header and ambient gradient lowered ~12% across all pages. _(This alignment from a211182 remains the current visual baseline.)_
- **Upload page simplified.** Redundant heading removed, layout spacing tightened. _(Still current.)_
- **Tailor page launch-ready.** Copy-to-clipboard action added. Retry-on-error flow. Polished result area. _(Still current.)_
- **Pipeline board enhanced.** Cards moveable via DnD. Fit score displayed on each card. Board reloads on tab focus. _(Still current.)_
- **Extension ZIP rebuilt.** v0.6.0 packaging refreshed. _(Still current.)_
- **~~Visual shell drift largely resolved.~~** _(Superseded — drift was resolved for the a211182 visual baseline but the broader shared-shell architecture is not locked.)_
- **Product validation is next.** Pipeline board model and tailor output quality. _(Still current.)_

## Session Decisions (2026-03-11, Visual Shell Re-Lock + Action-Layer Refinement)

- **Design-system re-lock.** Stopped iterating via "match the pipeline page" approach after repeated local UI tweaks caused visual drift. Design system is now anchored to explicit approved primitives documented in CALIBER_ACTIVE_STATE.md.
- **Approved visual primitives codified:** Wide ambient gradient over #050505, outlined green buttons (no solid fills), no sharp centered line motif, calm/cinematic/premium feel.
- **Tailor page recomposed.** "Tailor Resume" is now the primary heading. CaliberHeader removed. Job title/company card appears first. Pipeline confirmation banner demoted to secondary position below job context.
- **Pipeline board implemented.** Rebuilt from vertical list to 4-column board (Resume Prep / Submitted / Interview Prep / Interview). Code is implemented with legacy stage auto-mapping. Product validation is active/next work — board model is not yet PM-approved.
- **Pipeline truth clarified.** Pipeline entries are created at tailor-prepare time (not after tailoring). Pipeline dedupe uses canonical/normalized job URL. Confirmation banner is truthful and tied to actual pipeline existence. CTA suppression prevents repeat Tailor CTA for jobs already in pipeline.
- **Extension debug/report label.** Bug-report button changed from icon-only (🐛) to "🐛 Report" with explicit text label. May need further UX refinement.
- **Better Search Title thresholds verified (2026-03-20).** Simple weak/strong thresholds from v0.8.x are superseded by two-phase composite classifier (v0.9.17). See CALIBER_ACTIVE_STATE.md for canonical BST doctrine. Trigger behavior validated and three bugs fixed in v0.9.20.
- **Routing standardized.** All "Back to Caliber" links now route to /calibration.
- **Visual drift is an active concern.** Shell composition remains inconsistent across pages. This is the next focused effort after the current session's changes.
- **Product layer separation reinforced:** Calibration = direction, Extension = evaluation, Tailor + Pipeline = action layer. These layers must not be conflated.

## Session Decisions (2026-03-08)

- **Stable beta environment split active.** Production and dev are hard-separated at the host-permission level. See `ENVIRONMENT_SPLIT.md`.
- **Roadmap re-sequenced:** scoring credibility and beta stability come before any feature expansion. Phase 2 is explicitly deferred.
- **Product understanding clarified:**
  - Calibration titles are a starting hypothesis / initial search terms, not the complete market-search solution.
  - Extension is the real job-fit decision engine. Fit explanations should feel most powerful in the extension.
  - Real-market search may require adjacent/expanded titles later — this is a known gap, not current scope.
  - Adaptive search suggestions are a later feature.
- **Scoring credibility resolved:**
  - Title scoring baseline verified with canonical fixture profiles (Chris, Jen, Fabio, Dingus).
  - Fabio correctly maps to SecurityAnalysis cluster; Jen correctly maps to CreativeOps / partnerships outputs.
  - Cross-cluster isolation and thin-input caps preserved.
  - Smoke baseline: 45 passed, 0 failed.
  - Market-job score compression (#26) and search-surface gap (#27) remain open but are separate from title-scoring correctness.
- **Calibration results page direction simplified:** intro typewriter lines → title cards → extension CTA. No other summary sections.
- **operateBest / loseEnergy / summary prose block intentionally removed** from the calibration results page flow.
- **Extension sidecard should show active job identity** (job title, company, optional location) for trust.
- **Workflow lesson:** multiple parallel extension branches caused renderer/persistence/packaging regressions — only one major extension branch at a time.
- **Documentation rule adopted:** after major PM sessions, create a documentation task before next PM reload.
- **Beta Launch Infrastructure Lock (future):** At beta launch, main becomes the stable production branch. All development moves to feature branches, staging/preview deploys must pass verification before merging to main. Rule is documented in `Bootstrap/milestones.md` but not yet active — current push-to-main workflow continues until beta launch is declared.

### Phase-2 Extension Overlay UX Contract (Finalized 2026-03-08)

UX design locked. Implementation deferred until scoring credibility and stable beta are resolved.

**Listing Badge:** Each LinkedIn job card displays a Caliber badge (icon + color-coded score) under the company logo.
- Format: `[Caliber Icon] Score` — e.g. 🟢 8.4
- Color bands (updated v0.8.9): Green (8.0–10.0, strong fit) · Yellow (6.0–7.9, stretch) · Red (0–5.9, skip)
- Exactly three bands. No additional tiers.

**Loading Placeholder:** When a job card becomes visible, immediately render `[Caliber Icon] …` before scoring completes. Replace with final badge when done. Purpose: eliminate perceived latency and signal scoring in progress.

**Progressive Visible-Job Scoring:** Score jobs based on viewport visibility.
- Page loads → score first ~10 visible jobs → user scrolls → score newly visible jobs.
- Must NOT score the entire search page at once.

**Sidecard Trust Header:** Sidecard displays the job currently being scored.
- Required: Job Title, Company Name.
- Optional: Company logo.
- Location intentionally excluded (clutter).

**Sidecard Content:** Minimal structure:
- Job Title / Company Name
- Caliber Score
- Supports (bullets)
- Stretch (bullets)
- Bottom Line (short paragraph)
- No additional LinkedIn metadata duplicated.

**Future Features (documented, NOT Phase-2 scope):**
- "Show only 7+ matches" filter
- Adaptive search suggestions when few strong matches appear
- Deep scoring vs preview scoring experiment
- Next/previous job navigation
- Sidebar tools (resume tailoring, interview prep)

## Next Tasks (locked order, updated 2026-03-11)

1. ~~Recompose global Caliber shell from approved visual primitives~~ — ATTEMPTED (three-zone framing tried, rolled back to a211182 baseline; shared framework not locked)
2. ~~Fix main/upload/ingest/tailor page hierarchy and spacing drift~~ — DONE (upload simplified, header lowered, tailor completed)
3. **Decide shared shell architecture** — page-local ownership (current) vs reusable shared shell. This is the next shell decision.
4. **Validate pipeline 4-column board model** — product-level approval of column names and stage decomposition. Code is complete with DnD and fit score.
5. **Validate tailor page output quality** — tailor page is launch-ready; determine text vs PDF download, review tailoring quality.
6. ~~Verify/restore Better Search Title trigger behavior~~ — DONE (v0.9.20: three bugs fixed, docs aligned to two-phase composite classifier, #44 resolved).
7. **CTA noise-control refinement** — per-session and time-based suppression for first-time 8.0+ exposures.
8. **Clarify extension debug/report affordance** — text label ("🐛 Report") shipped; may need further UX refinement.
9. **No unnecessary expansion of calibration scope** — calibration page is stable.
10. **Continue keeping role separation** — calibration as direction, extension as evaluation, tailor/pipeline as action layer.
11. **Bottom line / explanation polish** — only as needed for beta credibility.
12. **Phase 2 overlay/list scoring** — deferred until after stable beta.

## Scoring Baseline

Caliber title scoring now uses canonical fixture profiles as regression anchors.

**Fixture profiles:**
- **Chris** — systems / product builder pattern (Product Designer 9.9, Product Development Lead 9.9, UX Design Strategist 8.6)
- **Jen** — creative operations / enablement pattern (Creative Operations Lead 9.9, Sales Enablement Specialist 9.9, Partnerships Manager 8.8)
- **Fabio** — technical investigation / security analysis pattern (Technical Security Consultant 9.3, Cybersecurity Specialist 8.8, Security Analyst 8.8)
- **Dingus** — weak / generic control pattern (Account Manager 2.3, Business Development Manager 2.3, Client Success Manager 2.3)

Dingus is the weak-profile control fixture used to validate scoring suppression for thin or generic inputs.

**Thin-input synthetic control:** A minimal input ("Software developer. 3 years.") is also validated; observed max score: 0.0.

Smoke test (`scripts/title_scoring_smoke.ts`) imports the canonical scoring library — no stale inlined scoring logic in tests.

These fixtures verify:
- Correct cluster mapping
- Cross-cluster isolation
- Thin-profile score caps
- Stable top-title outputs

**Current baseline status:** Smoke test passes 45/45.

## Deferred / Later

- Job Board Adapter Architecture implementation (decision recorded, adapters not yet built — see kernel.md)
- 5-title discovery expansion / adjacent titles
- Static "How we arrived at these titles" explainer on titles page
- Adaptive search suggestions
- Phase 2 overlay/list scoring — UX contract finalized (see above), implementation blocked until scoring credibility resolved
- "Show only 7+ matches" filter
- Deep scoring vs preview scoring experiment
- Next/previous job navigation
- Sidebar tools (resume tailoring, interview prep)
- Preview-text scoring (experiment only)
- Post-score LLM dialogue mode toggle

## Strong-Match Action Workflow (2026-03-10, Product Decision)

**Product shift:** Caliber expands beyond evaluation-only into strong-match actionability. This is the next product layer after scoring trust — not a generic feature expansion.

**8.0+ Contextual Tailoring Action:**
- Jobs scoring 8.0+ trigger a contextual "Tailor resume for this job" card above the extension sidecard.
- The card renders in the same position as the Better Search Title recovery banner (above the sidecard, not inside it).
- Clicking triggers: extension POSTs job context (title, company, description, URL) to `/api/tailor/prepare` → opens `/tailor?id=...` in a new tab.
- `/api/tailor/prepare` creates a pipeline entry in `strong_match` stage at prepare time — pipeline persistence begins before tailoring, not after.
- The `/tailor` page loads the prepared job context, then generates a tailored resume using OpenAI.
- Pipeline advances to `tailored` stage during `/api/tailor/generate`.
- Tailoring input: the user's existing uploaded Caliber resume (`session.resume.rawText`) + the live job description from the extension.
- Tailoring rules: NEVER fabricate experience, skills, or accomplishments. Only reorder, emphasize, and adjust language to align with the target role.
- Output: tailored resume text, downloadable as `.txt`.
- The `/tailor` confirmation banner is gated by actual pipeline existence — only shown when backed by a real pipeline entry.
- Extension suppresses the 8.0+ tailor CTA for jobs already present in the user's pipeline (baseline CTA noise control).
- Language: "Tailor resume for this job" — not "Apply for this job."

**Simple Job Pipeline/Tracker:**
- Strong-fit opportunities are tracked in a pipeline board at `/pipeline`.
- Pipeline was originally a single-list view with linear stages: Strong Match → Tailored → Applied → Interviewing (+ optional Offer / Archived).
- Pipeline rebuilt (2026-03-11) as a 4-column board: **Resume Prep** → **Submitted** → **Interview Prep** → **Interview**.
- Legacy stages auto-map to new board columns (strong_match/tailored→resume_prep, applied→submitted, interviewing→interview).
- Cards are moveable between columns via DnD (forward/back buttons + drag). Fit score displayed on each card.
- Board reloads visible data on tab focus.
- Board is intentionally anti-CRM: no subtasks, no notes, no timelines, no due dates.
- Code is implemented; product-level validation of the board model is active/next work.
- Pipeline entry is created at prepare-time (not after tailoring). Pipeline dedupe based on canonical/normalized job URL.
- `/tailor` confirmation banner is gated by actual pipeline existence.
- Extension suppresses 8.0+ tailor CTA for jobs already in pipeline.

**API Surface:**
- `POST /api/tailor/prepare` — extension stages job context (CORS-enabled for chrome-extension origin)
- `GET /api/tailor/prepare?id=...` — tailor page retrieves staged context
- `POST /api/tailor/generate` — generates tailored resume, auto-creates pipeline entry
- `GET/POST/PATCH /api/pipeline` — pipeline CRUD

**Anti-bloat rationale:** The pipeline must remain intentionally minimal. The moment it gains subtasks, notes, timelines, or CRM-like features, it has failed its design goal. Caliber's pipeline is a clarity tool, not a workflow manager.

## Session Decision — 2026-03-26 (Tailor Specificity Fix, bee6e83)

**Problem identified:** Tailored resumes were too close to a polished default version of the user's base resume and not adapting structurally to the target role. Tested against Chris fixture for an IEM Product Manager role.

**Root cause — Bug 1 (score never passed):**
`app/api/tailor/generate/route.ts` called `generateTailoredResume(resumeText, jobTitle, company, jobText)` — missing the `score` argument. `matchBand` always evaluated to `"WEAK"` in production. The STRONG-path (assertive headline adaptation, bullet reordering, summary rewrite) never fired for any job regardless of fit score.

**Root cause — Bug 2 (prompt lacked decomposition mechanics):**
The system prompt instructed the model to "elevate relevant evidence" but provided no structured decomposition step. Without explicit theme-mapping, the model preserved the source resume's structure and only lightly rephrased bullets — no reordering, no headline adaptation, no anti-single-project-dominance logic.

**Fix applied:**
- `app/api/tailor/generate/route.ts`: pass `prep.score` to `generateTailoredResume`
- `lib/tailor_store.ts` system prompt additions:
  - PRE-WORK ROLE DECOMPOSITION: identify 3–5 JD capability themes, map each to specific resume evidence before writing
  - HEADLINE & SUMMARY ADAPTATION (STRONG matches): adapt headline to role function, lead summary with top JD themes candidate actually supports
  - EVIDENCE DISTRIBUTION & BULLET ORDERING: front-load JD-relevant bullets, prevent single-project dominance when job needs breadth
  - SECTION ORDERING for product/ops/strategy/consulting roles
- `analysis/tailor_quality_validation.ts`: Chris IEM PM fixture (score 7.5, STRONG) — validates presence of cross-functional/launch/stakeholder evidence and blocks industrial/energy/hardware fabrication

**Anti-fabrication guardrails: preserved and unchanged.** BLOCKED field in debug trace enforces source-truth grounding. Contamination test suite: 29/29 pass.

**Remaining tailor work:** live user validation on a real STRONG-match job; optional decomposition depth tuning; PDF/DOCX export quality. Core specificity bug is closed.
