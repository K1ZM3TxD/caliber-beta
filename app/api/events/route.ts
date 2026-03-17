import { NextRequest, NextResponse } from "next/server";
import {
  appendTelemetryEvent,
  isValidEventName,
  TelemetryEvent,
} from "@/lib/telemetry_store";

const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\/[a-z]{32}$/;
const ALLOWED_ORIGINS = new Set([
  "https://www.caliber-app.com",
  "http://localhost:3000",
]);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (CHROME_EXT_ORIGIN_RE.test(origin) || ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {};
}

function withCors(req: NextRequest, res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

function sanitize(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null;
  return val.trim().slice(0, maxLen) || null;
}

const VALID_SOURCES = new Set(["extension", "web"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!isValidEventName(body.event)) {
      return withCors(
        req,
        NextResponse.json({ error: "Invalid event name" }, { status: 400 })
      );
    }

    const event: TelemetryEvent = {
      event: body.event,
      timestamp: new Date().toISOString(),
      sessionId: sanitize(body.sessionId, 200),
      surfaceKey: sanitize(body.surfaceKey, 500),
      jobId: sanitize(body.jobId, 100),
      jobTitle: sanitize(body.jobTitle, 200),
      company: sanitize(body.company, 200),
      jobUrl: sanitize(body.jobUrl, 2000),
      score:
        typeof body.score === "number" && Number.isFinite(body.score)
          ? Math.round(body.score * 10) / 10
          : null,
      source: VALID_SOURCES.has(body.source) ? body.source : null,
      scoreSource: sanitize(body.scoreSource, 100),
      signalPreference: sanitize(body.signalPreference, 100),
      meta:
        body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
          ? body.meta
          : null,
    };

    await appendTelemetryEvent(event);
    return withCors(req, NextResponse.json({ ok: true }));
  } catch {
    return withCors(
      req,
      NextResponse.json({ error: "Invalid request" }, { status: 400 })
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"])
    return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers });
}
