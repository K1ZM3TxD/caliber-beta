# CALIBER_ISSUES_LOG

## Current Open Issues

1. Post-score LLM dialogue mode: toggle and UI implementation pending after Fit score + summary page.
2. Routing/polling fragility: session state checks can be stale, causing UI to hang or misroute (partially mitigated, but still relevant).
3. Score+summary page: ensure correct UI and backend contract for Fit score (0–10) + summary output.

## Mitigations / Working Rules
 
- Reject any multi-file patch when task expects one file.
- Require git diff --name-only == expected file(s) before applying.
- No ‘compiled/200 OK’ claims without user-provided logs.
- Added Remote Visibility Rule and Divergence Playbook to contract to prevent recurrence.
