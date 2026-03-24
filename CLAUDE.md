# Caliber — Claude Code Setup

This repo uses a two-role separation for Claude Code: **planner** and **implementer**.

## Roles

| Role | Agent | Command | Does | Does NOT |
|------|-------|---------|------|----------|
| **PM Planner** | `pm-planner` | `/plan` | Break work into tasks, define acceptance criteria, call out risks | Edit code, run tests, make implementation decisions |
| **Implementer** | `implementer` | `/build` | Edit files, run tests, report results with evidence | Change roadmap, expand scope, invent product decisions |

## Usage

**Planning a feature or fix:**
```
/plan Add a retry mechanism to the tailor export endpoint
```
→ Produces a scoped task brief with target, acceptance criteria, and file list.

**Executing a task brief:**
```
/build <paste or reference the task brief>
```
→ Implements the change, runs tests, reports evidence.

## Interaction pattern

1. Start with `/plan` to scope the work.
2. Review the task brief — adjust if needed.
3. Hand off to `/build` to execute.
4. Review results and iterate.

For simple, single-file changes you can skip planning and go straight to `/build`.

## Project context

- Bootstrap docs in `Bootstrap/` are the source of truth for project state and rules.
- Build targets (`WEB_APP`, `EXTENSION`, `DOCS_ONLY`) enforce file-scope boundaries.
- See `Bootstrap/CALIBER_EXECUTION_CONTRACT.md` for delivery rules.
