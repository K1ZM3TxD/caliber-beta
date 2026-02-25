# KERNEL.md

Execution Doctrine — Anchor-First Architecture  
(Updated: Cloud-Canonical Workflow + 6.x Complete)

Philosophy lives in CALIBER_DOCTRINE.md  
Task sequencing lives in MILESTONES.md  

This document defines mechanical enforcement and workflow invariants.

---

# Authority Order

1. CALIBER_DOCTRINE.md — Identity + philosophy  
2. KERNEL.md — Enforcement mechanics + workflow invariants  
3. MILESTONES.md — Task sequencing + status  

Doctrine defines what Caliber is.  
Kernel defines how it enforces it.  

If execution diverges from doctrine, execution changes — not doctrine.

---

# Canonical Development Environment (Cloud-First)

Caliber now operates under a cloud-canonical workflow.

Canonical environment:
- GitHub Codespaces
- Branch: `copilot/work`

Rules:

- All development occurs in Codespaces.
- All commits land on `copilot/work`.
- Local machines are optional, not authoritative.
- No branch drift between agent and runtime.
- `package-lock.json` reflects Codespaces environment.

When stable:
- `copilot/work` → merge into `main`.

There is one active execution branch.
No parallel canonical branches.

---

# Primary Mode: Calibration Core (Active)

The Pattern Summary narrative layer remains frozen.

Active spine:

1. Resume ingest
2. 5-question signal capture
3. Deterministic anchor extraction (user-visible; applies GENERIC_ANCHOR_BANLIST in addition to stopwords to remove generic/boilerplate/education/business filler)
4. Job description ingest
5. Anchor overlap + gap surface
6. Title producer (mechanical, anchor-driven)

OperateBest / loseEnergy bullet grounding is entering controlled extension phase.

---

# Core Execution Principle

We do not persuade the model to behave.  
We constrain it until behavior aligns.

All synthesis is governed by structural pressure, not prompt rhetoric.

---

# Anchor-First Pipeline (Mandatory)

All synthesis must follow:

1. Extract lexical anchors (deterministic; applies GENERIC_ANCHOR_BANLIST in addition to stopwords to enforce anchor quality)
2. Generate via LLM under anchor-aware prompt
3. Validate:
   - Structural validity
   - Blacklist enforcement
   - Anchor overlap
   - Anti-praise
   - Anti-abstraction
4. Retry at most once (if overlap fails)
5. Deterministic fallback if retry fails

Skipping enforcement violates doctrine.

---

# Enforcement Hierarchy

Order of enforcement:

1. Structural validity
2. Blacklist enforcement (bypasses retry)
3. Anchor overlap threshold
4. Anti-praise
5. Anti-abstraction
6. Repetition control

Blacklist detection:
- Deterministic
- Case-insensitive
- Immediate fallback
- No retry

---

# Overlap Enforcement

score = overlapCount / anchorTerms.length  
MIN_OVERLAP = 0.35  

Outcomes:

- score ≥ threshold → PASS
- score < threshold → RETRY_REQUIRED
- retry success → PASS
- retry fail → FALLBACK_ANCHOR_FAILURE

Retry occurs once only.

---

# Validator Outcome Matrix (Stable)

Allowed outcomes:

- PASS
- RETRY_REQUIRED
- FALLBACK_ANCHOR_FAILURE
- FALLBACK_STRUCTURE_INVALID
- FALLBACK_BLACKLIST_PHRASE

No silent branches permitted.

All synthesis logs must include:

- synthesis_source
- anchor_overlap_score
- missing_anchor_count
- praise_flag
- abstraction_flag
- validator_outcome
- fallback_reason (fallbacks only)

Single-line. Deterministic. Machine-parseable.

---


# Observability Doctrine

Every synthesis attempt must log exactly once.

Job Description ingest: INCOMPLETE_DIMENSION_COVERAGE is surfaced as missingDimensions labels in API + UI error box (enforced and logged as part of observability).

Fallback must include fallback_reason:

- structure_invalid
- anchor_failure
- blacklist_phrase

If fallback frequency rises → extraction logic is failing.

---

# Structural Invariants

Must never break:

- Required line starters
- Contrast structure
- No first-person voice
- Construction line grammar
- No noun collision artifacts
- No abstraction drift beyond anchors

Structure > Anchor pressure.

---

# Bullet Grounding Extension (7.x Phase)

OperateBest validator scaffolding exists:
- validateOperateBestBullets
- formatOperateBestLogLine
- Shared enforcement stack
- bullet_group=operateBest logging

Current status:
- Validator implemented
- Not yet fully wired into runtime generation flow

Next enforcement milestone:
- Wire operateBest validation into live calibration flow
- Preserve identical enforcement stack
- Do not blend engines

loseEnergy remains untouched until operateBest stabilizes.

---

# Definition of Done

A task is complete only when:

- Acceptance criteria are met
- Enforcement passes
- Logs are emitted
- Change is minimal and scoped
- Outcome is mechanically verifiable
- Codespaces environment remains canonical

Technical success without enforcement is failure.

---

# Change Control

Philosophy changes → CALIBER_DOCTRINE.md  
Enforcement changes → KERNEL.md  
Execution sequencing → MILESTONES.md  
Workflow environment changes → KERNEL.md  

Execution evolves. Doctrine remains stable.