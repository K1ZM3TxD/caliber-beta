# UI Constitution — Caliber Visual Primitives Contract

> **This document is mandatory for all UX/UI coder tasks.**
> PM must attach or reference this file in every UX/UI task handoff.
> Coder must reject UX/UI tasks that do not reference this document.

---

## Purpose

This is the single source of truth for Caliber's visual primitives. Every UI implementation must conform to these rules. Local page-level overrides are not permitted unless explicitly approved and documented here.

---

## 1. Text Tokens

| Token | Value | Usage |
|---|---|---|
| **Body text** | `text-neutral-400` / `#a3a3a3` | Default paragraph and description text |
| **Heading text** | `text-neutral-200` / `#e5e5e5` | Page headings, section titles |
| **Primary accent text** | `text-green-400` / `#4ade80` | Primary CTAs, active states, positive signals |
| **Secondary accent text** | `text-yellow-400` / `#facc15` | Secondary CTAs, caution signals, stretch indicators |
| **Muted text** | `text-neutral-500` / `#737373` | Labels, captions, de-emphasized content |
| **Wordmark** | `text-neutral-500`, `tracking-[0.55em]`, uppercase | CALIBER wordmark only |

- No bright white (`text-white`) for body text. Reserve for rare high-emphasis moments only.
- Text hierarchy: headings > body > muted. Respect the weight ladder.

---

## 2. Surface Tokens

| Token | Value | Usage |
|---|---|---|
| **Page background** | `#050505` | Universal dark surface for all pages |
| **Card surface** | `rgba(255,255,255,0.03)` – `rgba(255,255,255,0.05)` | Elevated content containers |
| **Card border** | `rgba(255,255,255,0.06)` – `rgba(255,255,255,0.10)` | Subtle boundary for cards |
| **Interactive surface (green)** | `rgba(74,222,128,0.06)` bg, `rgba(74,222,128,0.45)` border | Primary action buttons |
| **Interactive surface (yellow)** | `rgba(250,204,21,0.06)` bg, `rgba(250,204,21,0.35)` border | Secondary action buttons |

- No solid color fills for buttons. Outlined style is canonical.
- Card surfaces must remain subtle — never compete with content.

---

## 3. Top-Band + Glow Model

The ambient gradient establishes brand presence at the top of every page.

- **Gradient type:** Radial gradient, wide and subtle.
- **Gradient center:** `50% 12%` (lowered from original iterations for grounding).
- **Gradient color:** Green-tinted glow — `rgba(74,222,128,0.06)` fading to transparent.
- **Extent:** Covers roughly the top 40–50% of viewport, fading to the `#050505` surface.
- **Ownership:** Each page renders its own gradient instance. No shared gradient component exists yet (see Shell Framework Invariant in `kernel.md`).

- The gradient must feel ambient, not decorative. If it draws conscious attention, it is too strong.
- No sharp lines, no hard gradient stops, no centered bright band.

---

## 4. Wordmark Anchor

- The CALIBER wordmark renders at the top of every page via `CaliberHeader`.
- Positioning: `pt-4` from page top.
- Style: uppercase, `tracking-[0.55em]`, `text-neutral-500`, `text-sm`.
- The wordmark is a quiet brand anchor, not a navigation element or heading.
- Do not enlarge, bold, brighten, or reposition the wordmark without PM approval.

---

## 5. Content Width

| Context | Max width | Class |
|---|---|---|
| **Standard content pages** | `600px` | `max-w-[600px]` |
| **Board / dashboard pages** | `960px` | `max-w-[960px]` |
| **Full-width exceptions** | viewport | Only with explicit PM approval |

- Content is always horizontally centered (`mx-auto`).
- Content must not touch viewport edges — maintain comfortable horizontal padding (`px-4` minimum).

---

## 6. Spacing Rhythm

All vertical spacing uses a base-4 / base-8 scale (Tailwind default spacing).

