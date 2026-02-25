# Caliber — MILESTONES
(Updated: Cloud Reset + 6.x Complete)

This document defines active execution runway.

For philosophy → CALIBER_DOCTRINE.md  
For enforcement → KERNEL.md  

---

# CURRENT STATE SUMMARY

Canonical branch: `copilot/work`  
Canonical environment: GitHub Codespaces  

Local development is no longer authoritative.

---

# 6.x — Anchor Enforcement Stack (COMPLETE)

6.0 — Deterministic Anchor Extraction  
Status: COMPLETE

6.1 — Overlap Enforcement + Retry Logic  
Status: COMPLETE

6.2 — Signal/Skill Classification + Weighted Scoring  
Status: COMPLETE
  - Deterministic signal vs skill classification: resume-only anchors never become signal; signal requires breakdown + distinct context.
  - Caps: signalAnchors max 10, skillAnchors max 14.
  - Scoring outputs: signalAlignment (0–100), skillCoverage (0–100), compositeAlignment (0–100 adaptive blend), stretchLoad (0–100 weighted missing anchors).
  - Structural Note branch: triggers if signalAlignment ≤ 40 AND skillCoverage ≥ 70 (parallel branch).
  - Observability: single-line log includes all new metrics, emitted once per scoring attempt.

6.3 — Explicit Validator Outcome Matrix  
Status: COMPLETE

  6.0.x / 6.1.x: Anchor extraction now applies a deterministic GENERIC_ANCHOR_BANLIST filter (in addition to stopwords) to remove generic/boilerplate/education/business filler from anchors.

6.4 — Observability Upgrade  
Status: COMPLETE

  Job Description ingest: INCOMPLETE_DIMENSION_COVERAGE is surfaced as missingDimensions labels in API + UI error box. Lexical coverage broadened for: structuralMaturity, roleAmbiguity, breadthVsDepth (lexical only; no semantic inference).

  Job Description ingest: INCOMPLETE_DIMENSION_COVERAGE is surfaced as missingDimensions labels in API + UI error box. Lexical coverage broadened for: structuralMaturity, roleAmbiguity, breadthVsDepth (lexical only; no semantic inference).

All 6.x logs deterministic.  
Fallback_reason implemented.  
Blacklist precedence codified.  

---

# 7.0 — Bullet Grounding Extension (IN PROGRESS)

Phase 7.0a — OperateBest Validator Scaffold  
Status: COMPLETE

<<<<<<< HEAD
- validateOperateBestBullets implemented
- Shared enforcement stack
- bullet_group logging
- Guard coverage exists
=======
\## ARCHITECTURAL FORK



Milestone 5.1 (Hybrid Semantic Synthesis) is superseded.



Caliber now operates under Anchor-First Architecture.



We are no longer tuning guardrails.  

We are implementing structural grounding.



---



Milestone 6 — Lexical Anchor System (Deterministic)
6.0 Anchor Extraction — Deterministic Ordering (Complete)
Objective

Extract lexical anchors (verbs + nouns) from resume text and prompt answers in a deterministic, stable way suitable for downstream enforcement.

Implementation Guarantees

Deterministic tokenization

Deterministic sorting:

Primary: frequency (descending)

Secondary: term (ascending)

Stable top slices:

topVerbs (<= 12)

topNouns (<= 12)

anchorTerms (<= 24 combined)

No randomness. No semantic model involvement.

Contract

Anchor extraction must:

Produce identical output for identical input.

Never depend on runtime order or object key order.

Never mutate session state.

Be pure and synchronous.

Status: Complete

6.1 Anchor Injection + Overlap Enforcement (Complete)
Objective

Force semantic synthesis to meaningfully reuse user language without allowing the model to drift into abstraction or praise.

This is enforced via overlap scoring and retry logic.

Injection Layer

The synthesis prompt includes a LEXICAL ANCHORS block:

Verbs: (top verbs)

Nouns: (top nouns)

Anchors are advisory but scored.

Constraint:

Anchors must not override structural grammar rules.

Required line starters must never change.

Never switch to first-person voice.

Anchors should not create noun collisions (“protocol delegation” style artifacts).

Anchors assist structure. They do not define structure.

Overlap Enforcement

## ARCHITECTURAL FORK

