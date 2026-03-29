// GET /api/jobs/known
//
// Lists recently scored jobs from the Canonical Job Cache for the current
// user or session, ordered by most recently scored.
//
// Query params:
//   sessionId  — calibration session ID (required for extension requests)
//   limit      — max records to return (default 50, max 100)
//
// Auth behaviour:
//   - Extension requests (chrome-extension:// origin): sessionId-based
//   - Web authenticated: userId-based (deduplicated across sessions)
//   - Web unauthenticated with sessionId: session-based
//   - Neither: 401

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listJobsForSession, listJobsForUser, type KnownJobEntry } from "@/lib/job_cache_store";

const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\/[a-z]{32}$/;

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (CHROME_EXT_ORIGIN_RE.test(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {};
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);

  const cors = corsHeaders(req);

  function json(data: unknown, status = 200) {
    const res = NextResponse.json(data, { status });
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  }

  // Extension requests: session-based only
  const isExtension = CHROME_EXT_ORIGIN_RE.test(req.headers.get("origin") ?? "");
  if (isExtension) {
    if (!sessionId) return json({ ok: false, error: "Missing sessionId" }, 400);
    try {
      const entries = await listJobsForSession(sessionId, limit);
      return json({ ok: true, entries: entries.map(toApiShape) });
    } catch {
      return json({ ok: false, error: "Lookup failed" }, 500);
    }
  }

  // Web requests: prefer userId (auth), fall back to sessionId query param
  const session = await auth();
  if (session?.user?.id) {
    try {
      const entries = await listJobsForUser(session.user.id, limit);
      return json({ ok: true, entries: entries.map(toApiShape) });
    } catch {
      return json({ ok: false, error: "Lookup failed" }, 500);
    }
  }

  if (sessionId) {
    try {
      const entries = await listJobsForSession(sessionId, limit);
      return json({ ok: true, entries: entries.map(toApiShape) });
    } catch {
      return json({ ok: false, error: "Lookup failed" }, 500);
    }
  }

  return json({ ok: false, error: "Authentication or sessionId required" }, 401);
}

/** Shape returned to API consumers — strips jobText to keep payload small. */
function toApiShape(entry: KnownJobEntry) {
  return {
    jobId: entry.job.id,
    canonicalKey: entry.job.canonicalKey,
    platform: entry.job.platform,
    title: entry.job.title,
    company: entry.job.company,
    location: entry.job.location ?? null,
    sourceUrl: entry.job.sourceUrl,
    score: entry.scoreCache.score,
    hrcBand: entry.scoreCache.scorePayload.hrcBand ?? null,
    hrcReason: entry.scoreCache.scorePayload.hrcReason ?? null,
    workModeCompat: entry.scoreCache.scorePayload.workModeCompat ?? null,
    supportsFit: entry.scoreCache.scorePayload.supportsFit.slice(0, 2),
    calibrationTitle: entry.scoreCache.scorePayload.calibrationTitle,
    textSource: entry.scoreCache.textSource,
    scoredAt: entry.scoreCache.scoredAt,
  };
}
