/* eslint-disable no-console */

import { dispatchCalibrationEvent } from "../lib/calibration_machine"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function expectOk<T extends { ok: boolean }>(res: T, label: string): asserts res is T & { ok: true } {
  assert(res.ok === true, `${label}: expected ok=true, got ${JSON.stringify(res)}`)
}

function event(e: any, label: string) {
  const res = dispatchCalibrationEvent(e as any)
  expectOk(res as any, label)
  return res as any
}

function advanceUntil(sessionId: string, target: string, maxSteps: number, label: string) {
  let last = null as any
  for (let i = 0; i < maxSteps; i += 1) {
    last = event({ type: "ADVANCE", sessionId }, `${label}_ADVANCE_${i + 1}`)
    if (last.session.state === target) return last
  }
  throw new Error(`${label}: failed to reach ${target} within ${maxSteps} steps; last=${last?.session?.state}`)
}

const BLACKLIST = [
  "cadence",
  "leverage",
  "impact",
  "value",
  "optimize",
  "synergies",
  "scalable",
  "operating model",
  "operating structure",
  "system",
  "systems",
  "framework",
]

const ALLOWED_REPEAT = new Set(["you", "don’t", "don't", "just", "when", "isn’t", "isn't"])

const CONCRETE_VERBS = new Set([
  "notice",
  "map",
  "surface",
  "isolate",
  "name",
  "define",
  "test",
  "simplify",
  "tighten",
  "sequence",
  "clarify",
  "repair",
  "design",
  "build",
  "draft",
  "decide",
  "align",
  "measure",
])

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []).filter(Boolean)
}

function contentWords(text: string): string[] {
  return words(text).filter((w) => w.length >= 5 && !ALLOWED_REPEAT.has(w))
}

function assertNoBlacklist(text: string, label: string) {
  const lower = text.toLowerCase()
  for (const b of BLACKLIST) {
    assert(!lower.includes(b), `${label}: contains blacklisted term "${b}" -> ${text}`)
  }
}

function assertNoRepetitionAcrossLines(lines: string[], label: string) {
  const seen = new Set<string>()
  for (const line of lines) {
    for (const w of contentWords(line)) {
      assert(!seen.has(w), `${label}: repeated content word "${w}" -> ${lines.join(" | ")}`)
      seen.add(w)
    }
  }
}

function assertConstruction(line: string, label: string) {
  const m = line.trim().match(/^You\s+([a-z]+),\s+([a-z]+),\s+and\s+([a-z]+)\.$/i)
  assert(!!m, `${label}: bad construction form -> ${line}`)
  const v1 = m![1].toLowerCase()
  const v2 = m![2].toLowerCase()
  const v3 = m![3].toLowerCase()
  assert(CONCRETE_VERBS.has(v1) && CONCRETE_VERBS.has(v2) && CONCRETE_VERBS.has(v3), `${label}: non-allowed verb -> ${line}`)
}

function assertConsequence(line: string, id: string, iv: string, label: string) {
  assert(words(line).length <= 7, `${label}: consequence too long -> ${line}`)
  assertNoBlacklist(line, label)

  const c = new Set(contentWords(line))
  const a = new Set(contentWords(id))
  const b = new Set(contentWords(iv))
  let overlap = 0
  for (const w of c) if (a.has(w) || b.has(w)) overlap += 1
  assert(overlap < 2, `${label}: consequence repeats prior content -> ${line}`)
}

function answerForPrompt(seed: string, n: number): string {
  return `(${seed}) Prompt ${n}: concrete ownership, scoped execution, limits, decisions, measurable outcomes, and clear handoffs across teams and workstreams.`
}

function runOneCase(caseId: string, resumeText: string) {
  const created = event({ type: "CREATE_SESSION" }, `${caseId}_CREATE_SESSION`)
  const sessionId = created.session.sessionId

  event({ type: "SUBMIT_RESUME", sessionId, resumeText }, `${caseId}_SUBMIT_RESUME`)
  advanceUntil(sessionId, "PROMPT_1", 3, `${caseId}_TO_PROMPT_1`)

  for (let i = 1; i <= 5; i += 1) {
    const res = event({ type: "SUBMIT_PROMPT_ANSWER", sessionId, answer: answerForPrompt(caseId, i) }, `${caseId}_SUBMIT_PROMPT_${i}`)
    if (i < 5) assert(res.session.state === `PROMPT_${i + 1}`, `${caseId}: expected PROMPT_${i + 1}`)
    else assert(res.session.state === "CONSOLIDATION_PENDING", `${caseId}: expected CONSOLIDATION_PENDING`)
  }

  advanceUntil(sessionId, "CONSOLIDATION_RITUAL", 3, `${caseId}_TO_RITUAL`)
  const synth = advanceUntil(sessionId, "PATTERN_SYNTHESIS", 20, `${caseId}_TO_SYNTHESIS`)

  const summary = synth.session.synthesis?.patternSummary
  assert(typeof summary === "string" && summary.length > 0, `${caseId}: missing patternSummary`)

  const lines = summary.split(/\n\s*\n/).map((s: string) => s.trim()).filter(Boolean)
  assert(lines.length === 3 || lines.length === 4, `${caseId}: expected 3 or 4 lines -> ${summary}`)

  for (let i = 0; i < lines.length; i += 1) {
    assertNoBlacklist(lines[i], `${caseId}_LINE_${i + 1}`)
  }

  assertNoRepetitionAcrossLines(lines, `${caseId}_REPETITION`)
  assertConstruction(lines[2], `${caseId}_CONSTRUCTION`)

  if (lines.length === 4) {
    assertConsequence(lines[3], lines[0], lines[1], `${caseId}_CONSEQUENCE`)
  }

  assert(!summary.toLowerCase().includes("cadence"), `${caseId}: "cadence" appeared -> ${summary}`)

  console.log(`PASS: ${caseId}`)
}

try {
  const resumes = [
    "Operator leading cross-team delivery; owns decisions, defines constraints, and drives measurable outcomes across planning, execution, and handoffs.",
    "Builder who isolates scope, clarifies owners, and sequences work to reduce drift; measures results and repairs broken incentives.",
    "Generalist who maps dependencies, aligns stakeholders, and defines decision paths; keeps scope bounded and outcomes measurable.",
    "Executor who simplifies messy threads, names constraints, and sequences delivery; uses metrics to test what holds under pressure.",
    "Leader who routes decisions, defines boundaries, and maintains clear ownership; stabilizes execution across teams and handoffs.",
    "Program lead who tracks incentives, tightens limits, and tests assumptions; clarifies scope and protects measurement integrity.",
    "Operator who maps handoffs, isolates bottlenecks, and sequences work; measures outcomes and clarifies decision rights.",
    "Builder who defines constraints, repairs broken loops, and tightens sequencing; keeps ownership explicit and scope bounded.",
    "Cross-functional lead who aligns owners, maps dependencies, and clarifies calls; reduces drift with explicit limits and checks.",
    "Execution lead who isolates threads, defines boundaries, and sequences delivery; measures results and tests incentives.",
  ]

  for (let i = 0; i < resumes.length; i += 1) {
    runOneCase(`CASE_${i + 1}`, resumes[i])
  }

  console.log("PASS: synthesis language guard fixtures (10 cases)")
} catch (e: unknown) {
  const msg = String((e as any)?.message ?? e)
  console.error(`SMOKE FAILED: ${msg}`)
  process.exitCode = 1
}