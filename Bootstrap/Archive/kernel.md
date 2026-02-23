\# FILE: KERNEL.md



\# Kernel

Purpose: Execution doctrine for the project. Stable rules; updated deliberately.



\## Authority Order

1\) CALIBER\_DOCTRINE.md (philosophy + identity constraints)

2\) KERNEL.md (execution rules)

3\) MILESTONES.md (task runway + status)



\## Execution Doctrine

\- We prefer verifiable progress over speculative rewrites.

\- Small, controlled changes beat big refactors.

\- If a change cannot be measured, it is not “done.”



\## Output Policy

\- For humans: full-file rewrites are preferred when pasting is the workflow.

\- For coders/agents: surgical diffs only when explicitly labeled “surgical.”



\## Copy Governance

\- Canonical copy must have a single source.

\- If wording is deterministic or UI-visible, search for duplicates and route through the canonical source.

\- Drift prevention is part of completion (tests/grep checks when appropriate).



\## Safety Rails (Adjustable)

These are guardrails, not ideology. They can be loosened if they block quality:

\- Banned/blacklist terms

\- Repetition thresholds

\- “Construction line” strictness

If loosened, we record:

\- what changed

\- why

\- how we will detect regression



\## Observability Doctrine

\- If synthesis fails, we must be able to see \*why\* (logged reason code).

\- Logs should be precise, minimal, and keyed (e.g. synthesis\_source=llm/fallback, reason=...).



\## Definition of Done

A task is complete only when:

\- acceptance criteria are met

\- change is minimal/specific

\- outcome is mechanically verifiable (test, log signature, or deterministic repro)



\## Change Control

\- Doctrine changes go here (Kernel) only if they change execution mechanics.

\- Philosophy changes go only in CALIBER\_DOCTRINE.md.

\- Task changes go only in MILESTONES.md.

