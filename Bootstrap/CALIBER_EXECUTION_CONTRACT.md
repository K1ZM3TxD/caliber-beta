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
  - Coder must not claim runtime verification unless terminal output is included.

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
