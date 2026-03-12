# BREAK AND UPDATE LOG

Running log of process corrections and enforcement changes.
Each entry records what changed, why, and what is expected going forward.

---

## 2026-03-12 — Deterministic UX Task Rule + Unresolved Atmospheric Band Recreation

### What changed
New deterministic UX handoff rule formalized with 6 required elements:
Ownership Layer, Removal Clause, Layout Tree, Acceptance Criteria, Files in Scope, Commit + Push.

### Why it changed
Repeated UI drift from under-specified ownership/removal logic in PM-to-coder UX handoffs.
Visual tasks were being described as aesthetic outcomes ("atmospheric band," "depth separation") without specifying:
- which layer owns the effect
- which old implementation to remove
- what structural tree the result must follow

This caused the same visual correction to be attempted multiple times without reliable success.

### What is now expected
All UX/UI coder tasks include the 6 required elements defined in PM_bootstrap.md.
PM specifies ownership layer and removal clause explicitly.
Layout/background tasks state root-level or component-level ownership.

### What is no longer expected
Visual tasks described only as outcomes or mood language without ownership and removal.
Ad hoc gradient tuning without structural specification.

### Risk / Fallout
Slower PM task writing, but significantly lower UI drift and fewer correction cycles.

### Proof target
Future UX tasks enforce ownership-layer language and structural tree.
Coder rejects tasks missing required elements.

### Unresolved: Atmospheric Band / Depth Effect

**Status: NOT RELIABLY RECREATED**

Repeated attempts to recreate the intended atmospheric band/depth effect have not yet reliably succeeded.
The effect has been described, token values have been adjusted, z-index layering has been added, and opacity has been increased — but the visual result on the deployed page has not consistently matched the intended reference.

Process correction is being added because visual wording alone has not been sufficient to produce the target result.
The deterministic handoff rule is the structural response to this failure pattern.

The atmospheric band recreation should be reattempted only after the new deterministic handoff structure is actively used, and only with explicit ownership-layer + removal-clause compliance.

---

## 2026-03-12 — Two-Layer Depth Model (Atmosphere vs HeroSurface)

### What changed
Formalized the distinction between global atmosphere and hero-level depth as two separate visual layers with separate owners.

### Why it changed
Landing depth work stalled across multiple passes because every task targeted the global atmospheric background layer. Diagnostic investigation proved:
- layout.tsx correctly owned the page background
- A full-screen `<main>` in page.tsx was occluding the body background
- The results page's depth effect comes from a local hero surface treatment, not from global atmosphere alone

The missing architectural insight: global atmosphere creates mood, but visible hero depth requires a dedicated surface primitive behind the hero content.

### What is now expected
- Global atmosphere (wash, vignette, framing line) → owned by layout.tsx
- Hero depth (lifted dark plane behind hero content) → owned by shared HeroSurface primitive
- PM tasks must name which layer they target
- Pages compose these layers; they do not invent new lighting systems

### What is no longer expected
- Treating "background atmosphere" and "hero depth" as the same problem
- Tuning global atmospheric gradients to create local hero separation
- Page-specific one-off gradient hacks for depth

### Root cause record
Multiple commits landed correctly but produced no visible change because the global atmosphere layer cannot produce perceptible hero-level depth separation on near-black backgrounds. The fix is architectural (two layers), not parametric (stronger gradients).
