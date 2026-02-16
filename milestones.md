# Caliber — MILESTONES

This document defines the ordered build runway.

It changes only when scope shifts or milestones are completed.

---

## PHASE 1 — ALIGNMENT INSTRUMENT

Milestone 1.1 — Lock Scoring Mechanics (COMPLETE)

Milestone 1.2 — Define Interpretation Band Structure (COMPLETE)

Milestone 1.3 — Define Pattern Measurement Method (COMPLETE)

Milestone 1.4 — Define Role Demand Encoding (COMPLETE)

Milestone 1.5 — Define Disagreement Handling (COMPLETE)

---

## PHASE 2 — CALIBRATION FLOW

Milestone 2.1 — Resume Parsing Structure (COMPLETE)

Milestone 2.2 — Reflective Question Engine (COMPLETE)

Milestone 2.3 — Pattern Synthesis Output Logic (COMPLETE)

Milestone 2.4 — Current Role Validation Logic (COMPLETE)

---

## PHASE 3 — ROLE EXPLORATION ENGINE

Milestone 3.1 — Job Ingestion Structure (COMPLETE)

Milestone 3.2 — Skill Match Classification Engine (COMPLETE)

Milestone 3.3 — Stretch Load Framing Logic (COMPLETE)

---

## PHASE 4 — INTEGRATION LAYER

Milestone 4.0 — Integration Prep (Pre-Contract Hardening) (COMPLETE)

Milestone 4.1 — Formal Result Contract Definition (COMPLETE)

Public API contract version "v1" frozen.

Milestone 4.2 — Minimal Contract Viewer Page (COMPLETE)

Milestone 4.3 — Viewer Upgrade (Deterministic Enhancements Only) (ACTIVE)

Scope (locked for 4.3):
- Session-local result history (last 5)
- Copy JSON (exact contract only)
- Load Sample Job (deterministic)
- Clear state
- No derived metrics
- No interpretation / emotional framing
- No contract/API/lib changes

---

## NEXT MILESTONE

Milestone 5.0 — Calibration Flow UI (NOT STARTED)

Goal:
UI for resume + 5 prompts + synthesis strictly following kernel order and rules, without reinterpretation drift.

---

## MILESTONE RULES

Only one milestone is active at a time.

Milestones move to COMPLETE explicitly.

Do not work outside the active milestone.

---

## EXECUTION MODEL

Engineering work may be implemented by:

- Direct deterministic rewrite (preferred for small scoped tasks)

- Copilot Agent PR workflow (reserved for multi-file or structural changes)

Copilot Agent should not be used for:

- Small formatting corrections  
- Single-file constraint tightening  
- Tasks under ~100 LOC  

PM retains discretion over execution method per task.

---

MILESTONE ADVANCEMENT RULE

PM may recommend milestone completion.

Milestones move to COMPLETE only after explicit user confirmation.

Milestone completion does not trigger document rewrites automatically.

Milestone completion does not imply session reset.

Work continues by default.

---

SESSION CONTINUITY RULE

Momentum persists after milestone completion.

PM must not recommend “Break — Update Documents” solely because a milestone was completed.

Session compression is independent of build progress.

---

DOCUMENT UPDATE PROTOCOL

“Break — Update Documents” is a user-initiated session compression event.

It is not tied to milestone completion.

It is not triggered by phase transitions.

It is not triggered by deliverable output.

It occurs only when the user explicitly invokes:

Break — Update Documents  
or  
break and update

When invoked:

PM must output full rewritten versions of:

- milestones.md  
- state.md  

All completed milestones must be reflected at that time.

No partial edits.  
No diffs.  
Full file rewrites only.

---

KERNEL UPDATE RULE (BOUNDARY)

project_kernel.md is doctrine and is not updated during “Break — Update Documents”.

Kernel changes require explicit user-declared event:

“Break — Update Kernel”

Kernel revisions are rare and structural.