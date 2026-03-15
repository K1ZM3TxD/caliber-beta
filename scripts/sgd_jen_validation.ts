/**
 * SGD Jen Validation: YES vs NO side-by-side comparison
 * Usage: npx tsx scripts/sgd_jen_validation.ts
 */

import { dispatchCalibrationEvent } from "../lib/calibration_machine"
import * as fs from "fs"

const jen = JSON.parse(fs.readFileSync("fixtures/calibration_profiles/jen.json", "utf-8"))

async function runCalibration(includeSignals: boolean) {
  // 1. Create session
  let res = await dispatchCalibrationEvent({ type: "CREATE_SESSION" } as any)
  if (!res.ok) throw new Error(`CREATE_SESSION failed: ${JSON.stringify(res)}`)
  const sessionId = res.session.sessionId

  // 2. Submit resume
  res = await dispatchCalibrationEvent({ type: "SUBMIT_RESUME", sessionId, resumeText: jen.resume_text } as any)
  if (!res.ok) throw new Error(`SUBMIT_RESUME failed: ${JSON.stringify(res)}`)

  // 3. Advance past RESUME_INGEST
  res = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId } as any)
  if (!res.ok) throw new Error(`ADVANCE from RESUME failed: ${JSON.stringify(res)}`)

  // 4. Submit prompts 1-5 — each SUBMIT_PROMPT_ANSWER auto-advances.
  // Some may trigger clarifier states; handle those.
  const prompts = jen.prompt_answers
  for (let i = 1; i <= 5; i++) {
    const key = `prompt_${i}`
    res = await dispatchCalibrationEvent({
      type: "SUBMIT_PROMPT_ANSWER",
      sessionId,
      answer: prompts[key],
    } as any)
    if (!res.ok) throw new Error(`SUBMIT_PROMPT_ANSWER ${i} failed (state=${res.session?.state ?? "?"}): ${JSON.stringify(res)}`)

    // If we landed in a clarifier state, submit clarifier answer
    if (res.session.state?.includes("CLARIFIER")) {
      res = await dispatchCalibrationEvent({
        type: "SUBMIT_PROMPT_CLARIFIER_ANSWER",
        sessionId,
        answer: prompts[key] + " — expanded with measurable outcomes and concrete scope.",
      } as any)
      if (!res.ok) throw new Error(`SUBMIT_PROMPT_CLARIFIER ${i} failed: ${JSON.stringify(res)}`)
    }
  }

  // 5. Advance through remaining states
  let maxAdv = 30
  while (maxAdv-- > 0 && res.session.state !== "TERMINAL_COMPLETE") {
    const state = res.session.state

    // Check if we have detected signals and need to make a choice
    if (
      res.session.detectedSignals?.length > 0 &&
      res.session.includeDetectedSignals == null
    ) {
      console.log(`  [${includeSignals ? "YES" : "NO"}] Detected signals: ${res.session.detectedSignals.join(", ")}`)
      res = await dispatchCalibrationEvent({
        type: "SET_SIGNAL_PREFERENCE",
        sessionId,
        includeDetectedSignals: includeSignals,
      } as any)
      if (!res.ok) throw new Error(`SET_SIGNAL_PREFERENCE failed: ${JSON.stringify(res)}`)
      continue
    }

    const prev = res.session.state
    const lastGoodSession = res.session
    res = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId } as any)
    if (!res.ok) {
      console.log(`  [${includeSignals ? "YES" : "NO"}] ADVANCE blocked at ${prev}: ${(res as any)?.error?.message ?? "unknown"}`)
      return lastGoodSession
    }
  }

  return res.session
}

async function main() {
  console.log("=== Jen SGD Validation ===\n")

  console.log("--- Running with includeDetectedSignals = NO ---")
  const noSession = await runCalibration(false)

  console.log("\n--- Running with includeDetectedSignals = YES ---")
  const yesSession = await runCalibration(true)

  console.log("\n=== COMPARISON ===\n")

  const noTitle = noSession.synthesis?.marketTitle ?? "(none)"
  const yesTitle = yesSession.synthesis?.marketTitle ?? "(none)"

  const noRec = noSession.synthesis?.titleRecommendation
  const yesRec = yesSession.synthesis?.titleRecommendation

  const noBullets = noRec?.titles?.[0]?.bullets_3 ?? []
  const yesBullets = yesRec?.titles?.[0]?.bullets_3 ?? []

  const noSummary = noRec?.titles?.[0]?.summary_2s ?? ""
  const yesSummary = yesRec?.titles?.[0]?.summary_2s ?? ""

  console.log("Detected Signals:", noSession.detectedSignals ?? [])
  console.log()
  console.log("NO  - includeDetectedSignals:", noSession.includeDetectedSignals)
  console.log("NO  - Market Title:", noTitle)
  console.log("NO  - Why this fits bullets:", noBullets)
  console.log("NO  - Summary:", noSummary)
  console.log()
  console.log("YES - includeDetectedSignals:", yesSession.includeDetectedSignals)
  console.log("YES - Market Title:", yesTitle)
  console.log("YES - Why this fits bullets:", yesBullets)
  console.log("YES - Summary:", yesSummary)
  console.log()
  console.log("Title Changed?", noTitle !== yesTitle ? `YES (${noTitle} → ${yesTitle})` : "NO (same title)")
  console.log("Bullets Changed?", JSON.stringify(noBullets) !== JSON.stringify(yesBullets) ? "YES" : "NO")
  console.log("Summary Changed?", noSummary !== yesSummary ? "YES" : "NO")

  // Show top 3 candidates for both
  const noCands = (noSession.synthesis?.titleCandidates ?? []).slice(0, 5)
  const yesCands = (yesSession.synthesis?.titleCandidates ?? []).slice(0, 5)
  console.log("\nNO  - Top 5 candidates:", noCands.map((c: any) => `${c.title}(${c.score})`))
  console.log("YES - Top 5 candidates:", yesCands.map((c: any) => `${c.title}(${c.score})`))
}

main().catch(console.error)
