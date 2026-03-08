# CALIBER_CONTEXT_SUMMARY

## Project Status (2026-03-08)

Calibration flow runs end-to-end: resume upload → prompt answers → title recommendations → job paste → fit score + results. All steps render on a single /calibration page with no navigation away. Backend smoke reaches TERMINAL_COMPLETE with result. Vercel auto-deploys from main.

**Stable Beta — Production/Dev Environment Split Active (2026-03-08).**
- Production web app served from `https://www.caliber-app.com` (Vercel, auto-deployed from main).
- Production extension locked to `https://www.caliber-app.com` only — no localhost contact.
- Dev extension locked to `http://localhost:3000` only — no production contact.
- No host fallback behavior in either extension build.
- Production site + production extension verified working live.
- See `ENVIRONMENT_SPLIT.md` for operator instructions and host permission rules.

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

## Extension — Working Assumptions

- Production extension targets `https://www.caliber-app.com` only. Dev extension targets `http://localhost:3000` only. No fallback between hosts.
- Extension is the real job-fit decision layer — fit explanations should feel most powerful in the extension, not on the calibration page.
- Calibration titles are initial search terms / starting hypothesis, not the full search surface. Real market discovery may require adjacent/expanded titles later.
- Testing must use the current `extension/` folder build (DEV) or `dist/extension-dev/` — never stale zip artifacts.
- Phase 1 validation flow: open LinkedIn job detail page → click Caliber extension → popup returns score.

## Session Decisions (2026-03-08)

- **Stable beta environment split active.** Production and dev are hard-separated at the host-permission level. See `ENVIRONMENT_SPLIT.md`.
- **Roadmap re-sequenced:** scoring credibility and beta stability come before any feature expansion. Phase 2 is explicitly deferred.
- **Product understanding clarified:**
  - Calibration titles are a starting hypothesis / initial search terms, not the complete market-search solution.
  - Extension is the real job-fit decision engine. Fit explanations should feel most powerful in the extension.
  - Real-market search may require adjacent/expanded titles later — this is a known gap, not current scope.
  - Adaptive search suggestions are a later feature.
- **Scoring credibility is the top open issue:**
  - Jen's title family appears directionally correct, but scores are compressed too low (Partnerships Manager 5.3, Account Manager 4.6, Business Development Manager 4.6).
  - Fabio also appears low-scored relative to expected strong-profile behavior.
  - User's own calibration titles score high, but real market jobs found under those terms often score below 6, with rare ~7+. This suggests search-surface and/or job-score weighting issues, not just calibration failure.
- **Calibration results page direction simplified:** intro typewriter lines → title cards → extension CTA. No other summary sections.
- **operateBest / loseEnergy / summary prose block intentionally removed** from the calibration results page flow.
- **Extension sidecard should show active job identity** (job title, company, optional location) for trust.
- **Workflow lesson:** multiple parallel extension branches caused renderer/persistence/packaging regressions — only one major extension branch at a time.
- **Documentation rule adopted:** after major PM sessions, create a documentation task before next PM reload.

### Phase 2 Direction (Deferred — not current scope)

- Persistent LinkedIn results-list overlay with score badges on job cards.
- Sidebar becomes decision console / summary layer.
- Clicked job controls active sidebar details.
- Possible next/previous navigation later.
- Preview-text scoring: experiment only, after beta stability.

## Next Tasks (locked order)

1. **Scoring calibration / credibility** — fix score compression for Jen and Fabio profiles; investigate why real market jobs under calibrated titles score mostly below 6.
2. **Bottom line / explanation polish** — only as needed for beta credibility (anti-repetition / paraphrase rule).
3. **Maintain stable beta on production** — no experimental changes to production extension or web app.
4. **Extension trust UX** — active job identity in sidecard (job title, company, optional location).
5. **Phase 2 overlay/list scoring** — deferred until after stable beta and scoring credibility are resolved.

## Deferred / Later

- 5-title discovery expansion / adjacent titles
- Static "How we arrived at these titles" explainer on titles page
- Adaptive search suggestions
- Phase 2 overlay/list scoring (persistent LinkedIn results-list overlay, score badges on job cards, sidebar decision console)
- Next/previous job navigation
- Preview-text scoring (experiment only)
- Post-score LLM dialogue mode toggle
