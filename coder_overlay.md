# CODER ROOTBOOT — CALIBER



Read before any task. Doctrine: project\_kernel.md. Runway: milestones.md. Truth: state.md.

## Environment

* OS: Windows | Shell: PowerShell 5 | npm | Next.js (App Router) | TypeScript
* Repo root: C:\\users\\green\\caliber-beta
* Dev (when needed): npx next dev --webpack
* Single Next.js project at repo root. No nested roots.

## Canon Structure

* One shared library folder ONLY: /lib (NO /app/lib)
* API routes are thin wrappers only.
* scripts/ allowed only for temporary validation runners.

## Canon Modules

* Orchestration (canonical): lib/integration\_seam.ts
* Engines (authoritative): lib/job\_ingest.ts, lib/skill\_match.ts, lib/stretch\_load.ts
* Public contract (frozen): lib/result\_contract.ts (version "v1")
* API route: app/api/job-ingest/route.ts (thin wrapper)

## Non-Negotiables

* Metrics are never blended: alignment, skillMatch, stretchLoad stay separate.
* Stretch Load is derived only by its engine (inverse of Skill Match); never recompute.
* No reinterpretation, no emotional framing, no derived/composite scores.
* All API responses are JSON only (no HTML 500). Errors normalized: { ok:false, error:{ code, message } }.

## Execution Rules

* Work only within the active milestone 
* Full-file rewrites for any modified/created file (no diffs) unless explicitly asked.
