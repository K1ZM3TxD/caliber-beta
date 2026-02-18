// app/api/calibration/event/route.ts

import { dispatchCalibrationEvent } from "@/lib/calibration_machine"
import type { CalibrationEvent } from "@/lib/calibration_types"

function apiBad(code: string, message: string) {
  return { ok: false as const, error: { code, message } }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const event = body?.event as CalibrationEvent | undefined

    if (!event || typeof event !== "object" || typeof (event as any).type !== "string") {
      return Response.json(apiBad("BAD_REQUEST", "Missing or invalid event"), { status: 400 })
    }

    const res = await dispatchCalibrationEvent(event)

    if (!res.ok) {
      return Response.json(apiBad(res.error.code, res.error.message), { status: 400 })
    }

    // Always return the full session snapshot (server-authoritative).
    return Response.json({ ok: true, session: res.session }, { status: 200 })
  } catch {
    return Response.json(apiBad("BAD_REQUEST", "Invalid JSON body"), { status: 400 })
  }
}