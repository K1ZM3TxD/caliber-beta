// GET:  check tailor status for a pipeline entry (existing result or available prep)
// POST: generate tailored resume from a pipeline entry

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pipelineGet as filePipelineGet, pipelineUpdateStage as filePipelineUpdateStage } from "@/lib/pipeline_store";
import { pipelineGet as dbPipelineGet, pipelineUpdateStage as dbPipelineUpdateStage } from "@/lib/pipeline_store_db";
import {
  tailorPrepFindByJob,
  tailorResultGet,
  tailorResultSave,
  generateTailoredResume,
} from "@/lib/tailor_store";
import { storeGet } from "@/lib/calibration_store";

/**
 * Resolve a pipeline entry from DB (auth'd) or file store (fallback).
 * Returns [entry, source] where source indicates which store was used.
 */
async function resolveEntry(pipelineId: string) {
  const session = await auth();
  if (session?.user?.id) {
    const entry = await dbPipelineGet(pipelineId);
    if (entry) return { entry, source: "db" as const };
  }
  const entry = filePipelineGet(pipelineId);
  if (entry) return { entry, source: "file" as const };
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  if (!pipelineId) {
    return NextResponse.json(
      { ok: false, error: "Missing pipelineId" },
      { status: 400 }
    );
  }

  const resolved = await resolveEntry(pipelineId);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "Pipeline entry not found" },
      { status: 404 }
    );
  }

  const { entry } = resolved;

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

  // Check if prep context exists — use sessionId for file entries, userId for DB
  const lookupId = "userId" in entry ? (entry as { userId: string }).userId : (entry as { sessionId: string }).sessionId;
  // tailorPrepFindByJob uses sessionId from calibration — try both
  const sessionId = "sessionId" in entry ? (entry as { sessionId: string }).sessionId : "";
  const prep = sessionId ? tailorPrepFindByJob(sessionId, entry.jobUrl) : null;
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

    const resolved = await resolveEntry(pipelineId);
    if (!resolved) {
      return NextResponse.json(
        { ok: false, error: "Pipeline entry not found" },
        { status: 404 }
      );
    }

    const { entry, source } = resolved;

    // Find prep context for this job (uses sessionId from calibration)
    const sessionId = "sessionId" in entry ? (entry as { sessionId: string }).sessionId : "";
    const prep = sessionId ? tailorPrepFindByJob(sessionId, entry.jobUrl) : null;
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
    const calibSession = storeGet(prep.sessionId);
    if (!calibSession) {
      return NextResponse.json(
        { ok: false, error: "Calibration session not found. Recalibrate first." },
        { status: 404 }
      );
    }

    const resumeText = calibSession.resume?.rawText ?? "";
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

    // Advance pipeline entry to tailored stage (in whichever store it lives)
    if (source === "db") {
      await dbPipelineUpdateStage(entry.id, "tailored", { tailorId: result.id });
    } else {
      filePipelineUpdateStage(entry.id, "tailored", { tailorId: result.id });
    }

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
