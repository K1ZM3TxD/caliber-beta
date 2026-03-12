# Layout Skeleton — Caliber Page Composition Rules

This document defines the page composition model and background ownership rules.
Referenced by PM_bootstrap.md as mandatory for layout/composition coder tasks.

---

## Background Layer Ownership

All atmospheric bands, ambient washes, and page-level lighting effects must be implemented at the **page root background layer**.

### Deterministic Structure

```
page root (layout.tsx)
 ├── background layers (fixed, pointer-events-none)
 │    ├── Zone 1: atmospheric green wash (full viewport)
 │    ├── Zone 2: top dark region (38vh)
 │    ├── Zone 3: bottom dark fade (25vh)
 │    └── framing line (1px, above wordmark)
 │
 └── content layer (relative, z-10)
      └── page content
           └── hero / sections / inputs
```

### Rules

1. Atmospheric band must be implemented at the page root `layout.tsx`, not inside hero or section containers.
2. The band must span full viewport width and continue behind all content.
3. If the effect stops at section boundaries, the skeleton is not being followed.
4. Hero and section containers must be transparent to the page background — they must not define their own atmospheric gradients.
5. Component-level visual effects (e.g., button hover states, card borders) remain inside their components.

### Implementation

Background zones use shared CSS custom properties (tokens) from `globals.css`:
- `--bg-atmospheric-wash` — the green radial wash
- `--bg-top-dark` — top vignette
- `--bg-bottom-fade` — bottom fade
- `--bg-framing-line` — architectural rule

These are rendered as `fixed` `pointer-events-none` divs with explicit z-index layering:
- Wash: `z-[1]`
- Dark zones: `z-[2]`
- Framing line: `z-[3]`
- Content: `z-10`

### What is invalid

- Hero-local radial-gradient that creates a page-level atmospheric effect.
- Section-contained background that causes the band to restart between sections.
- Ad hoc green rgba values outside the shared token definitions.
- Any background styling inside a content component that duplicates or overrides the skeleton zones.

---

## Zone Model

### Reserved Heights

| Zone | Position | Height | Purpose |
|------|----------|--------|---------|
| Top dark | `fixed top-0` | 38vh | Darkens top edge above content |
| Atmospheric wash | `fixed inset-0` | 100vh | Continuous green atmosphere |
| Bottom fade | `fixed bottom-0` | 25vh | Darkens bottom edge |
| Framing line | `fixed` at `calc(50% - 5.5rem)` | 1px | Architectural rule above wordmark |

### Content Layer

- Content sits at `z-10`, above all background zones.
- Content uses `min-h-screen flex items-center justify-center`.
- Content wrapper: `max-w-[600px]` (layout default) or `max-w-[720px]` (hero).

---

## Transition Stability

Background zones are `fixed` and do not move with scroll.
Content scrolls above the fixed background.
No zone should cause a visual "jump" when navigating between pages that share the same layout.

---

## Current Status (2026-03-12)

The skeleton structure (tokens, zones, z-index layering) is implemented in `globals.css` and `layout.tsx`.
The intended visual result (atmospheric green band visible behind hero content) has **NOT been reliably confirmed** to match the reference target.
The structural foundation is in place; the visual calibration remains unresolved.
