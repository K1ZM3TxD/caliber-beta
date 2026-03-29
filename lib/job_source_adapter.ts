// lib/job_source_adapter.ts — Job Source Adapter Layer
//
// Standardizes how jobs enter the Canonical Job Cache from any acquisition source.
// Separates job acquisition (how we get the data) from job intelligence (scoring).
//
// Every ingestion path — extension sidecard, user import, API feeds, structured data —
// must flow through a source adapter that produces a NormalizedJobPayload with provenance.
//
// See KERNEL.md: Canonical Job Cache — Trusted Write Path Invariant.

import {
  writeTrustedScore,
  buildCanonicalKey,
  detectPlatform,
  type ScorePayload,
  type TrustedScoreInput,
} from "@/lib/job_cache_store";

// ─── Source Types ─────────────────────────────────────────────
// Every ingestion channel has a declared source type.

export type JobSourceType =
  | "extension_sidecard"   // Extension sidecard full-JD scoring
  | "extension_pipeline"   // Extension pipeline save with full jobText
  | "user_import"          // User-directed URL + text paste (/jobs page)
  | "ats_api"              // ATS or job board public API
  | "employer_jsonld"      // Employer-published JobPosting JSON-LD
  | "licensed_feed";       // Licensed bulk data feed

// ─── Trust Levels ─────────────────────────────────────────────
// Trust level determines write eligibility and downstream processing rules.

export type TrustLevel =
  | "user_verified"   // User-initiated action with full JD directly provided
  | "api_structured"  // Machine-extracted from a structured, authenticated source
  | "feed_unverified"; // Raw feed/crawl data — needs quality gate before scoring

// ─── Processing Rights ────────────────────────────────────────
// Declares what Caliber is permitted to do with data from this source.
// Source-specific legal/licensing constraints map here.

export interface ProcessingRights {
  canScore: boolean;    // May score against user calibration
  canStore: boolean;    // May persist in Canonical Job Cache
  canDisplay: boolean;  // May render in user-facing UI
  canTailor: boolean;   // May use job text for resume tailoring
}

// ─── Provenance ───────────────────────────────────────────────
// Attached to every normalized payload. Strong enough to distinguish source
// origin and support future rights handling / audit.

export interface JobProvenance {
  sourceType: JobSourceType;
  sourceName: string;      // Human-readable source label (e.g., "LinkedIn Extension Sidecard")
  trustLevel: TrustLevel;
  rights: ProcessingRights;
  acquiredAt: string;       // ISO 8601 timestamp
  rawRef?: string;          // Optional reference to raw/original payload (for audit trail)
}

// ─── Normalized Payload ───────────────────────────────────────
// The universal output of every source adapter. This is what canonicalization consumes.

export interface NormalizedJobPayload {
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  jobText: string;           // Full job description text (≥200 chars for cache write)
  provenance: JobProvenance;
}

// ─── Adapter Validation ───────────────────────────────────────

export type AdapterValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

// ─── Adapter Interface ────────────────────────────────────────
// Every ingestion source implements this contract.

export interface JobSourceAdapter<TRaw = unknown> {
  readonly sourceType: JobSourceType;
  readonly sourceName: string;
  readonly trustLevel: TrustLevel;
  readonly defaultRights: ProcessingRights;

  /** Validate that raw input meets minimum quality bar for this source. */
  validate(raw: TRaw): AdapterValidationResult;

  /** Transform raw source input into a NormalizedJobPayload with provenance. */
  normalize(raw: TRaw): NormalizedJobPayload;
}

// ─── textSource Bridge ────────────────────────────────────────
// Maps source types to the existing textSource values for backward compatibility
// with CanonicalJob.textSource and JobScoreCache.textSource fields.

export function sourceTypeToTextSource(sourceType: JobSourceType): "sidecard_full" | "pipeline_save" {
  switch (sourceType) {
    case "extension_sidecard":
      return "sidecard_full";
    case "extension_pipeline":
      return "pipeline_save";
    // All other ingestion sources are treated as equivalent to sidecard_full
    // (user-verified or structured data with full JD).
    case "user_import":
    case "ats_api":
    case "employer_jsonld":
    case "licensed_feed":
      return "sidecard_full";
  }
}

// ─── Canonicalization Entry ───────────────────────────────────
// Bridges adapter output → Canonical Job Cache write.
// This is the single entry point for all source-adapted ingestion.

export interface CanonicalizationContext {
  sessionId: string;
  userId?: string;
  score: number;
  scorePayload: ScorePayload;
}

export interface CanonicalizationResult {
  ok: true;
  jobId: string;
  cacheId: string;
  canonicalKey: string;
  platform: string;
  provenance: JobProvenance;
}

export interface CanonicalizationError {
  ok: false;
  reason: string;
}

const MIN_JOB_TEXT_CHARS = 200;

/**
 * Canonicalize a normalized job payload and write it to the Canonical Job Cache.
 *
 * Validates provenance rights, enforces text quality gate, maps to existing
 * writeTrustedScore path. This is THE entry point for all adapter-sourced ingestion.
 */
export async function canonicalizeAndWrite(
  payload: NormalizedJobPayload,
  ctx: CanonicalizationContext,
): Promise<CanonicalizationResult | CanonicalizationError> {
  // ── Rights check ────────────────────────────────────────────
  if (!payload.provenance.rights.canStore) {
    return { ok: false, reason: `Source "${payload.provenance.sourceName}" does not have storage rights.` };
  }
  if (!payload.provenance.rights.canScore) {
    return { ok: false, reason: `Source "${payload.provenance.sourceName}" does not have scoring rights.` };
  }

  // ── Text quality gate ───────────────────────────────────────
  if (!payload.jobText || payload.jobText.length < MIN_JOB_TEXT_CHARS) {
    return {
      ok: false,
      reason: `Job text too short for canonical write (${payload.jobText?.length ?? 0} < ${MIN_JOB_TEXT_CHARS}).`,
    };
  }

  // ── Map to existing write path ──────────────────────────────
  const textSource = sourceTypeToTextSource(payload.provenance.sourceType);
  const canonicalKey = buildCanonicalKey(payload.sourceUrl);
  const platform = detectPlatform(payload.sourceUrl);

  const input: TrustedScoreInput = {
    sourceUrl: payload.sourceUrl,
    title: payload.title,
    company: payload.company,
    location: payload.location,
    jobText: payload.jobText,
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    score: ctx.score,
    payload: ctx.scorePayload,
    textSource,
  };

  const result = await writeTrustedScore(input);

  return {
    ok: true,
    jobId: result.jobId,
    cacheId: result.cacheId,
    canonicalKey,
    platform,
    provenance: payload.provenance,
  };
}

// ─── Adapter Registry ─────────────────────────────────────────
// Simple registry for discovering available adapters by source type.

const adapterRegistry = new Map<JobSourceType, JobSourceAdapter<any>>();

export function registerAdapter(adapter: JobSourceAdapter<any>): void {
  adapterRegistry.set(adapter.sourceType, adapter);
}

export function getAdapter<T = unknown>(sourceType: JobSourceType): JobSourceAdapter<T> | undefined {
  return adapterRegistry.get(sourceType) as JobSourceAdapter<T> | undefined;
}

export function getRegisteredSourceTypes(): JobSourceType[] {
  return Array.from(adapterRegistry.keys());
}
