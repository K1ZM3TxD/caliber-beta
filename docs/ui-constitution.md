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

**Current status (2026-03-12):** Background tokens and skeleton zones are defined in `globals.css` and `layout.tsx`. The intended atmospheric band effect has NOT been reliably recreated to match the reference. The structural foundation exists but the visual result is not yet confirmed.

---

## Text Tokens

- Base text: `#F2F2F2` / `--foreground`
- Muted text: `opacity-80` or `text-zinc-400`
- Tracking (wordmark): `tracking-[0.35em]`
- Tracking (tagline): `tracking-[0.06em]`

---

## Surface Tokens

- Page base: `#000000` / `--bg-base`
- Hero surface lift: `--bg-hero-surface` (subtle white-lift gradient, not a card)

---

## Background Tokens (Shared)

All defined as CSS custom properties in `globals.css`:

- `--bg-base` — Pure black page surface
- `--bg-top-dark` — Top darkening vignette
- `--bg-atmospheric-wash` — Green atmospheric radial wash
- `--bg-framing-line` — Thin green architectural rule
- `--bg-bottom-fade` — Bottom dark fade
- `--bg-hero-surface` — Subtle hero depth lift

These tokens are consumed by the skeleton zones in `layout.tsx`.
No page or component may define its own atmospheric gradient outside these tokens.

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