| Spacing use | Value |
|---|---|
| **Section gap (major)** | `mt-12` / `mt-16` (48px / 64px) |
| **Section gap (minor)** | `mt-6` / `mt-8` (24px / 32px) |
| **Element gap (within section)** | `mt-3` / `mt-4` (12px / 16px) |
| **Tight grouping** | `mt-1` / `mt-2` (4px / 8px) |

- Prefer consistent gaps within a page — do not mix major and minor gaps arbitrarily.
- Vertical rhythm should feel calm and evenly paced, not cramped or scattered.

---

## 7. Interaction Boundary Visibility

Every interactive element must have a visible boundary or state change. Users must never wonder "is this clickable?"

- **Buttons:** Outlined with accent-color border (green or yellow). Hover state brightens border/text.
- **Collapsible sections:** Toggle indicator (chevron or similar). Label must look interactive (accent color or underline on hover).
- **Form fields:** Visible border against dark background. Focus state uses accent-color ring.
- **Links:** Accent-colored text. Underline on hover or always-underlined for inline text links.
- **Cards (if clickable):** Hover state must show border brightening or subtle surface shift.

- No invisible-boundary interactions. No "ghost buttons" that blend into the background.
- Disabled states: reduce opacity to `0.4`–`0.5`, remove hover effects.

---

## Shell Feel

The overall visual identity is: **calm, cinematic, premium.**

- Dark, quiet surfaces.
- Subtle ambient light, never harsh.
- Typography-led hierarchy — spacing and weight do the work, not color saturation.
- No visual noise: no decorative dividers, no gratuitous animations, no competing accent colors.
- **Centered hero continuity:** Pages that share a centered hero shell (landing, resume ingest, build-resume) must use a shared `minHeight` on the content zone so the wordmark anchor position is identical across transitions. See Layout Skeleton §5.1.

---

## 8. Staged Progress Treatment

Processing / loading screens that represent multi-second backend work use a staged progress bar instead of a vague time estimate.

- **Stages:** 20 → 40 → 60 → 80 → Complete.
- **Bar track:** `rgba(255,255,255,0.06)`, 3px height, rounded.
- **Bar fill:** `rgba(74,222,128,0.45)` during progress, `#4ADE80` on Complete.
- **Label:** Muted text (`#737373`) showing percentage during progress; green accent (`#4ADE80`) for "Complete".
- **Bar width:** Max 260px, centered.
- **Timing:** CSS transition `width 0.6s ease` for smooth visual movement between stages.
- The progress bar accompanies the spinner — it does not replace it.
- Progress is presentation-only; it does not reflect literal backend percentage.

---

## 9. Mobile Responsive Scale

All visual primitives adapt to smaller viewports via a shared responsive scale. The breakpoint boundary is Tailwind's `sm` (640px).

| Token | Mobile (< 640px) | Desktop (≥ 640px) |
|---|---|---|
| **Page horizontal padding** | `px-4` (16px) | `px-6` (24px) |
| **Wordmark font-size** | `1.6rem` | `2.15rem` |
| **Wordmark letter-spacing** | `0.18em` | `0.22em` |
| **Hero heading font-size** | `20px` | `26px` |
| **Hero heading letter-spacing** | `0.18em` | `0.22em` |

- Mobile reduces spacing and type scale proportionally — never simply truncates or hides content.
- Letter-spacing tightens on mobile to prevent overflow and maintain rhythm.
- Buttons and interactive elements maintain minimum 44px tap targets on mobile.
- Horizontal button groups must use `flex-wrap` so buttons stack on narrow screens.
- No horizontal scroll is permitted on content pages. Board/dashboard pages may use horizontal scroll for multi-column layouts.

---

## Change Control

Changes to this document require a BREAK+UPDATE entry in `Bootstrap/BREAK_AND_UPDATE.md`. This is a governed contract, not a living suggestion file.
