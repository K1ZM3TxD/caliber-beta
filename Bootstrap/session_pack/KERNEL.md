\# KERNEL.md

Execution Doctrine — Anchor-First Architecture



Stable enforcement rules.

Updated deliberately.



Philosophy lives in CALIBER\_DOCTRINE.md  

Task sequencing lives in MILESTONES.md  

This document defines mechanical enforcement.





\# Authority Order



1\. CALIBER\_DOCTRINE.md — Identity + philosophy  

2\. KERNEL.md — Enforcement mechanics  

3\. MILESTONES.md — Task sequencing + status  



Doctrine defines what Caliber is.  

Kernel defines how it enforces it.



If execution diverges from doctrine, execution changes — not doctrine.



## Current Spine: Locked Calibration Flow

Caliber is now locked to the following product flow:

1. Resume upload (PDF/DOCX/TXT)
2. Title suggestion + job description paste (same screen; no user title editing; no confirmation gate)
3. Fit score (0–10) + summary
4. LLM dialogue opens after score+summary (next phase toggle; wander vs constrained not yet locked)

Default UX is distilled; expanded details are user-initiated (collapsed by default).

Older calibration-core steps (anchors, overlap/gap, mechanical title producer) are deprecated in the current flow.

Narrative synthesis and dialogue mode will be enabled after score+summary.

## Beta Telemetry Invariant

- Telemetry event capture must be active before beta launches to outside users.
- Beta testing without instrumentation is not permitted — outside-user sessions must generate usable product data from day one.
- Telemetry is non-blocking: event capture failures must never break user-facing flows.
- Initial event set: search_surface_opened, job_score_rendered, job_opened, strong_match_viewed, pipeline_save, tailor_used.
- New events may be added; existing events must not be removed without PM approval.

## Durable Telemetry Invariant (2026-03-17)

- Production telemetry and feedback MUST use durable hosted storage (Postgres via Prisma/Neon). File-backed (JSONL) and local SQLite persistence are not acceptable for production.
- Both `/api/events` and `/api/feedback` must write to durable storage that survives serverless deploys, function cold starts, and instance recycling.
- Beta testing without durable observability is not permitted — PM experiments depend on data that persists across deploys.
- Experiment-condition tagging (sessionId, signalPreference, meta) is required for controlled PM telemetry validations when comparing product modes (e.g., signal injection ON/OFF).
- Production `DATABASE_URL` must be set as a Vercel environment variable. Missing `DATABASE_URL` in production is an operator configuration failure, not a code deficiency.

## Signal & Surface Intelligence (SSI) Classification

SSI is the system family that reduces user cognitive load by summarizing professional signals and job-surface quality.

Subsystems:
- **Signal Gap Detection (SGD)** — compares prompt answers vs resume anchors to detect professional signals the user expressed in prompts but not in the resume. Up to 5 labels. Requires explicit user choice (Yes/No) before calibration advances.
- **Surface Quality Banner** — evaluates the current LinkedIn search surface and displays strong-match count + best job when >=1 job scores >=7.0. Renders in BST slot with green accent.
- **Better Search Trigger (BST)** — surface-classification-driven recovery mechanism. Suggests alternative search titles when the current surface is weak or out-of-scope. Session-level title dedup prevents suggestion loops.

Purpose: Reduce user cognitive load by summarizing professional signals and job-surface quality. SSI subsystems are validated together during the Desktop Stabilization phase before beta launch.

## Surface/Job UI Separation Invariant (2026-03-17)

Surface intelligence and job-decision UI are distinct presentation surfaces. Mixing them creates user confusion.

- **Sidecard** is the current-job decision surface. It displays: this job's score, this job's decision label, hiring reality, supports/stretch, bottom line, pipeline action. It MUST NOT display page-level comparison signals (e.g., "Best so far", strong match count, search surface quality).
- **Surface layer** is the page/search intelligence surface. It displays: strong match count, best job on surface, BST recovery suggestions. These are aggregate signals about the search surface.
- **"Best so far"** is a surface-layer construct. It may be reused by banners, overlay, or future surface-summary UI, but MUST NOT appear in sidecard-adjacent decision UI.
- Underlying surface intelligence state (`prescanSurfaceBanner`, `pageMaxScore`, `pageBestTitle`, `strongCount`) MUST be preserved even when its presentation is disabled — future overlay features depend on it.
- Combining surface-level signals with job-level decision UI is a UX regression.

