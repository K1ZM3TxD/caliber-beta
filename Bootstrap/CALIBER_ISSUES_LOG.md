
# CALIBER_ISSUES_LOG

## Current Open Issues

- Coder reliability: repeated build-breaking edits; require evidence + strict guardrails.
- Backend wiring needs refactor into hook to reduce page.tsx fragility.
- Narrative layer unfreeze blocked on manual validation (explicit blocker)

## Mitigations / Working Rules

- Reject any multi-file patch when task expects one file.
- Require git diff --name-only == expected file(s) before applying.
- No ‘compiled/200 OK’ claims without user-provided logs.
