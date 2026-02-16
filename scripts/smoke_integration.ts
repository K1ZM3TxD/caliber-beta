// scripts/smoke_integration.ts

import { runIntegrationSeam } from "../lib/integration_seam"

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(`ASSERTION_FAILED: ${msg}`)
}

function main() {
  const failingJob = "Responsibilities include. You will. Clear role scope." // deterministic low-signal for multiple dims
  const experienceVector = [1, 1, 1, 1, 1, 1]

  const res = runIntegrationSeam({ jobText: failingJob, experienceVector })

  assert(res.ok === false, "expected hard-fail for failing input")
  assert(res.error.code === "BAD_REQUEST" || res.error.code === "INCOMPLETE_DIMENSION_COVERAGE", "expected BAD_REQUEST")
  assert(
    typeof res.error.message === "string" && res.error.message.includes("Insufficient signal in dimensions:"),
    "expected dimension-specific error message prefix"
  )

  const labels = [
    "Structural Maturity",
    "Authority Scope",
    "Revenue Orientation",
    "Role Ambiguity",
    "Breadth vs Depth",
    "Stakeholder Density",
  ]
  assert(labels.some((l) => res.error.message.includes(l)), "expected at least one locked dimension label in message")

  // eslint-disable-next-line no-console
  console.log("smoke_integration OK")
  // eslint-disable-next-line no-console
  console.log({ ok: res.ok, error: res.error })
}

main()