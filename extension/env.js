// env.js — Caliber extension environment config
// THIS FILE IS OVERWRITTEN BY THE BUILD SCRIPT (scripts/build-extensions.sh).
// Do not edit manually in dist/ output directories.
//
// The source copy (extension/env.js) defaults to DEV for local development.
// Load the production or dev build from dist/extension-prod/ or dist/extension-dev/.

const CALIBER_ENV = Object.freeze({
  // "production" or "development"
  MODE: "development",

  // Locked API base — no fallback, no ambiguity
  API_BASE: "http://localhost:3000",

  // Human-readable label for UI/logging
  LABEL: "Caliber DEV",
});
