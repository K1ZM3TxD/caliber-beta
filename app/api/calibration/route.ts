// app/api/calibration/route.ts

import { dispatchCalibrationEvent } from "@/lib/calibration_machine"
import type { CalibrationEvent } from "@/lib/calibration_types"

function normalizeApiError(code: string, message: string) {
  return { ok: false as const, error: { code, message } }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const event = body?.event as CalibrationEvent | undefined
    if (!event || typeof event !== "object" || typeof (event as any).type !== "string") {
      return Response.json(normalizeApiError("BAD_REQUEST", "Missing or invalid event"), { status: 400 })
    }

    const res = dispatchCalibrationEvent(event)

    if (!res.ok) {
      return Response.json(normalizeApiError(res.error.code, res.error.message), { status: 400 })
    }

    // Server-authoritative: client renders this session snapshot.
    return Response.json({ ok: true, session: res.value }, { status: 200 })
  } catch {
    return Response.json(normalizeApiError("BAD_REQUEST", "Invalid JSON body"), { status: 400 })
  }
}