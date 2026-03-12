# CALIBER ISSUES LOG

## Current Open Issues

### 54. Atmospheric band / hero depth effect not reliably recreated — RESOLVED (2026-03-12)

**Symptom:**
Repeated UI passes leave the atmospheric band effect unchanged or misimplemented.
The intended page-level green atmospheric wash and hero depth separation do not visually match the reference target on deployed builds.

**Root cause:**
Two separate problems were conflated into one:
1. Effect was described visually (mood language) but not structurally — fixed by deterministic handoff rules.
2. Global atmosphere was being tuned to produce hero-level depth, which is architecturally impossible on near-black backgrounds.

**Resolution:**
- Two-layer depth model formalized: Global Atmosphere (layout.tsx) + HeroSurface (shared primitive).
- Shared HeroSurface component created with `soft` and `elevated` variants.
- Landing and results pages now compose HeroSurface for local depth.
- Layout.tsx retains global atmosphere only.

**Status:** RESOLVED

---

### 55. Hero-local gradients violate shared background ownership — RESOLVED (2026-03-12)

**Symptom:**
UX tasks that describe page-level atmospheric effects get implemented as hero-local gradients inside content containers.

**Root cause:**
PM handoffs did not distinguish atmosphere from hero depth. Without two-layer model, all depth work defaulted to page-level gradient tuning.

**Resolution:**
- HeroSurface primitive now owns hero-level depth as a composable layer.
- Pages compose HeroSurface; they do not invent page-level gradients.
- PM_bootstrap.md requires naming the target layer.

**Status:** RESOLVED

---

### 56. Landing depth failed due to page.tsx main occluding layout.tsx body — RESOLVED (2026-03-12)

**Symptom:**
UI changes to layout.tsx background produced no visible change on the landing page.

**Root cause:**
page.tsx `<main>` used `fixed inset-0` which painted a full-screen layer over the body background from layout.tsx. All layout.tsx background layers (atmospheric wash, vignette, hero surface) were invisible because `<main>` covered them.

**Diagnostic:**
- Set body background to red → page showed blue (diagnostic color on `<main>`).
- Confirmed `<main>` was the visual background owner.

**Resolution:**
- Removed all background painting from page.tsx `<main>`.
- `<main>` is now a transparent structural wrapper.
- All page-level background layers live in layout.tsx.
- Hero depth lives in HeroSurface composable primitive.

**Status:** RESOLVED

---

## Resolved Issues

### 53. Visual drift from under-specified PM UX handoffs — MITIGATED (2026-03-12)

PM-to-coder UX tasks were issued without shared visual primitives, relying on local page-level styling instructions only.
Result: repeated visual drift and regressions requiring correction passes.
Root cause: no mandatory contract requiring shared visual rules on UX handoffs.
Mitigation: 6-part deterministic UX handoff rule formalized in PM_bootstrap.md.
UI Constitution and Layout Skeleton made mandatory references.
Status: process fix documented. Effectiveness to be verified on next UX coder task.
