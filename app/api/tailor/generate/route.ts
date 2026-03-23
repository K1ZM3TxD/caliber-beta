// POST: generate tailored resume from prep context + user's calibration session resume

import { NextRequest, NextResponse } from "next/server";
import {
  tailorPrepGet,
  tailorPrepFindByJob,
  tailorResultSave,
  generateTailoredResume,
} from "@/lib/tailor_store";
import { storeGet } from "@/lib/calibration_store";
import {
  pipelineGet,
  pipelineFindByJob,
  pipelineCreate,
  pipelineUpdateStage,
} from "@/lib/pipeline_store";
import { stripDebugTrace } from "@/lib/resume_parser";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prepId = typeof body.prepId === "string" ? body.prepId.trim() : "";
    const pipelineId =
      typeof body.pipelineId === "string" ? body.pipelineId.trim() : "";

    if (!prepId && !pipelineId) {
      return NextResponse.json(
        { ok: false, error: "Missing prepId or pipelineId" },
        { status: 400 }
      );
    }

    // Resolve prep: either directly via prepId, or via pipelineId → lookup
    let prep = prepId ? tailorPrepGet(prepId) : null;
    let pipelineEntry = pipelineId ? pipelineGet(pipelineId) : null;

    if (!prep && pipelineEntry) {
      // Find the prep associated with this pipeline entry
      prep = tailorPrepFindByJob(pipelineEntry.sessionId, pipelineEntry.jobUrl);
    }

    if (!prep) {
      return NextResponse.json(
        {
          ok: false,
          error: pipelineId
            ? "No tailor context found for this job. Score the job from LinkedIn first."
            : "Prepare context not found",
        },
        { status: 404 }
      );
    }

    // Load the user's calibration session to get their resume
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
        { ok: false, error: "Resume text is too short. Recalibrate with a full resume." },
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

    // Advance existing pipeline entry to tailored (created at prepare time)
    let pipeline = pipelineFindByJob(prep.sessionId, prep.jobUrl);
    if (pipeline) {
      pipelineUpdateStage(pipeline.id, "tailored", {
        tailorId: result.id,
      });
    } else {
      // Fallback: create if somehow missing (e.g. data was cleared)
      pipeline = pipelineCreate({
        sessionId: prep.sessionId,
        jobTitle: prep.jobTitle,
        company: prep.company,
        jobUrl: prep.jobUrl,
        score: prep.score,
        stage: "tailored",
        tailorId: result.id,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        resultId: result.id,
        tailoredText: stripDebugTrace(tailoredText),
        pipelineId: pipeline.id,
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const isMissingKey = msg.includes("OPENAI_API_KEY");
    console.error(`[tailor/generate] ${msg}`);
    return NextResponse.json(
      {
        ok: false,
        error: isMissingKey
          ? "Resume tailoring is temporarily unavailable. Please try again later."
          : msg,
      },
      { status: isMissingKey ? 503 : 500 }
    );
  }
}
