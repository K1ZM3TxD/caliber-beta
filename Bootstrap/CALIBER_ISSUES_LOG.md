# CALIBER ISSUES LOG

## Current Open Issues

### 54. Atmospheric band / hero depth effect not reliably recreated — UNRESOLVED (2026-03-12)

**Symptom:**
Repeated UI passes leave the atmospheric band effect unchanged or misimplemented.
The intended page-level green atmospheric wash and hero depth separation do not visually match the reference target on deployed builds.

**Root cause:**
Effect was described visually (mood language, reference screenshots) but not structurally.
Handoffs lacked ownership-layer specification, removal clauses, and structural trees.
Multiple correction passes adjusted opacity, z-index, and token values without confirming the rendered result matched intent.

**Mitigation:**
- Deterministic UX handoff rules added to PM_bootstrap.md (6-part contract).
- Background Layer Ownership invariant added to kernel.md.
- Background tokens consolidated into globals.css as CSS custom properties.
- Z-index layering made explicit in layout.tsx.

**Current status:** UNRESOLVED / ACTIVE
The structural groundwork (tokens, skeleton zones, z-index layering) is in place, but the visual effect has not been reliably confirmed as matching the reference.
Next attempt should use the new deterministic handoff structure with explicit ownership and removal.

---

### 55. Hero-local gradients violate shared background ownership — ACTIVE RISK (2026-03-12)

**Symptom:**
UX tasks that describe page-level atmospheric effects get implemented as hero-local gradients inside content containers, causing:
- Band stops at section boundaries instead of continuing across the page.
- Effect restarts between sections.
- Background appears segmented rather than continuous.

**Root cause:**
PM handoffs did not specify that the effect is page-level and must live at the root background layer.
Without explicit ownership language, the default implementation path is to add the gradient to the nearest content container.

**Mitigation:**
- kernel.md invariant: page-level lighting must live at page root.
- PM_bootstrap.md rule: layout/background tasks must state root-level ownership and require removal of hero-local implementations.
- layout-skeleton.md: background ownership section added with explicit zone model.

**Current status:** ACTIVE RISK
Process rules are documented. Compliance depends on enforcement during future handoffs.

---

## Resolved Issues

### 53. Visual drift from under-specified PM UX handoffs — MITIGATED (2026-03-12)

PM-to-coder UX tasks were issued without shared visual primitives, relying on local page-level styling instructions only.
Result: repeated visual drift and regressions requiring correction passes.
Root cause: no mandatory contract requiring shared visual rules on UX handoffs.
Mitigation: 6-part deterministic UX handoff rule formalized in PM_bootstrap.md.
UI Constitution and Layout Skeleton made mandatory references.
Status: process fix documented. Effectiveness to be verified on next UX coder task.
