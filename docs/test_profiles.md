# Test Profiles

Lightweight regression-test reference for real user profiles used in calibration QA.

---

## Chris

- **Background:** Client growth / relationship management / business development.
- **Expected title family:** Client-facing growth roles — Account Director, Client Growth Lead, Business Development Manager, or similar.
- **Good output looks like:** 3 titles anchored in client/growth domain, scores 7+. No bleed into unrelated program management or engineering titles.
- **Known failure modes:** Earlier iterations mis-labeled relationship/team profiles as Program/PM with low confidence. Resolved (fix commit: f36dff0), but remains a regression signal.
- **Regression check:** ClientGrowth archetype should score ~1.0 on cross-domain bleed tests.

---

## Fabio

- **Background:** Cybersecurity / offensive security / technical investigation.
- **Expected title family:** Security-anchored roles — Security Architect, Offensive Security Lead, Cybersecurity Analyst, Threat Intelligence Analyst, or similar.
- **Good output looks like:** 3 titles grounded in the security domain, scores 7+. Title 3 may stretch into adjacent technical leadership but must retain security domain connection.
- **Known failure modes:**
  - Weak prior outputs included unrelated titles like "Brand Systems Designer" — caused by abstract trait drift (systems thinking + clarity mapped to brand/design roles with no domain support).
  - This profile is the **primary regression test for abstraction drift**.
- **Regression check:** If Fabio produces titles outside the security/investigation domain, the title grounding logic has regressed.

---

## Jen

- **Background:** Known low-score / weak-match regression case.
- **Expected title family:** *Details to be grounded in a future session.*
- **Good output looks like:** *Placeholder — Jen's profile historically produces low or weak-scoring outputs. Exact expected titles TBD.*
- **Known failure modes:**
  - Only one low-scoring title produced with no three-option output.
  - This profile is a regression test for the system's handling of profiles that don't map cleanly to strong title families.
- **Regression check:** The system should still produce 3 titles even for difficult profiles. Scores may be lower, but the output structure should be complete.
- **Note:** Jen's exact expected-output details need to be captured once a successful calibration run is established. This entry preserves the need for future grounding.
