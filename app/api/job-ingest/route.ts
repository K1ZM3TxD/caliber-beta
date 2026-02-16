// app/api/job-ingest/route.ts

import { runIntegrationSeam } from "@/lib/integration_seam"
import { toResultContract } from "@/lib/result_contract"

type ApiError = { code: "BAD_REQUEST" | "INTERNAL"; message: string }

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST(req: Request) {
  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } satisfies ApiError },
        400
      )
    }

    const seam = runIntegrationSeam({
      jobText: body?.jobText,
      experienceVector: body?.experienceVector,
    })

    if (!seam.ok) {
      // Seam already normalizes error codes/messages.
      // Public API surface for errors is intentionally simpler here per requirements.
      return json(
        { ok: false, error: { code: "BAD_REQUEST", message: seam.error.message } satisfies ApiError },
        400
      )
    }

    // Contract mapping lives in /lib; route remains thin.
    let contract
    try {
      contract = toResultContract(seam.result)
    } catch {
      return json(
        { ok: false, error: { code: "INTERNAL", message: "Unexpected internal error" } satisfies ApiError },
        500
      )
    }

    return json({ ok: true, result: contract }, 200)
  } catch {
    // Absolute last-resort guardrail: never allow HTML 500.
    return json(
      { ok: false, error: { code: "INTERNAL", message: "Unexpected internal error" } satisfies ApiError },
      500
    )
  }
}