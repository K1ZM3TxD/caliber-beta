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
- All tasks handed to Coder must be in a single fenced code block (black paste box only, no commentary).
