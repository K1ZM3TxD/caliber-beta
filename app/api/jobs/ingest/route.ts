// POST /api/jobs/ingest
//
// User-directed job ingestion with two modes:
//
//   Mode 1 — URL + pasted text (existing):
//     Body: { url: string, jobText: string, sessionId?: string }
//     Validates text, scores, and writes to Canonical Job Cache.
//
//   Mode 2 — URL only (provider-aware fetch):
//     Body: { url: string, sessionId?: string }
//     Classifies URL provider, fetches job data via safe paths:
//       - Supported ATS (Greenhouse/Lever/Ashby/SmartRecruiters): public API
//       - Employer pages with JSON-LD: structured data extraction
//       - Restricted boards (LinkedIn/Indeed): fails with guidance
//       - Unknown pages: attempts JSON-LD extraction, fails if none found
//
// Returns:
//   200 { ok: true, score, hrcBand, workModeCompat, supportsFit, canonicalKey, platform, fetchSource? }
//   400 { ok: false, error, field? }        — validation or fetch failure
//   422 { ok: false, error, retryWithPaste } — URL fetch failed, user can paste text
//   401 { ok: false, error }                 — no active session
//   500 { ok: false, error }                 — scoring system failure

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeGet, storeGetAsync, storeLatest, storeLatestAsync } from "@/lib/calibration_store";
import { runIntegrationSeam } from "@/lib/integration_seam";
import { computeHiringRealityCheck } from "@/lib/hiring_reality_check";
import { evaluateWorkMode, generateWorkRealitySummary } from "@/lib/work_mode";
import { writeTrustedScoreSafe, detectPlatform, buildCanonicalKey } from "@/lib/job_cache_store";
import { validateIngestInput, validateIngestUrl } from "@/lib/job_ingest_validation";
import { fetchJobFromUrl } from "@/lib/job_url_fetch";

