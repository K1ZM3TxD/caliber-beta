---

BREAK + UPDATE — 2026-03-11 (Visual Shell Re-Lock + Pipeline Board + Tailor Recompose)
---
DONE:
- Visual shell re-lock: abandoned "match the pipeline page" approach, anchored design to explicit approved primitives
- Approved primitives codified: wide ambient gradient over #050505, outlined green buttons, no sharp centered line, calm dark premium shell
- Global layout: top padding pt-16→pt-10, max-width widened to 960px for board (pages self-constrain to 600px)
- Calibration page: header area 8.5em→5.5em, LANDING spacing mt-14/mt-12→mt-8, dropzone text centered, redundant dividers removed
- Tailor page recomposed: "Tailor Resume" as primary heading, job context first, CaliberHeader removed, pipeline banner demoted
- Pipeline rebuilt from list to 4-column board: Resume Prep → Submitted → Interview Prep → Interview
- Pipeline API + store updated with new stages (resume_prep, submitted, interview_prep, interview) with legacy auto-mapping
- Extension bug-report button: icon-only → "🐛 Report" text label
- All "Back to Caliber" links → /calibration
- PM docs refreshed to reflect current shipped state vs planned-next behavior

REMAINING / ACTIVE NEXT:
- Tighten remaining visual shell drift across all pages (reference approved primitives)
- Product validation of pipeline 4-column board model (column names, stage decomposition)
- Verify Better Search Title trigger behavior with widened thresholds
- CTA noise-control refinement (per-session, time-based)
- Upload/ingest page shell alignment

---

BREAK + UPDATE — 2026-03-10 (Pipeline Truthfulness + Extension v0.6.0)
---
DONE:
- Pipeline entry now created at `/api/tailor/prepare` time in `strong_match` stage — persistence begins before tailoring, not after
- Pipeline advances to `tailored` during `/api/tailor/generate`
- `/tailor` confirmation banner gated by actual pipeline existence (truthful — only shown when backed by real entry)
- Extension suppresses 8.0+ tailor CTA for jobs already present in user's pipeline (baseline CTA noise control)
- Extension feedback row includes separate bug-report action, distinct from thumbs-down quality feedback
- Extension bumped to v0.6.0
- PM docs refreshed to reflect current shipped product truth

REMAINING:
- CTA noise-control refinement: per-session and time-based suppression for jobs not yet in pipeline
- Pipeline is still intentionally minimal — not a CRM

---

BREAK + UPDATE — 2026-03-10 (Strong-Match Action + Resume Tailoring + Job Pipeline)
---
DONE:
- Extension-first scoring UX stabilized (sidecard, HRC, compact layout, feedback loop)
- Contextual title recovery direction established (Better Search Title as search-surface recovery mechanism)
- Calibration/web visual polish direction established (brand-color, green CTAs, hero simplification)
- Product decision: Caliber expands from evaluation-only to strong-match action workflow

NEXT:
- Strong-match contextual resume-tailoring flow: 8.0+ jobs trigger "Tailor resume for this job" action
- Resume tailoring uses the user's existing uploaded Caliber resume + live job context from the extension
- Simple job pipeline/tracker for strong-fit opportunities:
  - Stages: Strong Match → Tailored → Applied → Interviewing (+ optional Offer / Archived)
- Extension contextual card (above sidecard) for 8.0+ jobs replaces in-sidecard CTA
- Tailor page + pipeline page on web app

BLOCKED / GUARDRAILS:
- Avoid CRM-style pipeline expansion — pipeline must remain intentionally minimal
- Keep pipeline stage model minimal (no subtasks, no notes, no timeline features)
- Strong-fit action ONLY on 8.0+ jobs — lower scores do not get tailoring CTAs
- Tailoring must never fabricate experience; only reorder, emphasize, and adjust language
- No generic feature sprawl — this is the next focused product layer, not a platform play

---

Milestone: Extension-First UX Stabilization (2026-03-10)
---

**Status:** COMPLETE

Extension sidecard and calibration results page received final polish pass, completing the extension-first operating model stabilization.

**What shipped:**

Extension sidecard (primary decision surface):
- Compact two-column header: company + job title (left), fit score + decision badge (right)
- Hiring Reality Check: collapsible with High/Possible/Unlikely band badge
- Bottom line: collapsible, collapsed by default
- Supports fit: green toggle, bullet count, collapsible
- Stretch factors: yellow toggle, bullet count, collapsible
- Panel dimensions: 320px × 420px max
- Extension v0.4.1 deployed

