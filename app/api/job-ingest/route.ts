// app/api/job-ingest/route.ts

import { runIntegrationSeam } from "@/lib/integration_seam"

function normalizeApiError(code: string, message: string) {
  return { ok: false as const, error: { code, message } }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const jobText = body?.job
    const experienceVector = body?.experienceVector

    // Viewer upgrade sends only { job }, so provide deterministic default vector if omitted.
    // This does NOT change ingest thresholds or encoding logic; it only satisfies seam input shape.
    const vec =
      Array.isArray(experienceVector) && experienceVector.length === 6 ? experienceVector : [1, 1, 1, 1, 1, 1]

    const seam = runIntegrationSeam({ jobText, experienceVector: vec })

    if (!seam.ok) {
      return Response.json(normalizeApiError("BAD_REQUEST", seam.error.message), { status: 400 })
    }

    // Contract v1 frozen; return result only.
    return Response.json({ ok: true, result: seam.result }, { status: 200 })
  } catch (e: any) {
    return Response.json(normalizeApiError("BAD_REQUEST", "Invalid JSON body"), { status: 400 })
  }
}