## Calibration Immersive Flow Invariant (2026-03-23)

The calibration flow is an immersive experience. No system UI chrome (headers, navigation, branding) is permitted during active calibration steps.

- The CALIBER header is ONLY shown on: **Landing page** and **Saved Jobs page**.
- The CALIBER header MUST NOT appear on: resume ingest, prompt pages, chips page, processing, or results page.
- Calibration steps operate in a chrome-free environment — the user's focus is on the calibration task, not the system frame.
- Adding header or navigation elements to calibration steps is a UX regression.
- System pages (landing, saved jobs) use the header as an anchored brand element.

## Chip Preference Model Invariant (2026-03-23)

The chip system uses a **2-tier preference model**: preferred (+) and avoided (−). No third tier exists.

- `selectedPrimary` / `primaryMode` / "most prominent chip" are deprecated concepts. Do not reintroduce.
- Chip interaction: tap chip body or "+" → preferred. Tap "−" → avoided. Mutual exclusion: selecting one clears the other.
- Submit sends `preferredModes` and `avoidedModes` only.
- The 2-tier model is the correct level of granularity for preference signaling. The 3-tier model was removed because users could not reliably distinguish "primary focus" from "also preferred."
- Scoring pipeline (`applyChipSuppression`, `getRoleTypePenalty`, `evaluateWorkMode`) consumes only `avoidedModes` for suppression. Adding a primary tier would require scoring pipeline changes and re-validation.

## Prompt Input Dock Invariant (2026-03-23)

The PROMPT step textarea is a **fixed-position viewport-bottom dock**. It does not scroll with page content.

- Textarea is anchored via `position: fixed; bottom: 0` with a gradient fade background — never inline with the typewriter question.
- Typewriter question text is centered in the viewport above the dock. The question's character-by-character reveal must NOT affect textarea position.
- A spacer element (≥200px) in the content flow prevents main content from being hidden behind the dock.
- **No submit button.** Enter key is the sole submit mechanism. Shift+Enter inserts a newline.
- Textarea border uses the Caliber green accent (`rgba(74,222,128,*)`) — consistent with resume dropzone border treatment.
- Moving the textarea back into the scrolling content flow, or adding a submit button, is a UX regression.

## Saved Jobs Terminology Invariant (2026-03-23)

All user-facing web app surfaces use **"saved jobs"** language. The word "pipeline" must not appear in any user-facing text.

- Page headings, confirmation banners, sign-in CTAs, tailor navigation, and tooltips all use "saved jobs" / "job saved" / "saved" terminology.
- The extension already uses "Save this job" / "View saved jobs →" — web app surfaces must match.
- URL routes (`/pipeline`) are unchanged — this is a user-facing copy rule, not a routing rule.
- Reintroducing "pipeline" in user-facing copy is a regression.

## Layout System Reference (2026-03-23)

Structural layout rules (vertical centering, fixed-bottom dock pattern, card depth layer model, green accent borders, transition stability) are defined in `Bootstrap/LAYOUT_SYSTEM.md`. That file is the canonical home for spatial/behavioral layout contracts.

- Visual primitives (colors, typography, surfaces): `docs/ui-constitution.md`
- Page composition zones and reserved heights: `docs/layout-skeleton.md`
- Do not redefine layout rules inline in other docs — point to `LAYOUT_SYSTEM.md`.

## Telemetry Documentation Truth Invariant (2026-03-17)

Telemetry storage documentation must match actual operator reality.

- Documentation MUST NOT describe deprecated storage backends (e.g., `data/telemetry_events.jsonl`, local SQLite) as active or canonical.
- The canonical telemetry backend is Neon (Postgres via Prisma). This is the only production-supported path.
- If the storage backend changes in the future, all documentation must be updated in the same BREAK+UPDATE.

## Beta-Scope Marketing Invariant (2026-03-17)

Pre-beta hero media may use a lightweight proof-of-product video or static preview. Full narrative animation concepts (e.g., "Career → Decision → Engine" animated system) are post-beta scope unless explicitly promoted into pre-beta scope by PM.

- This prevents unbounded marketing scope work from blocking beta launch.
- The pre-beta landing page should communicate what the product does, not tell a brand story.

## Scoring Context Invariant

Caliber uses two scoring contexts:

**Calibration (Directional)**
- Purpose: suggest job search direction
- Output: one title direction
- No scores shown

