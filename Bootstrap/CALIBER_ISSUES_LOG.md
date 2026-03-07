# CALIBER_ISSUES_LOG


## Current Open Issues

0. PM drift: afterthought additions and premature long tasks violate distilled UX. Enforce No-Afterthoughts + Input-First rules in PM mode. (2026-03-04)
1. TITLES step: session.synthesis.marketTitle/titleExplanation can be null in TITLE_DIALOGUE; Continue may misroute (JOB_REQUIRED/0-10 pending)
2. Title suggestion missing/null blocks job description entry; must surface job description gate reliably
3. Post-score LLM dialogue mode: toggle and UI implementation pending after Fit score + summary page (deferred)
4. Routing/polling fragility: session state checks can be stale, causing UI to hang or misroute (partially mitigated, but still relevant)
5-season. Title scoring calibration — **RESOLVED** (2026-03-05)
  - Strong profiles → top 3 titles ≥7 (at least one ≥8); weak/generic/thin → hard cap ≤5.0
  - lib/title_scoring.ts added; scripts/title_scoring_smoke.ts updated with band assertions
5. Score+summary page contract → **inline results panel on JOB_TEXT step** — **RESOLVED** (2026-03-03)
	- Fix commit: 57f1c68
	- Results now render inline on the JOB_TEXT step in /calibration (no separate score page or /results navigation).
	- Contract:
		- Show **Job Title** (best available title from synthesis / title recommendation)
		- Show **Fit Score** (0–10, deterministic)
		- Show exactly **3 sentences** of "why good/bad fit" summary (truncated if longer)
		- Error surfaces **real error string** from backend (no generic "A terminal error occurred" banner)
6. ALIGNMENT_OUTPUT gate: ADVANCE invalid; must COMPUTE_ALIGNMENT_OUTPUT (2026-03-01)
	- UI/Backend divergence: UI does not consistently execute COMPUTE_ALIGNMENT_OUTPUT or handle TERMINAL_COMPLETE/result

13. Clarifications dialogue panel — **RESOLVED** (2026-03-05)
  - Removed entirely from UI. No "Does this feel accurate?" chat. Titles render clean without dialogue.

14. Results separate page behavior — **RESOLVED** (2026-03-05)
  - Results now render as inline FitAccordion in the job region under titles. No RESULTS step, no page navigation.
  - Unified screen: titles stay visible; job textarea replaced with accordion when results exist.

15. Bottom line paragraph repetition — **OPEN** (2026-03-05)
  - Fit "Bottom line" can repeat phrases verbatim from stretch bullets (e.g., "tenure at scale" appears in both).
  - stretchLabel() de-dup partially mitigates but not fully doctrine-tight.
  - Need anti-repetition / paraphrase rule (no phrase bans; just de-dup).

16. Browser extension Phase 1 MVP — **RESOLVED** (2026-03-06)
  - LinkedIn job detail extraction via Chrome extension: verified working end-to-end.
  - Live confirmed behavior: user clicks LinkedIn job detail → clicks Caliber extension → popup extracts job description → calls production API → renders fit score (4.3/10 confirmed live screenshot).
  - Popup shows: score, supports-fit bullets, stretch factors, bottom line, Recalculate, Open in Caliber.
  - Resolved blockers during development:
    - Stale/old extension package repeatedly loaded instead of current `extension/` folder build.
    - Missing `scripting` permission broke `executeScript` fallback.
    - `localhost` API base caused fetch failure from user machine.
    - Bare-domain (`caliber-app.com`) vs www-domain mismatch caused 307 redirect → CORS preflight failure.
    - `/api/extension/fit` CORS needed exact `chrome-extension://...` origin echo, not wildcard.
  - Canonical production host confirmed: `https://www.caliber-app.com`.
  - Key commits: a9565d9, 66d1bf4, dd5da13 (domain alignment, CORS fix, host_permission cleanup).

