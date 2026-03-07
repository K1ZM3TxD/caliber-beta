import { NextRequest, NextResponse } from "next/server";
import { storeGet, storeLatest } from "@/lib/calibration_store";

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

/**
 * GET /api/extension/session?sessionId=xxx
 * Returns the active calibration session metadata for extension bootstrap.
 * If sessionId is provided, looks up that specific session.
 * Otherwise returns the most recent completed session.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("sessionId");

  let session;
  if (requestedId) {
    session = storeGet(requestedId);
  } else {
    session = storeLatest();
  }

  const headers = corsHeaders(req);

  if (!session) {
    const res = NextResponse.json(
      { ok: false, error: "no_session", message: "No calibration session found." },
      { status: 404 }
    );
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  const locked = Boolean(session.personVector?.values && session.personVector.locked);
  const state = String(session.state ?? "UNKNOWN");

  const res = NextResponse.json({
    ok: true,
    sessionId: session.sessionId,
    state,
    profileComplete: locked,
    hasSynthesis: Boolean(session.synthesis?.patternSummary),
  });
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}
