// scripts/smoke_integration.ts

/* eslint-disable no-console */

import { dispatchCalibrationEvent } from "../lib/calibration_machine"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function expectOk<T extends { ok: boolean }>(res: T, label: string): asserts res is T & { ok: true } {
  assert(res.ok === true, `${label}: expected ok=true, got ${JSON.stringify(res)}`)
}

function expectState(res: { ok: true; session: any }, state: string, label: string): void {
  assert(res.session.state === state, `${label}: expected state=${state}, got ${res.session.state}`)
}

function event(e: any, label: string) {
  const res = dispatchCalibrationEvent(e as any)
  expectOk(res, label)
  return res
}

function answerForPrompt(n: number): string {
  return `Prompt ${n} answer with deterministic detail about structured ownership, cross functional execution, measurable outcomes, and stakeholder alignment.`
}

function runCalibrationLoopSmoke(): void {
  const created = event({ type: "CREATE_SESSION" }, "CREATE_SESSION")
  const sessionId = created.session.sessionId

  event(
    {
      type: "SUBMIT_RESUME",
      sessionId,
      resumeText:
        "Senior operator leading cross functional programs, shaping process and delivery, partnering with leaders, and owning repeatable execution across multiple teams from planning through outcomes.",
    },
    "SUBMIT_RESUME",
  )

  event({ type: "ADVANCE", sessionId }, "ADVANCE to PROMPT_1")

  let finalAdvance: { ok: true; session: any } | null = null
  for (let i = 1; i <= 5; i += 1) {
    event({ type: "SUBMIT_PROMPT_ANSWER", sessionId, answer: answerForPrompt(i) }, `SUBMIT_PROMPT_ANSWER_${i}`)
    finalAdvance = event({ type: "ADVANCE", sessionId }, `ADVANCE_${i}`)
  }

  assert(finalAdvance !== null, "Expected final advance to be captured")
  expectState(finalAdvance, "JOB_INGEST", "Post-prompt progression should land in JOB_INGEST")
  const sawTitleDialogue = finalAdvance.session.history.some((h: any) => h.to === "TITLE_DIALOGUE")
  assert(sawTitleDialogue, "Step 1 should reach TITLE_DIALOGUE in transition history")

  const step2 = event(
    {
      type: "SUBMIT_JOB_TEXT",
      sessionId,
      jobText:
        `Director of Revenue Operations (RevOps) — Enterprise, Global Organization

You will lead and own strategy and operationalize repeatable playbooks across multiple departments (org-wide). This role partners cross-functional stakeholders in Sales, Marketing, and Finance, including executive stakeholders (C-suite) and the board of directors, plus customers and partners.

Responsibilities include revenue and ARR reporting, quota-carrying support motions, pipeline hygiene, pricing and monetization collaboration, and growth stage scaling.

This is a generalist, multi-disciplinary role: you will wear many hats and work across many areas, often in unstructured and undefined situations — other duties as assigned.

Governance, compliance, audit readiness (SOC 2 / ISO 27001), risk management, and controls experience is required.`,
    },
    "SUBMIT_JOB_TEXT valid #1",
  )
  expectState(step2, "JOB_INGEST", "Step 2 SUBMIT_JOB_TEXT -> JOB_INGEST")
  assert(step2.session.result === null, "Step 2: result should be cleared on valid new job")

  const step3 = event({ type: "ADVANCE", sessionId }, "ADVANCE after first job")
  expectState(step3, "ALIGNMENT_OUTPUT", "Step 3 ADVANCE -> ALIGNMENT_OUTPUT")

  const step4 = event({ type: "COMPUTE_ALIGNMENT_OUTPUT", sessionId }, "COMPUTE_ALIGNMENT_OUTPUT #1")
  expectState(step4, "TERMINAL_COMPLETE", "Step 4 compute -> TERMINAL_COMPLETE")
  const resultKeys1 = Object.keys(step4.session.result ?? {}).sort()
  assert(
    JSON.stringify(resultKeys1) === JSON.stringify(["alignment", "meta", "skillMatch", "stretchLoad"]),
    `Step 4: expected v1 top-level keys only, got ${resultKeys1.join(",")}`,
  )

  const step5 = event(
    {
      type: "SUBMIT_JOB_TEXT",
      sessionId,
      jobText:
        `Senior Backend Engineer (Kubernetes / Go)

You will lead platform strategy and own architecture while collaborating cross-functional with security, product, and SRE. Responsibilities include revenue pipeline reliability for enterprise customers, governance controls, SOC 2 compliance, and executive reporting.

This is a generalist role across multiple departments in unstructured situations with other duties as assigned, while still requiring deep technical expertise in controllers and reconciliation loops.`,
    },
    "SUBMIT_JOB_TEXT valid #2",
  )
  expectState(step5, "JOB_INGEST", "Step 5 resubmit job -> JOB_INGEST")
  assert(step5.session.result === null, "Step 5: result should be cleared after second valid job")

  const step6 = event({ type: "ADVANCE", sessionId }, "ADVANCE after second job")
  expectState(step6, "ALIGNMENT_OUTPUT", "Step 6 ADVANCE -> ALIGNMENT_OUTPUT")

  const step7 = event({ type: "COMPUTE_ALIGNMENT_OUTPUT", sessionId }, "COMPUTE_ALIGNMENT_OUTPUT #2")
  expectState(step7, "TERMINAL_COMPLETE", "Step 7 compute -> TERMINAL_COMPLETE")
  const resultKeys2 = Object.keys(step7.session.result ?? {}).sort()
  assert(
    JSON.stringify(resultKeys2) === JSON.stringify(["alignment", "meta", "skillMatch", "stretchLoad"]),
    `Step 7: expected v1 top-level keys only, got ${resultKeys2.join(",")}`,
  )

  console.log("PASS: calibration JOB_INGEST loop smoke transcript complete")
}

try {
  runCalibrationLoopSmoke()
} catch (e: unknown) {
  const msg = String((e as any)?.message ?? e)
  console.error(`SMOKE FAILED: ${msg}`)
  process.exitCode = 1
}
