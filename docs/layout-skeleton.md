# Layout Skeleton — Caliber Page Composition Rules

This document defines the page composition model and background ownership rules.
Referenced by PM_bootstrap.md as mandatory for layout/composition coder tasks.

---

## Background Layer Ownership

All atmospheric bands, ambient washes, and page-level lighting effects must be implemented at the **page root background layer**.

### Deterministic Structure

```
page root (layout.tsx) — Global Atmosphere
 ├── background layers (fixed, pointer-events-none)
 │    ├── z-[1]: atmospheric green wash (full viewport radial)
 │    ├── z-[2]: top darkening vignette (100vh linear-gradient)
 │    └── z-[3]: framing line (1px, architectural rule)
 │
 └── content layer (relative, z-10)
      └── page content
           └── HeroSurface (local depth primitive)
                └── hero text / CTA
```

### Two-Layer Depth Model

| Layer | Owner | Purpose | Scope |
|-------|-------|---------|-------|
| Global Atmosphere | layout.tsx | Page mood, ambient wash, vignette | Full viewport, all routes |
| HeroSurface | Shared component | Visible depth behind hero content | Per-page, composable |

### Rules

1. Atmospheric band must be implemented at the page root `layout.tsx`, not inside hero or section containers.
2. The band must span full viewport width and continue behind all content.
3. If the effect stops at section boundaries, the skeleton is not being followed.
4. Hero and section containers must be transparent to the page background — they must not define their own atmospheric gradients.
5. Component-level visual effects (e.g., button hover states, card borders) remain inside their components.

### Implementation

Global atmosphere layers in layout.tsx:
- Wash: `fixed inset-0 z-[1]` — green radial gradient
- Vignette: `fixed inset-x-0 top-0 z-[2]` — top darkening over 100vh
- Framing line: `fixed inset-x-0 z-[3]` — 1px architectural rule
- Content: `relative z-10`

HeroSurface primitive (`app/components/HeroSurface.tsx`):
- Wraps hero content with a soft neutral dark radial behind it
- Variants: `soft` (subtle) and `elevated` (stronger)
- Uses `absolute` positioning with oversized inset for soft bleed
- Does not paint page-level atmosphere

Background tokens in `globals.css`:
- `--bg-base: #050505`
- `--bg-framing-line` — green gradient for architectural rule

### What is invalid

- Hero-local radial-gradient that creates a page-level atmospheric effect.
- Section-contained background that causes the band to restart between sections.
- Ad hoc green rgba values outside layout.tsx atmosphere layers.
- Any background styling inside a content component that duplicates the skeleton zones.
- Page-specific one-off gradient hacks for hero depth (use HeroSurface instead).
- Tuning global atmosphere parameters to achieve hero-level depth separation.

---

## Zone Model

### Reserved Layers

| Zone | Position | z-index | Purpose |
|------|----------|---------|---------|
| Atmospheric wash | `fixed inset-0` | z-[1] | Continuous green atmosphere |
| Top darkening | `fixed inset-x-0 top-0` | z-[2] | Sculpts wash into depth |
| Framing line | `fixed inset-x-0` at `calc(50% - 5.5rem)` | z-[3] | Architectural rule |
| Content | `relative` | z-10 | Page content above all background |

### HeroSurface (Composable)

Not a fixed zone — composed per-page inside the content layer.
Creates local depth behind hero content using a neutral dark radial gradient.
See `app/components/HeroSurface.tsx`.

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
