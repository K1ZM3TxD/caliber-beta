
---

Milestone: Stabilize /calibration UI shell + typewriter tagline; restore RESUME_INGEST UI; add / -> /calibration redirect; establish single-file guardrails.

Next milestone:
- Backend wiring via hook: add useCalibrationSession and refactor page.tsx to call hook only; then resume-upload -> prompt 1.
## ⚠️ PHASE SHIFT — Calibration Core First (Temporary Freeze on Summary Engine)

As of this milestone update, development priority has shifted.

The Pattern Summary / Narrative Synthesis layer is temporarily frozen.

The product is now being developed as a Calibration Engine first.

Primary focus:

1. Resume ingest
2. 5-question signal capture
3. Deterministic anchor extraction
4. Job description ingest
5. Anchor overlap & gap surface
6. Title producer (mechanical, anchor-driven)

The narrative summary layer will return after the calibration core is stable and validated.

This prevents over-investment in surface polish before structural alignment logic is proven.

Caliber — MILESTONES (Anchor-First Architecture)



This document defines the active execution runway.



It changes only when architectural direction changes or new enforcement discoveries occur.



This file governs execution sequencing only.



For philosophy → CALIBER\_DOCTRINE.md  

For execution rules → KERNEL.md  



---



\## OPERATIONAL BASELINE (COMPLETED RECORD)



\### Core Architecture



\- Deterministic event-driven state machine  

\- Externally visible states only  

\- JSON-only API responses  

\- No hidden transitions  

\- Strict ADVANCE allowlist  

\- Resume upload is file-only  

\- No paste path  



Status: COMPLETED



---



\### Structural Cadence Backbone (COMPLETED RECORD)



Pattern Synthesis must follow 4-layer cadence:



1\. Identity Contrast  

2\. Intervention Contrast  

3\. Construction Layer  

4\. Conditional Consequence Drop (earned only)  



Cadence invariant.  

Not adjustable.  

Not prompt-dependent.  



Status: COMPLETED



---



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

skillAnchors[]

Milestone 6.2 — Deterministic Signal Classification
Status: COMPLETED
Notes: Deterministic signal/skill classification + weighted alignment scoring + tests (landed on main).

Milestone 6.3 — Anti-Abstraction Enforcement
Status: PARTIAL
Notes: Drift detection + retry injection present; validator outcome/log fields/tests not yet fully satisfied.


\## Milestone 6.3 — Anti-Abstraction Enforcement



Objective:



Prevent identity inflation and archetype drift not grounded in anchors.



Implementation:



\- Detect praise framing.

\- Detect identity inflation language.

\- Detect archetype terms not present in anchor set.

\- Flag abstraction\_flag=true/false.

\- Retry path must explicitly remove drift terms.



Status: NEXT



---



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



---



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



---



\# EXTENSION PHASE



Once top 3-line synthesis consistently produces D-level mechanical specificity:



---



\## Milestone 7.0 — Bullet Grounding Extension



Apply anchor enforcement to:



\- operateBest bullets

\- loseEnergy bullets



Constraints:



\- No identity inflation

\- No semantic drift beyond anchor band

\- No cross-engine blending



Status: BLOCKED until 6.x stable



---



\# Deterministic Fallback Doctrine (UNCHANGED)



Fallback exists only to:



\- Preserve cadence

\- Prevent invalid state

\- Protect downstream engines



If fallback rate increases → anchor extraction or overlap enforcement is failing.



Status: STABLE (structure preserved; anchor-based fallback under 6.1 build)



---



\# Definition of Done — 6.x



A milestone is complete only when:



\- Anchor extraction deterministic.

\- Overlap threshold enforced.

\- Retry path functional.

\- Fallback deterministic.

\- Logs present.

\- Regression tests pass.

\- Output feels mechanically specific under diverse inputs.

\- Anchor overlap metrics confirm grounding.



“Feels better” without anchor overlap metrics is not completion.

