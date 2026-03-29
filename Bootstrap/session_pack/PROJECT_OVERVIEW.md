# PROJECT_OVERVIEW

Canonical product-behavior reference for Caliber. This file documents intended UX that must be preserved across implementation changes.

---

## Calibration Purpose

Calibration identifies the user's **working pattern**, not just their literal past job history.

Calibration output is **directional guidance** — it surfaces a title direction and prepares the signal for real job evaluation. Calibration titles are not job-fit grades; they are starting hypotheses for market exploration.

Calibration balances two signal sources:
- **Resume / domain credibility** — what the user has actually done and where they are established.
- **Behavioral pattern from prompt answers** — how they work, what energizes them, how they make decisions.

**Core rule:** Pattern can stretch history. Pattern should not erase context.

A user whose resume is grounded in cybersecurity should get titles anchored in that domain, even if their behavioral pattern also maps to abstract traits like "systems thinking" or "clarity." The pattern shapes the expression of the domain — it does not replace it.

---

## Title Output Philosophy

The intended title model outputs **3 titles total**:

| Slot | Intent |
|------|--------|
| Title 1 | Strong fit — high-confidence match to pattern + domain |
| Title 2 | Strong fit / close alternate — credible variation within the same family |
| Title 3 | Adjacent credible opportunity — a believable next career step |

The third title should be a **reachable** next step, not a fantasy leap. It must feel plausible within roughly one career move.

**Known failure mode to avoid:** Abstract title-family drift — the system over-indexes on abstract traits (clarity, systems, communication) and produces titles in unrelated domains. This must be treated as a bug, not a feature.

---

## Match Quality Standard

Displayed calibration matches should generally score **7.0+** for strong, real-user profiles (clear resume + substantive prompt answers).

If the top displayed matches fall below that threshold, treat it as a likely miss in title-selection logic, not acceptable final output.

---

## Calibration Flow

The calibration experience lives at `/calibration` on a single page with no navigation away. The flow is:

1. **Resume upload** — user uploads a resume file.
2. **Prompt answers** — user responds to calibration prompts to surface anchors and identity signals.
3. **Calibration complete** — confirmation state appears at the top of the results view.
4. **Extension CTA** — primary next action; guides user to install or activate the browser extension.
5. **Hero title direction** — a single top title direction is displayed (not multiple scored titles).

Job-fit evaluation (scoring a specific job description) is no longer part of this page. That flow now lives in the browser extension.

---

## Scoring Context Separation

Caliber separates two distinct evaluation contexts:

- **Calibration produces directional guidance.** It answers "What direction should I search?" — not "Is this job a good fit?"
- **The extension performs real job analysis.** Job scoring occurs primarily within the browser extension, where a real job description provides evaluative context.
- **Calibration titles are not job fit scores.** They are directional starting points for market exploration.

## Extension as Primary Decision Surface

Calibration prepares the signal. The extension is where users evaluate real jobs. **Real job-fit analysis lives primarily in the extension.**

**Product loop:**
```
calibration → extension → real job fit evaluation
```

- **LinkedIn** is the navigation layer (where users browse jobs).
- **Caliber extension** is the decision layer (where users understand fit).
- The calibration page should guide users into extension usage, not serve as the primary scoring surface.

The strongest insight happens when the calibration pattern is applied against a real job. Calibration alone is not the full experience. Title suggestions on the calibration page are not job-fit grades — they are directional starting points.

### Extension Surface Mode: Sidecard-Primary, Overlays Reactive (2026-03-29)

The extension operates in **sidecard-primary mode**. Card-level overlays (score badges on list cards) are **reactive** — they appear only after a trusted sidecard score exists for that job.

**Confirmed working model (v0.9.45+, LinkedIn and Indeed):**
- User clicks a job card → sidecard opens and scores from the full job description → trusted score produced.
- Trusted score triggers a backfill badge on the corresponding list card.
- Cards with no sidecard score show no numeric badge.

**What is not supported:**
- Zero-click broad overlay coverage (badges on all visible cards before any click). LinkedIn and Indeed card DOM contains only title/company/location at list-view time — no job description is present. Prescan from card text produces structurally inflated scores and is explicitly suppressed.
- Future zero-click broad overlay coverage requires backend job inventory + score cache infrastructure, not additional DOM probing.

---

## Calibration Results Page Role

The calibration page is an **extension-first launchpad**, not the main scoring surface.

The calibration results page should emphasize:
- **Calibration complete** — confirmation that calibration is done
- **Install extension** — CTA to install or activate the browser extension
- **One top title direction** — a single hero title direction, not a scored list

The results page does **not** display:
- Calibration title scores
- Manual job paste as the primary continuation path
- Weak summary sections restating prompt content ("Where You Operate Best", "Lose Energy" — intentionally removed)

The real insight appears in the extension when applied to live jobs.

---

## Hero Title Card UX (Canonical)

The calibration results page displays a single hero title recommendation — not a multi-title scored list.

### Hero Title Card

The card contains:
- **Centered title text** — the single recommended title direction.
- **Primary action: "Search"** — launches a job search for this title direction.
- **Secondary action: "See why it fits"** — toggles an expandable explanation area.
- **Expandable explanation** — when opened, shows why this title direction matches the user's calibration pattern.

### "How we score this"

Beneath the hero card, a scoring philosophy section explains Caliber's approach to directional guidance.

### Key Invariants

- Only one title direction is displayed (hero title, not a list).
- No title scores are shown on this page.
- No manual job paste or inline fit results appear on this page.
- The extension CTA appears above the title card — it is the primary next action.
