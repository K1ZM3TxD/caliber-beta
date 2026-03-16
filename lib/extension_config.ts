// lib/extension_config.ts
// Config-driven Chrome Web Store install URL.
// Replace this value once the Chrome Web Store listing is published.

/** Chrome Web Store URL for the Caliber extension. Set to null until published. */
export const CHROME_STORE_URL: string | null = null;

/** Fallback landing page for the extension CTA when no store URL is configured. */
export const EXTENSION_LANDING_PATH = "/extension";

/** Direct download path for the beta extension ZIP (served from /public). */
export const EXTENSION_ZIP_PATH = "/caliber-extension-beta-v0.9.13.zip";

/** Current beta version label shown to users. */
export const EXTENSION_BETA_VERSION = "0.9.13";

/** Feedback email for beta testers. */
export const BETA_FEEDBACK_EMAIL = "feedback@caliber-app.com";