**Extension (Evaluative)**
- Purpose: evaluate a specific job posting
- Outputs: Fit Score, Hiring Reality Check, Bottom Line decision

Calibration MUST NOT evaluate specific jobs.

Extension is the primary job-evaluation surface.

## Extension-First Invariant

- `/calibration` is a launchpad, not the primary job-scoring surface.
- The browser extension is the primary scoring surface for real-role evaluation.
- Calibration output is directional guidance; real job-fit analysis lives in the extension.

## Extension Overlay Architecture Invariant (2026-03-29)

The extension operates in **sidecard-primary mode**. This is the durable product architecture.

- **Sidecard is the primary interaction surface.** All trusted score data flows from sidecard evaluation against a full job description.
- **Search-card overlays (badges) are reactive/backfilled.** They appear only after a trusted sidecard score exists for that job. They do not appear from prescan.
- **Unsafe DOM-wide prescan is explicitly not a product dependency.** LinkedIn and Indeed card DOM at list-view time contains only title/company/location — no job description. Scoring from card text alone produces structurally inflated, unreliable scores. `scoreSource=card_text_prescan` results may be cached internally (BST evaluation) but must never be rendered as user-visible numeric badges.
- **Describing DOM-wide prescan as reliable product behavior is a documentation error.** Correct it immediately.
- **Future zero-click broad overlay coverage** (badges on cards without clicking) requires backend job inventory + score cache infrastructure. It is not achievable by additional DOM probing.

## Canonical Job Cache — Trusted Write Path Invariant (2026-03-29)

`CanonicalJob` and `JobScoreCache` records MUST only be written from trusted scoring flows.

**Permitted write sources:**
- `sidecard_full` — `/api/extension/fit` POST after successful sidecard score (non-prescan, jobText ≥ 200 chars)
- `pipeline_save` — `/api/pipeline` POST when extension saves a job with full jobText

**Prohibited write sources:**
- `card_text_prescan` — DOM prescan from LinkedIn/Indeed card text; structurally inflated, unreliable
- Any scoring path where `isPrescan === true`
- Any ingest where `sourceUrl` is null/empty or `jobText` is shorter than 200 characters

**Why:** The canonical job record is the foundation for future zero-click overlay and homepage job inventory. Contaminating it with unscorable prescan data would corrupt the relevance baseline and cause badge scores to diverge from sidecard scores.

**Payload quality ordering:** `sidecard_full` data MUST NOT be overwritten by `pipeline_save` data. If both write to the same `(jobId, sessionId)` cache slot, the sidecard_full payload is preserved (it is always richer).

## Canonical Job Cache — Source Adapter Invariant (2026-03-30)

All job ingestion into the Canonical Job Cache MUST flow through the Job Source Adapter layer (`lib/job_source_adapter.ts`).

**Adapter contract:**
- Every ingestion source implements `JobSourceAdapter<TRaw>` with `validate()` and `normalize()` methods.
- `normalize()` produces a `NormalizedJobPayload` with attached `JobProvenance` (sourceType, sourceName, trustLevel, rights, acquiredAt).
- The single canonicalization entry (`canonicalizeAndWrite`) bridges adapter output to `writeTrustedScore`, enforcing rights checks and text quality gates.

**Source types:** `extension_sidecard` | `extension_pipeline` | `user_import` | `ats_api` | `employer_jsonld` | `licensed_feed`.

**Trust levels:** `user_verified` (user-initiated, full JD provided) | `api_structured` (machine-extracted from structured source) | `feed_unverified` (raw feed data, needs quality gate).

**Processing rights:** Every adapter declares `ProcessingRights` (`canScore`, `canStore`, `canDisplay`, `canTailor`). The canonicalization entry rejects writes when `canStore` or `canScore` is false.

**Backward compatibility:** `sourceTypeToTextSource()` maps new source types to existing `textSource` values (`sidecard_full` | `pipeline_save`) so existing cache/read/write paths are unaffected.

**Why:** Job acquisition and job intelligence must remain separate concerns. The adapter layer standardizes ingestion across all source types without coupling the scoring/cache stack to any single acquisition method.

## Canonical Job Cache — Trusted Read Path Invariant (2026-03-29)

Cache hits may only be served to the **same `sessionId`** used to write them.

