# Calibration Product Logic

Product logic behind calibration scoring and title outputs.

---

## Pattern vs History

Calibration balances two inputs that can each fail in isolation:

| Extreme | Failure Mode |
|---------|-------------|
| **History-only literalism** | Treats the resume as a ceiling. User gets titles that mirror their last job title verbatim. No room for growth, adjacent movement, or pattern expression. |
| **Pattern-only abstraction drift** | Ignores domain grounding entirely. User's behavioral traits (systems thinking, clarity, communication) map to unrelated title families with no domain support. |

**Caliber rule:**
- History constrains the plausible domain.
- Pattern shapes role expression and adjacent movement within that domain.

A cybersecurity professional who shows strong systems-design and communication patterns should get titles like "Security Architect" or "Security Program Manager" — not "Brand Systems Designer."

---

## Title Selection Model (2 + 1)

Calibration outputs exactly **3 titles**:

| Slot | Description |
|------|-------------|
| **Title 1** | Strong current/proven fit — high confidence the user could land and succeed in this role today. |
| **Title 2** | Strong fit / close alternate — a credible variation within the same role family. |
| **Title 3** | Adjacent credible opportunity — a believable next career step that stretches into adjacent territory. |

Titles 1 and 2 should feel obvious given the user's background. Title 3 should feel like a reach that still makes sense.

---

## Credibility Boundary

Adjacent titles (especially Title 3) must feel reachable within roughly **one career step**.

They should not:
- Jump into unrelated domains with no domain support
- Require a completely different skill set or credential base
- Feel like a fantasy or aspirational identity untethered from the resume

They should:
- Build on existing domain expertise
- Leverage demonstrated behavioral patterns
- Feel like something the user could credibly pursue in the next 1–2 years

---

## Match Quality Rule

Top displayed matches should score **7.0+ out of 10** for strong, real-user profiles.

- Strong profile = clear resume with substantive domain experience + thoughtful prompt answers.
- If top matches fall below 7.0, the title-selection logic likely missed — this is not acceptable final output.
- Weak, generic, or thin profiles may produce lower scores; the 7.0 threshold applies to well-formed input.

---

## Known Failure Mode: Abstract Title-Family Drift

**Observed behavior:**
- The system over-indexes on abstract behavioral traits (clarity, systems thinking, communication, stakeholder alignment).
- These traits map to many unrelated role families.
- Without domain anchoring, the system produces titles from completely different industries or functions.

**Example:**
- User: cybersecurity / offensive security / technical investigation background
- Bad output: "Brand Systems Designer" — matches abstract traits but has zero domain support
- Good output: "Security Architect" — matches both pattern and domain

**Root cause:** The synthesis pipeline weighted pattern signals too heavily relative to domain/resume signals, allowing abstract trait clusters to dominate title selection.

**Guard:** Title selection must always verify that recommended titles have domain support from the resume, not just trait-pattern alignment.