Calibration results page (final polish):
- Hero title reduced ~10% (text-[1.7rem] / sm:text-[2.4rem])
- Section label font-light (300 weight)
- "Search on LinkedIn" = green primary CTA
- "See why it fits" = scoring-yellow secondary
- Explanation dropdown: "WHY IT FITS" label removed, opens with "Your pattern matches on 4 core signals.", human-language bullets, no technical/internal scoring terminology
- summary_2s and bullets_3 generation rewritten for plain language

Extension delivery:
- Stale v0.3.5 zip replaced via version bumps (v0.4.0, then v0.4.1)
- New filename on each build to bust Vercel CDN cache
- `/extension` page serves current build as primary user install path

**Real user flow (canonical):**
calibration → results page → /extension → download ZIP → install in Chrome → LinkedIn → extension scores jobs

**Issues resolved:** #28, #32, #33, #35, #36, #37
**Issues downgraded:** #31 (handshake: BLOCKING → known friction)

---

BREAK + UPDATE — 2026-03-10 (Job Board Adapter Architecture)
---
DONE:
- Decision recorded: Job Board Adapter Architecture is the required foundation before expanding to additional job boards
- Architecture contract: site-specific adapters call extractJobData() → normalized job object (title, company, location, description)
- Adapter roster defined: linkedinAdapter, indeedAdapter, glassdoorAdapter, ziprecruiterAdapter, monsterAdapter
- Scoring engine contract: MUST consume only the normalized job object, NEVER site-specific DOM logic
- This is the required approach for Phase 1 multi-board coverage
- kernel.md updated with Job Board Adapter Invariant
- CALIBER_ISSUES_LOG updated with tracking issue
- decisions.md updated

BLOCKED:
- Implementation not yet started — architecture decision documented first

NEXT:
1. Implement adapter interface + linkedinAdapter extraction refactor
2. Implement indeedAdapter (first expansion target)
3. Scoring engine refactor to consume normalized job object only
4. Adapter smoke tests per board

---

BREAK + UPDATE — 2026-03-10 (Extension-First UX Stabilization)
---
DONE:
- Extension sidecard shipped as primary decision surface with job identity, HRC, collapsible sections
- Calibration results page final polish: smaller hero, lighter label, green/yellow button hierarchy, human-language explanation
- Explanation generation (title_scoring.ts) rewritten to remove all internal scoring language
- Extension v0.4.1 deployed with CDN cache-bust discipline
- Stale extension download artifacts eliminated
- Repo consolidated to single mainline (main)
- Issues #28, #32, #33, #35, #36, #37 resolved; #31 downgraded from blocking

BLOCKED:
- Nothing currently blocking

NEXT:
1. Extension compact scanline UX refinement
2. Extension decision trust / scoring clarity
3. No unnecessary expansion of calibration scope

---

Milestone: Repository Stabilization — Single Mainline (2026-03-10)
---

**Status:** COMPLETE

Multiple parallel extension branches (`extension-panel-persistence-restore`,
`extension-upgraded-panel-restore`, `extension-market-navigation`,
`extension-beta-download-page`, `docs-extension-beta-workflow`) caused
renderer/persistence/packaging regressions and made it unclear which branch
held the source of truth for the extension.

**Actions taken:**
- Stable extension changes consolidated onto main in a single commit.
- Regression-prone identity-key tracking and `updateIdentityHeader()` removed;
  identity rendering inlined into `showResults()`.
- All stale local and remote extension branches deleted.
- Hiring Reality Check display confirmed intact after consolidation.
- Extension build (`scripts/build-extensions.sh`) verified producing correct
  prod and dev outputs from the consolidated main.

**Rule going forward (during development):**
- `main` is the single integration branch.
- One extension feature branch at a time — no parallel extension branches.
- Extension testing uses the `extension/` source folder or `dist/extension-dev/`
  build, never stale zip artifacts.

---

Milestone: Beta Launch Infrastructure Lock (FUTURE — activates at beta launch)
---

**Status:** NOT YET ACTIVE — documenting the operational rule now so it is not
forgotten when beta launch arrives. Current behavior (main auto-deploys to
production) remains unchanged until this milestone activates.

**Trigger:** This milestone activates when the team declares "beta launch."
Until then, the current workflow (push to main → auto-deploy) continues.

### Deployment Workflow After Beta Launch

