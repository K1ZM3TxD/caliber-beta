# CALIBER_CONTEXT_SUMMARY

## Project Status (2026-03-08, Extension-First Update)

**Operating model has shifted to extension-first.**
- The calibration page (`/calibration`) is now a launchpad, not the main scoring surface.
- Calibration output is directional guidance: one top title direction displayed, no title scores, no manual paste as primary path.
- The browser extension sidecard is the primary decision surface for real-role evaluation.
- Active blocker: extension fresh-install / refresh handshake is unreliable — user must manually refresh Caliber and LinkedIn tabs after install.
- Next tasks (locked order): handshake reliability fix → Hiring Reality Check → compact sidecard UX polish.

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

## Current Calibration Page Layout (2026-03-09, canonical)

The `/calibration` page is an extension-first launchpad. It answers "What direction should I search?" — not "Is this specific job a fit?"

Layout from top to bottom:

1. **"Calibration Complete"** — confirmation that calibration is done.
2. **Extension install CTA** — primary next action, positioned above the title result. Framed as the main next step after calibration.
3. **Title section heading** — "Top title direction for your pattern" (directional, not evaluative).
4. **Hero title card** — single title recommendation:
   - Centered title text
   - Primary "Search" action
   - Secondary "See why it fits" action
   - Expandable explanation area
5. **"How we score this"** — scoring philosophy / explanation section beneath the hero card.

What is **not** on this page:
- Multiple title suggestions
- Title scores
- Manual job paste / manual scoring
- Fit accordion or inline job results
- Dialogue panel or clarifications chat

Job-fit evaluation now lives exclusively in the browser extension sidecard.

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

## Next Tasks (locked order, updated 2026-03-08)

1. **Fix extension handshake / session discovery bug** — fresh install or refresh causes "no active session" on LinkedIn until manual page refreshes. Top blocker for extension-first flow.
2. **Hiring Reality Check** — add to extension as next product feature after handshake reliability.
3. **Compact sidecard UX polish** — decision-first layout for extension sidecard, sequenced after Hiring Reality Check.
4. **Bottom line / explanation polish** — only as needed for beta credibility (anti-repetition / paraphrase rule).
5. **Phase 2 overlay/list scoring** — deferred until after stable beta is resolved.

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
