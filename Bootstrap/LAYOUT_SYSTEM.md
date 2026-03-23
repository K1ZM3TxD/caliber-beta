# LAYOUT_SYSTEM.md — Caliber Page Layout Behavioral Rules

> Canonical home for structural layout rules and spatial behavior contracts.
> For visual primitives (colors, type tokens, surfaces), see `docs/ui-constitution.md`.
> For page composition zones and reserved heights, see `docs/layout-skeleton.md`.
> For enforcement invariants (header visibility, prompt dock, chip model), see `kernel.md`.

---

## 1. Vertical Centering Standard

All centered-content pages use **flex-based vertical centering**. No padding hacks.

- Container: `display: flex; flex-direction: column; align-items: center; justify-content: center`
- Content grows naturally within the flex container.
- `padding-top` / `margin-top` percentages or viewport units MUST NOT be used as centering substitutes.
- Centering must hold during dynamic content changes (typewriter reveals, delayed renders, step transitions).
- Using viewport-percentage padding to simulate centering is a regression.

**Pages using this standard:** Landing, resume ingest, prompt steps, chips page.

## 2. Fixed Bottom Dock Pattern

Input elements that must remain positionally stable during dynamic content above them use a **fixed-bottom dock**.

- Dock: `position: fixed; bottom: 0; left: 0; right: 0` with gradient fade background.
- A spacer element (≥200px) in the normal content flow prevents main content from hiding behind the dock.
- The dock is a separate viewport-anchored layer — content above scrolls independently.
- This pattern prevents typewriter or progressive-reveal content from pushing input elements down.

**Current usage:** Prompt step textarea dock. See `kernel.md` Prompt Input Dock Invariant for behavioral rules.

## 3. Card Depth Layer Model

Elevated cards use a **3-layer depth model** for subtle visual separation from the background:

1. **Background** — page surface (`#050505`)
2. **Depth layer** — green-tinted halo via multi-layer `boxShadow` using `rgba(74,222,128,0.06)`
3. **Card surface** — `rgba(255,255,255,0.03)` – `rgba(255,255,255,0.05)` with subtle border

- Depth must be **subtle** — not glow. If the halo draws conscious attention, it is too strong.
- Applied consistently to all elevated card surfaces (chips page cards, title result hero card).
- See `docs/ui-constitution.md` §2 for surface token values.

## 4. Green Accent Border Treatment

Interactive input surfaces and ingest dropzones use green-accented borders for visual cohesion:

- **Prompt textarea:** `rgba(74,222,128,0.25)` resting → `rgba(74,222,128,0.40)` active
- **Resume dropzone:** `rgba(74,222,128,0.30)` dashed border
- This treatment signals "input expected here" within the dark calibration flow.
- Neutral white borders on input surfaces in calibration flow are deprecated.

## 5. Transition Stability

Layout changes during step transitions must produce **zero visible shift** in elements that are not changing.

- Reserved heights (`min-h-`) on containers prevent reflow jumps.
- See `docs/layout-skeleton.md` §5–6 for reserved heights and transition rules.
- Sequential reveals only: one element at a time, top to bottom.
- At most one animation runs at a time in the visible viewport.

---

## Cross-Reference Notes

- `docs/layout-skeleton.md` §1 (Wordmark Anchor Zone) states the wordmark appears on "every page." This is **superseded** by the Calibration Immersive Flow Invariant in `kernel.md` — calibration flow steps do not render the wordmark/header. `layout-skeleton.md` should be updated to reflect this.
- `docs/ui-constitution.md` §4 (Wordmark Anchor) is the canonical visual spec for the wordmark. Header visibility rules live in `kernel.md`.

---

## Change Control

Changes to this document require a BREAK+UPDATE entry in `Bootstrap/BREAK_AND_UPDATE.md`.
