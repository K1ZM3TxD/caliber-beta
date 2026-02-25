# BREAK_UPDATE_RITUAL.md

Purpose:
Keep Caliber governance and execution state coherent across PM chat reboots and coder cycles.
Guarantee clean diffs in and out of core docs.

Authority Order (for edits):
1. CALIBER_DOCTRINE.md — philosophy/identity only (rarely edited)
2. KERNEL.md — enforcement mechanics only
3. MILESTONES.md — sequencing + status only
4. PROJECT_OVERVIEW.md — repo-level contract only
5. PM_BOOTSTRAP.md — PM reboot entrypoint only

Non-Negotiables:
- No multi-file “cleanup” commits.
- No speculative refactors.
- Every doc change must be justified by an observable gap.
- If execution diverges from doctrine, execution changes — not doctrine.

Ritual A — BEFORE BREAK (PM)
Goal: freeze state so the next session resumes without ambiguity.

A1) Update MILESTONES.md
- Mark the just-finished milestone as COMPLETE (only if tests/DoD met).
- Add the next milestone as NEXT / ACTIVE.
- Add a 1–3 line “Observed” note only if it changes execution.
Rules:
- No prose expansion.
- No reformatting.
- No retroactive history rewrite.

A2) Update KERNEL.md (only if enforcement mechanics changed)
- Add/adjust only the mechanical rule(s) that changed.
- No philosophical rewrites.
- Preserve structural invariants and logging contracts.

A3) Update PROJECT_OVERVIEW.md (only if runtime/tooling contract changed)
- Document module resolution/test runner/runtime contract changes.
- Keep it short and declarative.

A4) Update PM_BOOTSTRAP.md (only if reboot procedure changed)
- Keep it minimal.
- Ensure reboot procedure points to the correct canonical docs.

Ritual B — AFTER CODER DELIVERY (PM Review → Doc Update)
Goal: record reality with minimal diffs.

B1) Verify
- Confirm acceptance criteria are met.
- Confirm tests pass (deterministic where required).
- Confirm no scope creep.

B2) Record
- Update ONLY the doc that owns the change:
  - Enforcement change → KERNEL.md
  - Sequencing/status change → MILESTONES.md
  - Repo/tooling contract change → PROJECT_OVERVIEW.md
  - PM reboot procedure change → PM_BOOTSTRAP.md
  - Philosophy change → CALIBER_DOCTRINE.md (rare)

B3) Diff discipline (required)
- One “topic” per commit.
- No whitespace-only edits.
- No formatting-only edits.
- Keep edits localized (smallest possible section).

Ritual C — CHAT REBOOT (PM)
Goal: re-anchor authority without pasting.

1) Load: CALIBER_DOCTRINE.md, KERNEL.md, MILESTONES.md, PROJECT_OVERVIEW.md, PM_BOOTSTRAP.md
2) Confirm current ACTIVE milestone in MILESTONES.md
3) Continue in PM mode only:
   - maintain structure + sequencing
   - write coder tasks
   - approve/deny based on doctrine/kernel + tests

---