export const maxDuration = 30;

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  // ── Determine ingestion mode ────────────────────────────────────────────
  // Mode 1: URL + jobText provided → validate both, use text directly
  // Mode 2: URL only (no jobText)  → provider-aware fetch
  const hasJobText = typeof body.jobText === "string" && body.jobText.toString().trim().length > 0;

  let normalizedUrl: string;
  let normalizedText: string;
  let title: string;
  let company: string;
  let location: string | undefined;
  let fetchSource: string | undefined;

  if (hasJobText) {
    // ── Mode 1: URL + pasted text (existing flow) ─────────────────────────
    const validation = validateIngestInput({ url: body.url, jobText: body.jobText });
    if (!validation.ok) {
      return json({ ok: false, error: validation.error, field: validation.field }, 400);
    }
    normalizedUrl = validation.normalizedUrl;
    normalizedText = validation.normalizedText;
    title = typeof body.title === "string" ? body.title.trim() : "";
    company = typeof body.company === "string" ? body.company.trim() : "";
    location = undefined;
  } else {
    // ── Mode 2: URL only → provider-aware fetch ───────────────────────────
    const urlValidation = validateIngestUrl(body.url);
    if (!urlValidation.ok) {
      return json({ ok: false, error: urlValidation.error, field: "url" }, 400);
    }
    normalizedUrl = urlValidation.normalizedUrl;

    const fetchResult = await fetchJobFromUrl(normalizedUrl);
    if (!fetchResult.ok) {
      // Return 422 with retry guidance for fetch failures
      return json({
        ok: false,
        error: fetchResult.error,
        retryWithPaste: fetchResult.retryWithPaste,
        provider: fetchResult.classification.kind === "ats" ? fetchResult.classification.provider
          : fetchResult.classification.kind === "restricted" ? fetchResult.classification.provider
          : undefined,
      }, 422);
    }

    normalizedText = fetchResult.data.jobText;
    title = fetchResult.data.title;
    company = fetchResult.data.company;
    location = fetchResult.data.location;
    fetchSource = fetchResult.data.fetchSource;
  }

  // ── Resolve sessionId ───────────────────────────────────────────────────
  // Priority: explicit body.sessionId → web auth user's latest → latest in store
  let sessionId: string | null = typeof body.sessionId === "string" ? body.sessionId : null;

  if (!sessionId) {
    // Web-auth path: look up the user's most recent session via auth()
    const webSession = await auth();
    if (!webSession?.user?.id) {
      // No auth — try the store's latest (dev / anon web)
      let latest = storeLatest();
      if (!latest) latest = await storeLatestAsync();
      if (!latest) {
        return json({ ok: false, error: "No active Caliber session. Complete your profile on Caliber first." }, 401);
      }
      sessionId = latest.sessionId;
    }
    // If auth succeeded but sessionId still null, fall through to store lookup below
  }

  // ── Load calibration session ────────────────────────────────────────────
  let session = sessionId ? storeGet(sessionId) : null;
  if (!session && sessionId) {
    session = await storeGetAsync(sessionId);
  }
  if (!session && !sessionId) {
    let latest = storeLatest();
    if (!latest) latest = await storeLatestAsync();
    if (latest) {
      sessionId = latest.sessionId;
      session = storeGet(sessionId) ?? await storeGetAsync(sessionId);
    }
  }

  if (!session) {
    return json({ ok: false, error: "Session not found. Log into Caliber and complete your profile first." }, 401);
  }

  if (!sessionId) {
    return json({ ok: false, error: "Could not determine session ID." }, 401);
  }

  if (!session.personVector?.values || !session.personVector.locked) {
    return json({ ok: false, error: "Profile incomplete. Finish the calibration prompts on Caliber first." }, 400);
  }

  // ── Canonicalize URL ──────────────────────────────────────────────────────
  const canonicalKey = buildCanonicalKey(normalizedUrl);
  const platform = detectPlatform(normalizedUrl);
  // writeTrustedScoreSafe upserts on canonicalKey — dedup is handled there,
  // no read needed on the scoring critical path.

  // ── Score ────────────────────────────────────────────────────────────────
  const personVector = session.personVector.values as number[];
  const seam = runIntegrationSeam({ jobText: normalizedText, experienceVector: personVector });
  if (!seam.ok) {
    return json({ ok: false, error: seam.error.message }, 500);
  }

  const alignment = seam.result.alignment as any;
  const resumeText = session.resume?.rawText ?? "";

  const hiringCheck = computeHiringRealityCheck(normalizedText, resumeText);

  const promptAnswers: Record<number, string> = {};
  if (session.prompts) {
    for (const key of [1, 2, 3, 4, 5]) {
      const slot = (session.prompts as any)[key];
      if (slot && typeof slot.answer === "string") {
        promptAnswers[key] = slot.answer;
      }
    }
  }

  const rawScore = alignment.score ?? 0;
  const workMode = evaluateWorkMode(rawScore, resumeText, promptAnswers, normalizedText, session.workPreferences ?? null);
  const finalScore = workMode.postScore;

  const titleRec = session.synthesis?.titleRecommendation;
  const primaryTitle = (titleRec as any)?.primary_title?.title ?? "";

  const stretchFactors: string[] = [...(alignment.stretch_factors ?? [])];

  // ── Write to Canonical Job Cache (fire-and-forget) ───────────────────────
  writeTrustedScoreSafe({
    sourceUrl: normalizedUrl,
    title,
    company,
    location,
    jobText: normalizedText,
    sessionId,
    score: finalScore,
    payload: {
      score: finalScore,
      supportsFit: (alignment.supports_fit ?? []).slice(0, 3),
      stretchFactors: stretchFactors.slice(0, 3),
      hrcBand: hiringCheck.band ?? null,
      hrcReason: hiringCheck.reason ?? null,
      workModeCompat: workMode.compatibility ?? null,
      roleType: workMode.roleType ?? null,
      calibrationTitle: primaryTitle,
    },
    textSource: "sidecard_full",
  });

  const workRealitySummary = generateWorkRealitySummary(workMode);

  return json({
    ok: true,
    score: finalScore,
    hrcBand: hiringCheck.band ?? null,
    hrcReason: hiringCheck.reason ?? null,
    workModeCompat: workMode.compatibility ?? null,
    supportsFit: (alignment.supports_fit ?? []).slice(0, 2),
    bottomLine: workRealitySummary,
    canonicalKey,
    platform,
    ...(title ? { title } : {}),
    ...(company ? { company } : {}),
    ...(fetchSource ? { fetchSource } : {}),
  });
}