- Cross-session score reuse is **prohibited** — a different calibration session may represent a different user context, and the score may be directionally wrong.
- Cache-first lookups are **non-fatal**: any lookup failure (network error, timeout, miss) silently falls through to fresh API scoring. The read path must never block the normal scoring flow.
- The `_fromCache: true` flag on cache-served responses is **internal only** — it must not drive UI differentiation visible to the user unless explicitly designed for that purpose.
- **Prescan calls are excluded** from cache-first logic (`isPrescan === true` guard). The cache is only consulted for full sidecard scoring flows.



- `/calibration` is a direction-setting launchpad, not a job-scoring surface.
- Layout order: "Calibration Complete" → Extension install CTA → hero title direction → "How we score this".
- Extension CTA appears before the title recommendation — it is the primary next action.
- One hero title direction displayed (centered title, search action, "See why it fits" expandable explanation).
- No title scores shown on this page.
- No manual job paste or inline job scoring on this page.
- "How we score this" philosophy section sits below the hero card.

## Job Board Adapter Invariant

New job boards MUST be added via a site-specific adapter, never by embedding site-specific DOM logic into the scoring engine.

Adapter contract:
- Each adapter exports `extractJobData()` → normalized job object
- Normalized fields: `title`, `company`, `location`, `description`
- The scoring engine consumes ONLY the normalized job object
- Site-specific DOM extraction is isolated inside the adapter

Defined adapters:
- `linkedinAdapter` (active — extraction currently inline in content_linkedin.js, to be refactored)
- `indeedAdapter` (planned)
- `glassdoorAdapter` (planned)
- `ziprecruiterAdapter` (planned)
- `monsterAdapter` (planned)

Benefits:
- Isolates DOM extraction from scoring logic
- Simplifies adding new job boards
- Reduces maintenance when job sites change markup
- Enables faster expansion to additional platforms

This architecture is the required foundation before implementing Indeed and other job board integrations (Phase 1 multi-board coverage).

## Scoring Regression Invariant

- Canonical fixture profiles (Chris, Jen, Fabio, Dingus) are regression anchors and must remain stable across scoring updates.
- Thin-input synthetic control must continue to validate score suppression.
- Smoke tests must import canonical production scoring logic; duplicated or inlined scoring logic in tests is not allowed.
- Future scoring changes must preserve:
  - Cross-cluster isolation
  - Thin-profile caps
  - Stable fixture outputs — unless an intentional scoring-model revision is explicitly documented

## PM Task Sequencing Invariant

- Handshake reliability precedes Hiring Reality Check.
- Hiring Reality Check precedes sidecard polish.
- This order must not be re-sequenced without new blocking evidence.

### Coder Task Payload Format

Coder tasks use the standard structured handoff block (title, scope, changes, DoD, notes). Fenced code blocks and multi-line structured objects are allowed. Single-line plain text is acceptable for trivial or docs-only tasks.





\# Core Execution Principle



We do not persuade the model to behave.



We constrain it until behavior aligns.



All synthesis is governed by structural pressure, not prompt rhetoric.



\# Anchor-First Pipeline (Mandatory)

Signal Classification Layer (Deterministic)

Anchor extraction must tag each anchor with:

source: resume | q1 | q2 | q3 | q4 | q5

context_type:

breakdown

constraint_construction

incentive_distortion

neutral

Signal Classification Rules:

An anchor qualifies as Signal-Dominant only if:

It appears in at least one breakdown-context answer
AND

It appears in at least one additional distinct context (resume or other Q)

Resume-only repetition classifies as Skill-Dominant.

Signal alignment scoring must prioritize Signal-Dominant anchors.

Skill coverage scoring must use Skill-Dominant anchors.

Signal weight > Skill weight in composite alignment.



All pattern synthesis must follow this sequence:



1\. Extract lexical anchors from input signal

&nbsp;  - Repeated verbs

&nbsp;  - Repeated operational nouns

&nbsp;  - High-frequency mechanical terms



2\. Generate synthesis via LLM under anchor-aware prompt



3\. Validate anchor overlap and doctrine compliance



4\. If overlap fails → retry once with missing anchors injected



5\. If retry fails → deterministic fallback



This sequence is mandatory.



Skipping enforcement violates doctrine.





\# Enforcement Hierarchy



When evaluating synthesis, enforcement order is:



1\. Cadence compliance (structure)

2\. Anchor overlap threshold

3\. Anti-praise enforcement

4\. Anti-abstraction enforcement

5\. Repetition control



Cadence alone is insufficient.  

Lexical grounding is primary.





\# Lexical Anchor Rules



