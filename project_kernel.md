Caliber — PROJECT KERNEL

This document defines the invariant structure of Caliber.

All doctrine here is considered locked unless explicitly revised.

PHILOSOPHY

Calibration optimizes for alignment, not activity.

Competence is not the same as expression.

A role can be executable and still be misaligned.

The system does not decide.

It illuminates.

Precision creates clarity.

Clarity creates momentum.

Calibration is structural grounding.

Not ego reinforcement.

Filtration is focus.

CORE METRICS

ALIGNMENT SCORE (0–10)

Measures working pattern expression fit.

Built from 6 internal pattern dimensions.

Severe contradiction penalized more than mild tension.

Reflects identity expression — not readiness.

Includes structural environment preference.

SKILL MATCH (0–10)

Measures execution readiness today.

Built from grounded / adjacent / new terrain classification.

Encodes authority tier and scope stretch.

Stretch Load = inverse of Skill Match.

METRICS ARE NEVER BLENDED.

STRUCTURAL INVARIANT

Alignment dimensions measure identity expression.

Skill Match measures capability readiness.

Alignment scoring must never incorporate capability strength.

Skill Match must never incorporate identity alignment.

PATTERN CAPTURE INSTRUMENT (LOCKED)

Calibration extracts working pattern through structured reflection.

The following prompts are used sequentially (one at a time):

In your most recent role, what part of the work felt most like you?

What part of the role drained you fastest?

What do others come to you for that isn’t necessarily in your job description?

What type of challenge feels exciting rather than overwhelming?

If you removed job titles entirely, how would you describe the work you’re best at?

Rules:

Free text only

One question at a time

Hard gating with minimum signal threshold

One clarifier maximum per prompt

Direct confrontation clarifier for evasive responses

Answers frozen once advanced

No instructional framing

Unlimited response length

Reflective answers carry highest language weight

After Prompt 5:

Internal consolidation phase required

Person vector encoded and locked before synthesis

Time-simulated calibration ritual shown to user with visible progress bar

ALIGNMENT SCORING MECHANICS (LOCKED)

Assume:

n = 6 dimensions

Person vector P_i ∈ {0,1,2}

Role vector R_i ∈ {0,1,2}

Distance per dimension:

d_i = abs(P_i - R_i)

Contradiction classes:

Severe contradiction iff d_i = 2

Mild tension iff d_i = 1

Counts:

S = count(d_i = 2)

M = count(d_i = 1)

Penalty weighting:

W = 1.0S + 0.35M

Scale to 0–10:

raw = 10 * (1 - W / n)

Alignment = round(clamp(raw, 0, 10), 1)

Dimensions equally weighted.

Functional form locked.

LOCKED ALIGNMENT DIMENSIONS

Structural Maturity

Authority Scope

Revenue Orientation

Role Ambiguity

Breadth vs Depth

Stakeholder Density

No additional alignment dimensions may be introduced.

POST-CALIBRATION FLOW ARCHITECTURE (LOCKED)

Resume Ingest

Parse resume for structural signals (not tone).

5 Reflective Prompts

Extract identity-level pattern signals.

Pattern Synthesis

Output:

2–3 sentence structural summary

Where You Operate Best

Where You Lose Energy (structural translation only)

Title Hypothesis

Output:

Identity summary (1 sentence)

Single market-native title

Plain explanation of role meaning

Open-ended reaction prompt

Title Dialogue Loop

Clarify resistance

Adjust one dimension at a time

Recompute pattern only if new structural signals emerge

No cap on exploration

Job Ingestion

Encode job into locked 6-dimension role vector.

Alignment Output

Show:

Alignment score

Skill Match score

Stretch load

Structural explanation

Severe contradiction surfaced if present

No blending.

No skipping order.

LANGUAGE DOCTRINE

System must not sound more educated than the user.

May tighten within ±15%.

MISALIGNMENT FRAMING

Use:

Adaptation load

Energy diversion

Structural friction

Avoid:

Emotional dramatization