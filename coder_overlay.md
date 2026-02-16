# CODER ROOTBOOT — CALIBER (Condensed)

Read before any task. Doctrine: project_kernel.md. Runway: milestones.md. Truth: state.md.

## Environment
- OS: Windows | Shell: PowerShell 5 | npm | Next.js (App Router) | TypeScript
- Repo root: C:\users\green\caliber-beta
- Dev (when needed): npx next dev --webpack
- Single Next.js project at repo root. No nested roots.

## Canon Structure
- One shared library folder ONLY: /lib (NO /app/lib)
- API routes are thin wrappers only.
- scripts/ allowed only for temporary validation runners.

## Canon Modules
- Orchestration (canonical): lib/integration_seam.ts
- Engines (authoritative): lib/job_ingest.ts, lib/skill_match.ts, lib/stretch_load.ts
- Public contract (frozen): lib/result_contract.ts (version "v1")
- API route: app/api/job-ingest/route.ts (thin wrapper)

## Non-Negotiables
- Metrics are never blended: alignment, skillMatch, stretchLoad stay separate.
- Stretch Load is derived only by its engine (inverse of Skill Match); never recompute.
- No reinterpretation, no emotional framing, no derived/composite scores.
- All API responses are JSON only (no HTML 500). Errors normalized: { ok:false, error:{ code, message } }.

## Execution Rules
- Work only within the active milestone (currently: 4.3 — Viewer Upgrade).
- Minimal, intentional changes only. No refactors outside task.
- Full-file rewrites for any modified/created file (no diffs) unless explicitly asked.