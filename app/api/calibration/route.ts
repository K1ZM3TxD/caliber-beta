// app/api/calibration/route.ts

import { dispatchCalibrationEvent } from "@/lib/calibration_machine"
import { storeGet, storeImport, storeGetAsync } from "@/lib/calibration_store"
import type { CalibrationEvent } from "@/lib/calibration_types"

function apiBad(code: string, message: string) {
  return { ok: false as const, error: { code, message } }
}

/** GET /api/calibration?sessionId=xxx — fetch full session snapshot for resume */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")
  if (!sessionId) {
    return Response.json(apiBad("MISSING_ID", "Missing sessionId"), { status: 400 })
  }
  let session = storeGet(sessionId)
  if (!session) {
    session = await storeGetAsync(sessionId)
  }
  if (!session) {
    return Response.json(apiBad("NOT_FOUND", "Session not found"), { status: 404 })
  }
  return Response.json({ ok: true, session }, { status: 200 })
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

    return Response.json({ ok: true, session: res.session }, { status: 200 })
  } catch {
    return Response.json(apiBad("BAD_REQUEST", "Invalid JSON body"), { status: 400 })
  }
}

/** PUT /api/calibration — restore a session from client-side backup */
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const blob = body?.session
    if (!blob || typeof blob !== "object") {
      return Response.json(apiBad("BAD_REQUEST", "Missing session object"), { status: 400 })
    }
    const ok = storeImport(blob)
    if (!ok) {
      return Response.json(apiBad("BAD_REQUEST", "Invalid session shape"), { status: 400 })
    }
    return Response.json({ ok: true, sessionId: blob.sessionId }, { status: 200 })
  } catch {
    return Response.json(apiBad("BAD_REQUEST", "Invalid JSON body"), { status: 400 })
  }
}