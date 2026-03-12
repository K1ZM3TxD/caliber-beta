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

## Change Control

Changes to this document require a BREAK+UPDATE entry in `Bootstrap/BREAK_AND_UPDATE.md`. This is a governed contract, not a living suggestion file.
