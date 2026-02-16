// scripts/smoke_integration.ts

import { runIntegrationSeam } from "@/lib/integration_seam"
import { toResultContract } from "@/lib/result_contract"

function logJson(label: string, obj: unknown) {
  // eslint-disable-next-line no-console
  console.log(label)
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(obj, null, 2))
  // eslint-disable-next-line no-console
  console.log("")
}

async function main() {
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

  if (seamOk.ok) {
    const contract = toResultContract(seamOk.result)
    logJson("SMOKE: happy path (contract)", {
      ok: true,
      keys: Object.keys(contract),
      hasAlignment: !!contract.alignment,
      hasSkillMatch: !!contract.skillMatch,
      hasStretchLoad: !!contract.stretchLoad,
      hasMeta: !!contract.meta,
    })
  } else {
    logJson("SMOKE: happy path unexpectedly failed", seamOk)
  }

  const seamBad = runIntegrationSeam({
    jobText: "",
    experienceVector: [1, 1, 1, 1, 1, 1],
  })

  logJson("SMOKE: bad input (seam normalized)", seamBad)
}

main().catch((e) => {
  logJson("SMOKE: runner crashed (should not happen)", {
    ok: false,
    error: { code: "INTERNAL", message: String((e as any)?.message ?? e) },
  })
  process.exitCode = 1
})