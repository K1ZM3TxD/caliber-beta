import { NextRequest, NextResponse } from "next/server";
import { storeGet, storeLatest, storeImport, storeGetAsync, storeLatestAsync } from "@/lib/calibration_store";
import { runIntegrationSeam } from "@/lib/integration_seam";
import { computeHiringRealityCheck } from "@/lib/hiring_reality_check";
import { evaluateWorkMode } from "@/lib/work_mode";

// Request more execution time from Vercel (hobby: 10s default → 60s on Pro)
export const maxDuration = 30;

const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\/[a-z]{32}$/;

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (CHROME_EXT_ORIGIN_RE.test(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {};
}

/** Helper: build a JSON response with CORS headers always attached. */
function jsonResponse(req: NextRequest, data: Record<string, unknown>, status: number) {
  const res = NextResponse.json(data, { status });
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobText = typeof body.jobText === "string" ? body.jobText.trim() : "";
    const isPrescan = body.prescan === true;
    const minLength = isPrescan ? 80 : 200;
    if (jobText.length < minLength) {
      return jsonResponse(req, { error: `Job description too short (need ≥${minLength} characters).` }, 400);
    }

    // Resolve session: explicit sessionId or fall back to most recent
    let sessionId: string | null = typeof body.sessionId === "string" ? body.sessionId : null;
    if (!sessionId) {
      let latest = storeLatest();
      if (!latest) latest = await storeLatestAsync();
      if (!latest) {
        return jsonResponse(req, { error: "No active Caliber session. Complete your profile on Caliber first." }, 401);
      }
      sessionId = latest.sessionId;
    }

    let session = storeGet(sessionId);

    // Serverless resilience: if session not in local store, try importing
    // the inline backup sent by the extension (avoids multi-Lambda mismatch).
    if (!session && body.sessionBackup && typeof body.sessionBackup === "object") {
      storeImport(body.sessionBackup);
      session = storeGet(sessionId);
    }

    // Fall back to DB on cold Lambda
    if (!session) {
      session = await storeGetAsync(sessionId);
    }

    if (!session) {
      return jsonResponse(req, { error: "Session not found. Log into Caliber and complete your profile first." }, 401);
    }

    // Session must have completed encoding (personVector locked)
    if (!session.personVector?.values || !session.personVector.locked) {
      return jsonResponse(req, { error: "Profile incomplete. Finish the calibration prompts on Caliber first." }, 400);
    }

    // ── Direct scoring path ──────────────────────────────────────
    // Bypass the state machine entirely. The state machine is for the
    // calibration flow; for scoring a job we only need personVector + jobText.
    // This is faster (no file I/O, no state mutations) and eliminates the
    // session-state corruption that caused "Failed to fetch" on cold Lambdas.
    const personVector = session.personVector.values as number[];

    const seam = runIntegrationSeam({ jobText, experienceVector: personVector });
    if (!seam.ok) {
      return jsonResponse(req, { error: seam.error.message }, 400);
    }

    const alignment = seam.result.alignment as any;

    // Compute Hiring Reality Check (screening likelihood)
    const resumeText = session.resume?.rawText ?? "";
    const hiringCheck = computeHiringRealityCheck(jobText, resumeText);

    // ── Dominant Work Mode classification + score ceiling ─────
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
    const workPrefs = session.workPreferences ?? undefined;
    const workMode = evaluateWorkMode(rawScore, resumeText, promptAnswers, jobText, workPrefs);
    const finalScore = workMode.postScore;

    // Extract calibration titles for search suggestions
    const titleRec = session.synthesis?.titleRecommendation;
    const primaryTitle = titleRec?.primary_title?.title ?? "";
    const adjTitles = titleRec?.adjacent_titles ?? [];
    const allTitles = (titleRec as any)?.titles ?? [];
    const titlePool = adjTitles.length > 0
      ? adjTitles
      : allTitles.filter((t: { title: string }) => t.title !== primaryTitle);
    const nearbyRoles = titlePool.slice(0, 3).map((t: { title: string }) => ({ title: t.title }));

    return jsonResponse(req, {
      score_0_to_10: finalScore,
      supports_fit: alignment.supports_fit ?? [],
      stretch_factors: alignment.stretch_factors ?? [],
      bottom_line_2s: alignment.bottom_line_2s ?? "",
      hiring_reality_check: {
        band: hiringCheck.band,
        reason: hiringCheck.reason,
      },
      calibrationId: sessionId,
      sourceUrl: body.sourceUrl ?? null,
      nearby_roles: nearbyRoles,
      calibration_title: primaryTitle,
      signal_preference: session.includeDetectedSignals === true ? "yes" : session.includeDetectedSignals === false ? "no" : null,
      debug_signals: alignment.signals ? {
        personVector: alignment.signals.personVector,
        roleVector: alignment.signals.roleVector,
        S: alignment.signals.severeContradictions,
        M: alignment.signals.mildTensions,
        W: alignment.signals.penaltyWeight,
      } : null,
      debug_work_mode: {
        userMode: workMode.userMode.mode,
        userModeConfidence: workMode.userMode.confidence,
        userModeScores: workMode.userMode.scores,
        userModeMatches: workMode.userMode.topMatches,
        jobMode: workMode.jobMode.mode,
        jobModeConfidence: workMode.jobMode.confidence,
        jobModeScores: workMode.jobMode.scores,
        jobModeMatches: workMode.jobMode.topMatches,
        compatibility: workMode.compatibility,
        preAdjustmentScore: workMode.preScore,
        workModeAdjustment: workMode.workModeAdjustment,
        executionIntensityAdjustment: workMode.executionIntensityAdjustment,
        preferenceAdjustment: workMode.preferenceAdjustment,
        executionIntensity: {
          score: workMode.executionIntensity.score,
          triggers: workMode.executionIntensity.triggers,
          reason: workMode.executionIntensity.reason,
        },
        finalScore: workMode.postScore,
        adjustmentReason: workMode.adjustmentReason,
      },
    }, 200);
  } catch (e: any) {
    return jsonResponse(req, { error: e?.message ?? "Internal error" }, 500);
  }
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}
