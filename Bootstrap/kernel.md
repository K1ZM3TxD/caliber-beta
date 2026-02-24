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


## Primary Mode: Calibration Core (Current)

Caliber is being built as a calibration engine first.

The narrative Pattern Summary layer is temporarily frozen.

Current spine:

1. Resume ingest
2. 5-question signal capture
3. Deterministic anchor extraction (user-visible)
4. Job description ingest
5. Anchor overlap + gap surface
6. Title producer (mechanical, anchor-driven)

Narrative synthesis returns only after the calibration core is stable and validated.


\# Core Execution Principle



We do not persuade the model to behave.



We constrain it until behavior aligns.



All synthesis is governed by structural pressure, not prompt rhetoric.





\# Anchor-First Pipeline (Mandatory)



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

\- Full-file rewrites preferred when pasting supports workflow.



For coders / agents:

\- Surgical diffs only when explicitly labeled “surgical.”

\- No speculative refactors.

\- Minimal surface change per task.





\# Definition of Done



A task is complete only when:



\- Acceptance criteria are met.

\- Anchor enforcement passes.

\- Doctrine compliance passes.

\- Logging is present.

\- Change is minimal and scoped.

\- Outcome is mechanically verifiable.



Technical success without philosophical compliance is failure.





\# Change Control



Philosophy changes → CALIBER\_DOCTRINE.md  

Enforcement changes → KERNEL.md  

Task sequencing → MILESTONES.md  



Execution evolves. Doctrine remains stable.

