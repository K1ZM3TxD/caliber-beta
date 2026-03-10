# CALIBER_CONTEXT_SUMMARY

> **Role:** Full project history and session decisions. For a compact current-state reload, see `Bootstrap/CALIBER_ACTIVE_STATE.md`. For the canonical system loader, see `CALIBER_SYSTEM.md`.

## Project Status (2026-03-10, Extension-First UX Stabilization)

**Extension sidecard is the primary product surface.** Calibration page is a polished launchpad; extension delivers all real-role evaluation.

- The calibration page (`/calibration`) is a launchpad. Output: one hero title direction, extension install CTA, scoring philosophy.
- The browser extension sidecard is the primary decision surface: job identity, fit score, decision badge, Hiring Reality Check, collapsible supports/stretch/bottom line.
- Extension v0.4.1 deployed with compact decision-first layout.
- Calibration results page received final polish pass (2026-03-10): smaller hero title, lighter section label, green primary CTA, yellow secondary, human-language explanation dropdown.
- Extension handshake friction (#31) is known — may require manual tab refresh on first install. Not currently blocking.
- Next priorities: extension compact scanline refinement → decision trust / scoring clarity. No expansion of calibration scope.

**Real User Flow:**
```
calibration → results page → /extension → download ZIP → install in Chrome → navigate LinkedIn → extension scores jobs
```
`/extension` must always serve the current extension build.

**Scoring Context Separation:**
- **Calibration → Direction:** determine job-search direction, display single hero title direction, prompt extension install.
- **Extension → Evaluation:** analyze real job descriptions, provide fit + hiring reality evaluation (Fit Score, Hiring Reality Check, Bottom Line).
- These are fundamentally different evaluation contexts and must not be conflated.

Calibration flow runs end-to-end: resume upload → prompt answers → title recommendation → extension CTA. Backend smoke reaches TERMINAL_COMPLETE with result. Vercel auto-deploys from main.

**Stable Beta — Production/Dev Environment Split Active (2026-03-08).**
- Production web app served from `https://www.caliber-app.com` (Vercel, auto-deployed from main).
- Production extension locked to `https://www.caliber-app.com` only — no localhost contact.
- Dev extension locked to `http://localhost:3000` only — no production contact.
- No host fallback behavior in either extension build.
- Production site + production extension verified working live.
- See `ENVIRONMENT_SPLIT.md` for operator instructions and host permission rules.

**Extension Phase 1 MVP: VERIFIED WORKING (2026-03-06).** The Chrome extension extracts job descriptions from LinkedIn job detail pages and calls the production API at `https://www.caliber-app.com/api/extension/fit`. The popup renders a fit score (confirmed live: 4.3/10 screenshot), supports-fit bullets, stretch factors, bottom line, and Recalculate / Open in Caliber actions.

## Current Calibration Page Layout (2026-03-10, canonical)

The `/calibration` page is an extension-first launchpad. It answers "What direction should I search?" — not "Is this specific job a fit?"

Layout from top to bottom:

1. **"Calibration Complete"** — confirmation that calibration is done.
2. **Extension install CTA** — primary next action, positioned above the title result.
3. **Title section heading** — "Top title direction for your pattern" (font-light, directional).
4. **Hero title card** — single title recommendation:
   - Centered title text (text-[1.7rem] / sm:text-[2.4rem])
   - Primary "Search on LinkedIn" (green CTA)
   - Secondary "See why it fits" (scoring-yellow)
   - Expandable explanation: opens with "Your pattern matches on 4 core signals.", bullets first, summary below
5. **"How we score this"** — scoring philosophy section.

What is **not** on this page:
- Multiple title suggestions
- Title scores
- Manual job paste / manual scoring
- Fit accordion or inline job results
- "OR" divider between buttons
- Technical internal language in explanations

Job-fit evaluation lives exclusively in the browser extension sidecard.

## Current Extension Sidecard (2026-03-10, canonical)

The extension sidecard is the primary decision surface. Compact, decision-first layout.

**Structure (top to bottom):**

*Above the sidecard (conditional):*
0. **Better Search Title recovery banner** — appears only when weak-fit trigger fires. Renders as a standalone banner above the sidecard. Contains a clickable suggested title that links to a LinkedIn search. Suggests calibration primary title or adjacent search-surface titles — never listing-specific titles.

*Inside the sidecard:*
1. **Header bar** — Caliber logo + refresh + close button
2. **Top row** — Two-column: company name + job title (right), fit score (28px) + decision badge (left)
3. **Hiring Reality Check** — Collapsible row with band badge (High/Possible/Unlikely); reason text color-matched to band
4. **Bottom line** — Collapsible, collapsed by default
5. **Supports fit** — Green toggle with bullet count; expands to bullet list
6. **Stretch factors** — Yellow toggle with bullet count; expands to bullet list
7. **Nearby roles** — Collapsible, blue-tinted (conditional)
8. **Feedback row** — Thumbs up/down; negative feedback expands to chip panel + optional text

**Dimensions:** 340px wide, 460px max height.
**Version:** v0.4.7.

## Better Search Title — Search Surface Recovery Mechanism (2026-03-10)

Better Search Title is a **Search Surface Recovery Mechanism**. It answers the user question: "What title should I search to find better-fit jobs?"

**Trigger:** Rolling window of the last 4 scored jobs. If 3/4 score below 6.0 and none score above 7.0, the feature activates.

**UX:**
- Recovery banner renders **above** the sidecard, not inside it.
- Banner is visually connected to the sidecard but structurally separate.
- The suggested title is the clickable control — clicking navigates to a LinkedIn search for that title.
- Compact, visually calm (blue accent, not error-red). Feels like a helpful next move, not a warning.

**Title suggestion logic:**
- Primary: calibration primary title (the user's strongest fit direction from their calibration session).
- Secondary: adjacent search-surface titles from calibration (cross-cluster alternatives).
- Never: exact listing titles, employer-specific phrasing, long compound titles, or overly narrow job-specific phrases.
- Titles must be broader market-search terms — plausible, reusable across many listings, adjacent to the user's fit zone.

**Product principle separation:**
- Navigation guidance (Better Search Title) is structurally separated from job evaluation (sidecard).
- The sidecard evaluates the current job. The recovery banner redirects the search.

**API support:** `/api/extension/fit` returns `calibration_title` (the user's calibration primary title) and `nearby_roles` (adjacent titles) to power the suggestion logic.

## Beta Feedback Loop (2026-03-10)

Structured feedback collection active across extension and web app.

- Extension sidecard: thumbs up/down row at bottom of scored results.
- Thumbs down expands to chip panel (Score wrong / Hiring reality wrong / Title suggestion wrong / Explanation not helpful / Other) + optional textarea.
- Web results page: same thumbs → chips → submit flow.
- Behavioral signals tracked per session: jobs_viewed, scores_below_6, highest_score, suggest_shown, suggest_clicked.
- Backend: `POST /api/feedback` endpoint, JSONL append-only log at `data/feedback_events.jsonl`.
- Session signals reset on search query change and panel deactivate.

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
- **Scoring credibility resolved:**
  - Title scoring baseline verified with canonical fixture profiles (Chris, Jen, Fabio, Dingus).
  - Fabio correctly maps to SecurityAnalysis cluster; Jen correctly maps to CreativeOps / partnerships outputs.
  - Cross-cluster isolation and thin-input caps preserved.
  - Smoke baseline: 45 passed, 0 failed.
  - Market-job score compression (#26) and search-surface gap (#27) remain open but are separate from title-scoring correctness.
- **Calibration results page direction simplified:** intro typewriter lines → title cards → extension CTA. No other summary sections.
- **operateBest / loseEnergy / summary prose block intentionally removed** from the calibration results page flow.
- **Extension sidecard should show active job identity** (job title, company, optional location) for trust.
- **Workflow lesson:** multiple parallel extension branches caused renderer/persistence/packaging regressions — only one major extension branch at a time.
- **Documentation rule adopted:** after major PM sessions, create a documentation task before next PM reload.
- **Beta Launch Infrastructure Lock (future):** At beta launch, main becomes the stable production branch. All development moves to feature branches, staging/preview deploys must pass verification before merging to main. Rule is documented in `Bootstrap/milestones.md` but not yet active — current push-to-main workflow continues until beta launch is declared.

### Phase-2 Extension Overlay UX Contract (Finalized 2026-03-08)

UX design locked. Implementation deferred until scoring credibility and stable beta are resolved.

**Listing Badge:** Each LinkedIn job card displays a Caliber badge (icon + color-coded score) under the company logo.
- Format: `[Caliber Icon] Score` — e.g. 🟢 8.4
- Color bands: Green (8.0–10.0, strong fit) · Yellow (6.5–7.9, possible fit) · Gray (0–6.4, skip)
- Exactly three bands. No additional tiers.

**Loading Placeholder:** When a job card becomes visible, immediately render `[Caliber Icon] …` before scoring completes. Replace with final badge when done. Purpose: eliminate perceived latency and signal scoring in progress.

**Progressive Visible-Job Scoring:** Score jobs based on viewport visibility.
- Page loads → score first ~10 visible jobs → user scrolls → score newly visible jobs.
- Must NOT score the entire search page at once.

**Sidecard Trust Header:** Sidecard displays the job currently being scored.
- Required: Job Title, Company Name.
- Optional: Company logo.
- Location intentionally excluded (clutter).

**Sidecard Content:** Minimal structure:
- Job Title / Company Name
- Caliber Score
- Supports (bullets)
- Stretch (bullets)
- Bottom Line (short paragraph)
- No additional LinkedIn metadata duplicated.

**Future Features (documented, NOT Phase-2 scope):**
- "Show only 7+ matches" filter
- Adaptive search suggestions when few strong matches appear
- Deep scoring vs preview scoring experiment
- Next/previous job navigation
- Sidebar tools (resume tailoring, interview prep)

## Next Tasks (locked order, updated 2026-03-10, v0.4.7)

1. **Extension compact scanline UX refinement** — tune visual/interaction details of the decision-first sidecard.
2. **Extension decision trust / scoring clarity** — ensure scores and signals feel credible and actionable.
3. **No unnecessary expansion of calibration scope** — calibration page is stable.
4. **Bottom line / explanation polish** — only as needed for beta credibility.
5. **Phase 2 overlay/list scoring** — deferred until after stable beta.

## Scoring Baseline

Caliber title scoring now uses canonical fixture profiles as regression anchors.

**Fixture profiles:**
- **Chris** — systems / product builder pattern (Product Designer 9.9, Product Development Lead 9.9, UX Design Strategist 8.6)
- **Jen** — creative operations / enablement pattern (Creative Operations Lead 9.9, Sales Enablement Specialist 9.9, Partnerships Manager 8.8)
- **Fabio** — technical investigation / security analysis pattern (Technical Security Consultant 9.3, Cybersecurity Specialist 8.8, Security Analyst 8.8)
- **Dingus** — weak / generic control pattern (Account Manager 2.3, Business Development Manager 2.3, Client Success Manager 2.3)

Dingus is the weak-profile control fixture used to validate scoring suppression for thin or generic inputs.

**Thin-input synthetic control:** A minimal input ("Software developer. 3 years.") is also validated; observed max score: 0.0.

Smoke test (`scripts/title_scoring_smoke.ts`) imports the canonical scoring library — no stale inlined scoring logic in tests.

These fixtures verify:
- Correct cluster mapping
- Cross-cluster isolation
- Thin-profile score caps
- Stable top-title outputs

**Current baseline status:** Smoke test passes 45/45.

## Deferred / Later

- Job Board Adapter Architecture implementation (decision recorded, adapters not yet built — see kernel.md)
- 5-title discovery expansion / adjacent titles
- Static "How we arrived at these titles" explainer on titles page
- Adaptive search suggestions
- Phase 2 overlay/list scoring — UX contract finalized (see above), implementation blocked until scoring credibility resolved
- "Show only 7+ matches" filter
- Deep scoring vs preview scoring experiment
- Next/previous job navigation
- Sidebar tools (resume tailoring, interview prep)
- Preview-text scoring (experiment only)
- Post-score LLM dialogue mode toggle
