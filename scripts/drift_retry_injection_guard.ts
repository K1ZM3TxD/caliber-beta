// scripts/drift_retry_injection_guard.ts
// Acceptance guard: drift detection + retry-injection pathway.
// Run: tsx scripts/drift_retry_injection_guard.ts
/* eslint-disable no-console */

import { detectDriftFlags, buildRetryExtraLinesFromFlags, formatSynthesisLogLine } from "../lib/semantic_synthesis"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Inputs: no anchors (excludes "visionary"), synthesis text contains "visionary"
// ---------------------------------------------------------------------------
const anchorTerms: string[] = []
const synthesisText = "You are a visionary who maps scope and clarifies constraints."

// Step 1: compute drift flags using the real production function
const firstFlags = detectDriftFlags(synthesisText, anchorTerms)

assert(firstFlags.abstraction_flag === true, `abstraction_flag must be true; got ${firstFlags.abstraction_flag}`)
assert(firstFlags.drift_terms.includes("visionary"), `drift_terms must include "visionary"; got ${JSON.stringify(firstFlags.drift_terms)}`)

// Step 2: build retry drift lines using the real production helper
const retryDriftLines = buildRetryExtraLinesFromFlags(firstFlags)

assert(
  retryDriftLines.includes("REMOVE DRIFT TERMS: visionary"),
  `retryDriftLines must include exactly "REMOVE DRIFT TERMS: visionary"; got ${JSON.stringify(retryDriftLines)}`,
)

// Optional: log line in the format used by the production validator
const logLine = `abstraction_flag=${firstFlags.abstraction_flag} drift_terms=${JSON.stringify(firstFlags.drift_terms)}`
assert(logLine.includes("abstraction_flag=true"), `log line must contain "abstraction_flag=true"; got: ${logLine}`)

const removeDriftLine = retryDriftLines.find((l) => l.startsWith("REMOVE DRIFT TERMS"))!
console.log(`PASS drift_retry_injection_guard: abstraction_flag=true drift_terms=${JSON.stringify(firstFlags.drift_terms)}`)
console.log(`PASS retry line: "${removeDriftLine}"`)
console.log(`PASS log: ${logLine}`)

// Step 3: verify formatSynthesisLogLine with abstraction_flag=true
const formattedLogLine = formatSynthesisLogLine({
  synthesis_source: "llm",
  anchor_overlap_score: 0,
  missing_anchor_count: 0,
  praise_flag: false,
  abstraction_flag: firstFlags.abstraction_flag,
})
assert(formattedLogLine.includes("abstraction_flag=true"), `formatted log line must contain "abstraction_flag=true"; got: ${formattedLogLine}`)
assert(formattedLogLine.startsWith("synthesis_source=llm anchor_overlap_score=0.00 missing_anchor_count=0 praise_flag=false abstraction_flag=true"), `formatted log line must match expected format; got: ${formattedLogLine}`)
console.log(`PASS formatSynthesisLogLine: "${formattedLogLine}"`)
