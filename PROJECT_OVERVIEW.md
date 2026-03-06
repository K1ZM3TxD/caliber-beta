# PROJECT_OVERVIEW

Canonical product-behavior reference for Caliber. This file documents intended UX that must be preserved across implementation changes.

---

## Calibration Flow

The calibration experience lives at `/calibration` on a single page with no navigation away. The flow is:

1. **Resume upload** — user uploads a resume file.
2. **Prompt answers** — user responds to calibration prompts to surface anchors and identity signals.
3. **Title recommendations** — system recommends up to 3 high-alignment titles.
4. **Job paste / extension** — user pastes a job description (or the browser extension extracts one) to score fit.
5. **Fit result** — inline fit score, supports-fit bullets, stretch factors, and bottom line render below the titles.

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