1. **main = stable production branch.**
   - `main` auto-deploys to `https://www.caliber-app.com` via Vercel.
   - After beta launch, nothing merges to main without passing staging
     verification first.

2. **Feature branches for all development.**
   - All new work happens on feature branches off main.
   - No direct commits to main after beta launch.

3. **Staging / preview deployment for testing.**
   - Every PR to main gets a Vercel preview deployment URL.
   - QA and PM verify the preview deployment before approving merge.
   - Extension dev builds (`dist/extension-dev/`) test against
     `http://localhost:3000`; production extension (`dist/extension-prod/`)
     is only updated after main merges.

4. **Production deploys only from main after verification.**
   - Merge to main = production deploy.
   - No hotfix pushes without at least one preview verification pass.

### Why This Matters

During early development, main-as-dev is acceptable because the product is
still forming. At beta launch, real users depend on production stability.
The staging gate prevents half-finished work from reaching users.

### Checklist (activate at beta launch)

- [ ] Branch protection rule on main (require PR + at least one approval)
- [ ] Vercel preview deployments confirmed working for PRs
- [ ] Team notified: no direct pushes to main
- [ ] Extension build script verified against preview URL if needed

---

BREAK + UPDATE — 2026-03-08 (Extension-First Operating Model)
---
DONE:
- Calibration results page repositioned as extension-first launchpad
- Single hero title direction replaces multi-title scored list on calibration page
- Title scores removed from calibration page
- Manual paste scoring removed from calibration primary flow
- Extension sidecard is now the primary decision surface for real-role evaluation
- Canonical scoring fixtures created and committed (Chris / Jen / Fabio / Dingus)
- Title scoring baseline verified and considered stable
- Fabio scoring correction validated (SecurityAnalysis cluster)
- Jen scoring correction validated (CreativeOps / partnerships outputs)
- Smoke test aligned to canonical scoring library (stale inlined logic removed)
- Baseline smoke passes 45/45
- /calibration extension-first hero-title layout merged and documented as canonical surface contract

BLOCKED:
- Extension fresh-install / refresh handshake still unreliable (user calibrates → installs/refreshes extension → opens LinkedIn → extension says no active session until manual Caliber and LinkedIn refresh)

NEXT:
1. Fix handshake/session discovery bug
2. Add Hiring Reality Check to extension
3. Compact sidecard UX polish

---

Phase-2 Extension Overlay UX Contract Finalized (2026-03-08)
---
DONE:
- Phase-2 LinkedIn overlay UX design locked and documented
- Listing badge: Caliber icon + color score under company logo on each job card
- Color bands: Green (8.0–10.0) · Yellow (6.5–7.9) · Gray (0–6.4)
- Loading placeholder: immediate `[Icon] …` badge before scoring completes
- Progressive visible-job scoring: ~10 visible jobs first, then on scroll
- Sidecard trust header: Job Title + Company Name (location excluded)
- Sidecard content: score + supports + stretch + bottom line, no extra metadata
- Future ideas documented but explicitly out of Phase-2 scope

