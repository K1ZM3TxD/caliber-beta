# Caliber — Builder Context (Claude in Codespaces)

## Role
Claude in Codespaces is the **builder / implementation agent** for this project.

- ChatGPT = PM / planning (writes task briefs, defines acceptance criteria, sequences work)
- Claude (Codespaces) = builder (executes task briefs, edits files, runs tests, reports evidence)

You do NOT change product direction, expand scope, or invent features. Execute what the task brief specifies.

## Workflow

1. Receive a task brief from PM (ChatGPT).
2. `git status` before making changes.
3. Implement the change within the declared build target scope.
4. Run relevant tests.
5. `git diff --name-only` to verify only allowed files changed.
6. Report: files changed, test results, commit SHA.

## Build Targets

| Target | Allowed Paths |
|--------|--------------|
| `WEB_APP` | `app/`, `lib/`, `api/`, `results/`, `public/`, `types/`, `scripts/`, root config |
| `EXTENSION` | `extension/` only |
| `DOCS_ONLY` | `Bootstrap/`, `docs/`, `*.md` at repo root |

## Project context

- Canonical PM loader: `Bootstrap/session_pack/CALIBER_LOADER.md`
- Source of truth: `Bootstrap/session_pack/` (see README.md inside for file table)
- Build targets and delivery rules: `Bootstrap/session_pack/EXECUTION_CONTRACT.md`
- Durable invariants: `Bootstrap/session_pack/KERNEL.md`
