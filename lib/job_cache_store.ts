// lib/job_cache_store.ts — Canonical job record + per-user score cache
//
// TRUSTED WRITE PATH ONLY.
// Records are created from trusted scoring flows:
//   - Extension sidecard CALIBER_FIT_API response (full JD scored)
//   - Pipeline save when jobText is present
//
// Unsafe DOM prescan (card_text_prescan) MUST NOT be written here.
// See KERNEL.md: Extension Overlay Architecture Invariant (2026-03-29).

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────

export type JobPlatform = "linkedin" | "indeed" | "web";

export interface CanonicalJobRecord {
  id: string;
  canonicalKey: string;
  platform: JobPlatform;
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  jobText?: string;
  textWordCount?: number;
  textSource?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobScoreCacheEntry {
  id: string;
  jobId: string;
  userId?: string;
  sessionId: string;
  score: number;
  scorePayload: ScorePayload;
  scoringModel: string;
  textSource: string;
  scoredAt: string;
}

/** Compact payload stored for future overlay / homepage consumers */
export interface ScorePayload {
  score: number;
  supportsFit: string[];     // first 3 bullets
  stretchFactors: string[];  // first 3 bullets
  hrcBand: string | null;    // "High" | "Possible" | "Unlikely" | null
  hrcReason: string | null;
  workModeCompat: string | null;  // "compatible" | "adjacent" | "conflicting"
  roleType: string | null;
  calibrationTitle: string;
}

/** Input for writing a trusted score cache entry */
export interface TrustedScoreInput {
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  jobText: string;           // MUST be trusted full JD (>= 200 chars)
  userId?: string;
  sessionId: string;
  score: number;
  payload: ScorePayload;
  textSource: "sidecard_full" | "pipeline_save";
}

// ─── Canonical Key Strategy ───────────────────────────────────
//
// LinkedIn: "linkedin:job:{numericId}"  — stable across URL format variants
// Indeed:   "indeed:job:{jk}"           — stable across subdomain/path variants
// Generic:  "url:{normalizedUrl}"       — strip tracking params
//
// Key is the primary dedupe identity. Two URLs for the same LinkedIn job
// (slug vs ID path vs ?currentJobId) all resolve to the same key.

export function detectPlatform(url: string): JobPlatform {
  try {
    const host = new URL(url).hostname;
    if (host.includes("linkedin.com")) return "linkedin";
    if (host.includes("indeed.com")) return "indeed";
  } catch {}
  return "web";
}

export function buildCanonicalKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;

    // LinkedIn — extract numeric job ID
    if (host.includes("linkedin.com")) {
      // ?currentJobId=123456
      const cjid = u.searchParams.get("currentJobId");
      if (cjid && /^\d+$/.test(cjid)) return `linkedin:job:${cjid}`;
      // /jobs/view/123456 or /jobs/view/title-at-company-123456
      const idMatch = u.pathname.match(/\/jobs\/view\/(?:[^/]*?-)?(\d{5,})(?:\/|$)/);
      if (idMatch) return `linkedin:job:${idMatch[1]}`;
      // Exact numeric /jobs/view/123456
      const exactMatch = u.pathname.match(/\/jobs\/view\/(\d+)/);
      if (exactMatch) return `linkedin:job:${exactMatch[1]}`;
    }

    // Indeed — extract jk or vjk param
    if (host.includes("indeed.com")) {
      const jk = u.searchParams.get("jk") || u.searchParams.get("vjk");
      if (jk) return `indeed:job:${jk}`;
    }

    // Generic — strip known tracking params, normalize
    const stripped = new URL(url);
    const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "refId", "trk", "trackingId", "fbclid", "gclid"];
    for (const p of TRACKING_PARAMS) stripped.searchParams.delete(p);
    const normalized = (stripped.origin + stripped.pathname).replace(/\/+$/, "");
    return `url:${normalized}`;
  } catch {
    return `url:${url.split("?")[0].split("#")[0].replace(/\/+$/, "")}`;
  }
}

