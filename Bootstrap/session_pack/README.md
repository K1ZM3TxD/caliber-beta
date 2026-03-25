# Caliber PM Session Pack

This folder is the single authoritative reload bundle for new PM chat sessions.

---

## How to start a new PM chat

**Load one file. That's it.**

Point the new chat at:

```
Bootstrap/session_pack/CALIBER_LOADER.md
```

Acceptable trigger formats (any of these works):
- Workspace file path: `Bootstrap/session_pack/CALIBER_LOADER.md`
- Repo-relative path: `Bootstrap/session_pack/CALIBER_LOADER.md`
- GitHub URL: `https://github.com/K1ZM3TxD/caliber-beta/blob/main/Bootstrap/session_pack/CALIBER_LOADER.md`
- Attach or paste the file contents into the chat

The loader file activates PM mode and specifies the exact load order for the remaining pack files.

---

## What's in this pack

| File | Status | Purpose |
|------|--------|---------|
| `Bootstrap/session_pack/CALIBER_LOADER.md` | **REQUIRED — LOAD FIRST** | Entry point. Triggers PM mode, defines load order. |
| `ACTIVE_STATE.md` | **REQUIRED** | Current phase, open gates, top blocker, next decision. |
| `ISSUES_LOG.md` | **REQUIRED** | Open issues, active work, recently resolved. |
| `EXECUTION_CONTRACT.md` | **REQUIRED** | Build targets, delivery rules, hard boundaries. |
| `KERNEL.md` | **REQUIRED** | Durable invariants and enforcement mechanics. |
| `PROJECT_OVERVIEW.md` | **REQUIRED** | Intended product behavior and UX contracts. |
| `PM_BOOTSTRAP.md` | **REQUIRED** | PM role definition and operating rules. |
| `CONTEXT_SUMMARY.md` | **CONDITIONAL** | Full project history. Load when deep history is needed. |

**Required** = load in every new PM chat.  
**Conditional** = load only when deep historical context is needed for the current task.

---

## Source-of-truth hierarchy

| Question | File in this pack |
|----------|------------------|
| What is the product supposed to do? | `PROJECT_OVERVIEW.md` |
| What is happening right now? | `ACTIVE_STATE.md` |
| What issues are open? | `ISSUES_LOG.md` |
| What are the execution rules? | `EXECUTION_CONTRACT.md` |
| What invariants must hold? | `KERNEL.md` |
| PM role and operating rules? | `PM_BOOTSTRAP.md` |
| Full project history? | `CONTEXT_SUMMARY.md` (conditional) |

---

## Root-level compatibility stubs

Files in `Bootstrap/` and the repo root that previously served as reload entry points now contain thin redirect stubs pointing here. Those stubs exist for compatibility but are **not** authoritative — always use the session pack files directly for new chats.

Redirect stubs:
- `CALIBER_SYSTEM.md` (repo root) → redirects to `Bootstrap/session_pack/CALIBER_LOADER.md`
- `Bootstrap/PM_bootstrap.md` → redirects to `Bootstrap/session_pack/CALIBER_LOADER.md`

The authoritative content for all these files lives inside this folder.

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
