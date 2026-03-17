# Signal Injection Telemetry Analysis

> Generated: 2026-03-17T03:29:09.282Z

## Executive Summary

Signal injection produced a **negligible** mean score shift of **0.02** across **28** matched job pairs.

- **1** jobs scored higher with signals, **0** scored lower, **27** unchanged.
- Strong-match yield: **54/54** (signal_on) vs **30/30** (signal_off).
- **0** jobs crossed the 7+ threshold only because of signal injection.
- **0** jobs dropped below threshold with signal injection.

**Trustworthiness:** Moderate — sufficient sample for directional conclusions.

## Data Overview

| Metric | signal_on | signal_off | untagged |
|--------|-----------|------------|----------|
| Total events | 315 | 181 | 38 |
| Scored jobs (unique) | 54 | 30 | — |
| Strong matches (≥7) | 54 | 30 | — |
| Strong match rate | 100% | 100% | — |

### Matching Methodology

- **Job identity:** LinkedIn job ID extracted from URL (`currentJobId` or `/jobs/view/{id}`). Fallback: normalized `title|company` composite key.
- **Duplicate rule:** If multiple score events exist for the same job within a condition, the latest `job_score_rendered` is used. Fallback priority: `strong_match_viewed` > `job_opened`.
- **Matched pairs:** 28 jobs scored in both conditions.

## Score Delta Statistics

Delta = signal_on_score − signal_off_score

| Statistic | Value |
|-----------|-------|
| Mean delta | 0.02 |
| Median delta | 0 |
| Min delta | 0 |
| Max delta | 0.6 |
| Jobs improved | 1 |
| Jobs unchanged | 27 |
| Jobs worsened | 0 |
| Threshold crossings (gained) | 0 |
| Threshold crossings (lost) | 0 |

### Top Positive Deltas (signal injection helped most)

| Job Title | Company | signal_on | signal_off | Delta |
|-----------|---------|-----------|------------|-------|
| Business Development Manager | Bay Logistics, Inc. | 7.7 | 7.1 | +0.6 |

### All Matched Pairs

| Job Title | Company | signal_on | signal_off | Delta |
|-----------|---------|-----------|------------|-------|
| Business Development Manager | Bay Logistics, Inc. | 7.7 | 7.1 | +0.6 |
| Business Development Manager | Mitchell Silberberg & Knupp LLP | 8.3 | 8.3 | 0 |
| Business Development Manager | MARKHAM | 7.7 | 7.7 | 0 |
| Business Development Manager | LETL | 7.2 | 7.2 | 0 |
| Business Development/Sales Manager | Precision Contractors | 7.7 | 7.7 | 0 |
| Business Development Manager | Innodisk Corporation | 7.1 | 7.1 | 0 |
| CLTC Business Development Manager | Certitrek Group | 7.2 | 7.2 | 0 |
| Business Development Manager | Buyerlink | 7.2 | 7.2 | 0 |
| Fuel Card Business Development Manager | AZFS LLC | 7.1 | 7.1 | 0 |
| Regional Manager, Business Development - Eastern US | DALS Lighting / Éclairage Dals, Inc. | 7.1 | 7.1 | 0 |
| Laundry Sales Manager / Business Development Manager | Star Fades International - SFI | 7.1 | 7.1 | 0 |
| Senior Partnership Success Manager (Westcoast) | Fox Fold | 7.7 | 7.7 | 0 |
| Partnerships & Community Growth Manager | Motion Recruitment | 7.2 | 7.2 | 0 |
| Partnership Manager | Archer Education | 8.8 | 8.8 | 0 |
| Commercial Manager | Alchemy CO₂ | 7.7 | 7.7 | 0 |
| Alliance Manager | Cork | 8.3 | 8.3 | 0 |
| Business Development Manager-Utility | Vertical Supply Group | 7.1 | 7.1 | 0 |
| Partnerships Manager | Alleaz | 7.2 | 7.2 | 0 |
| Sales Business Development Manager | Alpha Integration | 7.1 | 7.1 | 0 |
| Creator Partnerships Manager | Fahlo | 8.3 | 8.3 | 0 |
| Business Development Manager | Voro | 7.7 | 7.7 | 0 |
| Partnerships Manager | UIDP | 8.8 | 8.8 | 0 |
| Strategic Commercial Manager, Global Markets | Seaman Corporation | 7.2 | 7.2 | 0 |
| Partnership Development Manager (Remote) | Dryad | 8.3 | 8.3 | 0 |
| Senior Business Development Manager | Mobius Talent Global | 7.7 | 7.7 | 0 |
| Business Development Manager | DryRite Restoration LLC | 7.2 | 7.2 | 0 |
| Business Development Manager | Reliance Worldwide Corporation | 8.3 | 8.3 | 0 |
| Business Development Manager — Medical Aesthetics Sales (New York City) | Rion Aesthetics | 7.7 | 7.7 | 0 |

## Secondary: Time-to-Strong-Match (TTSM)

TTSM = elapsed seconds from `search_surface_opened` to first `strong_match_viewed` on the same surface/session.

| Condition | Surfaces | Avg TTSM (s) | Values |
|-----------|----------|-------------|--------|
| signal_on | 1 | 2.8 | 2.8 |
| signal_off | 0 | — | — |

*TTSM is secondary and depends on user browsing speed; sample sizes may be too small for conclusions.*

## Assumptions & Limitations

1. Condition is determined by `sessionId` suffix (`::signal_on`/`::signal_off`) with fallback to `signalPreference` field.
2. Job matching uses LinkedIn job ID when available; otherwise normalized title+company composite. Composite matching may produce false matches if two companies post identically-titled jobs.
3. If a condition has very few scored jobs, statistical conclusions are unreliable.
4. Score differences may include natural LinkedIn DOM extraction variance (different text extracted at different times).
5. `job_score_rendered` is the primary score source (prescan badge scores). `strong_match_viewed` scores (sidecard full-text scores) are used only when no `job_score_rendered` event exists for a job.

---
*Analysis script: `analysis/signal_injection_analysis.js`*