\## Anchor Weighting



\- Repeated verbs → highest weight

\- Repeated operational nouns → high weight

\- Identity descriptors → low weight

\- Emotional framing → minimal weight

\- Resume headlines → no special privilege



\## Failure Conditions



Output fails if:



\- It introduces novel archetype language not present in anchors.

\- It rephrases marketing copy into softer marketing copy.

\- It invents identity not grounded in extracted anchors.



Anchors assist structure.  

Anchors do not override grammar.



Structure > Anchor pressure.





\# Overlap Enforcement



After LLM synthesis:



score = overlapCount / anchorTerms.length  

MIN\_OVERLAP = 0.35



Decision logic:



\- score >= 0.35 → accept (llm)

\- score < 0.35 → retry once

\- retry still < 0.35 → deterministic fallback



Retry occurs at most once.





\# Structural Invariants



These must never break:



\- Required line starters remain exact.

\- Contrast structure must remain intact.

\- Never switch to first-person voice.

\- Construction line must match allowed verb pattern.

\- No noun collision artifacts.

\- No cadence distortion under anchor pressure.




## Calibration Fit Score Enforcement (2026-03-01)

1. Fit score must be computed deterministically (no LLM) before TERMINAL_COMPLETE is considered 'results-ready'.
2. ALIGNMENT_OUTPUT does not accept ADVANCE; UI must fire COMPUTE_ALIGNMENT_OUTPUT exactly once per session.
3. Result page must read from /api/calibration/result, not ADVANCE responses.

If anchor pressure degrades grammar, anchor usage must be reduced — not structure.


## Environment Separation Invariant (2026-03-08)

Stable production and experimental development must remain host-separated at all times.

- Production extension targets `https://www.caliber-app.com` exclusively.
- Dev extension targets `http://localhost:3000` exclusively.
- No multi-host fallback, no endpoint discovery between environments.
- Reintroduction of cross-environment host permissions or fallback arrays is a structural regression.

## Roadmap Sequencing Invariant (2026-03-08)

Roadmap sequencing can block feature work when credibility or stability issues remain.

- Scoring credibility and production stability gate all feature expansion.
- Phase 2 / feature-layer work is blocked until PM explicitly unblocks.
- This is a durable rule, not a temporary pause.

## Strong-Match Action Invariant (2026-03-10)

Strong-fit jobs may trigger an action workflow. This invariant constrains what actions are allowed and how they surface.

- Only jobs scoring 8.0+ may trigger the "Tailor resume for this job" action. Lower scores do not get tailoring CTAs.
- The contextual card must remain low-noise: it renders above the sidecard (like the recovery banner), not inside it, and must not feel like a persistent nag.
- Resume tailoring must NEVER fabricate experience, skills, or accomplishments. Only reorder, emphasize, and adjust language.
- The job pipeline must remain intentionally minimal. Anti-CRM by design.
- Pipeline is NOT a CRM. No subtasks, no notes fields, no timeline features, no due dates. If it gains these, the design has failed.

## UX Shared-Primitives Invariant (2026-03-11)

UI changes must be governed by documented shared primitives. PM UX tasks may not rely on local page-only styling instructions.

- Every UX/UI coder task must reference the UI Constitution (`docs/ui-constitution.md`). This is mandatory, not optional.
- Every layout/composition task must additionally reference the Layout Skeleton (`docs/layout-skeleton.md`).
- Coder must reject UX/UI tasks that do not include the required visual-contract references.
- The UI Constitution defines visual primitives (text tokens, surface tokens, spacing rhythm, interaction boundaries). The Layout Skeleton defines page composition (zones, reserved heights, transition stability, vertical rhythm).
- These two documents are complementary: the Constitution governs primitives, the Skeleton governs composition.
- UX tasks issued without shared-primitives governance are a process regression.

## Shell Framework Invariant (2026-03-11)

Do not declare a layout framework canonical until a single owner exists for gradient placement, hero offset, and content width.

- The three-zone shell framing was attempted and rolled back because no single owner controlled these properties — each page implemented them independently, causing documentation/implementation drift.
- Until a shared shell component is designed and locked, shell ownership remains page-local. Each page defines its own gradient, hero offset, and content width.
- The visual baseline is commit a211182 (lowered header + lowered ambient gradient, 50% 12%). New shell work should reference this baseline.
- Do not introduce Zone 1 wrappers, CaliberHeader compact/noGradient props, or fixed gradient overlays without a locked shared-shell design.

