# Layout Skeleton — Caliber Page Composition Rules

> **This document is mandatory for all layout/composition coder tasks (in addition to the UI Constitution).**
> PM must attach or reference this file on any task that touches layout, spacing, composition, hero structure, ingest flow, or page alignment.
> Coder must reject layout/composition tasks that do not reference both this document and `docs/ui-constitution.md`.

---

## Purpose

This is the canonical page composition contract for Caliber pages. It defines the structural zones, reserved heights, and transition rules that govern how page content is arranged. Visual primitives (colors, text tokens, surfaces) are defined in the UI Constitution — this document governs spatial composition only.

---

## 1. Wordmark Anchor Zone

- **Position:** Top of every page.
- **Component:** `CaliberHeader` with `pt-4`.
- **Height:** Intrinsic (not fixed). Wordmark text + padding.
- **Rule:** The wordmark is always the first rendered element. Nothing renders above it.
- **Content:** CALIBER wordmark only. No navigation, no page title, no secondary text.

---

## 2. Prompt / Subtitle Zone

- **Position:** Below the wordmark anchor, above the interaction surface.
- **Content:** Page heading, subtitle, status text, or contextual prompt.
- **Spacing:** `mt-6` to `mt-10` below the wordmark anchor (page-dependent).
- **Width:** Contained within the page's content max-width (typically `max-w-[600px]`).
- **Text:** Heading tokens from the UI Constitution. Body or muted tokens for subtitles.
- **Rule:** This zone sets context before the user reaches interactive content. Keep it concise — one heading, at most one subtitle sentence.

---

## 3. Interaction Surface Zone

- **Position:** Below the prompt/subtitle zone. This is the primary content area.
- **Content:** Forms, cards, results, lists, boards — the core interactive elements of the page.
- **Spacing:** `mt-8` to `mt-12` below the prompt/subtitle zone.
- **Width:** Contained within the page's content max-width.
- **Rule:** The interaction surface is where the user does work. It must feel spacious and uncluttered. Avoid stacking too many heterogeneous elements — group related items, separate groups with consistent section gaps.

---

## 4. CTA Zone

- **Position:** Below the interaction surface, or anchored at the bottom of a hero card / result card.
- **Content:** Primary and secondary action buttons.
- **Spacing:** `mt-6` to `mt-8` below the last interaction element, or integrated into a card's bottom area.
- **Button order:** Primary (green outlined) on the left or top. Secondary (yellow outlined or muted) below or to the right.
- **Rule:** One primary CTA per visible viewport region. If multiple actions exist, establish clear visual hierarchy. Do not cluster more than 2–3 buttons in one zone.

---

## 5. Reserved Prompt Heights

For pages with progressive/multi-step flows (e.g., calibration ingest), reserve vertical space to prevent layout shift during transitions.

| Element | Reserved height |
|---|---|
| **Hero heading area** | `min-h-[5.5em]` (calibration) |
| **Prompt/question area** | `min-h-[3em]` per prompt line |
| **Textarea / input area** | Height as defined by component; do not collapse to 0 between steps |
| **Result card area** | `min-h-[200px]` when results are expected but loading |

- Reserved heights prevent the page from "jumping" when content appears or disappears.
- Use `min-h-` (not fixed `h-`) so content can grow beyond the reservation.

---

## 6. Transition Stability Rules

When page content changes (step transitions, loading states, result reveals):

1. **No layout shift:** Elements above the changing content must not move. Use reserved heights for areas that will gain content.
2. **Sequential reveals only:** If multiple elements appear, they appear in reading order (top to bottom), one at a time. No simultaneous multi-element entrance.
3. **No competing motion:** At most one animation or transition runs at a time on the visible viewport. Overlapping motion is a regression.
4. **Fade over slide:** Prefer opacity transitions (`opacity-0` → `opacity-100`) over positional slides. Positional animation is permitted only for deliberate choreographed moments (e.g., a single hero card entrance).
5. **Loading states:** Show a subtle placeholder (skeleton or muted text) in the reserved space. Do not leave a blank gap that suddenly fills.

---

## 7. Content Width and Vertical Rhythm

