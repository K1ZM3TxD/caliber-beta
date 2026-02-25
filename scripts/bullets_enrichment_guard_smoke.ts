// scripts/bullets_enrichment_guard_smoke.ts

import { dispatchCalibrationEvent } from "@/lib/calibration_machine"
import process from "node:process"

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function mockFetchOnce(jsonObj: any) {
  ;(globalThis as any).fetch = async () => {
    return {
      ok: true,
      status: 200,
      async text() {
        return ""
      },
      async json() {
        return { choices: [{ message: { content: JSON.stringify(jsonObj) } }] }
      },
    } as any
  }
}

async function runFlowToSynthesis() {
  const created = await dispatchCalibrationEvent({ type: "CREATE_SESSION" } as any)
  if (!created.ok) throw new Error("CREATE_SESSION failed")
  const sessionId = created.session.sessionId

  const resumeText =
    "Worked across scope and constraints; mapped ownership and routing; documented handoffs; fixed measurement drift; kept scope bounded across cycles."
  const r1 = await dispatchCalibrationEvent({ type: "SUBMIT_RESUME", sessionId, resumeText } as any)
  if (!r1.ok) throw new Error("SUBMIT_RESUME failed")

  const a1 = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId } as any)
  if (!a1.ok) throw new Error("ADVANCE to PROMPT_1 failed")

  const answers = [
    "I did the routing and decision boundary work, clarified constraints, and kept handoffs explicit across stakeholders.",
    "Ambiguous ownership and shifting priorities drain me fast, especially when decisions have no owner and the scope resets each week.",
    "People come to me to map dependencies, clarify who owns what, and make the handoff path explicit when the routing is unclear.",
    "Hard problems with constraints and real tradeoffs feel exciting when I can reduce scope and make decisions and measures explicit.",
    "I’m best at mapping messy work into clear constraints, ownership, routing, and handoffs so the cycle becomes repeatable.",
  ]

  let s = a1.session
  for (let i = 0; i < 5; i += 1) {
    const res = await dispatchCalibrationEvent({ type: "SUBMIT_PROMPT_ANSWER", sessionId, answer: answers[i] } as any)
    if (!res.ok) throw new Error(`SUBMIT_PROMPT_ANSWER ${i + 1} failed`)
    s = res.session
  }

  // Consolidation pending -> ritual
  const c1 = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId } as any)
  if (!c1.ok) throw new Error("ADVANCE to CONSOLIDATION_RITUAL failed")
  s = c1.session

  // Tick ritual until complete (needs >=450ms between ticks)
  while (s.state === "CONSOLIDATION_RITUAL") {
    await sleep(500)
    const tick = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId } as any)
    if (!tick.ok) throw new Error("ADVANCE tick failed")
    s = tick.session
    if (s.state === "ENCODING_RITUAL") break
  }

  const enc = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId } as any)
  if (!enc.ok) throw new Error("ADVANCE encoding->synthesis failed")
  s = enc.session
  if (s.state !== "PATTERN_SYNTHESIS") throw new Error("Did not reach PATTERN_SYNTHESIS")
  return s
}

async function testHappyPathUsesLLMBullets() {
  process.env.OPENAI_API_KEY = "test"
  mockFetchOnce({
    identityContrast: "You don’t just map work — you set boundaries.",
    interventionContrast: "When something isn’t working, you don’t push through — you tighten constraints.",
    constructionLayer: "You map, define, and decide.",
    consequenceDrop: "You change the handoff path.",
    operate_best_bullets: ["Explicit ownership and decision routing.", "Stable constraints across the cycle."],
    lose_energy_bullets: ["Decisions without an owner.", "Scope resets without constraints."],
  })

  const s = await runFlowToSynthesis()
  if (!Array.isArray(s.synthesis?.operateBest)) throw new Error("Missing operateBest")
  if (!s.synthesis.operateBest.includes("Explicit ownership and decision routing.")) throw new Error("LLM bullets not used for operateBest")
  if (!Array.isArray(s.synthesis?.loseEnergy)) throw new Error("Missing loseEnergy")
  if (!s.synthesis.loseEnergy.includes("Decisions without an owner.")) throw new Error("LLM bullets not used for loseEnergy")
}

async function testValidationRejectsPraiseAndFallsBack() {
  process.env.OPENAI_API_KEY = "test"
  mockFetchOnce({
    identityContrast: "You don’t just map work — you set boundaries.",
    interventionContrast: "When something isn’t working, you don’t push through — you tighten constraints.",
    constructionLayer: "You map, define, and decide.",
    operate_best_bullets: ["You are great at leadership."], // should fail
    lose_energy_bullets: ["Scope resets without constraints."],
  })

  const s = await runFlowToSynthesis()
  const joined = (s.synthesis?.operateBest ?? []).join(" ")
  if (/great/i.test(joined)) throw new Error("Praise bullet survived validation (should have fallen back)")
}

async function testRepetitionAcrossSynthesisAndBulletsRejected() {
  process.env.OPENAI_API_KEY = "test"
  mockFetchOnce({
    identityContrast: "You don’t just map work — you set ownership.",
    interventionContrast: "When something isn’t working, you don’t push through — you tighten constraints.",
    constructionLayer: "You map, define, and decide.",
    operate_best_bullets: ["Clear ownership boundaries."], // repeats ownership (>=5 chars) -> reject
    lose_energy_bullets: ["Scope resets without constraints."],
  })

  const s = await runFlowToSynthesis()
  const joined = (s.synthesis?.operateBest ?? []).join(" ")
  if (/Clear ownership boundaries\./.test(joined)) throw new Error("Repetition bullet survived validation (should have fallen back)")
}

async function main() {
  await testHappyPathUsesLLMBullets()
  await testValidationRejectsPraiseAndFallsBack()
  await testRepetitionAcrossSynthesisAndBulletsRejected()
  console.log("OK: bullet enrichment guards passing.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})