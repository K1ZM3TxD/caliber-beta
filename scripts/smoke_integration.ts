// scripts/smoke_integration.ts

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */

const path = require("path")

// Register @/* alias explicitly (do NOT depend on tsconfig baseUrl/paths)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tsconfigPaths = require("tsconfig-paths")
  tsconfigPaths.register({
    baseUrl: path.resolve(__dirname, ".."),
    paths: {
      "@/*": ["*"],
    },
  })
} catch (e) {
  // If tsconfig-paths isn't installed, fail loudly and early
  throw new Error(
    `tsconfig-paths is required to run this smoke script. Install it with: npm i -D tsconfig-paths. Original error: ${String(
      (e as any)?.message ?? e,
    )}`,
  )
}

const { runIntegrationSeam } = require("../lib/integration_seam")
const { toResultContract } = require("../lib/result_contract")

const VALID_DIMENSION_LABELS = [
  "Structural Maturity",
  "Authority Scope",
  "Revenue Orientation",
  "Role Ambiguity",
  "Breadth vs Depth",
  "Stakeholder Density",
] as const

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertStartsWith(actual: string, prefix: string, context: string) {
  assert(
    actual.startsWith(prefix),
    `${context}: expected error.message to start with "${prefix}", got: "${actual}"`,
  )
}

function assertIncludesAnyDimensionLabel(message: string, context: string) {
  const hit = VALID_DIMENSION_LABELS.some((label) => message.includes(label))
  assert(
    hit,
    `${context}: expected error.message to include at least one known dimension label (${VALID_DIMENSION_LABELS.join(
      ", ",
    )}), got: "${message}"`,
  )
}

function assertHardFail(label: string, jobText: string) {
  const res = runIntegrationSeam({
    jobText,
    experienceVector: [1, 1, 1, 1, 1, 1],
  })

  assert(res && typeof res === "object", `${label}: expected object response`)
  assert((res as any).ok === false, `${label}: expected ok === false`)

  const err = (res as any).error
  assert(err && typeof err === "object", `${label}: expected error object`)
  assert(err.code === "BAD_REQUEST", `${label}: expected error.code === "BAD_REQUEST"`)
  assert(typeof err.message === "string", `${label}: expected error.message to be string`)

  const msg: string = err.message
  const prefix = "Insufficient signal in dimensions:"
  assertStartsWith(msg, prefix, label)
  assertIncludesAnyDimensionLabel(msg, label)
}

async function main() {
  // 1) Existing happy-path test (unchanged)
  const sampleJobText = `
Director of Revenue Operations (RevOps) — Enterprise, Global Organization

You will lead and own strategy and operationalize repeatable playbooks across multiple departments
(org-wide). This role partners cross-functional stakeholders in Sales, Marketing, and Finance,
including executive stakeholders (C-suite) and the board of directors, plus customers and partners.

Responsibilities include revenue and ARR reporting, quota-carrying support motions, pipeline hygiene,
pricing and monetization collaboration, and growth stage scaling.

This is a generalist, multi-disciplinary role: you will wear many hats and work across many areas,
often in unstructured and undefined situations — other duties as assigned.

Governance, compliance, audit readiness (SOC 2 / ISO 27001), risk management, and controls
experience is required.
`.trim()

  const seamOk = runIntegrationSeam({
    jobText: sampleJobText,
    experienceVector: [1, 1, 1, 1, 1, 1],
  })

  assert(seamOk.ok === true, "Happy path: expected ok === true")
  const contract = toResultContract(seamOk.result)
  assert(!!contract.alignment, "Happy path: expected contract.alignment")
  assert(!!contract.skillMatch, "Happy path: expected contract.skillMatch")
  assert(!!contract.stretchLoad, "Happy path: expected contract.stretchLoad")
  assert(!!contract.meta, "Happy path: expected contract.meta")
  console.log("PASS: Happy path")

  // 2) Fixture A — Sparse Marketing Posting (>= 40 chars)
  const fixtureA = `
Marketing Coordinator (Part-Time)

Help support our brand presence and assist with day-to-day marketing tasks.
You will contribute to content updates, social posts, and general campaign support.
Other duties as assigned.
`.trim()

  assertHardFail("Hard-fail fixture A", fixtureA)
  console.log("PASS: Hard-fail fixture A")

  // 3) Fixture B — Narrow Technical Posting (strong in 1–2 dimensions, weak in others)
  const fixtureB = `
Senior Backend Engineer (Kubernetes / Go)

Build a Kubernetes operator in Go. Implement CRDs, controllers, reconciliation loops,
and performance profiling. Maintain CI pipelines and write integration tests.
This is an individual contributor role focused on deep systems implementation.
`.trim()

  assertHardFail("Hard-fail fixture B", fixtureB)
  console.log("PASS: Hard-fail fixture B")
}

main().catch((e) => {
  const msg = String((e as any)?.message ?? e)
  console.error(`SMOKE FAILED: ${msg}`)
  process.exitCode = 1
})