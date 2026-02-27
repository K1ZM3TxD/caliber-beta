# CALIBER_ISSUES_LOG

## Current Open Issues

- Coder reliability: repeated build-breaking edits; require evidence + strict guardrails.
- Backend wiring needs refactor into hook to reduce page.tsx fragility.
- Narrative layer unfreeze blocked on manual validation (explicit blocker)
- Git visibility/branch divergence drift: Fixes existed locally but were not committed/pushed, causing PM bootstrap to fail. New rules require remote visibility and divergence recovery playbook (see CALIBER_EXECUTION_CONTRACT.md).

## Mitigations / Working Rules

- Reject any multi-file patch when task expects one file.
- Require git diff --name-only == expected file(s) before applying.
- No ‘compiled/200 OK’ claims without user-provided logs.
- Added Remote Visibility Rule and Divergence Playbook to contract to prevent recurrence.
