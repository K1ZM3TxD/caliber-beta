# Caliber — MILESTONES
(Updated: Cloud Reset + 6.x Complete)

This document defines active execution runway.

For philosophy → CALIBER_DOCTRINE.md  
For enforcement → KERNEL.md  

---

# CURRENT STATE SUMMARY

Canonical branch: `copilot/work`  
Canonical environment: GitHub Codespaces  

Local development is no longer authoritative.

---

# 6.x — Anchor Enforcement Stack (COMPLETE)

6.0 — Deterministic Anchor Extraction  
Status: COMPLETE

6.1 — Overlap Enforcement + Retry Logic  
Status: COMPLETE

6.2 — Signal/Skill Classification + Weighted Scoring  
Status: COMPLETE
  - Deterministic signal vs skill classification: resume-only anchors never become signal; signal requires breakdown + distinct context.
  - Caps: signalAnchors max 10, skillAnchors max 14.
  - Scoring outputs: signalAlignment (0–100), skillCoverage (0–100), compositeAlignment (0–100 adaptive blend), stretchLoad (0–100 weighted missing anchors).
  - Structural Note branch: triggers if signalAlignment ≤ 40 AND skillCoverage ≥ 70 (parallel branch).
  - Observability: single-line log includes all new metrics, emitted once per scoring attempt.

6.3 — Explicit Validator Outcome Matrix  
Status: COMPLETE

  6.0.x / 6.1.x: Anchor extraction now applies a deterministic GENERIC_ANCHOR_BANLIST filter (in addition to stopwords) to remove generic/boilerplate/education/business filler from anchors.

6.4 — Observability Upgrade  
Status: COMPLETE

  Job Description ingest: INCOMPLETE_DIMENSION_COVERAGE is surfaced as missingDimensions labels in API + UI error box. Lexical coverage broadened for: structuralMaturity, roleAmbiguity, breadthVsDepth (lexical only; no semantic inference).

  Job Description ingest: INCOMPLETE_DIMENSION_COVERAGE is surfaced as missingDimensions labels in API + UI error box. Lexical coverage broadened for: structuralMaturity, roleAmbiguity, breadthVsDepth (lexical only; no semantic inference).

All 6.x logs deterministic.  
Fallback_reason implemented.  
Blacklist precedence codified.  

---

# 7.0 — Bullet Grounding Extension (IN PROGRESS)

Phase 7.0a — OperateBest Validator Scaffold  
Status: COMPLETE

- validateOperateBestBullets implemented
- Shared enforcement stack
- bullet_group logging
- Guard coverage exists

Phase 7.0b — OperateBest Runtime Wiring  
Status: NEXT

- Attach validator to real generation path
- Preserve retry + fallback logic
- Emit operateBest log lines
- Do not touch loseEnergy yet

Phase 7.0c — loseEnergy Grounding  
Status: BLOCKED (until operateBest stable)

---

# UI Surface Stabilization (COMPLETE)

- Removed user-visible “Prompt” label
- Typewriter effect applied to:
  - Question text
  - Clarifier text
  - Generated outputs
- Reduced-motion respected
- No logic changes

Mock-calibration remains archived candidate (future cleanup).

# UI/UX Flow (2026)

- JOB_INGEST and ALIGNMENT_OUTPUT states now auto-advance and auto-compute, showing "Computing ..." states in the UI. Duplicate event prevention is enforced via ref-based locks.

---

# WORKFLOW RESET (COMPLETE)

- Codespaces adopted as canonical dev environment
- copilot/work created as canonical branch
- persist-anchor-metrics merged into copilot/work
- Lockfile aligned to Codespaces

No further local/agent branch drift allowed.

---

## 7.0b — Guard Scope Stabilization (In Progress)

- Calibration prompt guard currently scans archived docs.
- Policy decision: exclude Bootstrap/Archive/** from guard scope.
- Runtime logic must remain untouched.
- No enforcement weakening allowed.

# NEXT EXECUTION STEPS

1. Wire operateBest validation into live calibration flow
2. Emit bullet_group logs during runtime
3. Confirm fallback behavior visible in logs
4. Stabilize operateBest output quality
5. Archive mock-calibration route cleanly
6. Prepare for merge of copilot/work → main (post-stabilization)

---

# Definition of Completion (7.x)

- operateBest enforced identically to 3-line synthesis
- Logs deterministic
- No abstraction drift
- No silent branches
- No cross-engine blending
- Output mechanically specific

“Feels right” is not completion.
Anchor metrics confirm grounding.

---

Execution continues from stable enforcement base.