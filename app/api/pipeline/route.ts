// GET:   list pipeline entries (optionally filtered by sessionId)
// POST:  create a new pipeline entry
// PATCH: update an existing entry's stage

import { NextRequest, NextResponse } from "next/server";
import {
  pipelineList,
  pipelineCreate,
  pipelineUpdateStage,
  type PipelineStage,
} from "@/lib/pipeline_store";

const VALID_STAGES: PipelineStage[] = [
  "strong_match",
  "tailored",
  "applied",
  "interviewing",
  "offer",
  "archived",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") ?? undefined;
  const entries = pipelineList(sessionId);
  return NextResponse.json({ ok: true, entries }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, jobTitle, company, jobUrl, score, stage } = body ?? {};

    if (!sessionId || !jobTitle || !company) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields (sessionId, jobTitle, company)" },
        { status: 400 }
      );
    }

    const entry = pipelineCreate({
      sessionId: String(sessionId),
      jobTitle: String(jobTitle).slice(0, 200),
      company: String(company).slice(0, 200),
      jobUrl: String(jobUrl ?? "").slice(0, 2000),
      score: typeof score === "number" ? score : 0,
      stage: VALID_STAGES.includes(stage) ? stage : "strong_match",
    });

    return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, stage, tailorId } = body ?? {};

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing entry id" },
        { status: 400 }
      );
    }
    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { ok: false, error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    const updated = pipelineUpdateStage(
      String(id),
      stage as PipelineStage,
      tailorId ? { tailorId: String(tailorId) } : undefined
    );
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Pipeline entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, entry: updated }, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