// ─── Word Count ───────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── ID Generation ───────────────────────────────────────────

function newJobId(): string {
  return "cj_" + crypto.randomBytes(8).toString("hex");
}

function newScoreCacheId(): string {
  return "jsc_" + crypto.randomBytes(8).toString("hex");
}

// ─── Write Path ───────────────────────────────────────────────

/**
 * Upsert a canonical job record and write (or overwrite) a score cache entry.
 *
 * Called from trusted scoring flows only. Fire-and-forget safe — errors are
 * caught and logged without affecting the calling request path.
 *
 * Deduplication:
 *   - CanonicalJob: upsert on canonicalKey (one record per job across all users)
 *   - JobScoreCache: upsert on (jobId, sessionId) — latest score per calibration session
 */
export async function writeTrustedScore(input: TrustedScoreInput): Promise<{ jobId: string; cacheId: string }> {
  const MIN_FULL_TEXT_CHARS = 200;
  if (!input.jobText || input.jobText.length < MIN_FULL_TEXT_CHARS) {
    throw new Error(`job_cache_store: jobText too short for trusted write (${input.jobText?.length ?? 0} < ${MIN_FULL_TEXT_CHARS})`);
  }

  const canonicalKey = buildCanonicalKey(input.sourceUrl);
  const platform = detectPlatform(input.sourceUrl);
  const wordCount = countWords(input.jobText);

  // Upsert canonical job record — if it already exists, update title/company/text
  // only if this write provides a longer (better) job description.
  const existingJob = await prisma.canonicalJob.findUnique({ where: { canonicalKey } });

  let jobId: string;
  if (existingJob) {
    jobId = existingJob.id;
    // Update job text if this write has more content
    const existingWordCount = existingJob.textWordCount ?? 0;
    if (wordCount > existingWordCount) {
      await prisma.canonicalJob.update({
        where: { id: jobId },
        data: {
          title: input.title || existingJob.title,
          company: input.company || existingJob.company,
          location: input.location ?? existingJob.location,
          jobText: input.jobText,
          textWordCount: wordCount,
          textSource: input.textSource,
          sourceUrl: input.sourceUrl,
        },
      });
    }
  } else {
    jobId = newJobId();
    await prisma.canonicalJob.create({
      data: {
        id: jobId,
        canonicalKey,
        platform,
        sourceUrl: input.sourceUrl,
        title: input.title,
        company: input.company,
        location: input.location ?? null,
        jobText: input.jobText,
        textWordCount: wordCount,
        textSource: input.textSource,
      },
    });
  }

  // Upsert score cache entry — one per (job, calibration session)
  const existingCache = await prisma.jobScoreCache.findUnique({
    where: { jobId_sessionId: { jobId, sessionId: input.sessionId } },
  });

  let cacheId: string;
  const payloadJson = JSON.stringify(input.payload);

  if (existingCache) {
    cacheId = existingCache.id;
    // Don't downgrade payload quality: sidecard_full > pipeline_save.
    // If existing entry was from sidecard_full and this write is pipeline_save,
    // preserve the richer existing payload.
    const isUpgrade = input.textSource === "sidecard_full" || existingCache.textSource === "pipeline_save";
    await prisma.jobScoreCache.update({
      where: { id: cacheId },
      data: {
        score: input.score,
        scorePayload: isUpgrade ? payloadJson : existingCache.scorePayload,
        textSource: isUpgrade ? input.textSource : existingCache.textSource,
        userId: input.userId ?? existingCache.userId,
        scoredAt: new Date(),
      },
    });
  } else {
    cacheId = newScoreCacheId();
    await prisma.jobScoreCache.create({
      data: {
        id: cacheId,
        jobId,
        userId: input.userId ?? null,
        sessionId: input.sessionId,
        score: input.score,
        scorePayload: payloadJson,
        textSource: input.textSource,
      },
    });
  }

  return { jobId, cacheId };
}

