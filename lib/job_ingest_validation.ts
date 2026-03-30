// lib/job_ingest_validation.ts
//
// Pure validation for the user-directed job ingestion path (/api/jobs/ingest).
//
// No DB access, no network calls — safe to call synchronously.

export const INGEST_MIN_TEXT_CHARS = 200;

// Private IP ranges we must reject to prevent SSRF-class misuse.
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1)/i;

export interface IngestValidationInput {
  url: unknown;
  jobText: unknown;
}

export type IngestValidationResult =
  | { ok: true; normalizedUrl: string; normalizedText: string }
  | { ok: false; error: string; field: "url" | "jobText" };

/**
 * Validate a URL for ingestion (URL-only or URL+text modes).
 * Shared logic extracted for reuse.
 */
export function validateIngestUrl(url: unknown): { ok: true; normalizedUrl: string } | { ok: false; error: string } {
  if (typeof url !== "string" || url.trim().length === 0) {
    return { ok: false, error: "Job URL is required." };
  }

  const rawUrl = url.trim();

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Job URL is not valid. Paste the full URL including https://." };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Job URL must start with https:// or http://." };
  }

  if (PRIVATE_IP_RE.test(parsed.hostname)) {
    return { ok: false, error: "Job URL must be a public web address, not a local or private host." };
  }

  return { ok: true, normalizedUrl: rawUrl };
}

/**
 * Validate a user-submitted job URL + job text pair.
 *
 * Rules:
 *   url  — required, must be https:// or http://, must be a public host
 *          (no localhost or private IP ranges).
 *   jobText — required, must be >= 200 characters (same gate as writeTrustedScore).
 *
 * Returns the normalized url/text on success, or an error string + field on failure.
 */
export function validateIngestInput(
  input: IngestValidationInput,
): IngestValidationResult {
  // ── URL validation ──────────────────────────────────────────

  const urlResult = validateIngestUrl(input.url);
  if (!urlResult.ok) {
    return { ok: false, error: urlResult.error, field: "url" };
  }

  // ── Job text validation ─────────────────────────────────────

  if (typeof input.jobText !== "string" || input.jobText.trim().length === 0) {
    return { ok: false, error: "Job description text is required.", field: "jobText" };
  }

  const trimmedText = input.jobText.trim();
  if (trimmedText.length < INGEST_MIN_TEXT_CHARS) {
    return {
      ok: false,
      error: `Job description is too short (${trimmedText.length} characters). Paste the full job description — at least ${INGEST_MIN_TEXT_CHARS} characters are required to produce a reliable score.`,
      field: "jobText",
    };
  }

  return { ok: true, normalizedUrl: urlResult.normalizedUrl, normalizedText: trimmedText };
}
