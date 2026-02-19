# Caliber — MILESTONES (Revised After Hybrid Pivot)

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

## 5.1A — Locked Calibration Prompts (Instrumentation Integrity)

Prompts 1–5 are instrumentation and must remain deterministic.

Final Locked Wording:

1. In your most recent role, what part of the work felt most like you?  
2. What part of the role drained you fastest?  
3. What do others come to you for that isn’t necessarily in your job description?  
4. What type of challenge feels exciting rather than overwhelming?  
5. If you removed job titles entirely, how would you describe the work you’re best at?

Rules:
- No AI rewriting
- No structural reframing
- No additional qualifiers
- Copy locked unless milestone explicitly changes it

Status: REVERT + LOCK IN PROGRESS

---

## 5.1B — Semantic Synthesis (LLM Integration)

Current Status:
LLM integrated, structurally correct, but still archetypal.

Required Improvements:

1. Reuse lexical anchors from resume and prompt answers.
2. Reduce over-constraint causing generic phrasing.
3. Remove over-broad blacklist entries (allow “system”, block only problematic forms).
4. Maintain:
   - No repetition across lines
   - Concrete verbs only
   - No praise language
   - Strict JSON schema validation
   - Retry once on failure
   - Deterministic fallback if invalid

Goal:
Two users with same vector produce structurally similar but lexically distinct synthesis.

---

## 5.1C — Language Guardrail Validation

Maintain deterministic post-generation validation:

- No repeated content words (>=5 chars) across lines
- Construction line must match verb, verb, and verb pattern
- Consequence <= 7 words
- No blacklisted abstraction phrases
- Reject non-compliant JSON

---

# Milestone 5.2 — Synthesis Experience Refinement (PENDING)

UI refinements only (no scoring changes):

- Single column centered layout
- Controlled vertical rhythm
- Bullet reframing:
  - “Pattern Expresses Cleanly When”
  - “Pattern Friction Emerges When”
- Continue button de-emphasis
- Remove visual density

---

# Milestone 5.3 — Bullet Semantic Enrichment (PLANNED)

Decision Pending:

Option A:
Keep bullets deterministic (dimension-driven)

Option B:
Allow LLM shaping for bullet sections as well (still structurally constrained)

---

# Known Active Issues

1. Prompt copy drift (being reverted)
2. Synthesis still archetypal (LLM prompt tuning required)
3. Bullet sections not yet semantically grounded
4. Title Hypothesis screen needs verification post-refactor

---

# Definition of Done — 5.1

Create Session  
→ Resume Upload  
→ Prompts 1–5 (locked wording)  
→ Consolidation Ritual  
→ Encoding Ritual  
→ Pattern Synthesis (LLM semantic fill, structurally locked)  
→ Title Hypothesis  
→ Job Ingest  
→ Alignment Output  

Additionally:

- Prompts remain stable across sessions.
- Synthesis feels lexically grounded in resume language.
- No abstraction drift.
- No repetition loops.
- Deterministic validation enforced.

---

End of Milestones Snapshot