Milestone 5.1 (Hybrid Semantic Synthesis) is superseded.

Caliber now operates under Anchor-First Architecture.

We are no longer tuning guardrails.  
We are implementing structural grounding.

---

Milestone 6 — Lexical Anchor System (Deterministic)
6.0 Anchor Extraction — Deterministic Ordering (Complete)
Objective

Extract lexical anchors (verbs + nouns) from resume text and prompt answers in a deterministic, stable way suitable for downstream enforcement.

Implementation Guarantees

Deterministic tokenization

Deterministic sorting:

Primary: frequency (descending)

Secondary: term (ascending)

Stable top slices:

topVerbs (<= 12)

topNouns (<= 12)

anchorTerms (<= 24 combined)

No randomness. No semantic model involvement.

Contract

Anchor extraction must:

Produce identical output for identical input.

Never depend on runtime order or object key order.

Never mutate session state.

Be pure and synchronous.

Status: Complete

6.1 Anchor Injection + Overlap Enforcement (Complete)
Objective

Force semantic synthesis to meaningfully reuse user language without allowing the model to drift into abstraction or praise.

This is enforced via overlap scoring and retry logic.

Injection Layer

The synthesis prompt includes a LEXICAL ANCHORS block:

Verbs: (top verbs)

Nouns: (top nouns)

Anchors are advisory but scored.

Constraint:

Anchors must not override structural grammar rules.

Required line starters must never change.

Never switch to first-person voice.

Anchors should not create noun collisions (“protocol delegation” style artifacts).

Anchors assist structure. They do not define structure.

Overlap Enforcement

After first LLM response:

Build a concatenated synthesis string.

Perform whole-word matching (\bterm\b, case-insensitive).

Compute:

score = overlapCount / anchorTerms.length

Threshold:

MIN_OVERLAP = 0.35
Decision Tree
Case A — score >= 0.35

Accept.

Log:

synthesis_source=llm ...
Case B — score < 0.35

Retry once with injected missing anchors.

Log:

synthesis_source=retry ...
Case C — retry still < 0.35

Deterministic fallback synthesis.

Log:

synthesis_source=fallback ...

Retry occurs at most once.

Logging Contract (Strict)

All synthesis logs must:

Be single-line physical strings.

Contain:

synthesis_source

anchor_overlap_score (2 decimals)

missing_anchor_count

praise_flag=false

abstraction_flag=false

Emit exactly once per attempt.

Never emit llm if first attempt fails threshold.

This ensures deterministic observability.

Known Behavioral Observations

Overlap pressure can produce grammatical degradation if anchor set is low quality.

Raising threshold increases anchor forcing.

Quality improvements should focus on:

Anchor selection refinement

Prompt structure clarity

Allowlist discipline

Grammar preservation

Threshold tuning should occur only after anchor quality stabilizes.

Status: Complete and Stable

Milestone 6.2 — Signal Classification Layer (Deterministic)

Objective:

Differentiate Signal-Dominant anchors from Skill-Dominant anchors based on cross-context repetition.

Implementation:

Tag anchors with source and context_type.

Implement deterministic classification rules.

Produce:

signalAnchors[]

skillAnchors[]

Update alignment engine to weight signalAnchors higher than skillAnchors.

Acceptance Criteria:

Identical input → identical classification.

Resume-only repetition never classifies as signal.

Breakdown-context repetition required for signal status.

Alignment score visibly differentiates signal vs skill match.

Status: NEXT

## Milestone 6.3 — Anti-Abstraction Enforcement

Objective:

Prevent identity inflation and archetype drift not grounded in anchors.

Implementation:

- Detect praise framing.

- Detect identity inflation language.

- Detect archetype terms not present in anchor set.

- Flag abstraction_flag=true/false.

- Retry path must explicitly remove drift terms.

Phase 7.0b — OperateBest Runtime Wiring  
Perform whole-word matching (\bterm\b, case-insensitive).

Threshold:

MIN_OVERLAP = 0.35
Decision Tree

Accept.

synthesis_source=llm ...
Case B — score < 0.35

Log:

synthesis_source=retry ...
Case C — retry still < 0.35

Deterministic fallback synthesis.

Log:

All synthesis logs must:

Be single-line physical strings.

Contain:

synthesis_source