## Visual Shell Invariant (2026-03-11, updated)

Design changes must reference approved visual primitives and three-zone shell structure, not copy from a single live page.

**Three-zone shell structure (mandatory for all pages):**
- **Zone 1 — Brand field (20vh):** CALIBER wordmark + ambient gradient. Fixed proportional height. This establishes the brand identity at the top of every page.
- **Zone 2 — Context:** Page heading, description, or status information. Variable height per page.
- **Zone 3 — Interaction:** Forms, cards, action buttons, content. The primary user-interaction area.

Every page must follow this three-zone structure. Per-page ad-hoc shell composition is a regression.

Approved shell traits:
- Wide subtle ambient gradient band over #050505 dark surface
- CALIBER header and gradient positioned ~12% lower than original iterations for grounding
- Outlined green primary buttons (rgba(74,222,128,0.06) bg, #4ADE80 text, rgba(74,222,128,0.45) border). No solid green fills.
- No small sharp centered line motif
- Form fields must remain clearly visible and usable against dark backgrounds
- Shell feel: calm, cinematic, premium

"Match the pipeline page" (or any single-page reference) is NOT a valid design instruction.

Each page composes from the above primitives and three-zone structure. Visual drift from incremental local tweaks is a regression — the fix is to re-anchor to primitives, not to add more local patches.
- This is the next product layer after scoring trust — not a generic feature expansion or platform play.





\# Guardrails (Reclassified)



The previous “Safety Rails” framing is obsolete.



Guardrails are structural, not aesthetic.



\- Blacklist enforcement → structural integrity

\- Repetition thresholds → clarity enforcement

\- Construction strictness → cadence integrity



Loosening guardrails does not improve quality.  

Improving extraction improves quality.





\# Observability Doctrine



We must observe philosophical failure — not just runtime failure.



Every synthesis attempt must log:



\- synthesis\_source = llm | retry | fallback

\- anchor\_overlap\_score

\- missing\_anchor\_count

\- praise\_flag

\- abstraction\_flag



Logs must be:



\- Single-line

\- Precise

\- Minimal

\- Machine-parsable

\- Emitted exactly once per attempt



If fallback frequency rises, extraction logic is failing.





\# Verifiability Doctrine



If a change cannot be measured, it is not done.

**No Archaeology Rule:**
PM→Coder tasks must include explicit file paths + fixture inputs when user-specific artifacts are required; searching repo for resume/anchors is disallowed.

Acceptable verification methods:



\- Anchor overlap scoring

\- Deterministic regression tests

\- Log signature validation

\- Reproducible failure case



“Feels better” is not a metric.
Season wrap-ups must be written into Bootstrap docs before switching chats.




\# Output Policy



For humans:

- Surgical edits preferred by default (explicit replacements/insertions with anchors).
- Full-file rewrites ONLY when necessary (small file, pervasive edits, or scattered changes where omission risk is high). Must include justification.

For coders / agents:

- Default output MUST be surgical edits (not full rewrites).
- Full-file rewrite allowed ONLY with explicit justification per above.
- No speculative refactors.
- Minimal surface change per task.
- PM must gather minimum required inputs before drafting tasks; no afterthought additions after user directives.

Definition of surgical edit (mechanical):

- Must list file path(s)
- For each file: exact "replace OLD -> NEW" blocks and/or "insert AFTER <anchor>" blocks
- Avoid unified diffs unless explicitly requested





\# JSON-safe Coder Payload



Never include raw backslashes in task text (e.g., Windows paths like C:\Users\...).
If a backslash is required, represent as \\ or use forward slashes instead.
Avoid invalid JSON escape sequences (\U, \k, \:) in any payload that might be JSON-encoded.





\# Definition of Done



A task is complete only when:



\- Acceptance criteria are met.

\- Anchor enforcement passes.

\- Doctrine compliance passes.

\- Logging is present.

\- Change is minimal and scoped.

\- Outcome is mechanically verifiable.

If any documentation (*.md) is modified, coder MUST commit and push before reporting done.

Coder MUST report: git status -sb, git diff --name-only, and the pushed commit SHA.

Technical success without philosophical compliance is failure.





\# Change Control



Philosophy changes → CALIBER\_DOCTRINE.md  

Enforcement changes → KERNEL.md  

Task sequencing → MILESTONES.md  



Execution evolves. Doctrine remains stable.

