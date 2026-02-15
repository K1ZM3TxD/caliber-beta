\# ACTIVE SPEC — Milestone 2.3

Pattern Synthesis Output Logic



\## Status

ACTIVE MILESTONE: 2.3  

ACTIVE TASK: Define structural format of Pattern Synthesis output.



\## In Scope



Implement ONLY:



1\. A module:

&nbsp;  lib/pattern\_synthesis.ts



&nbsp;  Function:

&nbsp;  generatePatternSynthesis(

&nbsp;    resumeText: string,

&nbsp;    promptAnswers: string\[]

&nbsp;  )



&nbsp;  Returns:

&nbsp;  {

&nbsp;    structural\_summary: string,

&nbsp;    operate\_best: string\[],

&nbsp;    lose\_energy: string\[]

&nbsp;  }



2\. A minimal API route:

&nbsp;  /app/api/pattern-synthesis/route.ts



&nbsp;  - Accepts mock data

&nbsp;  - Returns mocked Pattern Synthesis output

&nbsp;  - No OpenAI calls yet

&nbsp;  - No alignment scoring

&nbsp;  - No skill match



3\. A minimal UI component:

&nbsp;  app/components/PatternSynthesis.tsx



&nbsp;  Renders:

&nbsp;  - 2–3 sentence summary

&nbsp;  - "Where You Operate Best"

&nbsp;  - "Where You Lose Energy"



\## Out of Scope (DO NOT IMPLEMENT)



\- Skill Match engine

\- Stretch Load

\- Alignment score

\- Job ingestion

\- Title hypothesis

\- Title dialogue loop

\- OpenAI extraction

\- Deployment config

\- Refactors outside M2.3

\- Global state orchestration



\## Constraints



\- No additional features.

\- No expansion to other milestones.

\- Keep implementation minimal and deterministic.

\- This PR must map strictly to Milestone 2.3 only.

