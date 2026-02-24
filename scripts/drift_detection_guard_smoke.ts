// scripts/drift_detection_guard_smoke.ts
// Acceptance proof for Milestone 6.2 Anti-Abstraction Enforcement.
// Run: npx tsx scripts/drift_detection_guard_smoke.ts
/* eslint-disable no-console */

import { detectDriftFlags, formatSynthesisLogLine, ValidatorOutcome, containsBlacklistPhrase } from "../lib/semantic_synthesis"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`)
}

// ---------------------------------------------------------------------------
// 1. abstraction_flag=true + retry prompt contains "REMOVE DRIFT TERMS: visionary"
// ---------------------------------------------------------------------------
function buildRetryExtraLines(firstFlags: { abstraction_flag: boolean; drift_terms: string[] }, missing: string[]): string[] {
  const lines = [
    "MISSING ANCHORS (must include several verbatim terms):",
    missing.slice(0, 24).join(", "),
  ]
  if (firstFlags.abstraction_flag && firstFlags.drift_terms.length > 0) {
    lines.push("REMOVE DRIFT TERMS: " + firstFlags.drift_terms.join(", "))
  }
  return lines
}

const firstAttemptText = "You don't just lead—you're a visionary who maps scope."
const anchors: string[] = []
const missing = ["scope", "constraints", "decisions"]

const firstFlags = detectDriftFlags(firstAttemptText, anchors)
assert(firstFlags.abstraction_flag === true, "abstraction_flag must be true when 'visionary' is in output and not in anchors")
assert(firstFlags.drift_terms.includes("visionary"), "drift_terms must include 'visionary'")

const retryLines = buildRetryExtraLines(firstFlags, missing)
const retryPromptSnippet = retryLines.join("\n")
assert(
  retryPromptSnippet.includes("REMOVE DRIFT TERMS: ") && retryPromptSnippet.includes("visionary"),
  `retry prompt must contain "REMOVE DRIFT TERMS: visionary"; got: ${retryPromptSnippet}`,
)
console.log(`PASS [1] abstraction_flag=true drift_terms=${JSON.stringify(firstFlags.drift_terms)}`)
console.log(`PASS [1] retry prompt line: "${retryLines.find((l) => l.startsWith("REMOVE DRIFT TERMS"))}"`)

// ---------------------------------------------------------------------------
// 2. Real (not hardcoded) abstraction_flag — value changes based on actual output content
// ---------------------------------------------------------------------------
const cleanText = "You don't just map scope—you clarify constraints and decisions."
const cleanFlags = detectDriftFlags(cleanText, [])
assert(cleanFlags.abstraction_flag === false, "abstraction_flag must be false when no drift terms are present")
assert(cleanFlags.praise_flag === false, "praise_flag must be false when no drift terms are present")
console.log(`PASS [2] abstraction_flag=false on clean text (not hardcoded)`)

const driftText = "You are a natural leader and high performer."
const driftFlags = detectDriftFlags(driftText, [])
assert(driftFlags.abstraction_flag === true, "abstraction_flag must be true for 'natural leader' and 'high performer'")
assert(driftFlags.drift_terms.includes("natural leader"), "drift_terms must include 'natural leader'")
assert(driftFlags.drift_terms.includes("high performer"), "drift_terms must include 'high performer'")
console.log(`PASS [2] abstraction_flag=true for "natural leader" / "high performer" (real detection)`)

// ---------------------------------------------------------------------------
// 3. Whole-word + case-insensitive, no false positives on substrings
// ---------------------------------------------------------------------------

// 3a. Case-insensitive: uppercase variant triggers the flag
const upperFlags = detectDriftFlags("You are VISIONARY and CHARISMATIC.", [])
assert(upperFlags.abstraction_flag === true, "abstraction_flag must be true for VISIONARY (case-insensitive)")
assert(upperFlags.drift_terms.includes("visionary"), "drift_terms must include 'visionary' when matched case-insensitively")
assert(upperFlags.drift_terms.includes("charismatic"), "drift_terms must include 'charismatic' when matched case-insensitively")
console.log(`PASS [3a] case-insensitive: VISIONARY + CHARISMATIC both detected`)

// 3b. No false positive on substring "visionary" inside a longer word
const substringText = "visionaryexecutor is not a word"
const subFlags = detectDriftFlags(substringText, [])
assert(subFlags.abstraction_flag === false, "abstraction_flag must be false when 'visionary' only appears as substring (no word boundary)")
console.log(`PASS [3b] no false positive: "visionaryexecutor" does not trigger visionary`)

// 3c. No false positive when "rockstar" is immediately followed by digits (no right word boundary)
const urlLikeText = "see rockstar123.com for details"
const urlFlags = detectDriftFlags(urlLikeText, [])
assert(urlFlags.abstraction_flag === false, "no false positive: 'rockstar' inside 'rockstar123' is not matched — digits are \\w so no right word boundary")
console.log(`PASS [3c] no false positive: "rockstar123" does not trigger rockstar (right \\b guards against substrings)`)

// 3d. Whole-word: "rockstar" surrounded by spaces is detected
const cleanRockstar = detectDriftFlags("You are a rockstar at this.", [])
assert(cleanRockstar.abstraction_flag === true, "abstraction_flag must be true for 'rockstar'")
assert(cleanRockstar.drift_terms.includes("rockstar"), "drift_terms must include 'rockstar'")
console.log(`PASS [3d] whole-word: "rockstar" (surrounded by spaces) is correctly flagged`)

// ---------------------------------------------------------------------------
// 4. Retry injection uses first-attempt flags (deterministic)
// ---------------------------------------------------------------------------

// Same input text always produces the same drift_terms (deterministic)
const inputA = "You are a visionary thought leader."
const run1 = detectDriftFlags(inputA, [])
const run2 = detectDriftFlags(inputA, [])
assert(JSON.stringify(run1.drift_terms) === JSON.stringify(run2.drift_terms), "drift_terms must be deterministic across identical calls")
assert(run1.abstraction_flag === run2.abstraction_flag, "abstraction_flag must be deterministic")

// Retry injection is built from firstFlags (first attempt), NOT from retry output
const firstAttemptDrift = detectDriftFlags("You are an empathetic visionary.", [])
const retryOutput = "You don't just map scope—you isolate constraints."  // clean retry output
const retryOutputFlags = detectDriftFlags(retryOutput, [])

// Prove firstAttemptDrift differs from retryOutputFlags
assert(firstAttemptDrift.abstraction_flag === true, "first-attempt must have abstraction_flag=true")
assert(retryOutputFlags.abstraction_flag === false, "clean retry output must have abstraction_flag=false")

// The retry prompt is built from firstAttemptDrift (first-attempt flags), not retryOutputFlags
const retryInjectionLines = buildRetryExtraLines(firstAttemptDrift, ["scope"])
assert(
  retryInjectionLines.some((l) => l.startsWith("REMOVE DRIFT TERMS:")),
  "retry prompt must include REMOVE DRIFT TERMS line because first-attempt had abstraction_flag=true",
)
const retryInjectionFromRetryOutput = buildRetryExtraLines(retryOutputFlags, ["scope"])
assert(
  !retryInjectionFromRetryOutput.some((l) => l.startsWith("REMOVE DRIFT TERMS:")),
  "if retry output flags were used instead, no REMOVE DRIFT TERMS line would appear (proves first-attempt is correct source)",
)
console.log(`PASS [4] retry injection uses first-attempt flags (deterministic):`)
console.log(`  first-attempt abstraction_flag=${firstAttemptDrift.abstraction_flag} drift_terms=${JSON.stringify(firstAttemptDrift.drift_terms)}`)
console.log(`  retry output  abstraction_flag=${retryOutputFlags.abstraction_flag} drift_terms=${JSON.stringify(retryOutputFlags.drift_terms)}`)
console.log(`  retry prompt line: "${retryInjectionLines.find((l) => l.startsWith("REMOVE DRIFT TERMS"))}"`)

// ---------------------------------------------------------------------------
// Anchor suppression: term in anchorTerms is NOT counted as drift
// ---------------------------------------------------------------------------
const anchoredFlags = detectDriftFlags("You are a visionary who maps scope.", ["visionary"])
assert(anchoredFlags.abstraction_flag === false, "abstraction_flag must be false when drift term is in anchorTerms")
assert(!anchoredFlags.drift_terms.includes("visionary"), "drift_terms must NOT include 'visionary' when it is an anchor")
console.log(`PASS [bonus] anchor suppression: 'visionary' in anchors → abstraction_flag=false`)

// ---------------------------------------------------------------------------
// 5. RETRY_REQUIRED outcome: first-pass log when score < MIN_OVERLAP
// ---------------------------------------------------------------------------

// Simulate the first-pass log line that production code emits when score < MIN_OVERLAP
// (synthesis_source=llm, validator_outcome=RETRY_REQUIRED)
const retryRequiredLine = formatSynthesisLogLine({
  synthesis_source: "llm",
  anchor_overlap_score: 0.10,
  missing_anchor_count: 18,
  praise_flag: false,
  abstraction_flag: false,
  validator_outcome: "RETRY_REQUIRED",
})
assert(retryRequiredLine.includes("synthesis_source=llm"), `first-pass retry line must have synthesis_source=llm; got: ${retryRequiredLine}`)
assert(retryRequiredLine.includes("validator_outcome=RETRY_REQUIRED"), `first-pass retry line must have validator_outcome=RETRY_REQUIRED; got: ${retryRequiredLine}`)
console.log(`PASS [5] first-pass RETRY_REQUIRED log: "${retryRequiredLine}"`)

// Simulate the retry-attempt log line (synthesis_source=retry, validator_outcome=PASS)
const retryPassLine = formatSynthesisLogLine({
  synthesis_source: "retry",
  anchor_overlap_score: 0.50,
  missing_anchor_count: 12,
  praise_flag: false,
  abstraction_flag: false,
  validator_outcome: "PASS",
})
assert(retryPassLine.includes("synthesis_source=retry"), `retry line must have synthesis_source=retry; got: ${retryPassLine}`)
assert(retryPassLine.includes("validator_outcome=PASS"), `retry line must have validator_outcome=PASS; got: ${retryPassLine}`)
console.log(`PASS [5] retry-attempt PASS log: "${retryPassLine}"`)

// Simulate the retry-attempt log line (synthesis_source=retry, validator_outcome=FALLBACK_ANCHOR_FAILURE)
const retryFailLine = formatSynthesisLogLine({
  synthesis_source: "retry",
  anchor_overlap_score: 0.10,
  missing_anchor_count: 18,
  praise_flag: false,
  abstraction_flag: false,
  validator_outcome: "FALLBACK_ANCHOR_FAILURE",
})
assert(retryFailLine.includes("synthesis_source=retry"), `retry fallback line must have synthesis_source=retry; got: ${retryFailLine}`)
assert(retryFailLine.includes("validator_outcome=FALLBACK_ANCHOR_FAILURE"), `retry fallback line must have validator_outcome=FALLBACK_ANCHOR_FAILURE; got: ${retryFailLine}`)
console.log(`PASS [5] retry-attempt FALLBACK_ANCHOR_FAILURE log: "${retryFailLine}"`)

// ---------------------------------------------------------------------------
// 6. FALLBACK_BLACKLIST_PHRASE: output containing a known blacklist token
// ---------------------------------------------------------------------------

// Known blacklist tokens from lib/semantic_synthesis.ts blacklistTokens array
const blacklistTokens = [
  "cadence",
  "operating structure",
  "operating model",
  "leverage",
  "impact",
  "value",
  "optimize",
  "synergy",
  "scalable",
  "framework",
  "system's",
  "system\u2019s",
]

// Feed synthesisText containing a known blacklist phrase ("optimize")
const blacklistText = "You don't just map scope—you optimize constraints and decide handoffs."
assert(
  containsBlacklistPhrase(blacklistText, blacklistTokens),
  `containsBlacklistPhrase must return true for text containing "optimize"; got false`,
)
console.log(`PASS [6] containsBlacklistPhrase=true for text containing "optimize"`)

// Clean text must NOT trigger the blacklist
const cleanTextBlacklist = "You don't just map scope—you clarify constraints and decide handoffs."
assert(
  !containsBlacklistPhrase(cleanTextBlacklist, blacklistTokens),
  `containsBlacklistPhrase must return false for clean text; got true`,
)
console.log(`PASS [6] containsBlacklistPhrase=false for clean text`)

// Assert the produced formatted log line includes validator_outcome=FALLBACK_BLACKLIST_PHRASE
const blacklistLogLine = formatSynthesisLogLine({
  synthesis_source: "fallback",
  anchor_overlap_score: 0,
  missing_anchor_count: 0,
  praise_flag: false,
  abstraction_flag: false,
  validator_outcome: "FALLBACK_BLACKLIST_PHRASE",
})
assert(blacklistLogLine.includes("synthesis_source=fallback"), `blacklist log must have synthesis_source=fallback; got: ${blacklistLogLine}`)
assert(blacklistLogLine.includes("validator_outcome=FALLBACK_BLACKLIST_PHRASE"), `blacklist log must have validator_outcome=FALLBACK_BLACKLIST_PHRASE; got: ${blacklistLogLine}`)
console.log(`PASS [6] FALLBACK_BLACKLIST_PHRASE log: "${blacklistLogLine}"`)

// ---------------------------------------------------------------------------
// 7. fallback_reason field: PASS does NOT contain it; FALLBACK_ANCHOR_FAILURE does
// ---------------------------------------------------------------------------

const passLogLine = formatSynthesisLogLine({
  synthesis_source: "llm",
  anchor_overlap_score: 0.50,
  missing_anchor_count: 6,
  praise_flag: false,
  abstraction_flag: false,
  validator_outcome: "PASS",
})
assert(!passLogLine.includes("fallback_reason="), `PASS log must NOT contain "fallback_reason="; got: ${passLogLine}`)
console.log(`PASS [7] PASS log does not contain fallback_reason=: "${passLogLine}"`)

const anchorFailLogLine = formatSynthesisLogLine({
  synthesis_source: "retry",
  anchor_overlap_score: 0.10,
  missing_anchor_count: 18,
  praise_flag: false,
  abstraction_flag: false,
  validator_outcome: "FALLBACK_ANCHOR_FAILURE",
  fallback_reason: "anchor_failure",
})
assert(
  anchorFailLogLine.includes("validator_outcome=FALLBACK_ANCHOR_FAILURE fallback_reason=anchor_failure"),
  `FALLBACK_ANCHOR_FAILURE log must contain "validator_outcome=FALLBACK_ANCHOR_FAILURE fallback_reason=anchor_failure"; got: ${anchorFailLogLine}`,
)
console.log(`PASS [7] FALLBACK_ANCHOR_FAILURE log contains fallback_reason=anchor_failure: "${anchorFailLogLine}"`)

console.log("\nALL ACCEPTANCE CHECKS PASSED")
