// GET:  check tailor status for a pipeline entry (existing result or available prep)
// POST: generate tailored resume from a pipeline entry

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pipelineGet as filePipelineGet, pipelineUpdateStage as filePipelineUpdateStage } from "@/lib/pipeline_store";
import { pipelineGet as dbPipelineGet, pipelineUpdateStage as dbPipelineUpdateStage, getLinkedCaliberSession } from "@/lib/pipeline_store_db";
import {
  tailorPrepFindByJob,
  tailorResultGet,
  tailorResultSave,
  generateTailoredResume,
} from "@/lib/tailor_store";
import { storeGet } from "@/lib/calibration_store";

/**
 * Resolve a pipeline entry from DB (auth'd or session-based) or file store (fallback).
 * Returns entry, source, and resolved sessionId (falls back to linked caliberSessionId).
 */
async function resolveEntry(pipelineId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  console.debug("[Caliber][tailor] resolveEntry start", { pipelineId, userId: userId ?? "none" });

  // Always check DB first (covers both user-owned and session-based entries)
  const entry = await dbPipelineGet(pipelineId);
  if (entry) {
    // Resolve sessionId: from entry, then linked fallback
    let sessionId = entry.sessionId || "";
    if (!sessionId && userId) {
      sessionId = (await getLinkedCaliberSession(userId)) || "";
    }
    console.debug("[Caliber][tailor] resolveEntry DB hit", {
      pipelineId,
      entryUserId: entry.userId ?? "none",
      sessionId: sessionId || "none",
    });
    return { entry, source: "db" as const, userId, sessionId };
  }

  // Fallback to legacy file store
  const fileEntry = filePipelineGet(pipelineId);
  if (fileEntry) {
    console.debug("[Caliber][tailor] resolveEntry file-store hit", { pipelineId });
    return { entry: fileEntry, source: "file" as const, userId, sessionId: fileEntry.sessionId };
  }

  console.warn("[Caliber][tailor] resolveEntry NOT FOUND", { pipelineId, userId: userId ?? "none" });
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
    console.warn("[Caliber][tailor][GET] entry not found", { pipelineId });
    return NextResponse.json(
      { ok: false, error: "Pipeline entry not found" },
      { status: 404 }
    );
  }

  const { entry, sessionId } = resolved;

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

  // Check if prep context exists — use resolved sessionId (entry or linked fallback)
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
      console.warn("[Caliber][tailor][POST] entry not found", { pipelineId });
      return NextResponse.json(
        { ok: false, error: "Pipeline entry not found" },
        { status: 404 }
      );
    }

    const { entry, source, userId, sessionId } = resolved;
    console.debug("[Caliber][tailor][POST] resolved", {
      pipelineId,
      source,
      userId: userId ?? "none",
      sessionId: sessionId || "none",
      jobUrl: entry.jobUrl,
    });

    // Find prep context for this job (uses resolved sessionId)
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
      ...(userId ? { userId } : {}),
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
    const isMissingKey = msg.includes("OPENAI_API_KEY");
    console.error(`[pipeline/tailor] ${msg}`);
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
