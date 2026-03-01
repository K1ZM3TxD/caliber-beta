

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
Produce a SINGLE LINE coder task that is:
- JSON-safe (no fenced code blocks)
- Specific file paths
- Default single-file unless unavoidable
- Includes acceptance criteria / DoD
- No extra prose outside the one line

(If this event is documentation-only, the coder task can be “Update docs only”, but it still must be one line.)

### Step 3 — Required Doc Updates (always)
Update these files every time:
1) `Bootstrap/milestones.md`
	- Add a dated block: `BREAK + UPDATE — YYYY-MM-DD`
	- Include DONE / BLOCKED / NEXT (tight bullets)
2) `Bootstrap/kernel.md`
	- Update ONLY if a new durable enforcement invariant is established
3) `Bootstrap/CALIBER_ISSUES_LOG.md`
	- Add/update/resolve issues tied to this break/update

### Step 4 — Definition of Done (report-out)
When the change lands, report:
- `git status -sb`
- `git diff --name-only`
- the pushed commit SHA

---

## Notes / Scope
- This workflow is for process + enforcement + contract drift control.
- It is not required for routine implementation that doesn’t change expectations.
- If unsure whether something is a “break”, treat it as a break and run the workflow.
(See <attachments> above for file contents. You may not need to search or read the file again.)
