
# CALIBER_CONTEXT_SUMMARY

## Project Status / Current active work

- Calibration UI now starts with a single landing page and stable header.
- Resume upload and all prompts (1–5) complete successfully.
- After prompts, the Job Anchor Title page appears (role title confirmation).
- UI routing and polling are improved; no blank hang screens after prompts.

## Current Blocker

- TITLE_FEEDBACK API error: "feedback must be a string" (contract mismatch blocks progress to job description page).

## Next Tasks (in order)

1. Fix TITLE_FEEDBACK request shape to match API contract (send payload as string).
2. Add Job Description paste page and connect SUBMIT_JOB_TEXT event.
3. Implement alignment output placeholder page after job ingest.
