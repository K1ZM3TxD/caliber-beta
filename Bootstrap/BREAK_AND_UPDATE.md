# BREAK_AND_UPDATE.md

## Purpose
Codifies the Break+Update contract for change-control in the Caliber repo. Used to document, trigger, and enforce architectural or enforcement changes.

## Trigger Phrase
“BREAK + UPDATE” — signals a change-control event requiring repo-wide documentation and enforcement updates.

## Required Outputs
- Chat snapshot of the change event
- Single-line coder task (JSON-safe, no fenced blocks)

## Required Docs to Update Each Time
- Bootstrap/milestones.md: Add a dated “BREAK + UPDATE — YYYY-MM-DD” entry near the top, summarizing DONE, BLOCKED, NEXT.
- Bootstrap/kernel.md: Update only when a new durable enforcement invariant is established per change-control.
- Bootstrap/CALIBER_ISSUES_LOG.md: Add, update, or resolve items as needed for the change event.

## Exact Snapshot Sections
- Chat snapshot: summary of the change event and rationale
- Doc update: milestone entry, kernel invariant (if applicable), issues log item(s)

## Exact Doc Update Format
- Milestones: “BREAK + UPDATE — YYYY-MM-DD” block after initial milestone/next milestone lines
- Kernel: Insert/update enforcement invariant only when new durable rule is established
- Issues log: Add/update/resolve items with date and status

## Coder Payload Constraints
- Single-line plain text
- JSON-safe
- No fenced code blocks (see KERNEL.md)

## Definition of Done
- Report: git status -sb, git diff --name-only, pushed commit SHA

## References
- Task sequencing lives in MILESTONES.md (see kernel)
- MILESTONES.md governs execution sequencing (see milestones)
- Current open-issues log: Bootstrap/CALIBER_ISSUES_LOG.md (see CALIBER_ISSUES_LOG)
