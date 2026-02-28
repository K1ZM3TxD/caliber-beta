# CALIBER_ISSUES_LOG

## Current Open Issues

1. TITLE_FEEDBACK contract mismatch: UI sends wrong field, API expects payload as string (blocks progress to job description page).
2. Post-prompt routing/polling fragility: session state checks can be stale, causing UI to hang or misroute (partially mitigated, but still relevant).
3. Alignment output UI not implemented: placeholder needed after job ingest to complete flow.

## Mitigations / Working Rules

- Reject any multi-file patch when task expects one file.
- Require git diff --name-only == expected file(s) before applying.
- No ‘compiled/200 OK’ claims without user-provided logs.
- Added Remote Visibility Rule and Divergence Playbook to contract to prevent recurrence.
