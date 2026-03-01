# CALIBER_ISSUES_LOG

## Current Open Issues

1. Post-score LLM dialogue mode: toggle and UI implementation pending after Fit score + summary page.
2. Routing/polling fragility: session state checks can be stale, causing UI to hang or misroute (partially mitigated, but still relevant).
3. Score+summary page: ensure correct UI and backend contract for Fit score (0–10) + summary output.
4. UI/Backend divergence: UI does not consistently execute COMPUTE_ALIGNMENT_OUTPUT or handle TERMINAL_COMPLETE/result.
5. State-gate hazards discovered: SUBMIT_JOB_TEXT invalid in CONSOLIDATION_PENDING and CONSOLIDATION_RITUAL; requires ADVANCE ticks (sleep between ticks in RITUAL).
6. Clarifier hazard: short prompt answers (<40 trimmed chars) can route to PROMPT_n_CLARIFIER and break naive scripts.
7. Resume upload MIME hazard: resume fixture must use supported MIME type (e.g., text/plain for .txt).

## Mitigations / Working Rules

- Reject any multi-file patch when task expects one file.
- Require git diff --name-only == expected file(s) before applying.
- No ‘compiled/200 OK’ claims without user-provided logs.
- Added Remote Visibility Rule and Divergence Playbook to contract to prevent recurrence.
- Smoke-first: calibration fixes must be proven via smoke terminal complete + result before UI debugging.
