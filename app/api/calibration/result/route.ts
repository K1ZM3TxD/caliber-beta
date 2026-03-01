// GET /api/calibration/result?calibrationId=xxx
import { storeGet } from "@/lib/calibration_store"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const calibrationId = searchParams.get("calibrationId")
  if (!calibrationId) {
    return Response.json({ ok: false, error: { code: "MISSING_ID", message: "Missing calibrationId" } }, { status: 400 })
  }
  const session = storeGet(calibrationId)
  if (!session || !session.result || !session.result.alignment) {
    return Response.json({ ok: false, error: { code: "NOT_FOUND", message: "Result not found" } }, { status: 404 })
  }
  const result = session.result.alignment
  return Response.json({
    ok: true,
    calibrationId,
    score_0_to_10: result.score,
    summary: result.explanation,
    jobTitle: session.synthesis?.marketTitle ?? null,
    jobText: session.resume?.rawText ?? null,
  })
}
