# CALIBER_CONTEXT_SUMMARY

## Project Status (2026-03-04)

Calibration flow runs end-to-end: resume upload → prompt answers → title recommendations → job paste → fit score + results. All steps render on a single /calibration page with no navigation away. Backend smoke reaches TERMINAL_COMPLETE with result. Vercel auto-deploys from main.

## Current UI Behavior (2026-03-04)

- **Titles screen:** Archetype header label; list of 4–6 titles with scores (X/10); collapsed rows show 1-line summary preview; expand for full summary + mechanism bullets; copy buttons per title; "Search in parallel" chips for cross-cluster titles.
- **Job calibration:** Paste job description on the same page → spinner → results appear inline on /calibration (no page navigation). Stabilized in 57f1c68.
- **Results card (pinned header):** Shows job title + fit score (0–10) + "Supports the fit" bullets + "Stretch factors" (growth framing) + "Bottom line" (1–2 sentences).
- **Dialogue panel:** "Does this feel accurate?" chat below titles; "Use these clarifications" reruns title scoring additively.

## Known Pain Points

- Title scoring calibration: design/solutions titles often score low; need to ensure multiple high-fit titles can be returned (avoid brittle single-winner behavior).
- Post-score LLM dialogue mode not yet implemented (wander vs constrained toggle pending).
- Routing/polling fragility partially mitigated but still relevant for edge cases.

## Next Tasks (in order)

1. Title scoring quality: calibrate so profiles with clear design/solutions signals get appropriately high scores.
2. Post-score LLM dialogue mode toggle.
3. Fit card wording/format polish pass.
