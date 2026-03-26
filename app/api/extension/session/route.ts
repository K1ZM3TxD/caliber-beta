import { NextRequest, NextResponse } from "next/server";
import { storeGet, storeImport, storeGetAsync } from "@/lib/calibration_store";

const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\/[a-z]{32}$/;

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (CHROME_EXT_ORIGIN_RE.test(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {};
}

/**
 * GET /api/extension/session?sessionId=xxx
 * Returns the active calibration session metadata for extension bootstrap.
 * sessionId is REQUIRED — omitting it would return storeLatest() which is
 * globally scoped and causes cross-user contamination.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("sessionId");

  const headers = corsHeaders(req);

  if (!requestedId) {
    // Refuse to return an arbitrary latest session — callers must supply an
    // explicit sessionId to prevent cross-profile contamination.
    const res = NextResponse.json(
      { ok: false, error: "session_id_required", message: "sessionId parameter is required." },
      { status: 400 }
    );
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  // Try sync (memory + disk) first, fall back to DB on cold Lambda
  let session = storeGet(requestedId);
  if (!session) {
    session = await storeGetAsync(requestedId);
  }

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

/**
 * POST /api/extension/session
 * Accepts { sessionId, sessionBackup } — imports the backup if the session
 * isn't already in the store, then returns session metadata.
 * This avoids the Vercel multi-Lambda race where a PUT and subsequent GET
 * hit different instances.
 */
export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  let body: { sessionId?: string; sessionBackup?: unknown };
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json(
      { ok: false, error: "invalid_body", message: "Invalid JSON" },
      { status: 400 }
    );
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  const requestedId = typeof body.sessionId === "string" ? body.sessionId : null;

  if (!requestedId) {
    // Require an explicit sessionId — falling back to storeLatest() here would
    // allow a different user's session to be imported and returned.
    const res = NextResponse.json(
      { ok: false, error: "session_id_required", message: "sessionId is required." },
      { status: 400 }
    );
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  }

  let session = storeGet(requestedId);

  // Import inline backup if session not found locally
  if (!session && body.sessionBackup && typeof body.sessionBackup === "object") {
    storeImport(body.sessionBackup);
    session = storeGet(requestedId);
  }

  // Fall back to DB on cold Lambda
  if (!session) {
    session = await storeGetAsync(requestedId);
  }

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
