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
(See <attachments> above for file contents. You may not need to search or read the file again.)
