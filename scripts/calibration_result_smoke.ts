/* eslint-disable no-console */

import * as fs from "fs"
import * as path from "path"
import {
  generateCalibrationResultCopy,
  computeSignalStrength,
  classifyConfidenceBand,
  type CalibrationResultCopy,
  type ConfidenceBand,
} from "../lib/calibration_result_copy"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

// ─── Fixture loader ────────────────────────────────────────────────────────

interface FixtureProfile {
  resumeText: string
  promptAnswers: string[]
}

function loadFixture(name: string): FixtureProfile {
  const fp = path.join(__dirname, "..", "fixtures", "calibration_profiles", `${name}.json`)
  const raw = JSON.parse(fs.readFileSync(fp, "utf-8"))
  const resumeText: string = raw.resume_text ?? ""
  const promptAnswers: string[] = [
    raw.prompt_answers?.prompt_1 ?? "",
    raw.prompt_answers?.prompt_2 ?? "",
    raw.prompt_answers?.prompt_3 ?? "",
    raw.prompt_answers?.prompt_4 ?? "",
    raw.prompt_answers?.prompt_5 ?? "",
  ]
  return { resumeText, promptAnswers }
}

// ─── Thin-input synthetic control ──────────────────────────────────────────

const THIN_RESUME = "Software developer. 3 years."
const THIN_PROMPTS = ["I like coding.", "", "", "", ""]

// ─── Checks ────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function check(label: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${label}`)
  } catch (e: any) {
    failed++
    console.error(`  ✗ ${label}: ${e.message}`)
  }
}

function checkResult(name: string, result: CalibrationResultCopy, expectedBand: ConfidenceBand) {
  check(`${name} band is ${expectedBand}`, () => {
    assert(result.band === expectedBand, `expected ${expectedBand}, got ${result.band}`)
  })

  check(`${name} contextSentence is non-empty string`, () => {
    assert(typeof result.contextSentence === "string" && result.contextSentence.length > 10,
      `contextSentence too short: "${result.contextSentence}"`)
  })

  check(`${name} marketLabelSentence is non-empty string`, () => {
    assert(typeof result.marketLabelSentence === "string" && result.marketLabelSentence.length > 10,
      `marketLabelSentence too short: "${result.marketLabelSentence}"`)
  })

  if (expectedBand === "strong") {
    check(`${name} has market title`, () => {
      assert(result.marketTitle !== null && result.marketTitle.length > 0,
        `expected market title for strong band, got ${result.marketTitle}`)
    })
    check(`${name} market label intro present`, () => {
      assert(result.marketLabelSentence.includes("closest market label"),
        `expected intro sentence, got: ${result.marketLabelSentence}`)
    })
  }

  if (expectedBand === "weak") {
    check(`${name} has no market title`, () => {
      assert(result.marketTitle === null,
        `expected null market title for weak band, got "${result.marketTitle}"`)
    })
    check(`${name} market label prompts for more input`, () => {
      assert(result.marketLabelSentence.includes("more detail"),
        `expected prompt for more detail, got: ${result.marketLabelSentence}`)
    })
  }

  check(`${name} signalStrength in range [0, 100]`, () => {
    assert(result.signalStrength >= 0 && result.signalStrength <= 100,
      `signalStrength out of range: ${result.signalStrength}`)
  })
}

// ─── Run ───────────────────────────────────────────────────────────────────

console.log("\n── calibration_result_copy smoke test ──\n")

// Strong profiles
for (const name of ["chris", "jen", "fabio"]) {
  console.log(`\n${name.toUpperCase()}:`)
  const f = loadFixture(name)
  const result = generateCalibrationResultCopy(f.resumeText, f.promptAnswers)
  checkResult(name, result, "strong")
}

// Weak profile (dingus has title score ~2.3)
console.log(`\nDINGUS:`)
const dingus = loadFixture("dingus")
const dingusResult = generateCalibrationResultCopy(dingus.resumeText, dingus.promptAnswers)
checkResult("dingus", dingusResult, "weak")

// Thin-input synthetic control
console.log(`\nTHIN-INPUT:`)
const thinResult = generateCalibrationResultCopy(THIN_RESUME, THIN_PROMPTS)
checkResult("thin-input", thinResult, "weak")

// Cross-profile: strong profiles always differ from weak
console.log(`\nCROSS-PROFILE:`)
const chrisResult = generateCalibrationResultCopy(
  loadFixture("chris").resumeText, loadFixture("chris").promptAnswers)

check("strong context != weak context", () => {
  assert(chrisResult.contextSentence !== thinResult.contextSentence,
    "strong and weak context sentences should differ")
})

check("strong marketLabel != weak marketLabel", () => {
  assert(chrisResult.marketLabelSentence !== thinResult.marketLabelSentence,
    "strong and weak market label sentences should differ")
})

// Summary
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
