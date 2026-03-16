# CALIBER_EXECUTION_CONTRACT

## Build Target Declaration Rule (source of truth)

Every coder task MUST declare exactly one build target:

| Target | Scope | Allowed paths |
|--------|-------|----------------|
| `WEB_APP` | Next.js web application | `app/`, `lib/`, `api/`, `results/`, `public/`, `types/`, `scripts/`, config files at repo root |
| `EXTENSION` | Browser extension | `extension/` only |
| `DOCS_ONLY` | Documentation / Bootstrap | `Bootstrap/`, `*.md` at repo root, `docs/` |

### Hard boundaries

- **Coder may NOT touch files outside the declared target.** If an edit is needed outside scope, stop and escalate to PM.
- **WEB_APP tasks:** `extension/` packaging, build, and manifest files are out of scope unless the task explicitly names them.
- **EXTENSION tasks:** Testing and building must use the **current `extension/` folder** build only. Do not reference, build, or test against stale root-level zip artifacts or any artifact outside `extension/`. The canonical production host is `https://www.caliber-app.com`; dev host is `http://localhost:3000`. See `ENVIRONMENT_SPLIT.md` and the **Extension Build Host Rule** below. Production builds must NEVER contain localhost references in `env.js`, `manifest.json`, or any runtime code.
- **DOCS_ONLY tasks:** No runtime code changes permitted.

If a task omits the target declaration, PM must add it before handoff. Coder must reject any task that lacks a declared target.

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

## Environment Separation Rule (2026-03-08, hardened 2026-03-16)

Production and development environments are hard-separated. No fallback between hosts.

- Production extension must only target `https://www.caliber-app.com`. No localhost contact.
- Dev extension must only target `http://localhost:3000`. No production contact.
- No multi-host fallback arrays or endpoint discovery logic in extension code.
- If any code change reintroduces cross-environment host permissions or fallback behavior, treat as a regression.
- See `ENVIRONMENT_SPLIT.md` for operator instructions and build details.

### Extension Build Host Rule (2026-03-16)

> **Production extension builds must point to `https://www.caliber-app.com`.**
> **Localhost endpoints are only allowed for explicitly declared development builds.**

This applies to ALL extension artifacts shipped to users:
- `extension/env.js` → `API_BASE` must be `https://www.caliber-app.com`
- `extension/manifest.json` → `host_permissions` and `content_scripts[].matches` must reference `https://www.caliber-app.com/*`, not `http://localhost:*`
- `extension/manifest.json` → `name` must not contain `[DEV]`

**Enforcement:** Before any extension zip is built for distribution:
1. Verify `extension/env.js` contains `API_BASE: "https://www.caliber-app.com"`
2. Verify `extension/manifest.json` contains no `localhost` references
3. If either check fails, fix before building the zip

**Violation = regression.** Any production extension build containing localhost endpoints is a shipping defect.

## PM/Coder Sequencing Guardrail (2026-03-08)

Locked task order for current phase:
1. Scoring calibration / credibility (Jen + Fabio)
2. Bottom line / explanation polish (only as needed for beta credibility)
3. Maintain stable beta on production
4. Extension trust UX (active job identity in sidecard)
5. Phase 2 overlay/list scoring — deferred until PM explicitly unblocks

Do not skip ahead in this sequence. If a later task is attempted before earlier tasks are resolved, flag it and stop.

## Extension Development Rules (2026-03-11)

The following rules apply to **any coder task that modifies the browser extension** (`extension/` scope). These are PM contract requirements — every extension task must satisfy them before it can be marked complete.

### Rule 1 — Extension Build Sync

If a coder task modifies the browser extension in any way, the task is **not complete** until:

1. The extension is rebuilt/packaged from the latest source.
2. The downloadable extension hosted on the website is updated to that new build.
3. The coder verifies the website is serving the current extension artifact, not a stale build.

**Return requirements** for any extension task must include:

- Confirmation that the downloadable extension was updated.
- Path/location of the served extension artifact.
- Confirmation that it matches the latest source commit.

### Rule 2 — Extension Session Handshake Validation

Any change touching extension session, storage, or messaging logic must verify the following flows before the task is considered complete:

- Extension installed **after** calibration is complete.
- Extension installed **with** a Caliber tab already open.
- Extension installed **with no** Caliber tab open.
- Extension reconnect **after browser restart**.

The coder must confirm the extension can discover or restore the active session in all four scenarios.

### Rule 3 — Side-Card Stability Requirement

Any task modifying the extension UI must verify:

- Collapsed sidecard height remains stable.
- Card expansion occurs only when dropdown sections open.
- Layout does not resize unexpectedly across different job scores.
- Strong / Stretch / Weak (Skip) states render consistently.

### Rule 4 — Extension Task Completion Standard

Tasks touching extension code are **not complete** until all of the following are confirmed:

- Extension builds cleanly.
- Website download artifact is updated.
- Session handshake verified (per Rule 2).
- UI stability verified (per Rule 3).
