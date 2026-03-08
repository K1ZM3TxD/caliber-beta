# CALIBER_EXECUTION_CONTRACT

## Guardrails for Coder tasks

- Every task must include the exact file path(s) allowed to change.
- Default: single-file only.
- If the assistant UI shows “N files changed” and N > allowed, user must Undo (do not Apply).
- Require workflow checks:
  - pre: git status
  - post: git diff --name-only
- Cloud agent policy:
  - Prefer Local mode for surgical edits; do not include uncommitted changes in cloud agent runs.
- Evidence rule:

  ## Smoke-First Verification Rule

  For any calibration-flow task (UI, routing, state machine integration), coder must run the calibration smoke script and paste final output showing:

    COMPUTE_ALIGNMENT_OUTPUT -> TERMINAL_COMPLETE -> hasResult=true

  Coder may not claim “fixed” unless smoke is green OR task is explicitly “docs-only”.

  ## Wall / Progress Signaling

  If a command is running and no output for >90 seconds, coder must print a status line:

    [RUNNING] <what it’s doing>

  If blocked, coder must print:

    [BLOCKED] <error> + file/line + full terminal output tail

  [DONE] only when acceptance evidence is pasted.

## Remote Visibility Rule
- PM/assistant can only act on files that are committed and pushed to GitHub.
- Any “task complete” report MUST include: branch name, commit hash, and push/PR link (as applicable).

## Divergence / Non-fast-forward Playbook
- If push is rejected (non-fast-forward): do NOT keep rebasing the same diverged branch.
- Preferred recovery: create a new branch from the remote tip, cherry-pick the local fix commit(s), push, open PR.
- Explicit stop condition: if rebase produces conflicts in Bootstrap/*, abort and use the recovery branch approach.

## Coder Task Templates
### Anti-JSON Guardrail (Bad Unicode escape)

To prevent JSON parsing failures (e.g., Bad Unicode escape) in Coder handoff:

1. Always paste Coder tasks as PLAIN TEXT inside a fenced block using:
  ```text
  [your task here]
  ```
2. Never paste Windows paths (e.g., C:\Users\...) or any backslash sequences directly into JSON or tool-input fields.
3. If a task must include a path, use forward slashes (/) or wrap the path in a plain text block.
4. If you see a JSON error referencing "Bad Unicode escape", check for stray backslashes and reformat as plain text.

### 1. Runtime/Integration Task Template
```
TASK: [Describe the runtime/integration task]

REQUIREMENTS:
- Local dev test loop (npm run dev)
- Reproduce bug or feature
- Verify fix (no build errors, UI/endpoint works)
- Evidence payload REQUIRED if failing:
  - URL/port used
  - Endpoint/method
  - Status code
  - Response body
  - Terminal stack trace
```

### 2. Core Logic Task Template
```
TASK: [Describe the core logic task]

REQUIREMENTS:
- Regression/unit tests pass
```

## Production Stability Rule (2026-03-08)

Production stability comes first. Feature expansion is blocked until stable beta is intentionally frozen and scoring credibility issues are resolved.

- Do not start Phase 2 overlay/list scoring tasks until scoring credibility issues (#25, #26) are resolved and PM explicitly unblocks.
- Do not merge experimental scoring or extension changes into main without PM approval.
- Production web app (`https://www.caliber-app.com`) must remain the stable beta build.

## Environment Separation Rule (2026-03-08)

Production and development environments are hard-separated. No fallback between hosts.

- Production extension must only target `https://www.caliber-app.com`. No localhost contact.
- Dev extension must only target `http://localhost:3000`. No production contact.
- No multi-host fallback arrays or endpoint discovery logic in extension code.
- If any code change reintroduces cross-environment host permissions or fallback behavior, treat as a regression.
- See `ENVIRONMENT_SPLIT.md` for operator instructions and build details.

## PM/Coder Sequencing Guardrail (2026-03-08)

Locked task order for current phase:
1. Scoring calibration / credibility (Jen + Fabio)
2. Bottom line / explanation polish (only as needed for beta credibility)
3. Maintain stable beta on production
4. Extension trust UX (active job identity in sidecard)
5. Phase 2 overlay/list scoring — deferred until PM explicitly unblocks

Do not skip ahead in this sequence. If a later task is attempted before earlier tasks are resolved, flag it and stop.
