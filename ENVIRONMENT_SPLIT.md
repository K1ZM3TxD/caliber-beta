# Caliber — Environment Split: Production vs Dev

## Operating Model (2026-03-08)

This environment split is the active beta operating model for Caliber, not just an implementation detail.

- **Production extension** is for real users. It connects only to `https://www.caliber-app.com`. It is built from `dist/extension-prod/`.
- **Dev extension** is for localhost-only experiments and scoring development. It connects only to `http://localhost:3000`. It is the source `extension/` directory or `dist/extension-dev/`.
- **Never mix the two during routine testing.** Use separate Chrome profiles if both must be active simultaneously.
- **Production must remain stable.** Experimental changes happen only in dev. No experimental code merges to main without PM approval.

This split is enforced at the manifest `host_permissions` level — even modified code cannot cross environments.

---

## Architecture

| Component | Production | Dev/Testing |
|-----------|-----------|-------------|
| Web app host | `https://www.caliber-app.com` | `http://localhost:3000` |
| Extension API base | `https://www.caliber-app.com` | `http://localhost:3000` |
| Extension name in Chrome | "Caliber — Job Fit Score" | "Caliber — Job Fit Score [DEV]" |
| Extension directory | `dist/extension-prod/` | `dist/extension-dev/` (or `extension/` source) |

**Hard rule:** Production extension never contacts localhost. Dev extension never contacts production.

---

## Building the Extensions

```bash
bash scripts/build-extensions.sh
```

This generates two directories:
- `dist/extension-prod/` — locked to `https://www.caliber-app.com`
- `dist/extension-dev/` — locked to `http://localhost:3000`

---

## Loading the Correct Extension in Chrome

### Step 1 — Open Chrome Extensions page

Navigate to `chrome://extensions/` and enable **Developer mode** (toggle in top-right).

### Step 2 — Load PROD Extension

1. Click **Load unpacked**.
2. Select the `dist/extension-prod/` directory.
3. Verify the extension card shows the name **"Caliber — Job Fit Score"** (no [DEV] tag).
4. Confirm the description reads: *"Get a fit score on LinkedIn or Indeed job posts — no copy/paste."*

### Step 3 — Load DEV Extension (separate Chrome profile recommended)

> **Recommended:** Use a separate Chrome profile for dev to prevent accidental mixing.

1. Click **Load unpacked**.
2. Select the `dist/extension-dev/` directory (or the `extension/` source directory for live editing).
3. Verify the extension card shows the name **"Caliber — Job Fit Score [DEV]"**.
4. Confirm the description starts with: *"DEV BUILD — localhost only."*

### How to Tell Them Apart

| Check | Prod | Dev |
|-------|------|-----|
| Extension name in `chrome://extensions/` | "Caliber — Job Fit Score" | "Caliber — Job Fit Score [DEV]" |
| Description prefix | (normal) | "DEV BUILD" |
| Popup behavior | Calls `caliber-app.com` | Calls `localhost:3000` |

### Avoiding Confusion

- **Never load both extensions in the same Chrome profile.** Use separate profiles if you need both active simultaneously.
- If unsure which is loaded, check the extension name on `chrome://extensions/`.
- The dev extension will fail with network errors if localhost is not running. The prod extension will fail if you are offline or `caliber-app.com` is down. Neither will silently fall through to the other.

---

## Web App Environment

Next.js automatically loads the correct env file:

| Command | Env file loaded | `NEXT_PUBLIC_APP_URL` |
|---------|----------------|----------------------|
| `next dev` | `.env.development` | `http://localhost:3000` |
| `next build` / `next start` | `.env.production` | `https://www.caliber-app.com` |

No ambiguity or fallback — the env var is explicit per build mode.

---

## Source Extension Directory (`extension/`)

The source `extension/` directory defaults to **DEV mode** (localhost). This means:
- During development, you can load `extension/` directly as an unpacked extension — no build step needed.
- For production builds, always use `dist/extension-prod/` from the build script output.

---

## Host Permission Rules

### Production Extension (`dist/extension-prod/manifest.json`)
```
host_permissions:
  - https://www.caliber-app.com/*
  - https://www.linkedin.com/*
  - https://www.indeed.com/*
```
**No localhost permission.** Cannot contact localhost even if code were modified.

### Dev Extension (`dist/extension-dev/manifest.json` / `extension/manifest.json`)
```
host_permissions:
  - http://localhost:3000/*
  - https://www.linkedin.com/*
  - https://www.indeed.com/*
```
**No caliber-app.com permission.** Cannot contact production even if code were modified.

---

## Files Changed

| File | Change |
|------|--------|
| `extension/env.js` | **New.** Environment config loaded by all extension scripts. Source defaults to DEV. |
| `extension/manifest.json` | Locked to DEV-only hosts. Removed prod + codespace host permissions. Added `env.js` to content_scripts. |
| `extension/background.js` | Imports `env.js`. Removed multi-endpoint fallback array. Single locked `API_BASE`. |
| `extension/popup.js` | Reads `API_BASE` from `CALIBER_ENV` instead of hardcoded value. |
| `extension/popup.html` | Loads `env.js` before `popup.js`. Removed hardcoded localhost link. |
| `extension/content_linkedin.js` | Reads `API_BASE` from `CALIBER_ENV`. |
| `scripts/build-extensions.sh` | **New.** Generates `dist/extension-prod/` and `dist/extension-dev/`. |
| `.env.production` | **New.** `NEXT_PUBLIC_APP_URL=https://www.caliber-app.com` |
| `.env.development` | **New.** `NEXT_PUBLIC_APP_URL=http://localhost:3000` |
| `.gitignore` | Added `/dist/` ignore. Un-ignored `.env.production` and `.env.development`. |
| `ENVIRONMENT_SPLIT.md` | **New.** This document. |
