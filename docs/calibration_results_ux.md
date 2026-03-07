# Calibration Results UX

Intended UX for the calibration results page after calibration completes.

---

## Intended Flow (Sequential Reveal)

The results page uses a guided, sequential reveal. Each element appears one at a time, top to bottom.

### Sequence

1. **Typewriter:** "Your signals have been calibrated."
2. **Typewriter:** "These titles best match your pattern."
3. **Title cards** reveal sequentially (one at a time, top to bottom).
4. **Typewriter:** "See your job fit score on real roles."
5. **Typewriter:** "Use the Caliber LinkedIn extension."
6. **CTA button:** "Find your fit on LinkedIn"

---

## Removed Sections

The following sections have been intentionally removed from the calibration results page:

| Section | Reason Removed |
|---------|---------------|
| **Where You Operate Best** | Did not land — felt like regurgitated prompt content |
| **Lose Energy** | Same — restated what user already told us without new insight |
| **Pattern summary prose block** | Verbose restatement that did not add value over the title cards themselves |

**Guiding principle:** The real insight appears in the extension when the calibration pattern is applied to a live job. The results page should not try to substitute for that with weak summary prose.

---

## Animation / Reveal Rules

These rules are canonical for the calibration results page:

- **One reveal block at a time** — never show two elements appearing simultaneously.
- **Strict top-to-bottom sequencing** — each block waits for the previous to complete.
- **No overlapping typewriters** — only one typewriter cursor active at any moment.
- **No multiple cursors** — the page should never have two typing animations running.
- **No simultaneous motion** — no elements animating in parallel across different parts of the page.

**Feel:** The page should feel guided, calm, and sequential — like a conversation unfolding, not a dashboard loading.

---

## Implementation Guidance

The reveal sequence should be driven by a **single sequential orchestrator or state machine**, not by multiple independent timers or separate animation controllers. Independent timers cause overlapping reveals, which violates the calm-sequential feel.

---

## Regression Risk

The removed sections (Operate Best, Lose Energy, summary prose) have been reintroduced by implementation drift in previous iterations. This is a known UX regression to guard against. If these sections reappear in the codebase, they should be treated as bugs, not features.
