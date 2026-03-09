# CALIBER_SYSTEM.md — Canonical System Loader

## Purpose
This file is the single entry point for loading the Caliber project context into a new chat. Load this file to activate PM mode or to orient any assistant session.

## Activation
Loading this file by any mechanism (filename, repo path, GitHub URL, file attachment) counts as **immediate system activation**.

### On activation:
1. **Do NOT summarize this file to the user.** It is an instruction set, not a document to present.
2. **Load the files below in order**, directly from the repo workspace.
3. **Output only the PM initialization summary:** (a) project goal, (b) current state, (c) next PM decision needed.
4. **Continue in PM mode** per `Bootstrap/PM_bootstrap.md` operating rules.

Only ask the user to paste file contents if repo file reading fails.

---

## Load Order

### Layer 1 — Active State (load first)
These files tell you where things stand right now.

| # | File | Purpose |
|---|------|---------|
| 1 | `Bootstrap/CALIBER_ACTIVE_STATE.md` | Current phase, top blocker, locked task order, next decision |
| 2 | `Bootstrap/CALIBER_ISSUES_LOG.md` | Open issues, active work, resolved items |

### Layer 2 — Stable Doctrine (load second)
These files tell you what the product is and how it works.

| # | File | Purpose |
|---|------|---------|
| 3 | `PROJECT_OVERVIEW.md` | Intended product behavior and UX contracts |
| 4 | `Bootstrap/CALIBER_EXECUTION_CONTRACT.md` | Delivery rules and execution constraints |
| 5 | `Bootstrap/kernel.md` | Durable invariants and enforcement mechanics |

### Layer 3 — PM Instructions (load last)
| # | File | Purpose |
|---|------|---------|
| 6 | `Bootstrap/PM_bootstrap.md` | PM role, operating rules, coder handoff template |

### Conditional (load only when relevant)
- `Bootstrap/CALIBER_CONTEXT_SUMMARY.md` — full project history, session decisions, Phase-2 UX contract. Load when deep context is needed beyond active state.
- `Bootstrap/BREAK_AND_UPDATE.md` — when preparing or reviewing a BREAK+UPDATE pass.
- `Bootstrap/milestones.md` — when reviewing sprint progress or sequencing work.

---

## Source-of-Truth Hierarchy

| Question | Source |
|----------|--------|
| What is the product supposed to do? | `PROJECT_OVERVIEW.md` |
| What is happening right now? | `Bootstrap/CALIBER_ACTIVE_STATE.md` |
| What issues are open? | `Bootstrap/CALIBER_ISSUES_LOG.md` |
| What are the execution rules? | `Bootstrap/CALIBER_EXECUTION_CONTRACT.md` |
| What invariants must hold? | `Bootstrap/kernel.md` |
| Full project history and decisions? | `Bootstrap/CALIBER_CONTEXT_SUMMARY.md` |

> **Rule of thumb:** If you're unsure whether something is _intended_ vs _actual_, check `PROJECT_OVERVIEW.md` for intended and `CALIBER_ACTIVE_STATE.md` for actual. Don't rediscover product behavior from code.
