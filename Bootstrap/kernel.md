\# KERNEL.md

Execution Doctrine — Anchor-First Architecture



Stable enforcement rules.

Updated deliberately.



Philosophy lives in CALIBER\_DOCTRINE.md  

Task sequencing lives in MILESTONES.md  

This document defines mechanical enforcement.





\# Authority Order



1\. CALIBER\_DOCTRINE.md — Identity + philosophy  

2\. KERNEL.md — Enforcement mechanics  

3\. MILESTONES.md — Task sequencing + status  



Doctrine defines what Caliber is.  

Kernel defines how it enforces it.



If execution diverges from doctrine, execution changes — not doctrine.



## Current Spine: Locked Calibration Flow

Caliber is now locked to the following product flow:

1. Resume upload (PDF/DOCX/TXT)
2. Title suggestion + job description paste (same screen; no user title editing; no confirmation gate)
3. Fit score (0–10) + summary
4. LLM dialogue opens after score+summary (next phase toggle; wander vs constrained not yet locked)

Older calibration-core steps (anchors, overlap/gap, mechanical title producer) are deprecated in the current flow.

Narrative synthesis and dialogue mode will be enabled after score+summary.

### Coder Task Payload Format

Coder tasks use the standard structured handoff block (title, scope, changes, DoD, notes). Fenced code blocks and multi-line structured objects are allowed. Single-line plain text is acceptable for trivial or docs-only tasks.





\# Core Execution Principle



We do not persuade the model to behave.



We constrain it until behavior aligns.



All synthesis is governed by structural pressure, not prompt rhetoric.



\# Anchor-First Pipeline (Mandatory)

Signal Classification Layer (Deterministic)

Anchor extraction must tag each anchor with:

source: resume | q1 | q2 | q3 | q4 | q5

context_type:

breakdown

constraint_construction

incentive_distortion

neutral

Signal Classification Rules:

An anchor qualifies as Signal-Dominant only if:

It appears in at least one breakdown-context answer
AND

It appears in at least one additional distinct context (resume or other Q)

Resume-only repetition classifies as Skill-Dominant.

Signal alignment scoring must prioritize Signal-Dominant anchors.

Skill coverage scoring must use Skill-Dominant anchors.

Signal weight > Skill weight in composite alignment.



All pattern synthesis must follow this sequence:



1\. Extract lexical anchors from input signal

&nbsp;  - Repeated verbs

&nbsp;  - Repeated operational nouns

&nbsp;  - High-frequency mechanical terms



2\. Generate synthesis via LLM under anchor-aware prompt



3\. Validate anchor overlap and doctrine compliance



4\. If overlap fails → retry once with missing anchors injected



5\. If retry fails → deterministic fallback



This sequence is mandatory.



Skipping enforcement violates doctrine.





\# Enforcement Hierarchy



When evaluating synthesis, enforcement order is:



1\. Cadence compliance (structure)

2\. Anchor overlap threshold

3\. Anti-praise enforcement

4\. Anti-abstraction enforcement

5\. Repetition control



Cadence alone is insufficient.  

Lexical grounding is primary.





\# Lexical Anchor Rules



\## Anchor Weighting



\- Repeated verbs → highest weight

\- Repeated operational nouns → high weight

\- Identity descriptors → low weight

\- Emotional framing → minimal weight

\- Resume headlines → no special privilege



\## Failure Conditions



Output fails if:



\- It introduces novel archetype language not present in anchors.

\- It rephrases marketing copy into softer marketing copy.

\- It invents identity not grounded in extracted anchors.



Anchors assist structure.  

Anchors do not override grammar.



Structure > Anchor pressure.





\# Overlap Enforcement



After LLM synthesis:



score = overlapCount / anchorTerms.length  

MIN\_OVERLAP = 0.35



Decision logic:



\- score >= 0.35 → accept (llm)

\- score < 0.35 → retry once

\- retry still < 0.35 → deterministic fallback



Retry occurs at most once.





\# Structural Invariants



These must never break:



\- Required line starters remain exact.

\- Contrast structure must remain intact.

\- Never switch to first-person voice.

\- Construction line must match allowed verb pattern.

\- No noun collision artifacts.

\- No cadence distortion under anchor pressure.




## Calibration Fit Score Enforcement (2026-03-01)

1. Fit score must be computed deterministically (no LLM) before TERMINAL_COMPLETE is considered 'results-ready'.
2. ALIGNMENT_OUTPUT does not accept ADVANCE; UI must fire COMPUTE_ALIGNMENT_OUTPUT exactly once per session.
3. Result page must read from /api/calibration/result, not ADVANCE responses.

If anchor pressure degrades grammar, anchor usage must be reduced — not structure.





\# Guardrails (Reclassified)



The previous “Safety Rails” framing is obsolete.



Guardrails are structural, not aesthetic.



\- Blacklist enforcement → structural integrity

\- Repetition thresholds → clarity enforcement

\- Construction strictness → cadence integrity



Loosening guardrails does not improve quality.  

Improving extraction improves quality.





\# Observability Doctrine



We must observe philosophical failure — not just runtime failure.



Every synthesis attempt must log:



\- synthesis\_source = llm | retry | fallback

\- anchor\_overlap\_score

\- missing\_anchor\_count

\- praise\_flag

\- abstraction\_flag



Logs must be:



\- Single-line

\- Precise

\- Minimal

\- Machine-parsable

\- Emitted exactly once per attempt



If fallback frequency rises, extraction logic is failing.





\# Verifiability Doctrine



If a change cannot be measured, it is not done.



Acceptable verification methods:



\- Anchor overlap scoring

\- Deterministic regression tests

\- Log signature validation

\- Reproducible failure case



“Feels better” is not a metric.





\# Output Policy



For humans:

- Surgical edits preferred by default (explicit replacements/insertions with anchors).
- Full-file rewrites ONLY when necessary (small file, pervasive edits, or scattered changes where omission risk is high). Must include justification.

For coders / agents:

- Default output MUST be surgical edits (not full rewrites).
- Full-file rewrite allowed ONLY with explicit justification per above.
- No speculative refactors.
- Minimal surface change per task.

Definition of surgical edit (mechanical):

- Must list file path(s)
- For each file: exact "replace OLD -> NEW" blocks and/or "insert AFTER <anchor>" blocks
- Avoid unified diffs unless explicitly requested





\# JSON-safe Coder Payload



Never include raw backslashes in task text (e.g., Windows paths like C:\Users\...).
If a backslash is required, represent as \\ or use forward slashes instead.
Avoid invalid JSON escape sequences (\U, \k, \:) in any payload that might be JSON-encoded.





\# Definition of Done



A task is complete only when:



\- Acceptance criteria are met.

\- Anchor enforcement passes.

\- Doctrine compliance passes.

\- Logging is present.

\- Change is minimal and scoped.

\- Outcome is mechanically verifiable.

If any documentation (*.md) is modified, coder MUST commit and push before reporting done.

Coder MUST report: git status -sb, git diff --name-only, and the pushed commit SHA.

Technical success without philosophical compliance is failure.





\# Change Control



Philosophy changes → CALIBER\_DOCTRINE.md  

Enforcement changes → KERNEL.md  

Task sequencing → MILESTONES.md  



Execution evolves. Doctrine remains stable.

