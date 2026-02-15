\# Caliber — MILESTONES



This document defines the ordered build runway.



It changes only when scope shifts or milestones are completed.



---



\## PHASE 1 — ALIGNMENT INSTRUMENT



Milestone 1.1 — Lock Scoring Mechanics (COMPLETE)



Milestone 1.2 — Define Interpretation Band Structure (COMPLETE)



Milestone 1.3 — Define Pattern Measurement Method (COMPLETE)



Milestone 1.4 — Define Role Demand Encoding (COMPLETE)



Milestone 1.5 — Define Disagreement Handling (COMPLETE)



---



\## PHASE 2 — CALIBRATION FLOW



Milestone 2.1 — Resume Parsing Structure (COMPLETE)



Milestone 2.2 — Reflective Question Engine (COMPLETE)



Milestone 2.3 — Pattern Synthesis Output Logic (ACTIVE)



Milestone 2.4 — Current Role Validation Logic



---



\## PHASE 3 — ROLE EXPLORATION ENGINE



Milestone 3.1 — Job Ingestion Structure



Milestone 3.2 — Skill Match Classification Engine



Milestone 3.3 — Stretch Load Framing Logic



---



\## MILESTONE RULES



Only one milestone is active at a time.



Milestones move to COMPLETE explicitly.



Do not work outside the active milestone.



---



\## EXECUTION MODEL



Engineering work may be implemented by:



\- Direct deterministic rewrite (preferred for small scoped tasks)

\- Copilot Agent PR workflow (reserved for multi-file or structural changes)



Copilot Agent should not be used for:

\- Small formatting corrections

\- Single-file constraint tightening

\- Tasks under ~100 LOC



PM retains discretion over execution method per task.



---



\## MILESTONE ADVANCEMENT RULE



PM may recommend milestone completion and advancement.



Milestones move to COMPLETE only after explicit user confirmation.



---



\## DOCUMENT UPDATE PROTOCOL



When user says "break update documents" (or "break and update") this is an explicit “Break — Update Documents” event.



PM must output full updated rewritten versions of:



\- milestones.md

\- state.md



All newly completed milestones must be reflected.



No partial edits.

No diffs.

Full file rewrites only.



---



\## KERNEL UPDATE RULE (BOUNDARY)



project\_kernel.md is doctrine and is not updated during “Break — Update Documents”.



Kernel changes require an explicit user-declared event:



“Break — Update Kernel”

