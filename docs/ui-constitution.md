# UI Constitution — Caliber Visual Primitives Contract

This document defines the shared visual primitives that all UX/UI implementations must follow.
Referenced by PM_bootstrap.md as mandatory for all UX/UI coder tasks.

---

## Background Ownership

Atmospheric bands, ambient washes, and page-level lighting effects are **shared page-level primitives**.

Rules:
- Hero sections must not implement page-level lighting locally.
- Framing lines, background washes, and dark-zone structure must use shared tokens defined in `globals.css`.
- If a visual effect is intended to span the full viewport, it must be implemented at the page root — never inside a content container.
- Visual effects should be described as primitives and ownership rules, not only as aesthetic moods.

**Current status (2026-03-12):** Two-layer depth model implemented. Global atmosphere owned by layout.tsx. Hero depth owned by shared HeroSurface primitive. Landing page occlusion bug resolved.

---

## Two-Layer Depth System

### Global Atmosphere (layout.tsx)
Creates page mood. Not responsible for hero-level depth.
- Atmospheric green wash (broad radial gradient)
- Top darkening vignette
- Framing line

### HeroSurface (shared primitive)
Creates visible depth separation behind hero content.
- Soft lifted dark plane, not a card
- Reusable component with intensity variants:
  - `soft` — subtle depth
  - `elevated` — stronger separation
- Composable: pages wrap hero content in HeroSurface
- Does not paint page-level atmosphere

### Why two layers
Global atmosphere on near-black backgrounds produces imperceptible contrast differences. Repeated attempts to create hero depth via atmospheric gradient tuning failed because the perceptual delta between `#050505` and `#0f0f0f` is below display/eye threshold. Hero depth requires a dedicated surface primitive with stronger local contrast.

---

## Text Tokens

- Base text: `#F2F2F2` / `--foreground`
- Muted text: `opacity-80` or `text-zinc-400`
- Tracking (wordmark): `tracking-[0.35em]`
- Tracking (tagline): `tracking-[0.06em]`

---

## Surface Tokens

- Page base: `#050505` / `--bg-base`
- Hero surface lift: HeroSurface component (neutral dark radial, not a token — see Two-Layer Depth System)

---

## Background Tokens (Shared)

All defined as CSS custom properties in `globals.css`:

- `--bg-base` — Dark page surface (#050505)
- `--bg-framing-line` — Thin green architectural rule

Atmospheric wash and top darkening are rendered directly in layout.tsx as inline styles.
Hero depth is rendered by the HeroSurface component.

No page or component may define its own atmospheric gradient outside layout.tsx.
No page may define its own hero depth gradient outside HeroSurface.

---

## Interaction Boundaries

- CTA buttons: solid `bg-[#F2F2F2]` on `text-[#0B0B0B]`, no border-radius
- Hover: `hover:bg-white`
- Disabled: `opacity-60 cursor-not-allowed`

---

## Spacing Rhythm

- Section spacing: `mt-8` between major blocks
- Content max-width: `max-w-[720px]` (hero), `max-w-[600px]` (layout wrapper)
- Vertical centering: flexbox `items-center justify-center`