praise_flag=false


Emit exactly once per attempt.

Known Behavioral Observations

Overlap pressure can produce grammatical degradation if anchor set is low quality.

Raising threshold increases anchor forcing.

Quality improvements should focus on:

Anchor selection refinement


Allowlist discipline

Milestone 6.2 — Signal Classification Layer (Deterministic)

Objective:


Implementation:

Tag anchors with source and context_type.

Implement deterministic classification rules.

Produce:

signalAnchors[]

skillAnchors[]

Update alignment engine to weight signalAnchors higher than skillAnchors.

Acceptance Criteria:

Identical input → identical classification.

Resume-only repetition never classifies as signal.

Breakdown-context repetition required for signal status.

Alignment score visibly differentiates signal vs skill match.

Status: NEXT


\## Milestone 6.3 — Anti-Abstraction Enforcement



Objective:



Prevent identity inflation and archetype drift not grounded in anchors.



Implementation:



\- Detect praise framing.

\- Detect identity inflation language.

\- Detect archetype terms not present in anchor set.

\- Flag abstraction\_flag=true/false.

\- Retry path must explicitly remove drift terms.


>>>>>>> main

Phase 7.0b — OperateBest Runtime Wiring  
Status: NEXT

- Attach validator to real generation path
- Preserve retry + fallback logic
- Emit operateBest log lines
- Do not touch loseEnergy yet

Phase 7.0c — loseEnergy Grounding  
Status: BLOCKED (until operateBest stable)

---

# UI Surface Stabilization (COMPLETE)

- Removed user-visible “Prompt” label
- Typewriter effect applied to:
  - Question text
  - Clarifier text
  - Generated outputs
- Reduced-motion respected
- No logic changes

<<<<<<< HEAD
Mock-calibration remains archived candidate (future cleanup).
=======
\## Milestone 6.4 — Validator Outcome Matrix (Refactor)



Purpose:



Replace silent validator branches with explicit classification.



Allowed outcomes:



\- PASS

\- REPAIR\_APPLIED

\- RETRY\_REQUIRED

\- FALLBACK\_ANCHOR\_FAILURE

\- FALLBACK\_STRUCTURE\_INVALID

\- FALLBACK\_BLACKLIST\_PHRASE



No empty returns permitted.



Status: PLANNED
>>>>>>> main

# UI/UX Flow (2026)

- JOB_INGEST and ALIGNMENT_OUTPUT states now auto-advance and auto-compute, showing "Computing ..." states in the UI. Duplicate event prevention is enforced via ref-based locks.

---

# WORKFLOW RESET (COMPLETE)

- Codespaces adopted as canonical dev environment
- copilot/work created as canonical branch
- persist-anchor-metrics merged into copilot/work
- Lockfile aligned to Codespaces

<<<<<<< HEAD
No further local/agent branch drift allowed.
=======
\## Milestone 6.5 — Observability Upgrade



Every synthesis must log:



\- synthesis\_source

\- anchor\_overlap\_score

\- missing\_anchor\_count

\- praise\_flag

\- abstraction\_flag

\- fallback\_reason (if applicable)



Logs must be:



\- machine-parseable

\- minimal

\- deterministic

\- non-verbose



Status: PARTIALLY IMPLEMENTED  

(Anchor count logging exists; overlap enforcement logging pending full stabilization.)


>>>>>>> main

---

## 7.0b — Guard Scope Stabilization (In Progress)

- Calibration prompt guard currently scans archived docs.
- Policy decision: exclude Bootstrap/Archive/** from guard scope.
- Runtime logic must remain untouched.
- No enforcement weakening allowed.

# NEXT EXECUTION STEPS

1. Wire operateBest validation into live calibration flow
2. Emit bullet_group logs during runtime
3. Confirm fallback behavior visible in logs
4. Stabilize operateBest output quality
5. Archive mock-calibration route cleanly
6. Prepare for merge of copilot/work → main (post-stabilization)

---

# Definition of Completion (7.x)

- operateBest enforced identically to 3-line synthesis
- Logs deterministic
- No abstraction drift
- No silent branches
- No cross-engine blending
- Output mechanically specific

“Feels right” is not completion.
Anchor metrics confirm grounding.

---

Execution continues from stable enforcement base.