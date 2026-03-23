import { NextRequest, NextResponse } from "next/server";
import { storeGet, storeLatest, storeImport, storeGetAsync, storeLatestAsync } from "@/lib/calibration_store";
import { runIntegrationSeam } from "@/lib/integration_seam";
import { computeHiringRealityCheck } from "@/lib/hiring_reality_check";
import { evaluateWorkMode } from "@/lib/work_mode";
import { generateRecoveryTerms } from "@/lib/title_scoring";

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

/** Build a single concise gap line for the sidecard when execution evidence guardrail fires. */
function buildExecutionEvidenceGapLine(
  categories: string[],
  missingEvidence: string[],
): string {
  if (missingEvidence.length === 0) return "This role requires specific execution experience not found in your profile.";
  const missing = missingEvidence[0];
  if (categories.includes("domain_locked")) {
    return `This role requires hands-on ${missing} experience.`;
  }
  return "This role requires hands-on coding and stack-specific experience.";
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
    const workMode = evaluateWorkMode(rawScore, resumeText, promptAnswers, jobText, session.workPreferences ?? null);
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

    // Generate recovery search terms — work-mode-aware, cluster-diverse, ranked
    const promptAnswersList = Object.values(promptAnswers);
    const recoveryResult = generateRecoveryTerms(
      resumeText, promptAnswersList, workMode.userMode.mode, primaryTitle,
    );

    return jsonResponse(req, {
      score_0_to_10: finalScore,
      supports_fit: alignment.supports_fit ?? [],
      stretch_factors: alignment.stretch_factors ?? [],
      bottom_line_2s: alignment.bottom_line_2s ?? "",
      hiring_reality_check: {
        band: hiringCheck.band,
        reason: hiringCheck.reason,
        execution_evidence_gap: workMode.executionEvidence.triggered
          ? buildExecutionEvidenceGapLine(workMode.executionEvidence.categories, workMode.executionEvidence.missingEvidence)
          : null,
      },
      calibrationId: sessionId,
      sourceUrl: body.sourceUrl ?? null,
      nearby_roles: nearbyRoles,
      recovery_terms: recoveryResult.terms.map(t => ({
        title: t.title,
        score: t.score,
        recoveryScore: t.recoveryScore,
        cluster: t.cluster,
        source: t.source,
      })),
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
        roleType: workMode.roleType,
        preAdjustmentScore: workMode.preScore,
        workModeAdjustment: workMode.workModeAdjustment,
        executionIntensityAdjustment: workMode.executionIntensityAdjustment,
        roleTypePenalty: workMode.roleTypePenalty,
        chipSuppression: {
          suppressed: workMode.chipSuppression.suppressed,
          adjustment: workMode.chipSuppression.adjustment,
          reason: workMode.chipSuppression.reason,
        },
        executionIntensity: {
          score: workMode.executionIntensity.score,
          triggers: workMode.executionIntensity.triggers,
          reason: workMode.executionIntensity.reason,
        },
        executionEvidence: {
          triggered: workMode.executionEvidence.triggered,
          categories: workMode.executionEvidence.categories,
          signals: workMode.executionEvidence.signals,
          missingEvidence: workMode.executionEvidence.missingEvidence,
          cap: workMode.executionEvidence.cap,
          adjustment: workMode.executionEvidence.adjustment,
          reason: workMode.executionEvidence.reason,
        },
        finalScore: workMode.postScore,
        adjustmentReason: workMode.adjustmentReason,
      },
      debug_recovery_terms: recoveryResult.debug,
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
