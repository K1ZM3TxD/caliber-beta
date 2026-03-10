// POST: extension stages job context for tailoring
// GET:  tailor page retrieves prepared context by id

import { NextRequest, NextResponse } from "next/server";
import { tailorPrepSave, tailorPrepGet } from "@/lib/tailor_store";

const CHROME_EXT_ORIGIN_RE = /^chrome-extension:\/\/[a-z]{32}$/;

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (CHROME_EXT_ORIGIN_RE.test(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }
  return {};
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, jobTitle, company, jobUrl, jobText, score } = body ?? {};

    if (!sessionId || typeof sessionId !== "string") {
      const res = NextResponse.json(
        { ok: false, error: "Missing sessionId" },
        { status: 400 }
      );
      for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
      return res;
    }
    if (!jobTitle || !company || !jobText) {
      const res = NextResponse.json(
        { ok: false, error: "Missing jobTitle, company, or jobText" },
        { status: 400 }
      );
      for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
      return res;
    }

    const prep = tailorPrepSave({
      sessionId: String(sessionId),
      jobTitle: String(jobTitle).slice(0, 200),
      company: String(company).slice(0, 200),
      jobUrl: String(jobUrl ?? "").slice(0, 2000),
      jobText: String(jobText).slice(0, 15000),
      score: typeof score === "number" ? score : 0,
    });

    const res = NextResponse.json({ ok: true, prepareId: prep.id }, { status: 200 });
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing id parameter" },
      { status: 400 }
    );
  }
  const prep = tailorPrepGet(id);
  if (!prep) {
    return NextResponse.json(
      { ok: false, error: "Prepare context not found or expired" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, prep }, { status: 200 });
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}
