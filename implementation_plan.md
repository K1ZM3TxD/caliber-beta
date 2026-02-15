\# Caliber — IMPLEMENTATION\_PLAN (Beta v1)



This document governs engineering execution for Beta v1.

Product doctrine is defined in:

\- PROJECT KERNEL

\- MILESTONES

\- STATE



Implementation must conform to those documents.

This plan does not change product doctrine.



Large code writes are delegated to the separate Coder chat.



---



\## Beta v1 Scope Lock



Public application.

No accounts.

No persistence.

No Supabase DB or Auth in v1.



Users do NOT see or select internal 0/1/2 dimension values.



OpenAI is used for extraction only.

All scoring and outputs are deterministic from extracted structured inputs.



---



\## Architecture Lock



\### Stack

\- Next.js (App Router)

\- TypeScript

\- Tailwind

\- Server-side computation (API routes or server actions)

\- Vercel deploy target



\### Core Boundary: Extraction vs Scoring

LLM layer:

\- Extracts structured data only.

\- Never computes scores.

\- Never blends metrics.

\- Never decides.



Deterministic engine:

\- Computes Alignment, Skill Match, Stretch Load.

\- Formats Pattern Synthesis output.



\### OpenAI Extraction Pipeline (Split: 3 calls)

1\) Person Extraction

\- Input: resume text + 5 prompt answers

\- Output:

&nbsp; - person\_vector: {StructuralMaturity, AuthorityScope, RevenueOrientation, RoleAmbiguity, BreadthVsDepth, StakeholderDensity} each in {0,1,2}

&nbsp; - evidence: short quotes/snippets per dimension (internal debugging only; not shown to user by default)



2\) Role Extraction

\- Input: raw job description text

\- Output:

&nbsp; - role\_vector: same 6 dims in {0,1,2}

&nbsp; - requirements: list of discrete requirement strings



3\) Requirement Classification

\- Input: requirements list + resume text

\- Output for each requirement:

&nbsp; - category: "grounded" | "adjacent" | "new"

&nbsp; - scope\_matched\_outcome: boolean

&nbsp; - final\_effective\_category:

&nbsp;   - grounded allowed ONLY if category=="grounded" AND scope\_matched\_outcome==true

&nbsp;   - otherwise downgrade to adjacent



---



\## Data Contracts (Schemas)



\### Six Dimensions (Locked Names)

\- structural\_maturity

\- authority\_scope

\- revenue\_orientation

\- role\_ambiguity

\- breadth\_vs\_depth

\- stakeholder\_density



\### Person Extraction Response

{

&nbsp; "person\_vector": {

&nbsp;   "structural\_maturity": 0|1|2,

&nbsp;   "authority\_scope": 0|1|2,

&nbsp;   "revenue\_orientation": 0|1|2,

&nbsp;   "role\_ambiguity": 0|1|2,

&nbsp;   "breadth\_vs\_depth": 0|1|2,

&nbsp;   "stakeholder\_density": 0|1|2

&nbsp; },

&nbsp; "evidence": {

&nbsp;   "structural\_maturity": \["..."],

&nbsp;   "authority\_scope": \["..."],

&nbsp;   "revenue\_orientation": \["..."],

&nbsp;   "role\_ambiguity": \["..."],

&nbsp;   "breadth\_vs\_depth": \["..."],

&nbsp;   "stakeholder\_density": \["..."]

&nbsp; }

}



\### Role Extraction Response

{

&nbsp; "role\_vector": { ...same shape... },

&nbsp; "requirements": \["req 1", "req 2", "..."]

}



\### Requirement Classification Response

{

&nbsp; "classified\_requirements": \[

&nbsp;   {

&nbsp;     "requirement": "string",

&nbsp;     "category": "grounded"|"adjacent"|"new",

&nbsp;     "scope\_matched\_outcome": true|false

&nbsp;   }

&nbsp; ]

}



---



\## Deterministic Scoring (Locked)



\### Alignment Score (0–10)

Given person\_vector P and role\_vector R, for each dim i:

d\_i = abs(P\_i - R\_i)

S = count(d\_i == 2)

M = count(d\_i == 1)

W = 1.0\*S + 0.35\*M

raw = 10 \* (1 - W / 6)

Alignment = round(clamp(raw, 0, 10), 1)



\### Skill Match (0–10)

From requirement classifications:

\- grounded\_effective = category=="grounded" AND scope\_matched\_outcome==true

\- otherwise:

&nbsp; - if category=="grounded" and scope\_matched\_outcome==false → treat as adjacent

Weights:

\- grounded = 1.0

\- adjacent = 0.5

\- new = 0.0

raw = (1.0\*G + 0.5\*A + 0.0\*N) / T

SkillMatch = round(10\*raw, 1)

If T==0: SkillMatch = 5.0



\### Stretch Load (%)

StretchLoad = round(100 \* (1 - raw), 0)

Always displayed.

Numeric only.

No bands.

No cross-metric contextualization.



---



\## Pattern Synthesis Output (Locked Format)



Structured Block Format:



1\) Title Hypothesis

\- 2–4 words

\- role-agnostic

\- structural pattern only



2\) Pattern Summary

\- exactly 3 sentences

\- declarative

\- no hedging

\- no advisory language



3\) Where You Operate Best

\- 3–5 bullets (default 4)

\- each ≤ 8 words

\- structural language only

\- signal-weighted ordering



4\) Where You Lose Energy

\- 3–5 bullets (default 4)

\- each ≤ 8 words

\- structural language only

\- mirrored opposition to Operate Best

\- signal-weighted ordering



5\) Structural Tensions

\- if severe contradiction exists (S ≥ 1), surface it as primary adaptation-load driver

\- no emotional framing



No “current role validation” section.



---



\## UI Surfaces (Beta v1)



\### Single Page Intake (v1)

Inputs:

\- Resume (paste text)

\- Prompt answers (5 text areas, sequential UI)

\- Job description (paste text)

Action:

\- “Calibrate” (runs pipeline)



\### Results Page

Outputs:

\- Alignment score

\- Pattern Synthesis block

\- Skill Match score

\- Requirement breakdown in plain language (not labels/table):

&nbsp; - “X requirements match prior scope-level execution.”

&nbsp; - “Y require adjacent capability expansion.”

&nbsp; - “Z represent new execution territory.”

\- Stretch Load percentage



Optional debug toggle (default off):

\- show extracted vectors + evidence (for internal testing)



---



\## Environment Variables



\- OPENAI\_API\_KEY



No Supabase keys in v1.



---



\## Build Phases (Execution Order)



\### Phase A — Project Setup

\- Next.js app scaffold

\- Tailwind

\- Basic routes: / (intake), /results

\- Env var handling



\### Phase B — Deterministic Engine Modules

\- lib/alignment.ts

\- lib/skillMatch.ts

\- lib/stretch.ts

\- lib/patternSynthesis.ts (format only; no LLM)



\### Phase C — OpenAI Extraction Layer

\- lib/openai/client.ts

\- lib/openai/personExtract.ts

\- lib/openai/roleExtract.ts

\- lib/openai/requirementsClassify.ts

All functions return typed JSON that matches schemas.



\### Phase D — Orchestration

\- server action or API route: /api/calibrate

Pipeline:

\- person extraction

\- role extraction

\- requirement classification

\- deterministic scoring

\- synthesis formatting

Return one consolidated result object.



\### Phase E — UI Integration

\- Intake collects inputs

\- Calls calibrate endpoint

\- Navigates to results with response payload



\### Phase F — Deployment

\- Vercel deploy

\- Smoke test



---



\## Definitions of Done



Beta v1 DoD:

\- Paste inputs → receive deterministic scores + synthesis output

\- No manual dimension selection

\- No persistence

\- Outputs match locked formatting constraints



---



\## Post-Beta Deferred (Do Not Implement Pre-v1)

\- Role comparison mode

\- Portfolio view

\- Decision layer

\- Accounts/auth/persistence