// ─── Lookup Path ──────────────────────────────────────────────

/** Look up a canonical job and its latest cached score for a given session. */
export async function lookupByUrl(sourceUrl: string, sessionId: string): Promise<{
  job: CanonicalJobRecord | null;
  scoreCache: JobScoreCacheEntry | null;
}> {
  const canonicalKey = buildCanonicalKey(sourceUrl);

  const job = await prisma.canonicalJob.findUnique({
    where: { canonicalKey },
    include: {
      scoreCaches: {
        where: { sessionId },
        orderBy: { scoredAt: "desc" },
        take: 1,
      },
    },
  });

  if (!job) return { job: null, scoreCache: null };

  const cacheRow = job.scoreCaches[0] ?? null;

  return {
    job: {
      id: job.id,
      canonicalKey: job.canonicalKey,
      platform: job.platform as JobPlatform,
      sourceUrl: job.sourceUrl,
      title: job.title,
      company: job.company,
      location: job.location ?? undefined,
      jobText: job.jobText ?? undefined,
      textWordCount: job.textWordCount ?? undefined,
      textSource: job.textSource ?? undefined,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    },
    scoreCache: cacheRow
      ? {
          id: cacheRow.id,
          jobId: cacheRow.jobId,
          userId: cacheRow.userId ?? undefined,
          sessionId: cacheRow.sessionId,
          score: cacheRow.score,
          scorePayload: JSON.parse(cacheRow.scorePayload) as ScorePayload,
          scoringModel: cacheRow.scoringModel,
          textSource: cacheRow.textSource,
          scoredAt: cacheRow.scoredAt.toISOString(),
        }
      : null,
  };
}

/** Look up a canonical job by canonical key directly. */
export async function lookupByKey(canonicalKey: string, sessionId: string): Promise<{
  job: CanonicalJobRecord | null;
  scoreCache: JobScoreCacheEntry | null;
}> {
  const job = await prisma.canonicalJob.findUnique({
    where: { canonicalKey },
    include: {
      scoreCaches: {
        where: { sessionId },
        orderBy: { scoredAt: "desc" },
        take: 1,
      },
    },
  });

  if (!job) return { job: null, scoreCache: null };

  const cacheRow = job.scoreCaches[0] ?? null;

  return {
    job: {
      id: job.id,
      canonicalKey: job.canonicalKey,
      platform: job.platform as JobPlatform,
      sourceUrl: job.sourceUrl,
      title: job.title,
      company: job.company,
      location: job.location ?? undefined,
      jobText: job.jobText ?? undefined,
      textWordCount: job.textWordCount ?? undefined,
      textSource: job.textSource ?? undefined,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    },
    scoreCache: cacheRow
      ? {
          id: cacheRow.id,
          jobId: cacheRow.jobId,
          userId: cacheRow.userId ?? undefined,
          sessionId: cacheRow.sessionId,
          score: cacheRow.score,
          scorePayload: JSON.parse(cacheRow.scorePayload) as ScorePayload,
          scoringModel: cacheRow.scoringModel,
          textSource: cacheRow.textSource,
          scoredAt: cacheRow.scoredAt.toISOString(),
        }
      : null,
  };
}

/**
 * Non-throwing wrapper for writeTrustedScore — suitable for fire-and-forget
 * use in API routes where cache write must not affect primary response time.
 */
export async function writeTrustedScoreSafe(input: TrustedScoreInput): Promise<void> {
  try {
    await writeTrustedScore(input);
  } catch (err: any) {
    console.warn("[caliber][job_cache] write failed (non-fatal):", err?.message ?? err);
  }
}

// ─── List / Inventory ─────────────────────────────────────────

export interface KnownJobEntry {
  job: CanonicalJobRecord;
  scoreCache: JobScoreCacheEntry;
}

