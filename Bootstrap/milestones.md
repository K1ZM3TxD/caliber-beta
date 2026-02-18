# Caliber — MILESTONES (Updated)

This document defines the ordered build runway.

It changes only when scope shifts or milestones are completed.

This file is the single source of truth for current build position and active constraints.

---

## OPERATIONAL BASELINE (STABLE UNLESS CHANGED)

### Public Contract (Frozen)

- Public API contract version: **v1**
- Top-level keys returned from role comparison:
  - `alignment`
  - `skillMatch`
  - `stretchLoad`
  - `meta`
- No blending of alignment and skill metrics.
- No additional alignment dimensions may be introduced.

### Core Orchestration

- Canonical orchestration: `lib/integration_seam.ts`
- Public contract module: `lib/result_contract.ts`
- Job ingest route: `app/api/job-ingest/route.ts`
  - Thin wrapper
  - JSON-only
  - Deterministic behavior

### Pattern Synthesis Baseline (Locked)

- Structural form governed by `SYNTHESIS_PATTERN.md`
- 4-layer contrast block is invariant:
  1. Identity Contrast
  2. Intervention Contrast
  3. Construction Layer
  4. Conditional Consequence Drop (earned only)
- No motivational tone.
- No abstraction drift.
- No KPI framing.
- Cadence/contrast structure must remain intact.

---

# ACTIVE MILESTONE

## Milestone 5.1 — Calibration Flow + Semantic Synthesis (ACTIVE)

### Goal

Complete deterministic calibration flow AND ensure Pattern Synthesis is semantically generated from user inputs (resume + prompts), not static phrase banks.

---

## Locked Scope for 5.1

### 1. Deterministic State Machine (Unchanged)

- No internal multi-hop chaining.
- Each state externally visible.
- Strict `ADVANCE` allowlist.
- No escape hatch transitions.
- Consolidation ritual externally visible.
- Clarifier enforcement (one max per prompt).

---

### 2. Resume Ingest (UPLOAD-ONLY — LOCKED)

- File-only upload (PDF, DOCX, TXT).
- No paste path.
- `POST /api/calibration/resume-upload`
- Server extracts text.
- Dispatcher receives `SUBMIT_RESUME`.
- JSON-only responses.
- Deterministic advancement.

---

### 3. Pattern Synthesis — Semantic Fill (NEWLY LOCKED)

#### Architectural Decision

Pattern Synthesis must:

- Use locked 4-layer structure.
- Use LLM to generate semantic content for:
  - X and Y (Identity Contrast)
  - A and B (Intervention Contrast)
  - Construction verbs
  - Consequence Drop
- Be derived from:
  - Person vector
  - Resume text
  - Prompt answers

Static phrase banks may exist only as deterministic fallback.

---

#### Required Constraints

- LLM must return structured JSON:
  - `identityContrast`
  - `interventionContrast`
  - `constructionLayer`
  - `consequenceDrop` (optional)
- Strict schema validation.
- Deterministic language guardrails:
  - No repeated content words.
  - No abstraction drift.
  - No praise / motivational tone.
  - Construction line must be 3 concrete verbs.
- Retry once on validation failure.
- Fallback to deterministic minimal safe output if still invalid.

---

### 4. UI Architecture (Beta-Ready)

- Single centered stage layout.
- No debug scaffolding.
- No raw field keys rendered.
- No duplicate action buttons.
- No layout reflow between states.
- Rendering strictly from server snapshot.

---

# PLANNED MILESTONE

## Milestone 5.2 — Synthesis Experience Refinement (PLANNED)

Purpose: Improve readability and gravity of Pattern Synthesis page.

### Planned Changes

- Single-column centered layout.
- Controlled spacing cadence.
- Bullet sections reframed as structural evidence:
  - “Pattern Expresses Cleanly When”
  - “Pattern Friction Emerges When”
- Reduced cognitive density.
- Continue button de-emphasized.

No scoring, state machine, or synthesis form changes.

---

# Definition of Done — 5.1

The following flow works cleanly and deterministically:

Create Session  
→ Resume Upload  
→ Prompts 1–5  
→ Consolidation Ritual  
→ Pattern Synthesis (LLM semantic fill, locked structure)  
→ Title Hypothesis  
→ Title Dialogue  
→ Job Ingest  
→ Alignment Output  

Additionally:

- No resume paste UI exists.
- LLM synthesis is validated and guarded.
- All responses JSON-only.
- Every state externally visible.
- No silent auto-chaining.
- No debug scaffolding remains.