# CALIBER_CONTEXT_SUMMARY

## Project Status / Current active work

Backend calibration flow is now validated end-to-end by smoke (terminal complete + result).
Current real blocker is UI divergence around title/job/score routing; UI does not reliably reach results even when backend can.

## Current Blocker

UI still diverges from backend flow; must align UI event sequence with smoke flow and treat TERMINAL_COMPLETE/result as results-ready.

## Next Tasks (in order)

1. Align calibration UI event sequence with smoke flow; ensure results render when TERMINAL_COMPLETE or result exists.
2. Remove/mitigate routing/polling fragility that causes hang/misroute.
3. Only after stable results: implement post-score LLM dialogue mode toggle.
