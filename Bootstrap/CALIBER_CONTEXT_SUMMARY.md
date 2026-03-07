# CALIBER_CONTEXT_SUMMARY

## Project Status (2026-03-06)

Calibration flow runs end-to-end: resume upload → prompt answers → title recommendations → job paste → fit score + results. All steps render on a single /calibration page with no navigation away. Backend smoke reaches TERMINAL_COMPLETE with result. Vercel auto-deploys from main.

**Extension Phase 1 MVP: VERIFIED WORKING (2026-03-06).** The Chrome extension extracts job descriptions from LinkedIn job detail pages and calls the production API at `https://www.caliber-app.com/api/extension/fit`. The popup renders a fit score (confirmed live: 4.3/10 screenshot), supports-fit bullets, stretch factors, bottom line, and Recalculate / Open in Caliber actions.

## Current UI Behavior (2026-03-05)

- **Titles screen:** Archetype header label; max 3 titles shown (high-alignment only); clean dropdown — no collapsed summary preview; expand for summary + mechanism bullets (left-aligned, bold); copy button per title. No "Search in parallel" chips.
- **Title detail (enriched):** Each title row is expandable when enriched data exists (`summary_2s` + `bullets_3`). Expanded state shows a ~2-sentence summary and three mechanism-level bullet points. Titles without enrichment render as flat rows with score and copy only (dot indicator, not clickable). This is canonical product behavior — see `PROJECT_OVERVIEW.md`.
- **Title scoring:** Strong profiles → top 3 titles with scores ≥7 (at least one ≥8). Weak/generic/thin input → hard cap at ≤5.0; smoke tests enforce both bands.
- **Unified screen:** Titles + job paste area on the same screen. Running a job replaces only the job textarea area with an inline Fit accordion; titles remain visible above.
- **Fit accordion:** "Supports the fit" bullets + "Stretch factors" (growth framing) + "Bottom line" (1–2 sentences, doctrine-tight, score-band templates). Fit score rendered prominently (centered, larger).
- **Controls:** "Try another job" resets only the job area (titles stay). No Restart button.
- **Extension-first CTA:** Above the job textarea — 3-line centered layout: green button "Try our browser extension for LinkedIn or Indeed" → "or" → "Paste job description below". Links to /extension landing page.
- **Dialogue panel:** Removed. No clarifications chat below titles.

## Known Pain Points

- Bottom line paragraph can repeat phrases from stretch bullets verbatim — stretchLabel() de-dup partially mitigates but not fully doctrine-tight yet.
- Extension popup explanation content/rendering is still sparse or incomplete in some runs.
- Sister-profile run produced only one low-scoring title with no three options/dropdown (saved issue).
- Must keep repo/main and extension packaging flow aligned so testing does not drift from source of truth.

## Extension Phase 1 — Working Assumptions

- Extension must use one canonical production host consistently: `https://www.caliber-app.com`.
- Testing must use the current `extension/` folder build, not stale root zip artifacts.
- Phase 1 validation flow: open LinkedIn job detail page → click Caliber extension → popup returns score.

## Session Decisions (2026-03-07)

- **Calibration results page direction simplified:** intro typewriter lines → title cards → extension CTA. No other summary sections.
- **operateBest / loseEnergy / summary prose block intentionally removed** from the calibration results page flow. These did not land and felt like regurgitated prompt content.
- **Extension is now the primary decision surface** — fit explanations should feel most powerful in the extension, not on the calibration page.
- **Title output quality is an active product concern:** Fabio and Jen profiles produced weak or low-scoring outputs. Title grounding and the 2 + 1 model (2 strong fits + 1 adjacent credible) need improvement.
- **Known need:** improve title grounding to prevent abstract trait drift into unrelated role families.
- **Live extension priority:** persistence + upgraded panel integration stability remain the top extension concerns.
- **Workflow lesson:** multiple parallel extension branches caused renderer/persistence/packaging regressions — only one major extension branch at a time.
- **Documentation rule adopted:** after major PM sessions, create a documentation task before next PM reload.

## Next Tasks (in order)

1. Title grounding / 2 + 1 model improvement: address abstraction drift, improve match quality for Fabio/Jen-type profiles.
2. Bottom line doctrine polish: reduce repetition across stretch bullets + bottom paragraph (anti-repetition / paraphrase rule).
3. Extension Phase 2: listings-page overlay — scores rendered next to job posts on LinkedIn/Indeed.
4. Post-score LLM dialogue mode toggle (deferred).
