# Caliber — MILESTONES (Current Snapshot)

This document defines the active build runway.

It changes only when scope shifts or architectural decisions are made.

This file is the single source of truth for current system intent.

---

# OPERATIONAL BASELINE (LOCKED)

## Core Architecture

- Deterministic state machine (event-driven, no auto-chaining)
- Externally visible states only
- JSON-only API responses
- No hidden transitions
- Strict ADVANCE allowlist
- Resume upload is file-only
- No paste path

---

# Pattern Synthesis Architecture (LOCKED)

## Structural Backbone

Pattern Synthesis must follow the 4-layer cadence structure:

1. Identity Contrast  
2. Intervention Contrast  
3. Construction Layer  
4. Conditional Consequence Drop (earned only)

No motivational tone.  
No abstraction drift.  
No KPI framing.  
Cadence structure invariant.

---

# ACTIVE MILESTONE

## Milestone 5.1 — Hybrid Semantic Synthesis (ACTIVE)

### Objective

Deliver “eerily specific” Pattern Synthesis using:

Locked 4-layer backbone  
+  
LLM semantic fill derived from:
- Resume text
- Prompt answers
- Person vector

Deterministic scoring remains unchanged.

---

# 5.1 EXECUTION STRUCTURE (ATOMIC SEQUENCING)

Milestone 5.1 is executed through strictly atomic tasks.

No multi-layer implementation allowed.

Each subsection below represents an independent execution unit.

Progress advances only after validation of each unit.

---

## 5.1A — Locked Calibration Prompts (COMPLETED / LOCKED)

Final Locked Wording:

1. In your most recent role, what part of the work felt most like you?  
2. What part of the role drained you fastest?  
3. What do others come to you for that isn’t necessarily in your job description?  
4. What type of challenge feels exciting rather than overwhelming?  
5. If you removed job titles entirely, how would you describe the work you’re best at?

Rules:
- No AI rewriting
- Canonical source only
- Mechanical drift prevention enforced

Status: LOCKED

---

## 5.1B — LLM Wiring (COMPLETED)

Scope (as executed):
- LLM is called to generate the 4 synthesis lines (JSON contract)
- Deterministic fallback remains intact
- No retry semantics beyond existing flow
- No UI changes

Notes:
- LLM execution confirmed via non-deterministic outputs.
- Missing OPENAI_API_KEY causes fallback; resolved via local env.

Status: COMPLETE

---

## 5.1C — Deterministic Validation Layer (ACTIVE)

Purpose:
- Prevent generic/archetypal drift and enforce structure deterministically.

Current behavior (observed):
- Validator is rejecting some LLM outputs and falling back to deterministic dimension-safe lines.

### 5.1C.1 — Repetition Rule Softening (COMPLETED)
Decision:
- Minor repetition should not force hard fallback.
- Repetition enforcement shifted toward best-effort repair.

Status: COMPLETE

### 5.1C.2 — Blacklist Handling Precision (ACTIVE)
Decision (LOCKED):
- Single-token blacklist hits must be REPAIR-FIRST (deterministic replacement), then re-check.
- Phrase-level archetype hits must remain HARD-FAIL to deterministic fallback.

Implementation rule:
- If blacklist hit contains whitespace → immediate fallback.
- Else attempt replacement using a small deterministic map (initial seed list), then re-check.
- Only fallback if unrepaired.

Also add minimal observability:
- Log when blacklist repair applied.
- Log when phrase-level blacklist triggers fallback.

Status: ACTIVE (next execution)

---

## 5.1D — Single Retry Enforcement (PENDING)

Scope:
- If validation fails:
  - Retry once with validation errors included.
- If retry fails:
  - Trigger deterministic fallback.
- No UI changes.

Status: PENDING

---

## 5.1E — Lexical Grounding Refinement (PENDING)

Scope:
- Improve prompt so synthesis reuses concrete lexical anchors from resume + answers.
- Reduce archetypal phrasing and “generic corp” defaults.
- Maintain:
  - No praise
  - No motivational tone
  - No metric blending

Status: PENDING

---

# 5.2 — Synthesis Experience Refinement (PENDING)

UI-only changes.

- Center bullet block under headers
- Increase bullet font size to match body
- Maintain single column, controlled rhythm
- No scoring changes

Status: PENDING

---

# 5.3 — Bullet Semantic Enrichment (PLANNED)

Decision locked: Enriched via single-pass segmented LLM.

Constraints:
- Dimension selection remains deterministic.
- Bullet structure remains fixed.
- Vocabulary band constraint ±15%.
- No praise.
- No identity labeling.
- No skill blending.
- Deterministic validation required.
- Deterministic fallback retained.

Status: PLANNED (after 5.1 complete)

---

# Deterministic Fallback Doctrine (LOCKED)

Fallback synthesis exists solely as structural guard.

It:
- Preserves 4-layer structure
- Prevents downstream crashes
- Is not primary experience

Fallback should rarely be shown.

---

# Definition of Done — 5.1

Create Session  
→ Resume Upload  
→ Prompts 1–5 (locked wording)  
→ Consolidation Ritual  
→ Encoding Ritual  
→ Pattern Synthesis (LLM semantic fill, structurally locked, validated)  
→ Title Hypothesis  
→ Job Ingest  
→ Alignment Output  

Additionally:
- Prompts remain stable across sessions.
- LLM output passes validation deterministically.
- Retry logic enforced (5.1D).
- Deterministic fallback preserved.
- No abstraction drift.
- No repetition loops.
- No metric blending.

---

End of Milestones Snapshot