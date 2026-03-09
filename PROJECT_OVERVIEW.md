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
3. **Title recommendations** — system recommends up to 3 high-alignment titles.
4. **Job paste / extension** — user pastes a job description (or the browser extension extracts one) to score fit.
5. **Fit result** — inline fit score, supports-fit bullets, stretch factors, and bottom line render below the titles.

---

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

## Calibration Title-Detail UX (Canonical)

Recommended titles are displayed as expandable rows on the calibration page. Each title row includes a fit score and supports rich detail content when enriched data is available.

### Title Row (Collapsed)

Each title row shows:

- **Expand indicator** — `▶` arrow if enriched detail exists; `·` dot if not.
- **Title text** — the recommended title string (first title rendered bold).
- **Fit score** — `N/10` (first title in green `#4ADE80`; others in gray).
- **Copy button** — copies the title text to clipboard.

Up to 3 titles are displayed, sorted by fit score descending. An archetype label may appear above the title list when available.

### Title Row (Expanded)

Clicking an expandable title row reveals per-title detail content:

1. **Summary** — a short (~2 sentence) summary explaining the title's fit to the user's profile.
2. **Three explanatory bullet points** — mechanism-level bullets grounding the title recommendation in matched signals and evidence from the resume/prompts.

The expanded panel uses a slightly lighter background (`#1A1A1A`) with a visible border to distinguish it from collapsed rows. Clicking the expanded row collapses it again.

### Enrichment Data Shape

Each enriched title carries:

| Field | Description |
|---|---|
| `title` | The recommended title string |
| `fit_0_to_10` | Numeric fit score (0–10) |
| `summary_2s` | ~2-sentence summary of title fit |
| `bullets_3` | Exactly 3 explanatory bullet points |

Titles without `summary_2s` or `bullets_3` render as non-expandable flat rows (dot indicator, no click action).

### Key Invariants

- Title rows without enrichment data must still render with score and copy — they just lack expand behavior.
- The expanded detail is part of the intended calibration UX, not an incidental implementation artifact.
- Titles remain visible on screen when the user enters job text and sees fit results below.
