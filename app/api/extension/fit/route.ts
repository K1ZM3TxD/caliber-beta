import { NextRequest, NextResponse } from "next/server";
import { storeGet, storeLatest } from "@/lib/calibration_store";
import { dispatchCalibrationEvent } from "@/lib/calibration_machine";
import { computeHiringRealityCheck } from "@/lib/hiring_reality_check";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobText = typeof body.jobText === "string" ? body.jobText.trim() : "";
    if (jobText.length < 200) {
      return NextResponse.json(
        { error: "Job description too short (need ≥200 characters)." },
        { status: 400 }
      );
    }

    // Resolve session: explicit sessionId or fall back to most recent
    let sessionId: string | null = typeof body.sessionId === "string" ? body.sessionId : null;
    if (!sessionId) {
      const latest = storeLatest();
      if (!latest) {
        return NextResponse.json(
          { error: "No active Caliber session. Complete your profile on Caliber first." },
          { status: 401 }
        );
      }
      sessionId = latest.sessionId;
    }

    const session = storeGet(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found. Log into Caliber and complete your profile first." },
        { status: 401 }
      );
    }

    // Session must have completed encoding (personVector locked)
    if (!session.personVector?.values || !session.personVector.locked) {
      return NextResponse.json(
        { error: "Profile incomplete. Finish the calibration prompts on Caliber first." },
        { status: 400 }
      );
    }

    // Drive through the job-fit pipeline: SUBMIT_JOB_TEXT → ADVANCE loops → COMPUTE_ALIGNMENT_OUTPUT
    // (mirrors the frontend flow in app/calibration/page.tsx)

    // Step 1: Submit job text
    const curState = String(session.state ?? "");
    if (curState.startsWith("TITLE_HYPOTHESIS") || curState.startsWith("TITLE_DIALOGUE")) {
      // Auto-advance past title feedback
      await dispatchCalibrationEvent({ type: "TITLE_FEEDBACK", sessionId, feedback: "" } as any);
    }

    let result = await dispatchCalibrationEvent({
      type: "SUBMIT_JOB_TEXT",
      sessionId,
      jobText,
    } as any);

    if (!result.ok) {
      return NextResponse.json(
        { error: `Pipeline error: ${(result as any).error?.detail ?? "SUBMIT_JOB_TEXT failed"}` },
        { status: 500 }
      );
    }

    // Step 2: Advance until ALIGNMENT_OUTPUT or TERMINAL_COMPLETE
    let s = result.session!;
    let ticks = 0;
    while (ticks < 12) {
      const st = String(s.state ?? "");
      if (st === "ALIGNMENT_OUTPUT" || st === "TERMINAL_COMPLETE") break;
      const adv = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId } as any);
      if (!adv.ok) break;
      s = adv.session!;
      ticks++;
    }

    // Step 3: Compute alignment output
    if (String(s.state) === "ALIGNMENT_OUTPUT") {
      const comp = await dispatchCalibrationEvent({
        type: "COMPUTE_ALIGNMENT_OUTPUT",
        sessionId,
      } as any);
      if (comp.ok && comp.session) s = comp.session;
    }

    // Step 4: Extract results
    const r = s.result;
    if (!r?.alignment) {
      return NextResponse.json(
        { error: "Fit computation did not produce results. Try again." },
        { status: 500 }
      );
    }

    const alignment = r.alignment as any;

    // Compute Hiring Reality Check (screening likelihood)
    const resumeText = session.resume?.rawText ?? "";
    const hiringCheck = computeHiringRealityCheck(body.jobText, resumeText);

    // Extract nearby/adjacent titles from calibration for search suggestions
    const adjTitles = session.titleRecommendation?.adjacent_titles ?? [];
    const nearbyRoles = adjTitles.slice(0, 3).map((t: { title: string }) => ({ title: t.title }));

    const res = NextResponse.json({
      score_0_to_10: alignment.score ?? 0,
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
    });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  } catch (e: any) {
    const res = NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  }
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}
