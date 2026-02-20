import type { CalibrationEvent, CalibrationSession, CalibrationState, CalibrationError } from "@/lib/calibration_types"
import { storeGet, storeSet } from "@/lib/calibration_store"
import { ingestJob } from "@/lib/job_ingest"
import { runIntegrationSeam } from "@/lib/integration_seam"
import { toResultContract } from "@/lib/result_contract"
import { generateSemanticSynthesis } from "@/lib/semantic_synthesis"
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts"

type Ok = { ok: true; session: CalibrationSession }
type Err = { ok: false; error: CalibrationError }
export type DispatchResult = Ok | Err

function nowIso(): string {
  return new Date().toISOString()
}

function bad(code: CalibrationError["code"], message: string): Err {
  return { ok: false, error: { code, message } }
}

function pushHistory(session: CalibrationSession, from: CalibrationState, to: CalibrationState, event: string): CalibrationSession {
  if (from === to) return session
  return {
    ...session,
    history: [...(Array.isArray(session.history) ? session.history : []), { at: nowIso(), from, to, event }],
  }
}

function mustGet(sessionId: string): CalibrationSession | Err {
  const s = storeGet(sessionId)
  if (!s) return bad("SESSION_NOT_FOUND", "Session not found")
  return s
}

function promptsComplete1to5(session: CalibrationSession): boolean {
  for (let i = 1 as const; i <= 5; i = (i + 1) as any) {
    const slot = session.prompts[i]
    if (!slot) return false
    if (!slot.accepted) return false
    if (typeof slot.answer !== "string" || slot.answer.trim().length === 0) return false
  }
  return true
}

function meetsSignal(text: string): boolean {
  return text.trim().length >= 40
}

function clarifierStateForIndex(n: 1 | 2 | 3 | 4 | 5): CalibrationState {
  return `PROMPT_${n}_CLARIFIER` as CalibrationState
}

function getPromptIndex(state: CalibrationState): 1 | 2 | 3 | 4 | 5 | null {
  switch (state) {
    case "PROMPT_1":
    case "PROMPT_1_CLARIFIER":
      return 1
    case "PROMPT_2":
    case "PROMPT_2_CLARIFIER":
      return 2
    case "PROMPT_3":
    case "PROMPT_3_CLARIFIER":
      return 3
    case "PROMPT_4":
    case "PROMPT_4_CLARIFIER":
      return 4
    case "PROMPT_5":
    case "PROMPT_5_CLARIFIER":
      return 5
    default:
      return null
  }
}

function nextPromptAfter(n: 1 | 2 | 3 | 4 | 5): CalibrationState {
  if (n === 1) return "PROMPT_2"
  if (n === 2) return "PROMPT_3"
  if (n === 3) return "PROMPT_4"
  if (n === 4) return "PROMPT_5"
  return "CONSOLIDATION_PENDING"
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return Math.round(n)
}

// Deterministic “encoding” placeholder: stable per session based on already-collected text.
function encodePersonVectorOnce(session: CalibrationSession): CalibrationSession {
  if (session.personVector.locked && session.personVector.values) return session

  const parts: string[] = []
  if (typeof session.resume.rawText === "string") parts.push(session.resume.rawText)
  for (let i = 1 as const; i <= 5; i = (i + 1) as any) {
    const a = session.prompts[i]?.answer
    if (typeof a === "string") parts.push(a)
    const ca = session.prompts[i]?.clarifier?.answer
    if (typeof ca === "string") parts.push(ca)
  }
  const joined = parts.join("\n").trim()

  let acc = 0
  for (let i = 0; i < joined.length; i += 1) {
    acc = (acc + joined.charCodeAt(i) * (i + 1)) >>> 0
  }

  const dims: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] = [
    ((acc + 11) % 3) as 0 | 1 | 2,
    ((acc + 23) % 3) as 0 | 1 | 2,
    ((acc + 37) % 3) as 0 | 1 | 2,
    ((acc + 41) % 3) as 0 | 1 | 2,
    ((acc + 59) % 3) as 0 | 1 | 2,
    ((acc + 71) % 3) as 0 | 1 | 2,
  ]

  return {
    ...session,
    personVector: { values: dims, locked: true },
    encodingRitual: { completed: true },
  }
}

type ContrastPair = { x: string; y: string } // identity contrast
type InterventionPair = { a: string; b: string } // intervention contrast

function pickFirst<T>(items: T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback
}

function coherenceStrong(vec: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]): boolean {
  // Earned consequence drop only when the vector shows clear shape (enough non-neutral dimensions).
  let nonNeutral = 0
  for (const v of vec) if (v !== 1) nonNeutral += 1
  return nonNeutral >= 4
}

type PersonVector6 = [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]
type ResumeSignals = { charLen: number; hasBullets: boolean; hasDates: boolean; hasTitles: boolean } | null | undefined

