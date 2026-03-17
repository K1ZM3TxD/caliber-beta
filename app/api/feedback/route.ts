import { NextRequest, NextResponse } from "next/server";
import { appendFeedbackEvent, FeedbackEvent } from "@/lib/feedback_store";

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

const VALID_SURFACES = new Set(["extension", "calibration_results", "title_suggestion"]);
const VALID_SITES = new Set(["linkedin", "indeed", "glassdoor", "ziprecruiter", "monster", "other"]);
const VALID_FEEDBACK_TYPES = new Set(["thumbs_up", "thumbs_down", "bug_report"]);
const VALID_REASONS = new Set([
  "score_wrong",
  "hiring_reality_wrong",
  "title_suggestion_wrong",
  "explanation_not_helpful",
  "other",
]);
const VALID_BUG_CATEGORIES = new Set([
  "wrong_job_detected",
  "score_failed_to_load",
  "panel_not_opening",
  "content_missing",
  "action_not_working",
  "other",
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.surface || !VALID_SURFACES.has(body.surface)) {
      return withCors(req, NextResponse.json({ error: "Invalid surface" }, { status: 400 }));
    }
    if (!body.feedback_type || !VALID_FEEDBACK_TYPES.has(body.feedback_type)) {
      return withCors(req, NextResponse.json({ error: "Invalid feedback_type" }, { status: 400 }));
    }

    const event: FeedbackEvent = {
      timestamp: new Date().toISOString(),
      surface: body.surface,
      site: VALID_SITES.has(body.site) ? body.site : "other",
      company_name: sanitize(body.company_name, 200),
      job_title: sanitize(body.job_title, 200),
      search_title: sanitize(body.search_title, 200),
      calibration_title_direction: sanitize(body.calibration_title_direction, 200),
      fit_score: typeof body.fit_score === "number" ? body.fit_score : null,
      decision_label: sanitize(body.decision_label, 50),
      hiring_reality_band: sanitize(body.hiring_reality_band, 50),
      better_search_title_suggestion: sanitize(body.better_search_title_suggestion, 200),
      feedback_type: body.feedback_type,
      feedback_reason: VALID_REASONS.has(body.feedback_reason) ? body.feedback_reason : null,
      bug_category: VALID_BUG_CATEGORIES.has(body.bug_category) ? body.bug_category : null,
      optional_comment: sanitize(body.optional_comment, 1000),
      behavioral_signals: {
        jobs_viewed_in_session: clampInt(body.behavioral_signals?.jobs_viewed_in_session, 0, 9999),
        scores_below_6_count: clampInt(body.behavioral_signals?.scores_below_6_count, 0, 9999),
        highest_score_seen: typeof body.behavioral_signals?.highest_score_seen === "number"
          ? Math.round(body.behavioral_signals.highest_score_seen * 10) / 10
          : null,
        better_title_suggestion_shown: !!body.behavioral_signals?.better_title_suggestion_shown,
        better_title_suggestion_clicked: !!body.behavioral_signals?.better_title_suggestion_clicked,
      },
    };

    await appendFeedbackEvent(event);

    return withCors(req, NextResponse.json({ ok: true }));
  } catch {
    return withCors(req, NextResponse.json({ error: "Invalid request" }, { status: 400 }));
  }
}

export async function OPTIONS(req: NextRequest) {
  const headers = corsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

function withCors(req: NextRequest, res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

function sanitize(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null;
  return val.trim().slice(0, maxLen) || null;
}

function clampInt(val: unknown, min: number, max: number): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  return Math.max(min, Math.min(max, Math.round(val)));
}
