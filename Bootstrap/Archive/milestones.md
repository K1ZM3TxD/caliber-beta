# Caliber — MILESTONES (Current Snapshot)

This document defines the active build runway.

It changes only when scope shifts, architectural decisions are made, 

or new execution discoveries occur.

This file governs execution only.

For philosophy and identity constraints, see: CALIBER_DOCTRINE.md  

For execution doctrine rules, see: KERNEL.md

---

# OPERATIONAL BASELINE (COMPLETED RECORD)

## Core Architecture

- Deterministic state machine (event-driven, no auto-chaining)
- Externally visible states only
- JSON-only API responses
- No hidden transitions
- Strict ADVANCE allowlist
- Resume upload is file-only
- No paste path

Status: COMPLETED

---

# Pattern Synthesis Architecture (COMPLETED RECORD)

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


Status: COMPLETED

---

# ACTIVE MILESTONE

## Milestone 5.1 — Hybrid Semantic Synthesis (ACTIVE)

### Objective

Deliver “eerily specific” Pattern Synthesis using:

4-layer structural backbone  

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

## 5.1A — Calibration Prompts (COMPLETED)


Final Locked Wording:

Final Wording:

1. In your most recent role, what part of the work felt most like you?  

2. What part of the role drained you fastest?  

3. What do others come to you for that isn’t necessarily in your job description?  

4. What type of challenge feels exciting rather than overwhelming?  

5. If you removed job titles entirely, how would you describe the work you’re best at?

Rules:

- No AI rewriting

- Canonical source only

- Mechanical drift prevention enforced

Status: COMPLETED

---
## 5.1B — LLM Wiring (COMPLETED)

Scope:

- LLM is called to generate the 4 synthesis lines (JSON contract)

- Deterministic fallback remains intact

- No uncontrolled retry semantics

- No UI changes

Status: COMPLETED

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
## 5.1C — Deterministic Validation Layer (ACTIVE)

Purpose:

Prevent archetypal drift while preserving structural integrity.

Observed Issue:

Validator instability is classification-opacity driven rather than structural backbone failure.  
Over-rejection is occurring due to silent branch exits and ambiguous fallback paths.

---

### 5.1C.1 — Repetition Rule Softening (COMPLETED)

Decision:

- Minor repetition should not force hard fallback.

- Repetition enforcement shifted toward best-effort repair.

Status: COMPLETED

---

### 5.1C.2 — Blacklist Handling Precision (ACTIVE)

Decision:

- Single-token blacklist hits must be REPAIR-FIRST.
- Phrase-level archetype hits must remain HARD-FAIL.

Implementation Rule:

- If blacklist hit contains whitespace → immediate fallback.
- Else attempt deterministic single-token replacement.
- Re-check.
- Only fallback if unrepaired.

Observability Required:

- Log when blacklist repair applied.
- Log when phrase-level blacklist triggers fallback.

Status: ACTIVE

---

### 5.1C.3 — Verb Rule Stabilization (PARTIAL)

Observed:

First-line verb validation previously caused empty patternSummary return.


Current State:

- Empty-string return path removed.
- Verb rule now treated as validation failure rather than hard exit.
- However, no explicit outcome classification or structured logging yet.

Required:

- Integrate verb-rule failures into Validator Outcome Matrix.
- Log verb_rule_failed under explicit outcome classification.

Status: PARTIAL

---

### 5.1C.4 — Validator Outcome Matrix (IN PROGRESS)

Purpose:

Eliminate silent branch exits and over-rejection ambiguity.

Validator must produce explicit outcome classification:

- PASS
- REPAIR_APPLIED
- RETRY_REQUIRED
- FALLBACK_BLACKLIST_PHRASE
- FALLBACK_UNREPAIRABLE
- FALLBACK_STRUCTURE_INVALID

No empty-string exits permitted.

Implementation initiated via dedicated coder task.  
Awaiting integration into validator return path.

Status: IN PROGRESS

---

## 5.1D — Single Retry Enforcement (PARTIAL)

Scope:

If validation fails:

- Retry once with validation errors injected.
- If retry fails → deterministic fallback.
- No further retries.
- No UI changes.

Status: PENDING
Retry must not bypass validator.

Current State:

- Retry path exists.
- Not yet driven by explicit validator outcome classification.
- Will be finalized after 5.1C.4 completion.

Status: PARTIAL

---

## 5.1E — Lexical Grounding Refinement (NEXT)

Strategic Direction:

Naturalness improvement will focus on lexical grounding, not stricter guardrails.

Scope:
- Improve prompt so synthesis reuses concrete lexical anchors from resume + answers.
- Reduce archetypal phrasing and “generic corp” defaults.
- Maintain:
  - No praise
  - No motivational tone
  - No metric blending

- Improve prompt so synthesis reuses concrete lexical anchors from resume + answers.
- Reduce archetypal phrasing.
- Maintain structural cadence.
- Maintain no praise / no motivational tone.

Status: NEXT

Status: PENDING

---

# 5.2 — Synthesis Experience Refinement (PENDING)

UI-only changes:

- Center bullet block under headers
- Increase bullet font size to match body
- Maintain single column, controlled rhythm
- Increase bullet font size
- Maintain single column rhythm
- No scoring changes

Status: PENDING

---

# 5.3 — Bullet Semantic Enrichment (PLANNED)

Decision:
Enriched via single-pass segmented LLM.

Constraints:

Status: PLANNED (after 5.1 complete)
- Deterministic dimension selection
- Fixed bullet structure
- Vocabulary band constraint ±15%
- No praise
- No identity labeling
- No skill blending
- Deterministic validation retained
- Deterministic fallback retained


Status: PLANNED


# Deterministic Fallback Doctrine (COMPLETED RECORD)

Fallback synthesis exists solely as structural guard.


It:

- Preserves 4-layer structure

- Prevents downstream crashes

- Is not primary experience

- Should rarely be shown


Status: COMPLETED


---

# Definition of Done — 5.1



Create Session  

→ Resume Upload  

→ Prompts 1–5  

→ Consolidation Ritual  

→ Encoding Ritual  

→ Pattern Synthesis (LLM semantic fill, validated, retry enforced)  

→ Title Hypothesis  

→ Job Ingest  

→ Alignment Output  



Additionally:
- Prompts remain stable across sessions.
- LLM output passes validation deterministically.
- Retry logic enforced (5.1D).

- Prompts stable across sessions.

- Retry logic enforced.

- Validator does not return empty patternSummary.

- Deterministic fallback preserved.

- No abstraction drift.

- No repetition loops.

- No metric blending.