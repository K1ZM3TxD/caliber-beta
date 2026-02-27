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
# CALIBER_EXECUTION_CONTRACT

## Coder Task Templates

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
- Deterministic behavior confirmed
- No dev server loop required
```

---


**Guidance:**
- Use Runtime/Integration template for any task requiring UI, endpoint, or runtime validation.
- Use Core Logic template for pure logic, algorithm, or test-driven tasks.
- Direct file modification is expected; Coder must not require user to paste code.
- After each change, Coder must run tests and report:
  - Summary of files changed
  - Test results
  - If failing: exact error and blocking reason
- Minimal surface change, no speculative refactors, one task only, scope discipline.
