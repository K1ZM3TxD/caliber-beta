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
  expectOk(res as any, label)
  return res as any
}

function answerForPrompt(n: number): string {
  return `Prompt ${n} answer with deterministic detail about structured ownership, cross functional execution, measurable outcomes, and stakeholder alignment.`
}

function advanceUntil(sessionId: string, target: string, maxSteps: number, label: string) {
  let last = null as any
  for (let i = 0; i < maxSteps; i += 1) {
    last = event({ type: "ADVANCE", sessionId }, `${label}_ADVANCE_${i + 1}`)
    if (last.session.state === target) return last
  }
  throw new Error(`${label}: failed to reach ${target} within ${maxSteps} steps; last=${last?.session?.state}`)
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

  // Resume -> Prompt 1
  advanceUntil(sessionId, "PROMPT_1", 3, "TO_PROMPT_1")

  // Prompt 1..5 submissions advance server-side per event (no extra ADVANCE between prompts)
  for (let i = 1; i <= 5; i += 1) {
    const res = event({ type: "SUBMIT_PROMPT_ANSWER", sessionId, answer: answerForPrompt(i) }, `SUBMIT_PROMPT_ANSWER_${i}`)
    if (i < 5) {
      expectState(res, `PROMPT_${i + 1}`, `Prompt ${i} submit -> next prompt`)
    } else {
      expectState(res, "CONSOLIDATION_PENDING", "Prompt 5 submit -> CONSOLIDATION_PENDING")
    }
  }

  // CONSOLIDATION_PENDING -> CONSOLIDATION_RITUAL (visible) -> PATTERN_SYNTHESIS (visible)
  const ritual = advanceUntil(sessionId, "CONSOLIDATION_RITUAL", 3, "TO_RITUAL")
  assert(typeof ritual.session.consolidationRitual?.progressPct === "number", "Ritual should include progressPct")

  const synth = advanceUntil(sessionId, "PATTERN_SYNTHESIS", 20, "TO_SYNTHESIS")
  assert(typeof synth.session.synthesis?.patternSummary === "string", "Synthesis must include patternSummary")
  assert(Array.isArray(synth.session.synthesis?.operateBest), "Synthesis must include operateBest list")
  assert(Array.isArray(synth.session.synthesis?.loseEnergy), "Synthesis must include loseEnergy list")

  // Continue through title states to keep loop parity
  advanceUntil(sessionId, "TITLE_HYPOTHESIS", 3, "TO_TITLE_HYPOTHESIS")
  const titleDialogue = advanceUntil(sessionId, "TITLE_DIALOGUE", 3, "TO_TITLE_DIALOGUE")

  const sawSynthesis = titleDialogue.session.history.some((h: any) => h.to === "PATTERN_SYNTHESIS")
  assert(sawSynthesis, "Expected transition history to include PATTERN_SYNTHESIS")

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

  console.log("PASS: calibration smoke transcript complete (includes consolidation ritual + synthesis)")
}

try {
  runCalibrationLoopSmoke()
} catch (e: unknown) {
  const msg = String((e as any)?.message ?? e)
  console.error(`SMOKE FAILED: ${msg}`)
  process.exitCode = 1
}