17. Extension popup explanation rendering sparse — **OPEN** (2026-03-06)
  - In some runs the popup explanation content (supports-fit, stretch, bottom line) is sparse or incomplete.
  - Likely related to bottom-line doctrine polish (#15).

18. Sister-profile title scoring — **OPEN** (2026-03-06, saved issue)
  - A sister-profile run produced only one low-scoring title with no three options/dropdown.
  - Needs investigation to determine if title scoring bands are too restrictive for certain profile types.

19. Extension Phase 2: listings-page overlay — **OPEN** (2026-03-06, product initiative)
  - Target: render fit scores next to job posts on LinkedIn/Indeed listings pages.
  - Blocked until Phase 1 is stable and popup rendering is polished.

20. Title rows may render without expandable detail — **OPEN** (2026-03-06, regression risk)
  - Intended behavior: each recommended title row is expandable with a ~2-sentence summary and 3 explanatory bullet points (see `PROJECT_OVERVIEW.md`).
  - Failure mode: if `summary_2s` or `bullets_3` are missing/null from the enrichment pipeline, title rows degrade to flat score-only rows with no expandable detail.
  - This can happen silently — the UI renders without error, but the user sees no explanation for the title recommendation.
  - Root cause when it occurs: enrichment data not populated by title scoring or pattern synthesis; or data shape changed without updating the rendering path.
  - This is distinct from issue #18 (sister-profile producing only one title); this issue is about per-title detail completeness regardless of how many titles appear.

## Acceptance Test Snippet (2026-03-01)

```sh
# Create session, submit prompts, submit job text (>=40 chars), reach ALIGNMENT_OUTPUT
# POST COMPUTE_ALIGNMENT_OUTPUT, GET /api/calibration/result returns score_0_to_10 (not always 0 if anchors match)
curl -X POST http://localhost:3000/api/calibration/event \
  -H "Content-Type: application/json" \
  -d '{"type":"COMPUTE_ALIGNMENT_OUTPUT","sessionId":"<SESSION_ID>"}'
curl http://localhost:3000/api/calibration/result?calibrationId=<SESSION_ID> | jq .
```
7. State-gate hazards discovered: SUBMIT_JOB_TEXT invalid in CONSOLIDATION_PENDING and CONSOLIDATION_RITUAL; requires ADVANCE ticks (sleep between ticks in RITUAL)
8. Clarifier hazard: short prompt answers (<40 trimmed chars) can route to PROMPT_n_CLARIFIER and break naive scripts
9. Resume upload MIME hazard: resume fixture must use supported MIME type (e.g., text/plain for .txt)

10. BREAK_AND_UPDATE.md drift: Step 2 "no fenced code blocks / single line" contradicted actual PM→Coder handoff format — **RESOLVED** (2026-03-02)
    - Contract now explicitly allows structured task blocks (fenced or multi-line); kernel.md payload section updated to match.

11. Relationship/team profiles were mis-labeled as Program/PM with low confidence — RESOLVED (2026-03-02)
  - Fix commit: f36dff0
  - Cleanup commit: 166baa4
  - Evidence: Jen fixture now outputs 5 titles >=7; Chris ClientGrowth scores ~1.0 (no bleed)

12. Low-confidence titles need in-flow recovery without editing prompts — RESOLVED (2026-03-02)
  - Fix commit: 057bc39
  - Added RERUN_TITLES event: collects user dialogue messages (max 600 chars), appends as additive anchor source, re-runs title scoring in-place
  - Guardrails: no prompt/resume mutation, no state transition, no job-fit impact; titles-only update

## Mitigations / Working Rules

- Reject any multi-file patch when task expects one file.
- Require git diff --name-only == expected file(s) before applying.
- No ‘compiled/200 OK’ claims without user-provided logs.
- Added Remote Visibility Rule and Divergence Playbook to contract to prevent recurrence.
- Smoke-first: calibration fixes must be proven via smoke terminal complete + result before UI debugging.
---

## Issues Added 2026-03-07

21. Calibration title-quality / low-score issue — **OPEN** (2026-03-07)
  - Fabio and Jen profiles produced weak or low-scoring outputs.
  - Strong profiles should produce top-3 titles scoring 7.0+; these profiles fell below that bar.
  - Title grounding and the 2 + 1 model (2 strong fits + 1 adjacent credible) need improvement.
  - Related: #18 (sister-profile), #20 (missing enrichment).

22. Abstract title-family drift — **OPEN** (2026-03-07)
  - System can over-index on abstract behavioral traits (clarity, systems thinking, communication) and produce role families with no domain support.
  - Example: cybersecurity user → "Brand Systems Designer" output.
  - Root cause: synthesis pipeline weighted pattern signals too heavily relative to domain/resume signals.
  - Guard needed: title selection must verify domain support from resume, not just trait-pattern alignment.
  - See `docs/calibration_product_logic.md` for full description.

23. Calibration results-page regression risk — **OPEN** (2026-03-07)
  - Removed sections (Where You Operate Best / Lose Energy / pattern summary prose) were reintroduced by implementation drift in prior iterations.
  - These sections are intentionally removed from the intended flow.
  - This is a known UX regression to guard against.
  - Intended flow: typewriter intro → title cards → extension CTA. Nothing else.
  - See `docs/calibration_results_ux.md` for canonical spec.

24. Extension panel integration instability — **OPEN** (2026-03-07)
  - Multiple extension branches caused renderer / persistence / packaging regressions.
  - Lesson: only one extension branch at a time should make major changes to `extension/content_linkedin.js`.
  - Integration discipline is required — parallel extension work needs a tightly controlled merge plan.