- **Standard pages:** `max-w-[600px]`, centered (`mx-auto`), `px-4` minimum horizontal padding.
- **Board / dashboard pages:** `max-w-[960px]`, same centering and padding rules.
- **Vertical rhythm:** Consistent section gaps within a page. Pick a primary gap (`mt-8` or `mt-12`) and use it between all major sections. Use a smaller gap (`mt-3` or `mt-4`) within sections. Do not alternate arbitrarily.
- **Bottom padding:** Every page must have `pb-16` or equivalent at the bottom to prevent content from crowding the viewport edge.

---

## Page Composition Summary

```
┌─────────────────────────────────────┐
│  Wordmark Anchor (CaliberHeader)    │  ← pt-4, intrinsic height
├─────────────────────────────────────┤
│  Prompt / Subtitle Zone             │  ← mt-6 to mt-10, heading + optional subtitle
├─────────────────────────────────────┤
│                                     │
│  Interaction Surface Zone           │  ← mt-8 to mt-12, primary content
│  (forms, cards, results, boards)    │
│                                     │
├─────────────────────────────────────┤
│  CTA Zone                           │  ← mt-6 to mt-8, action buttons
├─────────────────────────────────────┤
│  (bottom padding pb-16)             │
└─────────────────────────────────────┘
```

All zones are contained within the page's content max-width and centered horizontally.

---

## Relationship to UI Constitution

This document and `docs/ui-constitution.md` are complementary:
- **UI Constitution** governs what things look like (colors, text, surfaces, borders, interaction states).
- **Layout Skeleton** governs where things go (zones, spacing, composition, transition behavior).

Both are required for layout/composition tasks. The UI Constitution alone is sufficient for tasks that only change visual styling without altering spatial composition.

---

## 8. Processing Screen Staged Progress

When the calibration flow enters a processing / loading phase:

1. The spinner and "Processing…" label remain centered in the Interaction Surface Zone.
2. A thin progress bar (max-width 260px, centered) appears below the spinner with a percentage readout.
3. Stages advance through 20 → 40 → 60 → 80 → Complete with a minimum visible duration per stage (~1.2s) so fast completions remain readable.
4. Once the backend signals completion, remaining stages fast-forward at ~400ms each.
5. "Complete" appears only after real backend completion, then the page transitions after a brief 600ms hold.
6. The delay is presentation-only — it does not block backend work or alter workflow logic.
7. All transition stability rules from §6 apply: no layout shift, fade over slide, no competing motion.

---

## 9. Mobile Composition Rules

All spatial composition adapts to smaller viewports using Tailwind's `sm` (640px) breakpoint.

### Top Padding Scale

| Context | Mobile (< 640px) | Desktop (≥ 640px) |
|---|---|---|
| **Content steps** (PROMPT, PROCESSING) | `pt-[14vh]` | `pt-[22vh]` |
| **Result/title pages** (TITLES) | `pt-[6vh]` | `pt-[10vh]` |
| **Extended top** (IngestLayout) | `pt-[20vh]` | `pt-[32vh]` |
| **Sign-in / lightweight pages** | `mt-6` | `mt-10` |

- Mobile reduces top padding to reclaim vertical space for content. The wordmark still anchors the top.
- Centered-mode pages (LANDING, RESUME) use flex centering and are unaffected by top padding scale.

### Horizontal Padding

- All pages: `px-4` on mobile, `px-6` on desktop (`px-4 sm:px-6`).
- This is the constitution's minimum. Individual pages must not go below `px-4`.

### Board / Multi-Column Layouts

- Board layouts (pipeline) use `overflow-x-auto` on mobile with minimum column widths (`minmax(220px, 1fr)`) so the board scrolls horizontally.
- This preserves the board metaphor while keeping columns readable.
- Single-column content pages must never introduce horizontal scroll.

### Button / CTA Stacking

- Horizontal button groups must include `flex-wrap` so buttons stack vertically when viewport is too narrow.
- Gap reduces on mobile: `gap-3` vs `gap-4` on desktop.

---

## Change Control

Changes to this document require a BREAK+UPDATE entry in `Bootstrap/BREAK_AND_UPDATE.md`. This is a governed contract, not a living suggestion file.
