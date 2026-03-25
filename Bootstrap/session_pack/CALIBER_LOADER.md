# CALIBER_LOADER.md — Canonical PM Session Loader

## Trigger

Any of the following activates PM mode:
- File path `Bootstrap/session_pack/CALIBER_LOADER.md` appears in a user message
- This file is explicitly attached or loaded
- A GitHub URL pointing to this file is present in a user message
- The phrase **"Load CALIBER system"** appears in a user message

---

## Activation Instructions (for the assistant)

1. **Do NOT summarize or describe this file.** It is an instruction set, not a document to present.
2. **Load the files below in the exact order specified.** Read them directly from the repo workspace. Ask the user to paste content only if a repo file cannot be read.
3. **Assume the PM role for the Caliber project.** All responses follow the operating rules in `Bootstrap/session_pack/PM_BOOTSTRAP.md`.
4. **After loading, output only the PM initialization summary using this exact format:**

```
Project Goal:
<single concise paragraph>

Current State:
<derived from ACTIVE_STATE.md and ISSUES_LOG.md>

Next PM Decision Required:
<one actionable PM decision>
```

5. Continue in PM mode per `PM_BOOTSTRAP.md` operating rules.

---

## Load Order

### Layer 1 — Active State (load first)

| # | File | Purpose |
|---|------|---------|
| 1 | `Bootstrap/session_pack/ACTIVE_STATE.md` | Current phase, open gates, top blocker, next decision |
| 2 | `Bootstrap/session_pack/ISSUES_LOG.md` | Open issues, active work, recently resolved |

### Layer 2 — Stable Doctrine (load second)

| # | File | Purpose |
|---|------|---------|
| 3 | `Bootstrap/session_pack/PROJECT_OVERVIEW.md` | Intended product behavior and UX contracts |
| 4 | `Bootstrap/session_pack/EXECUTION_CONTRACT.md` | Build targets, delivery rules, hard boundaries |
| 5 | `Bootstrap/session_pack/KERNEL.md` | Durable invariants and enforcement mechanics |

### Layer 3 — PM Instructions (load last)

| # | File | Purpose |
|---|------|---------|
| 6 | `Bootstrap/session_pack/PM_BOOTSTRAP.md` | PM role, operating rules, coder handoff template |

### Conditional (load only when relevant)

- `Bootstrap/session_pack/CONTEXT_SUMMARY.md` — full project history and session decisions. Load when deep context is needed beyond active state.
- `Bootstrap/BREAK_AND_UPDATE.md` — when preparing or reviewing a BREAK+UPDATE pass.
- `Bootstrap/milestones.md` — when reviewing sprint progress or sequencing work.

---

## Source-of-Truth Hierarchy

| Question | File |
|----------|------|
| What is the product supposed to do? | `Bootstrap/session_pack/PROJECT_OVERVIEW.md` |
| What is happening right now? | `Bootstrap/session_pack/ACTIVE_STATE.md` |
| What issues are open? | `Bootstrap/session_pack/ISSUES_LOG.md` |
| What are the execution rules? | `Bootstrap/session_pack/EXECUTION_CONTRACT.md` |
| What invariants must hold? | `Bootstrap/session_pack/KERNEL.md` |
| PM role + operating rules? | `Bootstrap/session_pack/PM_BOOTSTRAP.md` |
| Full project history? | `Bootstrap/session_pack/CONTEXT_SUMMARY.md` (conditional) |

> **Rule of thumb:** If you're unsure whether something is _intended_ vs _actual_, check `PROJECT_OVERVIEW.md` for intended and `ACTIVE_STATE.md` for actual. Don't rediscover product behavior from code.

---

## Why this file exists

The full repo is too large and too noisy for reliable PM context reloads. This pack is the minimum authoritative bundle. Starting from this loader guarantees a deterministic, complete PM context load without depending on broad repo scanning.

---

## Workflow Roles

| Role | Tool | Responsibility |
|------|------|----------------|
| **PM / Planning** | ChatGPT | Write scoped task briefs, define acceptance criteria, sequence work, track risks. Does NOT edit code. |
| **Builder / Implementation** | Claude (Codespaces) | Execute task briefs, edit files, run tests, report evidence. Does NOT change product direction. |

## Release Model

| Branch | Role |
|--------|------|
| `main` | Development iteration + Vercel preview deploys |
| `stable` | Production — Vercel auto-deploys to `caliber-app.com` |

**Promotion path:** validate on `main` → merge/fast-forward to `stable` → Vercel deploys to production.
