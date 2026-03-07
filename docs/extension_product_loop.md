# Extension Product Loop

How the Caliber browser extension fits into the product.

---

## Product Loop

```
calibration → extension → real job fit evaluation
```

1. **Calibration sets the signal.** The user uploads a resume, answers prompts, and the system identifies their working pattern and title anchors.
2. **Extension applies the signal to real jobs.** The user browses LinkedIn, clicks the Caliber extension on a job post, and sees a fit score with explanation.
3. **User evaluates fit / stretch / alignment on LinkedIn.** The score, supports-fit bullets, stretch factors, and bottom line help the user decide whether to pursue the role.

---

## Product Positioning

| Layer | Role |
|-------|------|
| **LinkedIn** | Navigation layer — where users discover and browse jobs |
| **Caliber** | Decision layer — where users understand fit and make informed choices |

Caliber does not replace job search. It adds a decision signal on top of the user's existing workflow.

---

## Why the Extension Matters

- The strongest insight happens when the calibration pattern is applied against a **real job** — not in the abstract.
- Calibration alone gives the user title anchors, but the full value appears when those anchors are tested against real job descriptions.
- The extension is the primary surface where users experience the "aha" of fit scoring.
- Without the extension, calibration is a one-time output. With the extension, calibration becomes a persistent decision tool.

---

## Current Beta Distribution Status

- The extension is being distributed in **beta** before Chrome Web Store approval.
- Users download from Caliber's extension page / beta flow (/extension landing page).
- Extension must use the canonical production host: `https://www.caliber-app.com`.
- Testing must use the current `extension/` folder build, not stale root zip artifacts.

---

## Extension Workflow Constraint

Only one extension branch at a time should make major changes to `extension/content_linkedin.js` unless there is a tightly controlled integration plan. Multiple parallel extension branches have caused renderer, persistence, and packaging regressions.
