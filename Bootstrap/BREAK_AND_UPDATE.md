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
