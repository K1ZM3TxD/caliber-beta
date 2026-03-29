// GET /api/jobs/cache?url={sourceUrl}&sessionId={sessionId}
// GET /api/jobs/cache?key={canonicalKey}&sessionId={sessionId}
//
// Looks up a cached canonical job record and its most recent score for the
// given calibration session. Used by the extension overlay, homepage job
// inventory, and future pipeline views.
//
// Returns { ok: true, job, score } if found, { ok: false } if not cached.

import { NextRequest, NextResponse } from "next/server";
import { lookupByUrl, lookupByKey } from "@/lib/job_cache_store";

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
  const sourceUrl = searchParams.get("url");
  const canonicalKey = searchParams.get("key");
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    const res = NextResponse.json({ ok: false, error: "Missing sessionId" }, { status: 400 });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  }

  if (!sourceUrl && !canonicalKey) {
    const res = NextResponse.json({ ok: false, error: "Missing url or key parameter" }, { status: 400 });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  }

  try {
    const result = sourceUrl
      ? await lookupByUrl(sourceUrl, sessionId)
      : await lookupByKey(canonicalKey!, sessionId);

    if (!result.job) {
      const res = NextResponse.json({ ok: false }, { status: 200 });
      for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
      return res;
    }

    const res = NextResponse.json(
      {
        ok: true,
        job: {
          id: result.job.id,
          canonicalKey: result.job.canonicalKey,
          platform: result.job.platform,
          title: result.job.title,
          company: result.job.company,
          location: result.job.location ?? null,
        },
        score: result.scoreCache
          ? {
              score: result.scoreCache.score,
              payload: result.scoreCache.scorePayload,
              textSource: result.scoreCache.textSource,
              scoredAt: result.scoreCache.scoredAt,
            }
          : null,
      },
      { status: 200 }
    );
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  } catch (err: any) {
    const res = NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
    for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
    return res;
  }
}