function primaryDimFromVector(v: PersonVector6): number {
  for (let i = 0; i < 6; i += 1) if (v[i] !== 1) return i
  return 0
}

function splitSynthesisLines(patternSummary: string): string[] {
  return patternSummary
    .split(/\n\s*\n/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

function joinSynthesisLines(lines: string[]): string {
  return lines.join("\n\n")
}

function stripPraiseAdjectives(line: string): string {
  const praise = [
    "best",
    "great",
    "exceptional",
    "excellent",
    "amazing",
    "outstanding",
    "brilliant",
    "impressive",
    "remarkable",
    "world-class",
    "elite",
  ]
  let out = line
  for (const w of praise) {
    const re = new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi")
    out = out.replace(re, "")
  }
  out = out.replace(/\s{2,}/g, " ").trim()
  out = out.replace(/\s+([.,!?;:])/g, "$1")
  return out
}

function normalizeWordToken(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()
  return cleaned
}

function collectContentWords(lines: string[]): string[] {
  const words: string[] = []
  for (const line of lines) {
    const parts = line.split(/\s+/g)
    for (const p of parts) {
      const t = normalizeWordToken(p)
      if (t.length >= 5) words.push(t)
    }
  }
  return words
}

// Guardrail constants (MUST exist exactly once in this module).
const REPETITION_STOPWORDS = new Set<string>(["you", "dont", "just", "when", "something", "isnt", "working", "through"])

const BLACKLIST_TERMS: Array<{ label: string; re: RegExp }> = [
  { label: "cadence", re: /\bcadence\b/i },
  { label: "operating structure", re: /\boperating\s+(structure|model)\b/i },
  { label: "leverage", re: /\bleverage\b/i },
  { label: "impact", re: /\bimpact\b/i },
  { label: "value", re: /\bvalue\b/i },
  { label: "optimize", re: /\boptimi[sz]e\b/i },
  { label: "synergy", re: /\bsynergy\b/i },
  { label: "scalable", re: /\bscalable\b/i },
  { label: "framework", re: /\bframework\b/i },
  { label: "system’s", re: /\bsystem[’']s\b/i },
  { label: "system", re: /\bsystem\b/i },
]

const SYNONYM_MAP: Array<{ from: RegExp; to: string }> = [
  { from: /\bship\s+work\b/gi, to: "do the work" },
  { from: /\bcadence\b/gi, to: "rhythm" },
  { from: /\boperating\s+structure\b/gi, to: "operating rules" },
  { from: /\boperating\s+model\b/gi, to: "operating rules" },
  { from: /\bpush\s+through\b/gi, to: "force it" },
  { from: /\bleverage\b/gi, to: "use" },
  { from: /\bimpact\b/gi, to: "effect" },
  { from: /\bvalue\b/gi, to: "use" },
  { from: /\boptimi[sz]e\b/gi, to: "tighten" },
  { from: /\bsynergy\b/gi, to: "fit" },
  { from: /\bscalable\b/gi, to: "repeatable" },
  { from: /\bframework\b/gi, to: "method" },
  { from: /\bsystem[’']s\b/gi, to: "workflow’s" },
  { from: /\bsystem\b/gi, to: "workflow" },
]

const CONSTRUCTION_ALLOWED_VERBS = new Set<string>([
  "notice",
  "surface",
  "map",
  "isolate",
  "name",
  "define",
  "clarify",
  "tighten",
  "sequence",
  "test",
  "simplify",
  "decide",
  "design",
  "build",
  "repair",
  "align",
  "measure",
])

function applyDeterministicTermReplacements(line: string): string {
  let out = line
  for (const { from, to } of SYNONYM_MAP) out = out.replace(from, to)
  out = out.replace(/\s{2,}/g, " ").trim()
  out = out.replace(/\s+([.,!?;:])/g, "$1")
  return out
}

function hasBlacklist(line: string): boolean {
  for (const t of BLACKLIST_TERMS) if (t.re.test(line)) return true
  return false
}

function buildSafeMinimalLines(primaryDim: number, _signals: ResumeSignals): [string, string, string] {
  const identityByDim: Record<number, string> = {
    0: "You don’t just ship work — you set operating rules.",
    1: "You don’t just take ownership — you define boundaries.",
    2: "You don’t just hit targets — you protect measurement integrity.",
    3: "You don’t just work across scope — you hold constraints.",
    4: "You don’t just learn quickly — you choose one depth path.",
    5: "You don’t just coordinate stakeholders — you set handoffs.",
  }
  const interventionByDim: Record<number, string> = {
    0: "When something isn’t working, you don’t force it — you tighten constraints.",
    1: "When something isn’t working, you don’t wait — you route the call.",
    2: "When something isn’t working, you don’t argue — you audit the measure.",
    3: "When something isn’t working, you don’t adapt silently — you reject drift.",
    4: "When something isn’t working, you don’t keep exploring — you pick one thread.",
    5: "When something isn’t working, you don’t reply to everyone — you set one handoff.",
  }
  const constructionVerbsByDim: Record<number, [string, string, string]> = {
    0: ["notice", "clarify", "sequence"],
    1: ["map", "define", "decide"],
    2: ["measure", "isolate", "test"],
    3: ["surface", "tighten", "decide"],
    4: ["isolate", "simplify", "decide"],
    5: ["map", "align", "sequence"],
  }

  const identity = identityByDim[primaryDim] ?? identityByDim[0]
  const intervention = interventionByDim[primaryDim] ?? interventionByDim[0]
  const verbs = constructionVerbsByDim[primaryDim] ?? constructionVerbsByDim[0]
  const construction = `You ${verbs[0]}, ${verbs[1]}, and ${verbs[2]}.`

  return [identity, intervention, construction]
}

function isValidConstructionLine(line: string): boolean {
  const m = /^You\s+([A-Za-z]+),\s+([A-Za-z]+),\s+and\s+([A-Za-z]+)\.\s*$/.exec(line.trim())
  if (!m) return false
  const v1 = m[1].toLowerCase()
  const v2 = m[2].toLowerCase()
  const v3 = m[3].toLowerCase()
  return CONSTRUCTION_ALLOWED_VERBS.has(v1) && CONSTRUCTION_ALLOWED_VERBS.has(v2) && CONSTRUCTION_ALLOWED_VERBS.has(v3)
}

function rewriteConstructionLine(primaryDim: number): string {
  const verbsByDim: Record<number, [string, string, string]> = {
    0: ["notice", "clarify", "sequence"],
    1: ["map", "define", "decide"],
    2: ["measure", "isolate", "test"],
    3: ["surface", "tighten", "decide"],
    4: ["isolate", "simplify", "decide"],
    5: ["map", "align", "sequence"],
  }
  const verbs = verbsByDim[primaryDim] ?? verbsByDim[0]
  return `You ${verbs[0]}, ${verbs[1]}, and ${verbs[2]}.`
}

function enforceRepetitionControl(lines: string[], primaryDim: number, signals: ResumeSignals): string[] {
  const counts = new Map<string, number>()
  const words = collectContentWords(lines)
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)

  const repeated = new Set<string>()
  for (const [w, c] of counts.entries()) {
    if (c <= 1) continue
    if (REPETITION_STOPWORDS.has(w)) continue
    repeated.add(w)
  }
  if (repeated.size === 0) return lines

  let next = [...lines]
  for (const rep of Array.from(repeated.values())) {
    const replacementMap: Record<string, string> = {
      cadence: "rhythm",
      structure: "rules",
      operating: "working",
      constraints: "limits",
      decision: "call",
      boundaries: "limits",
      measure: "metric",
      measures: "metrics",
      incentives: "tradeoffs",
      scope: "range",
      handoffs: "handover",
      workflow: "process",
      system: "workflow",
    }
    const repl = replacementMap[rep]
    if (!repl) {
      const safe = buildSafeMinimalLines(primaryDim, signals)
      return [safe[0], safe[1], safe[2]]
    }

    let seen = 0
    next = next.map((line) => {
      const parts = line.split(/\b/)
      const outParts = parts.map((chunk) => {
        const t = normalizeWordToken(chunk)
        if (t !== rep) return chunk
        seen += 1
        if (seen <= 1) return chunk
        return repl
      })
      return outParts.join("")
    })
  }

  const counts2 = new Map<string, number>()
  const words2 = collectContentWords(next)
  for (const w of words2) counts2.set(w, (counts2.get(w) ?? 0) + 1)
  for (const [w, c] of counts2.entries()) {
    if (c <= 1) continue
    if (REPETITION_STOPWORDS.has(w)) continue
    const safe = buildSafeMinimalLines(primaryDim, signals)
    return [safe[0], safe[1], safe[2]]
  }

  return next.map((x) => x.replace(/\s{2,}/g, " ").trim())
}

function enforceConsequenceGate(lines: string[]): string[] {
  if (lines.length < 4) return lines
  const consequence = lines[3] ?? ""
  const normalized = consequence.trim()
  if (normalized.length === 0) return lines.slice(0, 3)

  if (hasBlacklist(normalized)) return lines.slice(0, 3)

  const lower = normalized.toLowerCase()
  const identityRepeats = [
    "operating rules",
    "operating structure",
    "constraints",
    "decision boundary",
    "scope boundary",
    "measurement",
    "handoff",
    "set constraints",
    "set structure",
    "define boundaries",
  ]
  for (const s of identityRepeats) {
    if (lower.includes(s)) return lines.slice(0, 3)
  }

  const wc = normalized.split(/\s+/g).filter(Boolean).length
  if (wc > 7) return lines.slice(0, 3)

  return lines.slice(0, 4)
}

function validateAndRepairSynthesisOnce(
  synthesisPatternSummary: string,
  personVector: PersonVector6,
  signals: ResumeSignals,
): { patternSummary: string; didRepair: boolean } {
  if (typeof synthesisPatternSummary !== "string" || synthesisPatternSummary.trim().length === 0) {
    const pd = primaryDimFromVector(personVector)
    const safe = buildSafeMinimalLines(pd, signals)
    return { patternSummary: joinSynthesisLines([safe[0], safe[1], safe[2]]), didRepair: true }
  }

  const primaryDim = primaryDimFromVector(personVector)
  const baseLines = splitSynthesisLines(synthesisPatternSummary)
  if (baseLines.length < 3) {
    const safe = buildSafeMinimalLines(primaryDim, signals)
    return { patternSummary: joinSynthesisLines([safe[0], safe[1], safe[2]]), didRepair: true }
  }

  let lines = baseLines.slice(0, 4)
  let didRepair = false

  const findBlacklistHit = (line: string): { label: string; match: string } | null => {
    for (const t of BLACKLIST_TERMS) {
      const m = t.re.exec(line)
      if (m && typeof m[0] === "string" && m[0].length > 0) {
        return { label: t.label, match: m[0] }
      }
    }
    return null
  }

  const applySingleTokenBlacklistRepair = (
    inLines: string[],
  ): { lines: string[]; didApply: boolean; from: string; to: string } => {
    const replacementMap: Record<string, string> = {
      targets: "measures",
      target: "measure",
      impact: "effect",
      value: "result",
      engagement: "use",
      optimize: "tighten",
      leverage: "use",
    }

    let out = [...inLines]
    let didApply = false
    let loggedFrom = ""
    let loggedTo = ""

    const preserveCase = (fromText: string, repl: string): string => {
      if (fromText.toUpperCase() === fromText) return repl.toUpperCase()
      const first = fromText.slice(0, 1)
      const rest = fromText.slice(1)
      const isTitle = first.toUpperCase() === first && rest.toLowerCase() === rest
      if (isTitle) return repl.slice(0, 1).toUpperCase() + repl.slice(1)
      return repl
    }

    for (let i = 0; i < out.length; i += 1) {
      const hit = findBlacklistHit(out[i] ?? "")
      if (!hit) continue

      // Phrase-level drift hard-fails.
      if (/\s/.test(hit.label)) {
        return { lines: out, didApply: false, from: "", to: "" }
      }

      const key = normalizeWordToken(hit.match)
      const replBase = replacementMap[key]
      if (!replBase) {
        return { lines: out, didApply: false, from: "", to: "" }
      }

      const re = new RegExp(`\\b${key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi")
      const before = out[i]
      out[i] = out[i].replace(re, (m) => preserveCase(m, replBase))

      if (out[i] !== before && !didApply) {
        didApply = true
        loggedFrom = hit.match
        loggedTo = replBase
      }
    }

    return { lines: out, didApply, from: loggedFrom, to: loggedTo }
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const before = joinSynthesisLines(lines)

    lines = lines.map((l) => stripPraiseAdjectives(l))
    lines = lines.map((l) => applyDeterministicTermReplacements(l))

    if (!isValidConstructionLine(lines[2] ?? "")) {
      lines[2] = rewriteConstructionLine(primaryDim)
      didRepair = true
    }

    lines = enforceConsequenceGate(lines)
    lines = enforceRepetitionControl(lines, primaryDim, signals)

    if (!/^You\s+don[’']t\s+just\s+/i.test(lines[0] ?? "")) {
      const safe = buildSafeMinimalLines(primaryDim, signals)
      lines = [safe[0], safe[1], safe[2]]
      didRepair = true
    }
    if (!/^When\s+something\s+isn[’']t\s+working,/i.test(lines[1] ?? "")) {
      const safe = buildSafeMinimalLines(primaryDim, signals)
      lines = [safe[0], safe[1], safe[2]]
      didRepair = true
    }

    // Repair-first for single-token blacklist hits; phrase-level hits hard-fail to fallback.
    const firstHit = lines.map((l) => findBlacklistHit(l)).find((x) => x !== null) as { label: string; match: string } | null
    if (firstHit) {
      if (/\s/.test(firstHit.label)) {
        console.warn("[caliber] synthesis_source=fallback", { reason: "blacklist_phrase_hit", hit: firstHit.match })
        const safe = buildSafeMinimalLines(primaryDim, signals)
        return { patternSummary: joinSynthesisLines([safe[0], safe[1], safe[2]]), didRepair: true }
      }

      const repaired = applySingleTokenBlacklistRepair(lines)
      if (repaired.didApply) {
        console.log("[caliber] blacklist_repair=applied", { from: repaired.from, to: repaired.to })
        lines = repaired.lines
        didRepair = true
      }

      const stillHasBlacklist = lines.some((l) => hasBlacklist(l))
      if (stillHasBlacklist) {
        const safe = buildSafeMinimalLines(primaryDim, signals)
        return { patternSummary: joinSynthesisLines([safe[0], safe[1], safe[2]]), didRepair: true }
      }
    }

    const anyBlacklist = lines.some((l) => hasBlacklist(l))
    const constructionOk = isValidConstructionLine(lines[2] ?? "")

    const contentWords = collectContentWords(lines)
    const counts = new Map<string, number>()
    for (const w of contentWords) counts.set(w, (counts.get(w) ?? 0) + 1)
    let repeatBad = false
    for (const [w, c] of counts.entries()) {
      if (c <= 1) continue
      if (REPETITION_STOPWORDS.has(w)) continue
      repeatBad = true
      break
    }

    if (!anyBlacklist && constructionOk && !repeatBad) {
      const after = joinSynthesisLines(lines)
      if (after !== before) didRepair = true
      return { patternSummary: after, didRepair }
    }

    if (pass === 1) {
      const safe = buildSafeMinimalLines(primaryDim, signals)
      return { patternSummary: joinSynthesisLines([safe[0], safe[1], safe[2]]), didRepair: true }
    }
  }

  const safe = buildSafeMinimalLines(primaryDim, signals)
  return { patternSummary: joinSynthesisLines([safe[0], safe[1], safe[2]]), didRepair: true }
}

async function buildSemanticPatternSummary(session: CalibrationSession, v: PersonVector6): Promise<string> {
  const primaryDim = primaryDimFromVector(v)
  const signals = session.resume.signals as ResumeSignals

  const promptAnswers: Array<{ n: 1 | 2 | 3 | 4 | 5; answer: string }> = []
  for (let i = 1 as const; i <= 5; i = (i + 1) as any) {
    const a = session.prompts[i]?.answer
    if (typeof a === "string" && a.trim().length > 0) {
      promptAnswers.push({ n: i, answer: a.trim() })
      continue
    }
    const ca = session.prompts[i]?.clarifier?.answer
    if (typeof ca === "string" && ca.trim().length > 0) {
      promptAnswers.push({ n: i, answer: ca.trim() })
    }
  }

  const resumeText = typeof session.resume.rawText === "string" ? session.resume.rawText : ""

  type FallbackReason = "llm_call_failed" | "json_parse_failed" | "missing_keys" | "empty_strings"

  const classifyFallbackReason = (msg: string): FallbackReason => {
    const m = (msg || "").toLowerCase()
    if (m.includes("non-json")) return "json_parse_failed"
    if (m.includes("missing required fields")) return "missing_keys"
    if (m.includes("empty content")) return "empty_strings"
    return "llm_call_failed"
  }

  const logFallback = (reason: FallbackReason, detail: string) => {
    console.log("synthesis_source=fallback")
    console.log(`synthesis_fallback_reason=${reason}`)
    if (reason === "json_parse_failed" || reason === "missing_keys") {
      const d = String(detail ?? "")
      console.log(`synthesis_model_response_len=${d.length}`)
      console.log(`synthesis_model_response_head=${d.slice(0, 200)}`)
    }
  }

  let lastErrorMessage = ""

  const tryOnce = async (): Promise<string | null> => {
    const semantic = await generateSemanticSynthesis({
      personVector: v,
      resumeText,
      promptAnswers,
    })

    const lines: string[] = [
      String(semantic.identityContrast ?? "").trim(),
      String(semantic.interventionContrast ?? "").trim(),
      String(semantic.constructionLayer ?? "").trim(),
    ]

    if (coherenceStrong(v) && typeof semantic.consequenceDrop === "string" && semantic.consequenceDrop.trim().length > 0) {
      lines.push(semantic.consequenceDrop.trim())
    }

    const raw = joinSynthesisLines(lines)
    const repaired = validateAndRepairSynthesisOnce(raw, v, signals)
    return repaired.patternSummary
  }

  try {
    const out1 = await tryOnce()
    if (out1) {
      console.log("synthesis_source=llm")
      return out1
    }
  } catch (e: any) {
    lastErrorMessage = String(e?.message ?? e ?? "")
    // retry once below
  }

  try {
    const out2 = await tryOnce()
    if (out2) {
      console.log("synthesis_source=llm")
      return out2
    }
  } catch (e: any) {
    lastErrorMessage = String(e?.message ?? e ?? "")
    // fall through
  }

  const reason = classifyFallbackReason(lastErrorMessage)
  logFallback(reason, lastErrorMessage)

  const safe = buildSafeMinimalLines(primaryDim, signals)
  return joinSynthesisLines([safe[0], safe[1], safe[2]])
}

// Deterministic synthesis fallback (phrase banks).
function buildDeterministicPatternSummary(v: PersonVector6): string {
  const identityByDim: Record<number, Record<0 | 1 | 2, ContrastPair>> = {
    0: {
      0: { x: "handle tasks", y: "set an operating structure" },
      1: { x: "do the work", y: "stabilize the work system" },
      2: { x: "do the work", y: "build an operating structure" },
    },
    1: {
      0: { x: "support decisions", y: "route decisions to the right owner" },
      1: { x: "take ownership", y: "define decision boundaries" },
      2: { x: "take ownership", y: "set decision boundaries and hold them" },
    },
    2: {
      0: { x: "do the work", y: "separate signal from incentives" },
      1: { x: "hit targets", y: "maintain measurement integrity" },
      2: { x: "hit targets", y: "design measurement and incentives" },
    },
    3: {
      0: { x: "follow a plan", y: "enforce scope boundaries" },
      1: { x: "work across scope", y: "anchor scope to constraints" },
      2: { x: "work across scope", y: "re-anchor scope to constraints" },
    },
    4: {
      0: { x: "cover many topics", y: "reduce the problem to a single thread" },
      1: { x: "learn quickly", y: "choose a depth path" },
      2: { x: "go deep", y: "build a depth path and stay on it" },
    },
    5: {
      0: { x: "coordinate updates", y: "reduce stakeholder noise" },
      1: { x: "coordinate stakeholders", y: "map dependencies" },
      2: { x: "coordinate stakeholders", y: "map dependencies and set handoffs" },
    },
  }

  const interventionByDim: Record<number, Record<0 | 1 | 2, InterventionPair>> = {
    0: {
      0: { a: "push through", b: "set a cadence and constraints" },
      1: { a: "do more", b: "tighten the operating structure" },
      2: { a: "do more", b: "tighten the operating structure" },
    },
    1: {
      0: { a: "take over", b: "route the decision to the owner" },
      1: { a: "wait", b: "claim the decision boundary" },
      2: { a: "wait", b: "claim the decision boundary" },
    },
    2: {
      0: { a: "optimize output", b: "fix the measurement" },
      1: { a: "argue for targets", b: "fix the incentives" },
      2: { a: "argue for targets", b: "fix the incentives" },
    },
    3: {
      0: { a: "adapt silently", b: "reject scope drift" },
      1: { a: "accept ambiguity", b: "re-anchor the scope" },
      2: { a: "accept ambiguity", b: "re-anchor the scope" },
    },
    4: {
      0: { a: "add more options", b: "choose one depth path" },
      1: { a: "keep exploring", b: "pick a track and commit" },
      2: { a: "keep exploring", b: "pick a track and commit" },
    },
    5: {
      0: { a: "reply to everyone", b: "set a single handoff path" },
      1: { a: "keep everyone aligned", b: "map dependencies and set handoffs" },
      2: { a: "keep everyone aligned", b: "map dependencies and set handoffs" },
    },
  }

  const constructionByDim: Record<number, string[]> = {
    0: ["notice drift", "diagnose constraints", "build cadence"],
    1: ["map ownership", "diagnose decision paths", "build boundaries"],
    2: ["track signal", "diagnose incentives", "build measures"],
    3: ["notice ambiguity", "diagnose scope", "build constraints"],
    4: ["notice sprawl", "diagnose the core thread", "build depth"],
    5: ["notice dependency loops", "diagnose handoffs", "build routing"],
  }

  let primaryDim = 0
  for (let i = 0; i < 6; i += 1) {
    if (v[i] !== 1) {
      primaryDim = i
      break
    }
  }

  const id = identityByDim[primaryDim][v[primaryDim]]
  const iv = interventionByDim[primaryDim][v[primaryDim]]
  const verbs = constructionByDim[primaryDim] ?? ["notice", "diagnose", "build"]

  const identityContrast = `You don’t just ${id.x} — you ${id.y}.`
  const interventionContrast = `When something isn’t working, you don’t ${iv.a} — you ${iv.b}.`
  const constructionLayer = `You ${verbs[0]}, ${verbs[1]}, and ${verbs[2]}.`

  let consequenceDrop: string | null = null
  if (coherenceStrong(v)) {
    const consequenceByDim: Record<number, string> = {
      0: "You change the system’s cadence.",
      1: "You change the decision boundary.",
      2: "You change the measurement rules.",
      3: "You change the scope boundary.",
      4: "You change the depth path.",
      5: "You change the handoff path.",
    }
    consequenceDrop = consequenceByDim[primaryDim] ?? "You change how the system operates."
  }

  const blockLines: string[] = [identityContrast, interventionContrast, constructionLayer]
  if (consequenceDrop) blockLines.push(consequenceDrop)
  return blockLines.join("\n\n")
}

// Hybrid synthesis: LLM semantic (strict) -> deterministic fallback
async function synthesizeOnce(session: CalibrationSession): Promise<CalibrationSession> {
  if (session.synthesis?.patternSummary && session.synthesis?.operateBest && session.synthesis?.loseEnergy) return session
  const vec = session.personVector.values
  if (!vec || vec.length !== 6) return session

  const v = vec as PersonVector6

  let patternSummary = ""
  try {
    patternSummary = await buildSemanticPatternSummary(session, v)
  } catch {
    patternSummary = buildDeterministicPatternSummary(v)
  }

  const repaired = validateAndRepairSynthesisOnce(patternSummary, v, session.resume.signals as ResumeSignals)
  patternSummary = repaired.patternSummary

  // Keep “Operate Best” + “Lose Energy” below, structural, no praise.
  const operateBest: string[] = []
  const loseEnergy: string[] = []

  const highDims: number[] = []
  const lowDims: number[] = []
  for (let i = 0; i < 6; i += 1) {
    if (v[i] === 2) highDims.push(i)
    if (v[i] === 0) lowDims.push(i)
  }

  const operateBestByDim: Record<number, string> = {
    0: "Work with stable cadence and explicit constraints.",
    1: "Work with explicit ownership and decision boundaries.",
    2: "Work where measures and incentives are consistent.",
    3: "Work where scope is explicit and drift is rejected.",
    4: "Work where depth is rewarded over constant context switching.",
    5: "Work where dependencies are mapped and handoffs are explicit.",
  }

  const loseEnergyByDim: Record<number, string> = {
    0: "Work where cadence is missing and constraints reset each cycle.",
    1: "Work where ownership is unclear and decisions have no owner.",
    2: "Work where measures change mid-cycle or incentives conflict.",
    3: "Work where scope is unbounded and priorities shift without constraints.",
    4: "Work where the thread changes before it can be reduced to a stable path.",
    5: "Work where handoffs are undefined and stakeholder routing is unclear.",
  }

  const operateFallback = [
    "Work with explicit scope, ownership, and a stable cadence.",
    "Work where dependencies can be made explicit and handoffs are defined.",
    "Work where measures are stable across cycles.",
  ]

  const loseFallback = [
    "Work where ownership is unclear and scope drift is accepted.",
    "Work where priorities reset each cycle without constraints.",
    "Work where dependencies are implicit and routing is inconsistent.",
  ]

  const primaryDim = primaryDimFromVector(v)
  const opDims = highDims.length > 0 ? highDims : [primaryDim]
  for (const d of opDims.slice(0, 3)) operateBest.push(operateBestByDim[d] ?? operateFallback[0])

  const leDims = lowDims.length > 0 ? lowDims : [primaryDim]
  for (const d of leDims.slice(0, 3)) loseEnergy.push(loseEnergyByDim[d] ?? loseFallback[0])

  while (operateBest.length < 3) operateBest.push(pickFirst(operateFallback.filter((x) => !operateBest.includes(x)), operateFallback[0]))
  while (loseEnergy.length < 3) loseEnergy.push(pickFirst(loseFallback.filter((x) => !loseEnergy.includes(x)), loseFallback[0]))
  operateBest.splice(3)
  loseEnergy.splice(3)

  return {
    ...session,
    synthesis: {
      patternSummary,
      operateBest,
      loseEnergy,
      identitySummary: session.synthesis?.identitySummary ?? null,
      marketTitle: session.synthesis?.marketTitle ?? null,
      titleExplanation: session.synthesis?.titleExplanation ?? null,
      lastTitleFeedback: session.synthesis?.lastTitleFeedback ?? null,
    },
  }
}

function newSessionId(): string {
  return `sess_${Math.random().toString(16).slice(2)}`
}

function mkSession(id: string): CalibrationSession {
  return {
    id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    state: "RESUME_PENDING",
    history: [],
    resume: { rawText: null, accepted: false, signals: null },
    prompts: {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
    } as any,
    personVector: { values: null, locked: false },
    encodingRitual: { completed: false },
    synthesis: {
      patternSummary: null,
      operateBest: null,
      loseEnergy: null,
      identitySummary: null,
      marketTitle: null,
      titleExplanation: null,
      lastTitleFeedback: null,
    },
    result: null,
  }
}

async function maybeFinalize(session: CalibrationSession): Promise<CalibrationSession> {
  if (session.state !== "CONSOLIDATION_PENDING") return session
  if (!promptsComplete1to5(session)) return session
  if (!session.personVector.values || session.personVector.values.length !== 6) return session

  const afterSynthesis = await synthesizeOnce(session)
  const contract = toResultContract(afterSynthesis)

  return {
    ...afterSynthesis,
    state: "FINAL",
    updatedAt: nowIso(),
    result: contract,
  }
}

export async function dispatchCalibrationEvent(sessionId: string | null | undefined, event: CalibrationEvent): Promise<DispatchResult> {
  if (!event || typeof event.type !== "string") return bad("BAD_EVENT", "Invalid event")

  const incomingId = typeof sessionId === "string" && sessionId.trim().length > 0 ? sessionId.trim() : null

  if (event.type === "SESSION_CREATE") {
    const id = newSessionId()
    const s0 = mkSession(id)
    const s1: CalibrationSession = { ...s0, updatedAt: nowIso() }
    storeSet(id, s1)
    return { ok: true, session: s1 }
  }

  if (!incomingId) return bad("SESSION_NOT_FOUND", "Session not found")
  const got = mustGet(incomingId)
  if (!("id" in got)) return got

  let session: CalibrationSession = got
  const fromState = session.state

  switch (event.type) {
    case "RESUME_SUBMIT": {
      const rawText = typeof (event as any).rawText === "string" ? String((event as any).rawText) : ""
      if (!meetsSignal(rawText)) return bad("RESUME_TOO_SHORT", "Resume text too short")
      session = {
        ...session,
        updatedAt: nowIso(),
        resume: { rawText, accepted: true, signals: session.resume.signals ?? null },
        state: "PROMPT_1",
      }
      break
    }

    case "PROMPT_ANSWER": {
      const n = Number((event as any).n) as 1 | 2 | 3 | 4 | 5
      const answer = typeof (event as any).answer === "string" ? String((event as any).answer) : ""
      if (!(n >= 1 && n <= 5)) return bad("BAD_EVENT", "Invalid prompt index")
      if (!meetsSignal(answer)) return bad("ANSWER_TOO_SHORT", "Answer too short")

      const idx = getPromptIndex(session.state)
      if (idx !== n) return bad("BAD_STATE", "Not expecting that prompt")

      const existing = session.prompts[n] ?? { answer: null, accepted: false, clarifier: null }
      session = {
        ...session,
        updatedAt: nowIso(),
        prompts: {
          ...session.prompts,
          [n]: { ...existing, answer, accepted: true },
        } as any,
        state: nextPromptAfter(n),
      }
      break
    }

    case "PROMPT_CLARIFIER": {
      const n = Number((event as any).n) as 1 | 2 | 3 | 4 | 5
      const answer = typeof (event as any).answer === "string" ? String((event as any).answer) : ""
      if (!(n >= 1 && n <= 5)) return bad("BAD_EVENT", "Invalid prompt index")
      if (!meetsSignal(answer)) return bad("ANSWER_TOO_SHORT", "Answer too short")

      if (session.state !== clarifierStateForIndex(n)) return bad("BAD_STATE", "Not expecting clarifier")

      const existing = session.prompts[n] ?? { answer: null, accepted: false, clarifier: null }
      session = {
        ...session,
        updatedAt: nowIso(),
        prompts: {
          ...session.prompts,
          [n]: { ...existing, clarifier: { answer, accepted: true } },
        } as any,
        state: nextPromptAfter(n),
      }
      break
    }

    case "PROMPT_NEED_CLARIFIER": {
      const n = Number((event as any).n) as 1 | 2 | 3 | 4 | 5
      if (!(n >= 1 && n <= 5)) return bad("BAD_EVENT", "Invalid prompt index")
      const idx = getPromptIndex(session.state)
      if (idx !== n) return bad("BAD_STATE", "Not expecting that prompt")
      session = {
        ...session,
        updatedAt: nowIso(),
        state: clarifierStateForIndex(n),
      }
      break
    }

    case "ENCODE_VECTOR": {
      const encoded = encodePersonVectorOnce(session)
      session = { ...encoded, updatedAt: nowIso() }
      break
    }

    case "CONSOLIDATE": {
      session = {
        ...session,
        updatedAt: nowIso(),
        state: "CONSOLIDATION_PENDING",
      }
      break
    }

    case "RUN_INGEST_JOB": {
      try {
        await ingestJob({ sessionId: session.id })
      } catch {
        // ignore
      }
      session = { ...session, updatedAt: nowIso() }
      break
    }

    case "RUN_INTEGRATION_SEAM": {
      try {
        await runIntegrationSeam({ sessionId: session.id })
      } catch {
        // ignore
      }
      session = { ...session, updatedAt: nowIso() }
      break
    }

    case "SET_MARKET_TITLE": {
      const marketTitle = typeof (event as any).marketTitle === "string" ? String((event as any).marketTitle).trim() : ""
      const titleExplanation =
        typeof (event as any).titleExplanation === "string" ? String((event as any).titleExplanation).trim() : ""
      if (marketTitle.length === 0 || titleExplanation.length === 0) return bad("BAD_EVENT", "Missing title fields")
      session = {
        ...session,
        updatedAt: nowIso(),
        synthesis: {
          ...(session.synthesis ?? ({} as any)),
          marketTitle,
          titleExplanation,
        },
      }
      break
    }

    case "SET_IDENTITY_SUMMARY": {
      const identitySummary = typeof (event as any).identitySummary === "string" ? String((event as any).identitySummary).trim() : ""
      if (identitySummary.length === 0) return bad("BAD_EVENT", "Missing identity summary")
      session = {
        ...session,
        updatedAt: nowIso(),
        synthesis: {
          ...(session.synthesis ?? ({} as any)),
          identitySummary,
        },
      }
      break
    }

    default:
      return bad("BAD_EVENT", "Unknown event")
  }

  const toState = session.state
  session = pushHistory(session, fromState, toState, event.type)

  session = await maybeFinalize(session)

  storeSet(session.id, session)
  return { ok: true, session }
}