# CALIBER_CONTEXT_SUMMARY

> **Role:** Full project history and session decisions. For a compact current-state reload, see `Bootstrap/CALIBER_ACTIVE_STATE.md`. For the canonical system loader, see `CALIBER_SYSTEM.md`.

## Project Status (2026-03-14, Phase-2 Overlay Scoring Shipped)

**Phase-2 overlay scoring is shipped and stable.** Extension now operates as a two-layer surface: discovery badges on LinkedIn search result cards + decision sidecard on the selected job. Badge system includes stable card identity, session score cache, progressive chunked scoring, scroll/mutation listeners, and BST evaluation from badge cache. Eight lifecycle/stability bugs were found and fixed during stabilization.

**Queued next (soft-locked in order):**
1. Auto-save strong-match jobs (score >= 8.5) into pipeline with canonical URL dedupe
2. Add post-save confirmation / action state in sidecard
3. Add account prompt for durable pipeline saving
4. Continue pipeline/action-layer refinement only after the above are stable

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
- Extension v0.8.0 deployed (ZIP rebuilt with overlay badge system).
- Extension handshake friction (#31) is known — may require manual tab refresh on first install. Not currently blocking.
- All "Back to Caliber" links route to /calibration.
- Next priorities: validate sidecard collapsed sizing → verify BST trigger → auto-save strong-match jobs → post-save confirmation → account prompt → pipeline/action-layer refinement. Soft-locked in order; small UI bug squashes allowed at any time.

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

Calibration flow runs end-to-end: resume upload → prompt answers → title recommendation → extension CTA. Backend smoke reaches TERMINAL_COMPLETE with result. Vercel auto-deploys from main.

**Stable Beta — Production/Dev Environment Split Active (2026-03-08).**
- Production web app served from `https://www.caliber-app.com` (Vercel, auto-deployed from main).
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
- **Discovery layer (listings):** Score badges injected directly into LinkedIn search result cards. Each card shows a color-coded fit score (Green 8.0+ / Yellow 6.5–7.9 / Gray 0–6.4) next to the company logo. Progressive scoring via chunked API batches. Scroll and MutationObserver detect new/rerendered cards. Cache restores badges instantly on return navigation.
- **Decision layer (sidecard):** Full evaluation panel for the selected job. Fit score, Hiring Reality Check, supports/stretch/bottom line, nearby roles, feedback controls.

The sidecard is the primary decision surface. Compact, decision-first layout. Collapsed height is stable across all score states — all collapsible section toggles render regardless of content.

**Structure (top to bottom):**

*Above the sidecard (conditional):*
0. **Better Search Title recovery banner** — appears only when weak-fit trigger fires. Renders as a standalone banner above the sidecard. Contains a clickable suggested title that links to a LinkedIn search. Suggests calibration primary title or adjacent search-surface titles — never listing-specific titles.

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
**Version:** v0.8.0.

## Better Search Title — Search Surface Recovery Mechanism (2026-03-10)

Better Search Title is a **Search Surface Recovery Mechanism**. It answers the user question: "What title should I search to find better-fit jobs?"

**Trigger:** Rolling window of the last 4 scored jobs. If 3/4 score below 6.5 and none score at or above 7.5, the feature activates.

**UX:**
- Recovery banner renders **above** the sidecard, not inside it.
- Banner is visually connected to the sidecard but structurally separate.
- The suggested title is the clickable control — clicking navigates to a LinkedIn search for that title.
- Compact, visually calm (blue accent, not error-red). Feels like a helpful next move, not a warning.

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
- Backend: `POST /api/feedback` endpoint, JSONL append-only log at `data/feedback_events.jsonl`.
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
- **Better Search Title thresholds widened.** Weak threshold changed from <6.0 to <6.5, strong threshold from >7.0 to >=7.5. Trigger behavior should be verified.
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
- Color bands: Green (8.0–10.0, strong fit) · Yellow (6.5–7.9, possible fit) · Gray (0–6.4, skip)
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
6. **Verify/restore Better Search Title trigger behavior** — thresholds changed to <6.5 weak, >=7.5 strong. Verify feature still activates correctly.
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
