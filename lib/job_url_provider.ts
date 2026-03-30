// lib/job_url_provider.ts — Provider detection for user-submitted job URLs
//
// Given a job URL, classify the provider and extract identifiers so the
// ingestion layer can route to the correct fetch strategy.
//
// Supported providers: Greenhouse, Lever, Ashby, SmartRecruiters
// Restricted providers: LinkedIn, Indeed (no server-side fetch permitted)
// Unknown: anything else — may attempt JSON-LD extraction from page HTML

// ─── Provider Types ───────────────────────────────────────────

export type KnownProvider =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters";

export type RestrictedProvider =
  | "linkedin"
  | "indeed";

export type ProviderClassification =
  | { kind: "ats"; provider: KnownProvider; boardToken: string; jobId: string; originalUrl: string }
  | { kind: "restricted"; provider: RestrictedProvider; originalUrl: string; reason: string }
  | { kind: "unknown"; originalUrl: string };

// ─── Provider Detection Patterns ──────────────────────────────

// Greenhouse: boards.greenhouse.io/{boardToken}/jobs/{id}
//          or: boards.eu.greenhouse.io/{boardToken}/jobs/{id}
const GREENHOUSE_RE = /^https?:\/\/boards(?:\.eu)?\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i;

// Lever: jobs.lever.co/{company}/{id}
const LEVER_RE = /^https?:\/\/jobs\.lever\.co\/([^/]+)\/([0-9a-f-]+)/i;

// Ashby: jobs.ashbyhq.com/{company}/application/{id}
//     or: jobs.ashbyhq.com/{company}/{id}
const ASHBY_RE = /^https?:\/\/jobs\.ashbyhq\.com\/([^/]+)\/([0-9a-f-]+)/i;

// SmartRecruiters: jobs.smartrecruiters.com/{company}/{id}
const SMARTRECRUITERS_RE = /^https?:\/\/jobs\.smartrecruiters\.com\/([^/]+)\/([^/?#]+)/i;

// Restricted boards
const LINKEDIN_RE = /^https?:\/\/(www\.)?linkedin\.com\//i;
const INDEED_RE = /^https?:\/\/([a-z]+\.)?indeed\.(com|co\.[a-z]+)\//i;

/**
 * Classify a URL into a provider type.
 *
 * Returns structured classification with extracted identifiers for supported ATS,
 * restricted status for major boards, or unknown for all else.
 */
export function classifyProvider(url: string): ProviderClassification {
  const trimmed = url.trim();

  // ── Restricted boards (fail fast) ──────────────────────────
  if (LINKEDIN_RE.test(trimmed)) {
    return {
      kind: "restricted",
      provider: "linkedin",
      originalUrl: trimmed,
      reason: "LinkedIn jobs cannot be fetched server-side. Use the Caliber browser extension to score LinkedIn jobs, or paste the full job description text.",
    };
  }
  if (INDEED_RE.test(trimmed)) {
    return {
      kind: "restricted",
      provider: "indeed",
      originalUrl: trimmed,
      reason: "Indeed jobs cannot be fetched server-side. Use the Caliber browser extension to score Indeed jobs, or paste the full job description text.",
    };
  }

  // ── Greenhouse ─────────────────────────────────────────────
  const ghMatch = trimmed.match(GREENHOUSE_RE);
  if (ghMatch) {
    return {
      kind: "ats",
      provider: "greenhouse",
      boardToken: ghMatch[1],
      jobId: ghMatch[2],
      originalUrl: trimmed,
    };
  }

  // ── Lever ──────────────────────────────────────────────────
  const leverMatch = trimmed.match(LEVER_RE);
  if (leverMatch) {
    return {
      kind: "ats",
      provider: "lever",
      boardToken: leverMatch[1],
      jobId: leverMatch[2],
      originalUrl: trimmed,
    };
  }

  // ── Ashby ──────────────────────────────────────────────────
  const ashbyMatch = trimmed.match(ASHBY_RE);
  if (ashbyMatch) {
    return {
      kind: "ats",
      provider: "ashby",
      boardToken: ashbyMatch[1],
      jobId: ashbyMatch[2],
      originalUrl: trimmed,
    };
  }

  // ── SmartRecruiters ────────────────────────────────────────
  const srMatch = trimmed.match(SMARTRECRUITERS_RE);
  if (srMatch) {
    return {
      kind: "ats",
      provider: "smartrecruiters",
      boardToken: srMatch[1],
      jobId: srMatch[2],
      originalUrl: trimmed,
    };
  }

  // ── Unknown — may attempt JSON-LD extraction ───────────────
  return { kind: "unknown", originalUrl: trimmed };
}

/**
 * Returns a human-readable label for a provider.
 */
export function providerLabel(provider: KnownProvider | RestrictedProvider): string {
  const labels: Record<string, string> = {
    greenhouse: "Greenhouse",
    lever: "Lever",
    ashby: "Ashby",
    smartrecruiters: "SmartRecruiters",
    linkedin: "LinkedIn",
    indeed: "Indeed",
  };
  return labels[provider] ?? provider;
}
