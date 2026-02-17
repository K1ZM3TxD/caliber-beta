# Caliber — MILESTONES

This document defines the ordered build runway.

It changes only when scope shifts or milestones are completed.

---

## OPERATIONAL BASELINE (STABLE UNLESS CHANGED)

- Public API contract: **v1 frozen**
  - Top-level keys: `alignment`, `skillMatch`, `stretchLoad`, `meta`
- Canonical orchestration: `lib/integration_seam.ts`
- Public contract module: `lib/result_contract.ts`
- API route: `app/api/job-ingest/route.ts` (thin wrapper, **JSON-only**)

Calibration subsystem (in progress under Phase 5):
- API route: `app/api/calibration/route.ts` (thin wrapper, JSON-only)
- UI route: `app/calibration/page.tsx` (server-authoritative renderer)

Pattern Synthesis implementation form:
- See `SYNTHESIS_PATTERN.md`
- Governs cadence and consequence structure for synthesis output
- Does not modify kernel doctrine

Note: `state.md` is deprecated. Current position is tracked here under **ACTIVE MILESTONE**.

---

## ACTIVE MILESTONE

Milestone 5.1 — Calibration Flow Implementation (ACTIVE)

Goal:
Implement the 5.0 state machine deterministically in backend + UI as a renderer of that state.

Scope (locked for 5.1):
- Backend:
  - Deterministic calibration state machine implementation
  - Deterministic session engine / dispatcher
  - Enforced gating rules (threshold + one clarifier)
  - No internal “state skipping” (each state must be externally visible; no multi-hop chaining in a single dispatch)
- UI:
  - Server-authoritative renderer of session snapshot
  - No client-side simulation of transitions
  - Clear input handling (no stale prompt text; no ambiguous submit/advance UX)
- API:
  - JSON-only responses
  - Normalized error shape `{ ok:false, error:{ code, message } }`
  - Must return `{ ok:true, session }` on success
- Synthesis:
  - Must conform to `SYNTHESIS_PATTERN.md`
  - Conditional operational consequence sentence only when identity coherence is strong

Not in scope:
- New scoring mechanics
- Contract changes (v1 remains frozen)
- Non-deterministic heuristics
- Additional alignment dimensions

Definition of Done (5.1):
- Full flow is executable end-to-end:
  Create session → Resume ingest → Prompts 1–5 (incl. clarifier) → Consolidation/Encoding Ritual → Pattern Synthesis (visible) → Title Hypothesis (visible) → Title Dialogue (interactive) → Job Ingest → Alignment Output
- Every state is externally visible (no silent auto-chaining through synthesis/title states)
- UI has no “guessing” steps (no required “submit then advance” ambiguity)
- Final result renders deterministically from server snapshot
- Synthesis output adheres to locked pattern form

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
- Public API contract version **v1** frozen.
- Live API POST returns contract surface with top-level keys only (no blending).

Milestone 4.2 — Minimal Contract Viewer Page (COMPLETE)
- Viewer renders contract deterministically.
- JSON-only error behavior confirmed.

Milestone 4.3 — Viewer Upgrade + Hard-Fail Clarity + Regression Fixtures (COMPLETE)
Validated:
- Viewer upgrades (history/copy-json/sample/clear) deterministic
- Ingest remains strict (hard fail on incomplete 6-dim encoding)
- BAD_REQUEST now dimension-specific (no new heuristics)
- Smoke runner includes 1 happy path + 2 hard-fail fixtures (green)

---

## PHASE 5 — CALIBRATION FLOW UI

Milestone 5.0 — Calibration Flow State Machine Spec (COMPLETE)

Milestone 5.1 — Calibration Flow Implementation (ACTIVE)

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

## MILESTONE ADVANCEMENT RULE

PM may recommend milestone completion.

Milestones move to COMPLETE only after explicit user confirmation.

Milestone completion does not trigger document rewrites automatically.

Milestone completion does not imply session reset.

Work continues by default.

---

## SESSION CONTINUITY RULE

Momentum persists after milestone completion.

PM must not recommend “Break — Update Documents” solely because a milestone was completed.

Session compression is independent of build progress.

---

## DOCUMENT UPDATE PROTOCOL

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

All completed milestones must be reflected at that time.

No partial edits.
No diffs.
Full file rewrites only.

---

## KERNEL UPDATE RULE (BOUNDARY)

project_kernel.md is doctrine and is not updated during “Break — Update Documents”.

Kernel changes require explicit user-declared event:

“Break — Update Kernel”

Kernel revisions are rare and structural.