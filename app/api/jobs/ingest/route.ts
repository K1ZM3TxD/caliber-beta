// POST /api/jobs/ingest
//
// User-directed job ingestion: the user supplies a public job URL and pastes
// the full job description text. The route scores the job against their active
// calibration session and stores it in the Canonical Job Cache, exactly as if
// the extension sidecard had triggered the score.
//
// Body: { url: string, jobText: string, sessionId?: string }
//
// Returns:
//   200 { ok: true, score, hrcBand, workModeCompat, supportsFit, canonicalKey, platform, alreadyKnown }
//   400 { ok: false, error, field? }   — validation failure
//   401 { ok: false, error }            — no active session
//   500 { ok: false, error }            — scoring system failure

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeGet, storeGetAsync, storeLatest, storeLatestAsync } from "@/lib/calibration_store";
import { runIntegrationSeam } from "@/lib/integration_seam";
import { computeHiringRealityCheck } from "@/lib/hiring_reality_check";
import { evaluateWorkMode, generateWorkRealitySummary } from "@/lib/work_mode";
import { writeTrustedScoreSafe, detectPlatform, buildCanonicalKey } from "@/lib/job_cache_store";
import { validateIngestInput } from "@/lib/job_ingest_validation";

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

  // ── Input validation ────────────────────────────────────────────────────
  const validation = validateIngestInput({ url: body.url, jobText: body.jobText });
  if (!validation.ok) {
    return json({ ok: false, error: validation.error, field: validation.field }, 400);
  }

  const { normalizedUrl, normalizedText } = validation;

  // ── Title / company from body (optional; populated when caller has metadata) ──
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";

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
  });
}
