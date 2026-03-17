// GET:   list pipeline entries (auth'd → DB by userId, extension/unauthenticated → DB by sessionId)
// POST:  create a new pipeline entry
// PATCH: update an existing entry's stage

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// File-based store (legacy migration only)
import {
  type PipelineStage,
} from "@/lib/pipeline_store";

// DB-backed store (all persistence)
import {
  pipelineList as dbPipelineList,
  pipelineFindByJob as dbPipelineFindByJob,
  pipelineCreate as dbPipelineCreate,
  pipelineUpdateStage as dbPipelineUpdateStage,
  migrateFileEntriesToUser,
  pipelineListBySession,
  pipelineFindByJobSession,
  pipelineCreateForSession,
  migrateSessionEntriesToUser,
} from "@/lib/pipeline_store_db";

const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\/[a-z]{32}$/;

function isExtensionRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin") ?? "";
  return CHROME_EXT_ORIGIN_RE.test(origin);
}

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

  // Extension requests: DB by sessionId
  if (isExtensionRequest(req)) {
    if (!sessionId) {
      const res = NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
      for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
      return res;
    }
    if (jobUrl) {
      const entry = await pipelineFindByJobSession(sessionId, jobUrl);
      const res = NextResponse.json(
        { ok: true, exists: !!entry, entry: entry ?? undefined },
        { status: 200 }
      );
      for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
      return res;
    }
    const entries = await pipelineListBySession(sessionId);
    const res = NextResponse.json({ ok: true, entries }, { status: 200 });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  }

  // Web app requests: prefer auth, fall back to sessionId
  const session = await auth();

  if (session?.user?.id) {
    const userId = session.user.id;

    // Migrate any file-based or session-based entries for this user
    if (sessionId) {
      await migrateFileEntriesToUser(sessionId, userId);
      await migrateSessionEntriesToUser(sessionId, userId);
    }

    if (jobUrl) {
      const entry = await dbPipelineFindByJob(userId, jobUrl);
      return NextResponse.json(
        { ok: true, exists: !!entry, entry: entry ?? undefined },
        { status: 200 }
      );
    }

    const entries = await dbPipelineList(userId);
    return NextResponse.json({ ok: true, entries }, { status: 200 });
  }

  // Not authenticated but has sessionId — show session-based entries
  if (sessionId) {
    if (jobUrl) {
      const entry = await pipelineFindByJobSession(sessionId, jobUrl);
      return NextResponse.json(
        { ok: true, exists: !!entry, entry: entry ?? undefined },
        { status: 200 }
      );
    }
    const entries = await pipelineListBySession(sessionId);
    return NextResponse.json({ ok: true, entries }, { status: 200 });
  }

  return NextResponse.json(
    { ok: false, error: "Authentication or sessionId required" },
    { status: 401 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, jobTitle, company, jobUrl, score, stage } = body ?? {};

    if (!jobTitle || !company) {
      const res = NextResponse.json(
        { ok: false, error: "Missing required fields (jobTitle, company)" },
        { status: 400 }
      );
      for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
      return res;
    }

    // Extension requests: DB by sessionId
    if (isExtensionRequest(req)) {
      if (!sessionId) {
        const res = NextResponse.json(
          { ok: false, error: "Missing sessionId" },
          { status: 400 }
        );
        for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
        return res;
      }
      const entry = await pipelineCreateForSession({
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
    }

    // Web app: require auth, use DB
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const entry = await dbPipelineCreate({
      userId: session.user.id,
      jobTitle: String(jobTitle).slice(0, 200),
      company: String(company).slice(0, 200),
      jobUrl: String(jobUrl ?? "").slice(0, 2000),
      score: typeof score === "number" ? score : 0,
      stage: VALID_STAGES.includes(stage) ? stage : "strong_match",
    });

    return NextResponse.json({ ok: true, entry }, { status: 201 });
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

    // Check auth for web requests
    const session = await auth();
    if (session?.user?.id) {
      const updated = await dbPipelineUpdateStage(
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
    }

    // Unauthenticated / extension: still use DB (session-based entries have no userId)
    const updated = await dbPipelineUpdateStage(
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