function mapCacheRowToEntry(row: any): KnownJobEntry {
  return {
    job: {
      id: row.job.id,
      canonicalKey: row.job.canonicalKey,
      platform: row.job.platform as JobPlatform,
      sourceUrl: row.job.sourceUrl,
      title: row.job.title,
      company: row.job.company,
      location: row.job.location ?? undefined,
      textWordCount: row.job.textWordCount ?? undefined,
      textSource: row.job.textSource ?? undefined,
      createdAt: row.job.createdAt.toISOString(),
      updatedAt: row.job.updatedAt.toISOString(),
    },
    scoreCache: {
      id: row.id,
      jobId: row.jobId,
      userId: row.userId ?? undefined,
      sessionId: row.sessionId,
      score: row.score,
      scorePayload: JSON.parse(row.scorePayload) as ScorePayload,
      scoringModel: row.scoringModel,
      textSource: row.textSource,
      scoredAt: row.scoredAt.toISOString(),
    },
  };
}

/**
 * List recently scored jobs for a calibration session, newest first.
 * Used by the extension overlay and basic known-jobs landing view.
 */
export async function listJobsForSession(
  sessionId: string,
  limit: number = 50,
): Promise<KnownJobEntry[]> {
  const rows = await prisma.jobScoreCache.findMany({
    where: { sessionId },
    orderBy: { scoredAt: "desc" },
    take: Math.min(limit, 200),
    include: { job: true },
  });
  return rows.map(mapCacheRowToEntry);
}

/**
 * List recently scored jobs for an authenticated user, newest first.
 * Deduplicated: if a job appears in multiple sessions, only the most
 * recent score entry is returned (handled by orderBy + userId filter).
 */
export async function listJobsForUser(
  userId: string,
  limit: number = 50,
): Promise<KnownJobEntry[]> {
  const rows = await prisma.jobScoreCache.findMany({
    where: { userId },
    orderBy: { scoredAt: "desc" },
    take: Math.min(limit, 200),
    include: { job: true },
  });
  // Deduplicate by canonicalKey — keep most recent score per job
  const seen = new Set<string>();
  const deduped: typeof rows = [];
  for (const row of rows) {
    const key = row.job.canonicalKey;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(row);
    }
  }
  return deduped.map(mapCacheRowToEntry);
}

// ─── Fit API Response Mapping ─────────────────────────────────

/**
 * Map a cache hit to the shape the extension expects from /api/extension/fit.
 * Called by the extension background worker for cache-first hydration.
 * Missing fields (bottom_line_2s, nearby_roles, recovery_terms) are empty —
 * the sidecard handles these gracefully.
 */
export interface CachedFitResponse {
  score_0_to_10: number;
  supports_fit: string[];
  stretch_factors: string[];
  bottom_line_2s: string;
  hiring_reality_check: {
    band: string | null;
    reason: string | null;
    execution_evidence_gap: null;
  };
  calibration_title: string;
  nearby_roles: unknown[];
  recovery_terms: unknown[];
  signal_preference: null;
  debug_signals: null;
  debug_work_mode: null;
  debug_recovery_terms: null;
  _fromCache: true;
  _cachedAt: string;
  _textSource: string;
}

export function buildCachedFitResponse(entry: KnownJobEntry): CachedFitResponse {
  const p = entry.scoreCache.scorePayload;
  return {
    score_0_to_10: entry.scoreCache.score,
    supports_fit: p.supportsFit ?? [],
    stretch_factors: p.stretchFactors ?? [],
    bottom_line_2s: "",
    hiring_reality_check: {
      band: p.hrcBand ?? null,
      reason: p.hrcReason ?? null,
      execution_evidence_gap: null,
    },
    calibration_title: p.calibrationTitle ?? "",
    nearby_roles: [],
    recovery_terms: [],
    signal_preference: null,
    debug_signals: null,
    debug_work_mode: null,
    debug_recovery_terms: null,
    _fromCache: true,
    _cachedAt: entry.scoreCache.scoredAt,
    _textSource: entry.scoreCache.textSource,
  };
}
