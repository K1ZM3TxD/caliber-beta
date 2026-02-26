
# CALIBER_CONTEXT_SUMMARY

## Project Status / Current active work

- Root route (/) now redirects to /calibration to avoid double landing.
- Calibration UI now uses a stable UI shell approach (LANDING -> RESUME_INGEST -> confirmation), with typewriter tagline.
- Backend wiring was attempted but is intentionally paused pending refactor into a hook for stability.

## Next planned step

- Create lib/useCalibrationSession.ts hook (begin session + upload resume) and then refactor app/calibration/page.tsx to call hook methods only (no fetch/FormData inside page).
