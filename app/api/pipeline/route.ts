// GET:   list pipeline entries (optionally filtered by sessionId)
// POST:  create a new pipeline entry
// PATCH: update an existing entry's stage

import { NextRequest, NextResponse } from "next/server";
import {
  pipelineList,
  pipelineFindByJob,
  pipelineCreate,
  pipelineUpdateStage,
  normalizeJobUrl,
  type PipelineStage,
} from "@/lib/pipeline_store";

const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\/[a-z]{32}$/;

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (CHROME_EXT_ORIGIN_RE.test(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {};
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

const VALID_STAGES: PipelineStage[] = [
  "strong_match",
  "tailored",
  "applied",
  "interviewing",
  "offer",
  "resume_prep",
  "submitted",
  "interview_prep",
  "interview",
  "archived",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") ?? undefined;
  const jobUrl = searchParams.get("jobUrl") ?? undefined;

  // Check if a specific job URL exists in the pipeline
  if (jobUrl && sessionId) {
    const entry = pipelineFindByJob(sessionId, jobUrl);
    const res = NextResponse.json(
      { ok: true, exists: !!entry, entry: entry ?? undefined },
      { status: 200 }
    );
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  }

  const entries = pipelineList(sessionId);
  const res = NextResponse.json({ ok: true, entries }, { status: 200 });
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, jobTitle, company, jobUrl, score, stage } = body ?? {};

    if (!sessionId || !jobTitle || !company) {
      const res = NextResponse.json(
        { ok: false, error: "Missing required fields (sessionId, jobTitle, company)" },
        { status: 400 }
      );
      for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
      return res;
    }

    const entry = pipelineCreate({
      sessionId: String(sessionId),
      jobTitle: String(jobTitle).slice(0, 200),
      company: String(company).slice(0, 200),
      jobUrl: String(jobUrl ?? "").slice(0, 2000),
      score: typeof score === "number" ? score : 0,
      stage: VALID_STAGES.includes(stage) ? stage : "strong_match",
    });

    const res = NextResponse.json({ ok: true, entry }, { status: 201 });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  } catch {
    const res = NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
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
