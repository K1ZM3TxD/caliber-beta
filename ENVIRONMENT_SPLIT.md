# ENVIRONMENT_SPLIT.md — SUPERSEDED

> **This document is superseded.** It described the early `dist/extension-prod/` + `dist/extension-dev/` build-script model from 2026-03-08. That architecture is no longer the active operating model.

## Current Release Model

| Branch | Purpose |
|--------|---------|
| `main` | Development iteration + preview validation (Vercel preview deploys) |
| `stable` | Production deploy — Vercel auto-deploys from this branch to `caliber-app.com` |

**Promotion:** validate on `main` → merge / fast-forward to `stable` → Vercel deploys to production.

## Extension Host Rules (still active — from CALIBER_EXECUTION_CONTRACT.md)

- Production extension source (`extension/`) points to `https://www.caliber-app.com`
- Dev builds default to `http://localhost:3000`
- Hard separation: production builds must never contain localhost references in `env.js`, `manifest.json`, or runtime code

## Canonical References

- Release model: `Bootstrap/CALIBER_ACTIVE_STATE.md` → "Two-branch release model" section
- Extension build rules: `Bootstrap/session_pack/EXECUTION_CONTRACT.md` → Extension Build Host Rule
- PM session start: `Bootstrap/session_pack/CALIBER_LOADER.md`
