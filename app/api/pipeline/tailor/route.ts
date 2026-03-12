// GET:  check tailor status for a pipeline entry (existing result or available prep)
// POST: generate tailored resume from a pipeline entry

import { NextRequest, NextResponse } from "next/server";
import { pipelineGet, pipelineUpdateStage } from "@/lib/pipeline_store";
import {
  tailorPrepFindByJob,
  tailorResultGet,
  tailorResultSave,
  generateTailoredResume,
} from "@/lib/tailor_store";
import { storeGet } from "@/lib/calibration_store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  if (!pipelineId) {
    return NextResponse.json(
      { ok: false, error: "Missing pipelineId" },
      { status: 400 }
    );
  }

  const entry = pipelineGet(pipelineId);
  if (!entry) {
    return NextResponse.json(
      { ok: false, error: "Pipeline entry not found" },
      { status: 404 }
    );
  }

  // If already tailored, return existing result
  if (entry.tailorId) {
    const result = tailorResultGet(entry.tailorId);
    if (result) {
      return NextResponse.json({
        ok: true,
        status: "done",
        tailoredText: result.tailoredText,
      });
    }
  }

  // Check if prep context exists (needed for generation)
  const prep = tailorPrepFindByJob(entry.sessionId, entry.jobUrl);
  if (prep) {
    return NextResponse.json({ ok: true, status: "ready", prepId: prep.id });
  }

  return NextResponse.json({ ok: true, status: "unavailable" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pipelineId =
      typeof body.pipelineId === "string" ? body.pipelineId.trim() : "";
    if (!pipelineId) {
      return NextResponse.json(
        { ok: false, error: "Missing pipelineId" },
        { status: 400 }
      );
    }

    const entry = pipelineGet(pipelineId);
    if (!entry) {
      return NextResponse.json(
        { ok: false, error: "Pipeline entry not found" },
        { status: 404 }
      );
    }

    // Find prep context for this job
    const prep = tailorPrepFindByJob(entry.sessionId, entry.jobUrl);
    if (!prep) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No job context available. Use the extension to tailor this job.",
        },
        { status: 400 }
      );
    }

    // Load the user's resume from calibration session
    const session = storeGet(prep.sessionId);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Calibration session not found. Recalibrate first." },
        { status: 404 }
      );
    }

    const resumeText = session.resume?.rawText ?? "";
    if (resumeText.length < 100) {
      return NextResponse.json(
        {
          ok: false,
          error: "Resume text is too short. Recalibrate with a full resume.",
        },
        { status: 400 }
      );
    }

    // Generate the tailored resume
    const tailoredText = await generateTailoredResume(
      resumeText,
      prep.jobTitle,
      prep.company,
      prep.jobText
    );

    // Save the result
    const result = tailorResultSave({
      prepId: prep.id,
      sessionId: prep.sessionId,
      tailoredText,
    });

    // Advance pipeline entry to tailored stage
    pipelineUpdateStage(entry.id, "tailored", { tailorId: result.id });

    return NextResponse.json({
      ok: true,
      tailoredText,
      resultId: result.id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
