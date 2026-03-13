// lib/env.ts — Shared server-side environment guards
// Centralizes validation for required runtime secrets.
// OPENAI_API_KEY is required for: resume tailoring, pattern synthesis, resume skeleton generation.

/**
 * Returns the OPENAI_API_KEY from the environment.
 * Throws immediately if the key is missing or empty.
 * Must only be called from server-side code (API routes, lib modules).
 */
export function requireOpenAIKey(): string {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  return key;
}
