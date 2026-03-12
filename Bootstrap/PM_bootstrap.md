# PM Bootstrap — Caliber Operating Rules

This document defines the PM-to-coder handoff contract.
Updated deliberately when handoff failures reveal missing structure.

---

## Mandatory UX/UI Coder Task Structure

Every UX/UI coder task must include all six of the following elements.
Coder must reject UX/UI tasks missing any of these required elements.

### 1. Ownership Layer
State the exact layout/styling layer where the behavior lives.
Example: "This effect lives at the page root background layer" or "This style is owned by the hero section component."

### 2. Removal Clause
Explicitly state which old implementation must be deleted or removed.
Example: "Remove the hero-local gradient in app/page.tsx" or "No existing implementation to remove."

### 3. Layout Tree
Provide a compact structural tree when composition or ownership matters.
Example:
```
page
 └ background layer
      └ atmospheric band (full width)
 └ content layer
      └ hero
           └ logo
           └ tagline
```

### 4. Acceptance Criteria
Observable proof conditions. Not mood language, not aesthetic descriptions.
Example: "Band spans full viewport width" — not "The page should feel atmospheric."

### 5. Files in Scope
Explicit list of allowed files to touch.
Example: "app/layout.tsx, app/globals.css — no other files."

### 6. Commit + Push
Required end-of-task workflow. Every task ends with:
```
git add .
git commit -m "<message>"
git push
```

---

## Layout/Background Task Enforcement

If a visual effect is page-level, PM must explicitly state:
- That it lives at the page root/background layer.
- That any hero-local or section-local implementation must be removed.
- That the effect must not restart between sections.

If a visual effect is component-level, PM must explicitly state:
- Which component owns the effect.
- That the effect must not leak into the page root.

---

## UI Constitution + Layout Skeleton Requirements

All UX/UI coder tasks must reference:
- `docs/ui-constitution.md` — shared visual primitives contract.
- `docs/layout-skeleton.md` — page composition and background ownership rules.

Tasks that involve layout or composition must additionally comply with the layout skeleton's zone model and background ownership rules.

Coder must reject UX tasks missing these references when the task involves visual primitives or layout.

---

## Process History

- 2026-03-12: Deterministic UX handoff rule formalized after repeated UI drift from under-specified ownership/removal logic.
- Root cause: visual tasks described only as outcomes/mood without ownership layer, removal clause, or structural tree.
- Multiple attempts to recreate atmospheric band/depth effect failed because handoffs lacked structural specificity.