BLOCKED:
- Implementation blocked until scoring credibility (#25) is resolved and PM unblocks

NEXT:
- Scoring credibility fix remains top priority
- Phase-2 overlay implementation only after PM explicitly unblocks

---

BREAK + UPDATE (2026-03-08)
---
DONE (this sprint):
- Production/dev environment split implemented and deployed
  - Production: `https://www.caliber-app.com` (Vercel from main)
  - Dev: `http://localhost:3000` only
  - Extension builds hard-separated: no host fallback, no cross-environment permissions
- Stable beta deployed and verified live on production domain
- Production extension verified working after build/reload
- Roadmap order locked: scoring credibility → beta stability → trust polish → Phase 2 (deferred)
- Product understanding captured: calibration titles are starting search terms, extension is the real decision engine
- Environment split documented in `ENVIRONMENT_SPLIT.md`

BLOCKED:
- Scoring credibility for Jen (5.3 / 4.6 / 4.6) and Fabio (low relative to expected strong-profile behavior)
- Market-job scores low despite high calibration title scores (jobs under calibrated terms often below 6)
- Possible search-surface / adjacent-title discovery gap (acknowledged, not current scope)

NEXT:
1. Scoring calibration / credibility fix (Jen + Fabio) — top priority
2. Bottom line polish only as needed for beta credibility
3. Extension sidecard: active job identity (title, company, location) for trust
4. Phase 2 overlay/list scoring — deferred until PM unblocks

---

BREAK + UPDATE (2026-03-06)
---
DONE (this sprint):
- Extension Phase 1 MVP verified working end-to-end on LinkedIn job detail pages
- Live confirmed: extract job description → call production API → render fit score in popup (4.3/10)
- Resolved: stale extension package, missing scripting permission, localhost API base, bare-domain redirect/CORS, exact chrome-extension origin echo
- Canonical production host locked: https://www.caliber-app.com
- Key commits: a9565d9, 66d1bf4, dd5da13

BLOCKED:
- (none)

NEXT:
- Bottom line doctrine polish (anti-repetition / paraphrase rule)
- Extension popup explanation rendering completeness
- Extension Phase 2: listings-page overlay scores next to job posts
---

Milestone: Stabilize /calibration UI shell + typewriter tagline; restore RESUME_INGEST UI; add / -> /calibration redirect; establish single-file guardrails.

BREAK + UPDATE (2026-02-28)
---
DONE (this sprint):
- Build/type fixes across backend and UI
- /calibration UI: no blank screens, no false results
- PDF bad-xref now returns RESUME_PARSE_FAILED

BLOCKED:
- Smoke integration stalls in CONSOLIDATION_RITUAL and does not reach PATTERN_SYNTHESIS within step cap

NEXT:
- Make CONSOLIDATION_RITUAL advance deterministically per ADVANCE call (remove wall-clock gating)
- Re-run smoke to confirm it reaches PATTERN_SYNTHESIS
---

Next milestone:
- Backend wiring via hook: add useCalibrationSession and refactor page.tsx to call hook only; then resume-upload -> prompt 1.
## ⚠️ PHASE SHIFT — Calibration Core First (Temporary Freeze on Summary Engine)

As of this milestone update, development priority has shifted.

The product flow is now locked as follows:

Primary focus:

1. Resume upload
2. Title suggestion + job description paste (same screen; no user title editing; no confirmation gate)
3. Fit score (0–10) + summary
4. LLM dialogue opens after score+summary (next phase)

Older calibration-core steps (anchors, overlap/gap, mechanical title producer) are deprecated in the current flow.

Narrative summary and dialogue mode will be enabled after score+summary.

This prevents over-investment in surface polish before structural alignment logic is proven.

Caliber — MILESTONES (Anchor-First Architecture)



This document defines the active execution runway.



It changes only when architectural direction changes or new enforcement discoveries occur.



This file governs execution sequencing only.



For philosophy → CALIBER\_DOCTRINE.md  

For execution rules → KERNEL.md  



---



\## OPERATIONAL BASELINE (COMPLETED RECORD)



\### Core Architecture



\- Deterministic event-driven state machine  

\- Externally visible states only  

\- JSON-only API responses  

\- No hidden transitions  

\- Strict ADVANCE allowlist  

\- Resume upload is file-only  

\- No paste path  



Status: COMPLETED



---



\### Structural Cadence Backbone (COMPLETED RECORD)



Pattern Synthesis must follow 4-layer cadence:



1\. Identity Contrast  

2\. Intervention Contrast  

3\. Construction Layer  

4\. Conditional Consequence Drop (earned only)  



Cadence invariant.  

Not adjustable.  

Not prompt-dependent.  



Status: COMPLETED



---



\## ARCHITECTURAL FORK



Milestone 5.1 (Hybrid Semantic Synthesis) is superseded.



Caliber now operates under Anchor-First Architecture.



We are no longer tuning guardrails.  

We are implementing structural grounding.



---



Milestone 6 — Lexical Anchor System (Deterministic)
6.0 Anchor Extraction — Deterministic Ordering (Complete)
Objective

Extract lexical anchors (verbs + nouns) from resume text and prompt answers in a deterministic, stable way suitable for downstream enforcement.

Implementation Guarantees

Deterministic tokenization

Deterministic sorting:

Primary: frequency (descending)

Secondary: term (ascending)

Stable top slices:

topVerbs (<= 12)

topNouns (<= 12)

anchorTerms (<= 24 combined)

No randomness. No semantic model involvement.

Contract

Anchor extraction must:

Produce identical output for identical input.

Never depend on runtime order or object key order.

Never mutate session state.

Be pure and synchronous.

Status: Complete

6.1 Anchor Injection + Overlap Enforcement (Complete)
Objective

Force semantic synthesis to meaningfully reuse user language without allowing the model to drift into abstraction or praise.

This is enforced via overlap scoring and retry logic.

Injection Layer

The synthesis prompt includes a LEXICAL ANCHORS block:

Verbs: (top verbs)

Nouns: (top nouns)

Anchors are advisory but scored.

Constraint:

Anchors must not override structural grammar rules.

Required line starters must never change.

Never switch to first-person voice.

Anchors should not create noun collisions (“protocol delegation” style artifacts).

Anchors assist structure. They do not define structure.

Overlap Enforcement

After first LLM response:

Build a concatenated synthesis string.

Perform whole-word matching (\bterm\b, case-insensitive).

Compute:

score = overlapCount / anchorTerms.length

Threshold:

MIN_OVERLAP = 0.35
Decision Tree
Case A — score >= 0.35

Accept.

Log:

synthesis_source=llm ...
Case B — score < 0.35

Retry once with injected missing anchors.

Log:

synthesis_source=retry ...
Case C — retry still < 0.35

Deterministic fallback synthesis.

Log:

synthesis_source=fallback ...

Retry occurs at most once.

Logging Contract (Strict)

All synthesis logs must:

Be single-line physical strings.

Contain:

synthesis_source

anchor_overlap_score (2 decimals)

missing_anchor_count

praise_flag=false

abstraction_flag=false

Emit exactly once per attempt.

Never emit llm if first attempt fails threshold.

This ensures deterministic observability.

Known Behavioral Observations

Overlap pressure can produce grammatical degradation if anchor set is low quality.

Raising threshold increases anchor forcing.

Quality improvements should focus on:

Anchor selection refinement

Prompt structure clarity

Allowlist discipline

Grammar preservation

Threshold tuning should occur only after anchor quality stabilizes.

Status: Complete and Stable

skillAnchors[]

Milestone 6.2 — Deterministic Signal Classification
Status: COMPLETED
Notes: Deterministic signal/skill classification + weighted alignment scoring + tests (landed on main).

Milestone 6.3 — Anti-Abstraction Enforcement
Status: PARTIAL
Notes: Drift detection + retry injection present; validator outcome/log fields/tests not yet fully satisfied.


\## Milestone 6.3 — Anti-Abstraction Enforcement



Objective:



Prevent identity inflation and archetype drift not grounded in anchors.



Implementation:



\- Detect praise framing.

\- Detect identity inflation language.

\- Detect archetype terms not present in anchor set.

\- Flag abstraction\_flag=true/false.

\- Retry path must explicitly remove drift terms.



Status: NEXT



---



\## Milestone 6.4 — Validator Outcome Matrix (Refactor)



Purpose:



Replace silent validator branches with explicit classification.



Allowed outcomes:



\- PASS

\- REPAIR\_APPLIED

\- RETRY\_REQUIRED

\- FALLBACK\_ANCHOR\_FAILURE

\- FALLBACK\_STRUCTURE\_INVALID

\- FALLBACK\_BLACKLIST\_PHRASE



No empty returns permitted.



Status: PLANNED



---



\## Milestone 6.5 — Observability Upgrade



Every synthesis must log:



\- synthesis\_source

\- anchor\_overlap\_score

\- missing\_anchor\_count

\- praise\_flag

\- abstraction\_flag

\- fallback\_reason (if applicable)



Logs must be:



\- machine-parseable

\- minimal

\- deterministic

\- non-verbose



Status: PARTIALLY IMPLEMENTED  

(Anchor count logging exists; overlap enforcement logging pending full stabilization.)



---



\# EXTENSION PHASE



Once top 3-line synthesis consistently produces D-level mechanical specificity:



---



\## Milestone 7.0 — Bullet Grounding Extension



Apply anchor enforcement to:



\- operateBest bullets

\- loseEnergy bullets



Constraints:



\- No identity inflation

\- No semantic drift beyond anchor band

\- No cross-engine blending



Status: BLOCKED until 6.x stable



---



\# Deterministic Fallback Doctrine (UNCHANGED)



Fallback exists only to:



\- Preserve cadence

\- Prevent invalid state

\- Protect downstream engines



If fallback rate increases → anchor extraction or overlap enforcement is failing.



Status: STABLE (structure preserved; anchor-based fallback under 6.1 build)



---



\# Definition of Done — 6.x



A milestone is complete only when:



\- Anchor extraction deterministic.

\- Overlap threshold enforced.

\- Retry path functional.

\- Fallback deterministic.

\- Logs present.

\- Regression tests pass.

\- Output feels mechanically specific under diverse inputs.

\- Anchor overlap metrics confirm grounding.



“Feels better” without anchor overlap metrics is not completion.

