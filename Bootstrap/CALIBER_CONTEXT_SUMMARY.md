# CALIBER_CONTEXT_SUMMARY

## Project Status (2026-03-05)

Calibration flow runs end-to-end: resume upload → prompt answers → title recommendations → job paste → fit score + results. All steps render on a single /calibration page with no navigation away. Backend smoke reaches TERMINAL_COMPLETE with result. Vercel auto-deploys from main.

## Current UI Behavior (2026-03-05)

- **Titles screen:** Archetype header label; max 3 titles shown (high-alignment only); clean dropdown — no collapsed summary preview; expand for summary + mechanism bullets (left-aligned, bold); copy button per title. No "Search in parallel" chips.
- **Title scoring:** Strong profiles → top 3 titles with scores ≥7 (at least one ≥8). Weak/generic/thin input → hard cap at ≤5.0; smoke tests enforce both bands.
- **Unified screen:** Titles + job paste area on the same screen. Running a job replaces only the job textarea area with an inline Fit accordion; titles remain visible above.
- **Fit accordion:** "Supports the fit" bullets + "Stretch factors" (growth framing) + "Bottom line" (1–2 sentences, doctrine-tight, score-band templates). Fit score rendered prominently (centered, larger).
- **Controls:** "Try another job" resets only the job area (titles stay). No Restart button.
- **Extension-first CTA:** Above the job textarea — 3-line centered layout: green button "Try our browser extension for LinkedIn or Indeed" → "or" → "Paste job description below". Links to /extension landing page.
- **Dialogue panel:** Removed. No clarifications chat below titles.

## Known Pain Points

- Bottom line paragraph can repeat phrases from stretch bullets verbatim — stretchLabel() de-dup partially mitigates but not fully doctrine-tight yet.
- Browser extension MVP not yet built (landing page only).

## Next Tasks (in order)

1. Bottom line doctrine polish: reduce repetition across stretch bullets + bottom paragraph (anti-repetition / paraphrase rule).
2. Browser extension MVP: LinkedIn + Indeed extraction, extension-first funnel, ads in extension UI.
3. Post-score LLM dialogue mode toggle (deferred).
