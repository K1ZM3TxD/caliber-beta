import type { CalibrationEvent, CalibrationSession, CalibrationState, CalibrationError } from "@/lib/calibration_types";
import { storeGet, storeSet } from "@/lib/calibration_store";
import { ingestJob } from "@/lib/job_ingest";
import { runIntegrationSeam } from "@/lib/integration_seam";
import { toResultContract } from "@/lib/result_contract";
import { generateSemanticSynthesis } from "@/lib/semantic_synthesis";
import { extractLexicalAnchors } from "@/lib/anchor_extraction";
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts";
import { detectAbstractionDrift } from "./abstraction_drift";
export { validateAndRepairSynthesisOnce };

// Ops/program-oriented deterministic title bank (10 titles)
const TITLE_BANK: Array<string> = [
  "Program Operations Lead",
  "Technical Program Manager",
  "Operations Manager",
  "Program Manager",
  "Delivery Lead",
  "Business Operations Analyst",
  "Implementation Manager",
  "Process Improvement Lead",
  "Project Delivery Manager",
  "Strategic Operations Partner"
];

// Deterministic title candidate generator
function generateTitleCandidates(personVector: any, resumeText: string, promptAnswers?: string[]): Array<{ title: string; score: number }> {
  // Score by personVector dimension affinity and lexical bonuses
  // Each title gets a base score from affinity, plus lexical bonus from resume/prompts
  const dimAffinity: Record<string, number[]> = {
    "Program Operations Lead": [2,2,1,2,1,1],
    "Technical Program Manager": [2,1,2,2,1,1],
    "Operations Manager": [2,2,1,1,2,1],
    "Program Manager": [2,1,2,1,2,1],
    "Delivery Lead": [1,2,2,1,2,1],
    "Business Operations Analyst": [1,2,1,2,2,1],
    "Implementation Manager": [2,1,2,1,1,2],
    "Process Improvement Lead": [1,2,2,2,1,1],
    "Project Delivery Manager": [2,1,2,2,1,1],
    "Strategic Operations Partner": [2,2,1,1,1,2]
  };
  const vector = Array.isArray(personVector?.values) ? personVector.values : [1,1,1,1,1,1];
  // Lexical bonus terms
  const bonusTerms = ["program", "operations", "delivery", "process", "project", "implementation", "strategy", "improvement", "manager", "lead", "analyst", "partner"];
  const text = [resumeText, ...(promptAnswers ?? [])].join(" ").toLowerCase();
  return TITLE_BANK.map(title => {
    // Affinity score: +15 for each exact match dim, +7 for off-by-1, 0 otherwise
    let affinity = 0;
    const dims = dimAffinity[title];
    for (let i = 0; i < vector.length; i++) {
      if (vector[i] === dims[i]) affinity += 15;
      else if (Math.abs(vector[i] - dims[i]) === 1) affinity += 7;
    }
    // Lexical bonus: +5 for each bonus term present in text and title
    let lexical = 0;
    for (const term of bonusTerms) {
      if (title.toLowerCase().includes(term) && text.includes(term)) lexical += 5;
    }
    let score = affinity + lexical;
    score = Math.max(0, Math.min(100, Math.round(score)));
    return { title, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
import type { CalibrationEvent, CalibrationSession, CalibrationState, CalibrationError } from "@/lib/calibration_types"
import { storeGet, storeSet } from "@/lib/calibration_store"
import { ingestJob } from "@/lib/job_ingest"
import { runIntegrationSeam } from "@/lib/integration_seam"
import { toResultContract } from "@/lib/result_contract"
import { generateSemanticSynthesis } from "@/lib/semantic_synthesis"
import { extractLexicalAnchors } from "@/lib/anchor_extraction"
import { CALIBRATION_PROMPTS } from "@/lib/calibration_prompts"
import { detectAbstractionDrift } from "./abstraction_drift"
export { validateAndRepairSynthesisOnce };

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

// Deterministic "encoding" placeholder: stable per session based on already-collected text.
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
    const re = new RegExp(`\\b${w.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}\\b`, "gi")
    out = out.replace(re, "")
  }
  out = out.replace(/\s{2,}/g, " ").trim()
  out = out.replace(/\s+([.,!?;:])/g, "$1")
  return out
}

function normalizeWordToken(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/['']/g, "")
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
  { label: "system's", re: /\bsystem['']s\b/i },
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
  { from: /\bsystem['']s\b/gi, to: "workflow's" },
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
    0: "You don't just ship work — you set operating rules.",
    1: "You don't just take ownership — you define boundaries.",
    2: "You don't just hit targets — you protect measurement integrity.",
    3: "You don't just work across scope — you hold constraints.",
    4: "You don't just learn quickly — you choose one depth path.",
    5: "You don't just coordinate stakeholders — you set handoffs.",
  }
  const interventionByDim: Record<number, string> = {
    0: "When something isn't working, you don't force it — you tighten constraints.",
    1: "When something isn't working, you don't wait — you route the call.",
    2: "When something isn't working, you don't argue — you audit the measure.",
    3: "When something isn't working, you don't adapt silently — you reject drift.",
    4: "When something isn't working, you don't keep exploring — you pick one thread.",
    5: "When something isn't working, you don't reply to everyone — you set one handoff.",
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
    next = next.map((line, idx) => {
      if (idx === 2) return line
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

type ValidatorOutcome =
  | "PASS"
  | "REPAIR_APPLIED"
  | "RETRY_REQUIRED"
  | "FALLBACK_BLACKLIST_PHRASE"
  | "FALLBACK_UNREPAIRABLE"
  | "FALLBACK_STRUCTURE_INVALID"

function validateAndRepairSynthesisOnce(
  synthesisPatternSummary: string,
  personVector: PersonVector6,
  signals: ResumeSignals,
  opts?: { log?: boolean, anchorTerms?: string[] },
): { patternSummary: string; didRepair: boolean; outcome: ValidatorOutcome } {
  const shouldLog = Boolean(opts?.log)
  const anchorTerms = opts?.anchorTerms || []

  const primaryDim = primaryDimFromVector(personVector)

  const safeFallback = (): string => {
    const safe = buildSafeMinimalLines(primaryDim, signals)
    return joinSynthesisLines([safe[0], safe[1], safe[2]])
  }

  const finalize = (
    patternSummary: string,
    didRepair: boolean,
    outcome: ValidatorOutcome,
  ): { patternSummary: string; didRepair: boolean; outcome: ValidatorOutcome } => {
    if (typeof patternSummary !== "string" || patternSummary.trim().length === 0) {
      return { patternSummary: safeFallback(), didRepair: true, outcome: "FALLBACK_STRUCTURE_INVALID" }
    }
    return { patternSummary, didRepair, outcome }
  }

  if (typeof synthesisPatternSummary !== "string" || synthesisPatternSummary.trim().length === 0) {
    if (shouldLog) console.warn("[caliber] synthesis_source=fallback", { reason: "construction_invalid" })
    return finalize(safeFallback(), true, "FALLBACK_STRUCTURE_INVALID")
  }

  const baseLines = splitSynthesisLines(synthesisPatternSummary)
  if (baseLines.length < 3) {
    if (shouldLog) console.warn("[caliber] synthesis_source=fallback", { reason: "construction_invalid" })
    return finalize(safeFallback(), true, "FALLBACK_STRUCTURE_INVALID")
  }

  const findFirstBlacklistMatch = (inLines: string[]): { label: string; match: string } | null => {
    for (const line of inLines) {
      for (const t of BLACKLIST_TERMS) {
        const m = t.re.exec(line)
        if (m && typeof m[0] === "string" && m[0].trim().length > 0) {
          return { label: t.label, match: m[0] }
        }
      }
    }
    return null
  }

  let lines = baseLines.slice(0, 4)
  let didRepair = false

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

    if (!/^You\s+don['']t\s+just\s+/i.test(lines[0] ?? "")) {
      const safe = buildSafeMinimalLines(primaryDim, signals)
      lines = [safe[0], safe[1], safe[2]]
      didRepair = true
    }
    if (!/^When\s+something\s+isn['']t\s+working,/i.test(lines[1] ?? "")) {
      const safe = buildSafeMinimalLines(primaryDim, signals)
      lines = [safe[0], safe[1], safe[2]]
      didRepair = true
    }

    const hit = findFirstBlacklistMatch(lines)
    if (hit) {
      // Phrase-level hits are HARD-FAIL. (match contains whitespace)
      if (/\s/.test(hit.match)) {
        if (shouldLog) {
          console.warn("[caliber] synthesis_source=fallback", { reason: "blacklist_phrase_hit", hit: hit.match })
        }
        return finalize(safeFallback(), true, "FALLBACK_BLACKLIST_PHRASE")
      }
    }

    // --- Milestone 6.3: Anti-Abstraction Enforcement ---
    const joined = joinSynthesisLines(lines)
    const drift = detectAbstractionDrift({ text: joined, anchorTerms })
    const abstraction_flag = drift.abstraction_flag
    const praise_flag = drift.praise_flag
    const drift_terms = drift.drift_terms
    const abstraction_reason = drift.reason

    const anyBlacklist = Boolean(hit)
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

    // If abstraction drift detected, trigger retry if possible
    if (abstraction_flag && pass === 0) {
      if (shouldLog) console.log(`[caliber] validator_outcome=RETRY_REQUIRED abstraction_flag=true abstraction_reason=${abstraction_reason} drift_term_count=${drift_terms.length}`)
      // Inject retry directive for drift terms
      lines.push(`REMOVE DRIFT TERMS: ${drift_terms.join(", ")}`)
      return finalize(joinSynthesisLines(lines), didRepair, "RETRY_REQUIRED")
    }

    // If abstraction drift detected after retry, fallback
    if (abstraction_flag && pass === 1) {
      if (shouldLog) console.log(`[caliber] validator_outcome=FALLBACK_STRUCTURE_INVALID abstraction_flag=true abstraction_reason=${abstraction_reason} drift_term_count=${drift_terms.length} fallback_reason=ABSTRACTION_DRIFT`)
      return finalize(safeFallback(), true, "FALLBACK_STRUCTURE_INVALID")
    }

    if (!anyBlacklist && constructionOk && !repeatBad && !abstraction_flag) {
      const after = joinSynthesisLines(lines)
      if (after !== before) didRepair = true
      if (shouldLog) console.log(`[caliber] synthesis_source=llm abstraction_flag=false abstraction_reason=NONE drift_term_count=0 validator_outcome=PASS`)
      return finalize(after, didRepair, didRepair ? "REPAIR_APPLIED" : "PASS")
    }

    // First pass: never hard-fallback for retryable issues.
    if (pass === 0) {
      if (shouldLog) console.log(`[caliber] validator_outcome=RETRY_REQUIRED abstraction_flag=${abstraction_flag} abstraction_reason=${abstraction_reason} drift_term_count=${drift_terms.length}`)
      return finalize(joinSynthesisLines(lines), didRepair, "RETRY_REQUIRED")
    }

    // Second pass: fallback classification.
    if (pass === 1) {
      if (shouldLog) console.warn("[caliber] synthesis_source=fallback", { reason: "validator_failed_second_pass" })
      const outcome: ValidatorOutcome = anyBlacklist ? "FALLBACK_UNREPAIRABLE" : "FALLBACK_STRUCTURE_INVALID"
      return finalize(safeFallback(), true, outcome)
    }
  }

  if (shouldLog) console.warn("[caliber] synthesis_source=fallback", { reason: "construction_invalid" })
  return finalize(safeFallback(), true, "FALLBACK_STRUCTURE_INVALID")
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

const { classifyAnchors } = require("./signal_classification")
const tryOnce = async (): Promise<string | null> => {
  const promptAnswersText = promptAnswers.map(p => p.answer).join("\n")
  const anchors = extractLexicalAnchors({ resumeText, promptAnswersText })

  // Build AnchorOccurrence array for classification
  const anchorOccurrences = [];
  // Resume tokens
  for (const a of anchors.combined) {
    anchorOccurrences.push({
      term: a.term,
      source: "resume",
      context_type: "neutral"
    });
  }
  // Prompt tokens (simulate context, real extraction should provide context)
  for (let i = 1; i <= 5; i++) {
    const ans = session.prompts[i]?.answer;
    if (typeof ans === "string" && ans.trim().length > 0) {
      const tokens = ans.trim().split(/\s+/);
      for (const t of tokens) {
        anchorOccurrences.push({
          term: t.toLowerCase(),
          source: `q${i}`,
          context_type: "neutral"
        });
      }
    }
  }

  const anchorTerms = anchors.combined.map(a => a.term);
  const classification = classifyAnchors(anchorTerms, anchorOccurrences);
  const signalCount = classification.signalAnchors.length;
  const skillCount = classification.skillAnchors.length;

  const anchorsText = anchors.combined
    .slice(0, 12)
    .map(a => `${a.term}(${a.count})`)
    .join(", ");

  const semantic = await generateSemanticSynthesis({
    personVector: v,
    resumeText,
    promptAnswers,
    lexicalAnchorsText: anchorsText
  } as any);

  const lines: string[] = [
    String(semantic.identityContrast ?? "").trim(),
    String(semantic.interventionContrast ?? "").trim(),
    String(semantic.constructionLayer ?? "").trim(),
  ];

  if (coherenceStrong(v) && typeof semantic.consequenceDrop === "string" && semantic.consequenceDrop.trim().length > 0) {
    lines.push(semantic.consequenceDrop.trim());
  }

  const raw = joinSynthesisLines(lines);
  // Add minimal log for classification counts
  console.log(`[caliber] signal_anchor_count=${signalCount} skill_anchor_count=${skillCount}`);
  const repaired = validateAndRepairSynthesisOnce(raw, v, signals, { log: true });

  if (repaired.outcome === "RETRY_REQUIRED") return null;
  return repaired.patternSummary;
}

try {
  const out1 = await tryOnce()
  if (out1) return out1
} catch {
  // retry once below
}

try {
  const out2 = await tryOnce()
  if (out2) return out2
} catch {
  // fall through
}

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

  const identityContrast = `You don't just ${id.x} — you ${id.y}.`
  const interventionContrast = `When something isn't working, you don't ${iv.a} — you ${iv.b}.`
  const constructionLayer = `You ${verbs[0]}, ${verbs[1]}, and ${verbs[2]}.`

  let consequenceDrop: string | null = null
  if (coherenceStrong(v)) {
    const consequenceByDim: Record<number, string> = {
      0: "You change the system's cadence.",
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

  const repaired = validateAndRepairSynthesisOnce(patternSummary, v, session.resume.signals as ResumeSignals, { log: false })
  patternSummary = repaired.patternSummary

  // Keep "Operate Best" + "Lose Energy" below, structural, no praise.
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

  const primaryDim2 = primaryDimFromVector(v)
  const opDims = highDims.length > 0 ? highDims : [primaryDim2]
  for (const d of opDims.slice(0, 3)) operateBest.push(operateBestByDim[d] ?? operateFallback[0])

  const leDims = lowDims.length > 0 ? lowDims : [primaryDim2]
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
  return `sess_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function makeDefaultPrompt(question: string): any {
  return {
    question,
    answer: null,
    accepted: false,
    frozen: false,
    clarifier: {
      asked: false,
      question: null,
      answer: null,
    },
  }
}

function createSession(): CalibrationSession {
  const sessionId = newSessionId()
  const session: CalibrationSession = {
    sessionId,
    state: "RESUME_INGEST",
    resume: {
      rawText: "",
      signals: null,
    },
    prompts: {
      1: makeDefaultPrompt(CALIBRATION_PROMPTS[1]),
      2: makeDefaultPrompt(CALIBRATION_PROMPTS[2]),
      3: makeDefaultPrompt(CALIBRATION_PROMPTS[3]),
      4: makeDefaultPrompt(CALIBRATION_PROMPTS[4]),
      5: makeDefaultPrompt(CALIBRATION_PROMPTS[5]),
    },
    personVector: { values: null, locked: false },
    encodingRitual: { completed: false },
    consolidationRitual: {
      startedAtIso: null,
      lastTickAtIso: null,
      progressPct: 0,
      step: 0,
      message: null,
      completed: false,
    },
    synthesis: undefined,
    job: { rawText: "", roleVector: null, completed: false },
    result: null,
    history: [],
  }
  storeSet(session)
  return session
}

// Strict allowlist: current_state -> allowed event types.
// (CREATE_SESSION is handled before session lookup.)
const ALLOWLIST: Record<CalibrationState, ReadonlyArray<CalibrationEvent["type"]>> = {
  RESUME_INGEST: ["SUBMIT_RESUME", "ADVANCE"],
  PROMPT_1: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_1_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_2: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_2_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_3: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_3_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_4: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_4_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  PROMPT_5: ["SUBMIT_PROMPT_ANSWER"],
  PROMPT_5_CLARIFIER: ["SUBMIT_PROMPT_CLARIFIER_ANSWER"],
  CONSOLIDATION_PENDING: ["ADVANCE"],
  CONSOLIDATION_RITUAL: ["ADVANCE"],
  ENCODING_RITUAL: ["ADVANCE"],
  PATTERN_SYNTHESIS: ["ADVANCE"],
  TITLE_HYPOTHESIS: ["ADVANCE", "TITLE_FEEDBACK"],
  TITLE_DIALOGUE: ["ADVANCE", "TITLE_FEEDBACK", "SUBMIT_JOB_TEXT"],
  JOB_INGEST: ["ADVANCE", "SUBMIT_JOB_TEXT", "COMPUTE_ALIGNMENT_OUTPUT"],
  ALIGNMENT_OUTPUT: ["ADVANCE", "COMPUTE_ALIGNMENT_OUTPUT", "SUBMIT_JOB_TEXT"],
  TERMINAL_COMPLETE: ["SUBMIT_JOB_TEXT", "COMPUTE_ALIGNMENT_OUTPUT"],
  PROCESSING: [],
  ERROR: [],
}

function ensureAllowed(session: CalibrationSession, eventType: CalibrationEvent["type"]): Err | null {
  const allowed = ALLOWLIST[session.state] ?? []
  if (!allowed.includes(eventType)) {
    return bad("INVALID_EVENT_FOR_STATE", `Event ${eventType} not allowed in state ${session.state}`)
  }
  return null
}

/**
 * Milestone 5.1 rule:
 * - Each dispatch may advance at most one state.
 * - No dead-end holds; UI can deterministically render from snapshot.
 */
export async function dispatchCalibrationEvent(event: CalibrationEvent): Promise<DispatchResult> {
  try {
    if (!event || typeof event !== "object" || typeof (event as any).type !== "string") {
      return bad("MISSING_REQUIRED_FIELD", "Missing event.type")
    }

    if (event.type === "CREATE_SESSION") {
      const session = createSession()
      return { ok: true, session }
    }

    const sessionId = (event as any).sessionId
    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return bad("MISSING_REQUIRED_FIELD", "Missing sessionId")
    }

    const got = mustGet(sessionId)
    if ((got as any).ok === false) return got as Err
    let session = got as CalibrationSession

    // Special: allow SUBMIT_JOB_TEXT from TITLE_HYPOTHESIS by auto-advancing
    if (event.type === "SUBMIT_JOB_TEXT" && session.state === "TITLE_HYPOTHESIS") {
      let attempts = 0;
      let autoSession = session;
      while (autoSession.state === "TITLE_HYPOTHESIS" && attempts < 6) {
        // Apply ADVANCE event
        const advRes = await dispatchCalibrationEvent({ type: "ADVANCE", sessionId: autoSession.sessionId } as any);
        if (!advRes.ok) {
          return bad("AUTO_ADVANCE_FAILED", `Failed to auto-advance from TITLE_HYPOTHESIS after ${attempts} attempts: ${advRes.error?.message ?? advRes.error}`);
        }
        autoSession = advRes.session;
        attempts++;
      }
      if (autoSession.state === "TITLE_HYPOTHESIS") {
        return bad(
          "AUTO_ADVANCE_FAILED",
          `Could not leave TITLE_HYPOTHESIS after ${attempts} attempts (state=${autoSession.state}, attempts=${attempts})`
        );
      }
      // Now apply SUBMIT_JOB_TEXT to the advanced session
      session = autoSession;
    }

    const allowErr = ensureAllowed(session, event.type);
    if (allowErr) return allowErr;

    const from = session.state;

    switch (event.type) {
      case "SUBMIT_RESUME": {
        const resumeText = (event as any).resumeText
        if (typeof resumeText !== "string" || resumeText.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "resumeText must be a non-empty string")
        }

        const text = resumeText.trim()
        const hasBullets = /(^|\n)\s*[-*•]\s+/.test(text)
        const hasDates = /\b(19|20)\d{2}\b/.test(text)
        const hasTitles = /\b(Engineer|Manager|Director|VP|President|Lead|Head|Founder|Analyst|Consultant)\b/i.test(text)

        session = {
          ...session,
          resume: {
            rawText: text,
            signals: {
              charLen: text.length,
              hasBullets,
              hasDates,
              hasTitles,
            },
          },
        }

        // Deterministic: remain in RESUME_INGEST; UI (or user) triggers ADVANCE explicitly.
        storeSet(session)
        return { ok: true, session }
      }

      case "ADVANCE": {
        if (session.state === "RESUME_INGEST") {
          if (!session.resume.rawText || session.resume.rawText.trim().length === 0)
            return bad("MISSING_REQUIRED_FIELD", "Resume must be submitted before advancing")
          const to: CalibrationState = "PROMPT_1"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "CONSOLIDATION_PENDING") {
          if (!promptsComplete1to5(session)) {
            return bad("RITUAL_NOT_READY", "Prompts 1–5 must be completed before consolidation ritual")
          }

          const to: CalibrationState = "CONSOLIDATION_RITUAL"
          const ritual = {
            startedAtIso: nowIso(),
            lastTickAtIso: nowIso(),
            progressPct: 0,
            step: 0,
            message: "Initializing consolidation…",
            completed: false,
          }

          session = pushHistory(
            {
              ...session,
              state: to,
              consolidationRitual: ritual,
            },
            from,
            to,
            event.type,
          )
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "CONSOLIDATION_RITUAL") {
          const r = session.consolidationRitual;
          if (!r) return bad("INTERNAL", "Missing consolidationRitual");

          // Deterministic: always advance step/progressPct by 1 per ADVANCE call
          const stepAdvance = 1;
          const nextStep = (r.step ?? 0) + stepAdvance;
          const nextPct = clampPct(r.progressPct + stepAdvance * 20);

          const messages = [
            "Consolidating signal…",
            "Encoding structural traits…",
            "Normalizing constraints…",
            "Locking person-vector…",
            "Preparing synthesis…",
          ];

          const nextMessage = messages[Math.min(nextStep, messages.length - 1)] ?? "Working…";

          const nextRitual = {
            ...r,
            startedAtIso: r.startedAtIso ?? nowIso(),
            lastTickAtIso: nowIso(), // still updated for observability
            step: nextStep,
            progressPct: nextPct,
            message: nextMessage,
            completed: nextPct >= 100,
          };

          // If not complete, remain in CONSOLIDATION_RITUAL (no state change).
          if (!nextRitual.completed) {
            session = { ...session, consolidationRitual: nextRitual };
            storeSet(session);
            return { ok: true, session };
          }

          // Ritual completes -> move to ENCODING_RITUAL (externally visible).
          const to: CalibrationState = "ENCODING_RITUAL";
          let next: CalibrationSession = {
            ...session,
            state: to,
            consolidationRitual: nextRitual,
            encodingRitual: { completed: false },
          };
          next = pushHistory(next, from, to, event.type);
          storeSet(next);
          return { ok: true, session: next };
        }

        if (session.state === "ENCODING_RITUAL") {
          // Single visible step: ENCODING_RITUAL -> PATTERN_SYNTHESIS.
          // Do encoding + synthesis exactly once, then transition ONE state.
          let next = encodePersonVectorOnce(session)
          next = await synthesizeOnce(next)

          const to: CalibrationState = "PATTERN_SYNTHESIS"
          next = pushHistory({ ...next, state: to }, from, to, event.type)
          storeSet(next)
          return { ok: true, session: next }
        }

        if (session.state === "PATTERN_SYNTHESIS") {
          // Restore deterministic title candidate generation
          let candidates: Array<{ title: string; score: number }> | undefined = undefined;
          if (!session.synthesis?.titleCandidates || session.synthesis.titleCandidates.length === 0) {
            // Gather prompt answers
            const promptAnswers = [];
            for (let i = 1; i <= 5; i++) {
              const ans = session.prompts?.[i]?.answer;
              if (typeof ans === "string" && ans.length > 0) promptAnswers.push(ans);
            }
            candidates = generateTitleCandidates(session.personVector, session.resume?.rawText ?? "", promptAnswers);
          } else {
            candidates = session.synthesis.titleCandidates;
          }
          // Always set marketTitle and titleExplanation for backward compatibility
          const marketTitle = candidates[0]?.title ?? "";
          const titleExplanation = "Top-ranked title based on your pattern profile.";
          session = {
            ...session,
            synthesis: {
              patternSummary: session.synthesis?.patternSummary ?? null,
              operateBest: session.synthesis?.operateBest ?? null,
              loseEnergy: session.synthesis?.loseEnergy ?? null,
              identitySummary: session.synthesis?.identitySummary ?? null,
              marketTitle,
              titleExplanation,
              lastTitleFeedback: session.synthesis?.lastTitleFeedback ?? null,
              titleCandidates: candidates,
              anchor_overlap_score: session.synthesis?.anchor_overlap_score,
              missing_anchor_count: session.synthesis?.missing_anchor_count,
              missing_anchor_terms: session.synthesis?.missing_anchor_terms,
            },
          };
          const to: CalibrationState = "TITLE_HYPOTHESIS";
          session = pushHistory({ ...session, state: to }, from, to, event.type);
          storeSet(session);
          return { ok: true, session };
        }

        if (session.state === "TITLE_HYPOTHESIS") {
          const to: CalibrationState = "TITLE_DIALOGUE"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "TITLE_DIALOGUE" || session.state === "JOB_INGEST") {
          const job = session.job;
          if (!job || !job.completed || !job.roleVector || !session.personVector.values) {
            return bad("JOB_REQUIRED", "Submit a job description before advancing")
          }
          // Only transition to ALIGNMENT_OUTPUT if result is not present
          if (!session.result || session.result?.alignment?.score == null) {
            const to: CalibrationState = "ALIGNMENT_OUTPUT"
            session = pushHistory({ ...session, state: to }, from, to, event.type)
            storeSet(session)
            return { ok: true, session }
          } else {
            // If result is present, go directly to TERMINAL_COMPLETE
            const to: CalibrationState = "TERMINAL_COMPLETE"
            session = pushHistory({ ...session, state: to }, from, to, event.type)
            storeSet(session)
            return { ok: true, session }
          }
        }

        return bad("INVALID_EVENT_FOR_STATE", `ADVANCE not supported in state ${session.state}`)
      }

      case "SUBMIT_PROMPT_ANSWER": {
        const idx = getPromptIndex(session.state)
        if (!idx) return bad("INVALID_EVENT_FOR_STATE", `Not in a prompt state: ${session.state}`)

        const slot = session.prompts[idx]
        if (slot.frozen) return bad("PROMPT_FROZEN", `Prompt ${idx} is frozen`)

        const answer = (event as any).answer
        if (typeof answer !== "string" || answer.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "answer must be a non-empty string")
        }

        const trimmed = answer.trim()

        // Signal gate: if weak and clarifier not yet used, move to clarifier state (visible) WITHOUT accepting.
        if (!meetsSignal(trimmed) && !slot.clarifier?.asked) {
          const to = clarifierStateForIndex(idx)
          const clarifierQ = "Please add concrete structural detail: scope, constraints, decisions, and measurable outcomes."

          const nextSlot = {
            ...slot,
            clarifier: {
              asked: true,
              question: clarifierQ,
              answer: null,
            },
          }

          session = {
            ...session,
            prompts: { ...session.prompts, [idx]: nextSlot } as any,
          }
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        // Accept and advance exactly one state.
        const nextSlot = {
          ...slot,
          answer: trimmed,
          accepted: true,
          frozen: true,
        }

        const to = nextPromptAfter(idx)
        session = {
          ...session,
          prompts: { ...session.prompts, [idx]: nextSlot } as any,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "SUBMIT_PROMPT_CLARIFIER_ANSWER": {
        const idx = getPromptIndex(session.state)
        if (!idx) return bad("INVALID_EVENT_FOR_STATE", `Not in a prompt clarifier state: ${session.state}`)
        if (session.state !== clarifierStateForIndex(idx)) {
          return bad("INVALID_EVENT_FOR_STATE", `Not in correct clarifier state for prompt ${idx}`)
        }

        const slot = session.prompts[idx]
        if (slot.frozen) return bad("PROMPT_FROZEN", `Prompt ${idx} is frozen`)

        const answer = (event as any).answer
        if (typeof answer !== "string" || answer.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "answer must be a non-empty string")
        }

        const trimmed = answer.trim()

        // If still insufficient after clarifier, fail deterministically (no silent acceptance).
        if (!meetsSignal(trimmed)) {
          return bad("INSUFFICIENT_SIGNAL_AFTER_CLARIFIER", "Answer still too short after clarifier; add more structural detail")
        }

        const nextSlot = {
          ...slot,
          answer: trimmed,
          accepted: true,
          frozen: true,
          clarifier: {
            ...slot.clarifier,
            answer: trimmed,
          },
        }

        const to = nextPromptAfter(idx)
        session = {
          ...session,
          prompts: { ...session.prompts, [idx]: nextSlot } as any,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "TITLE_FEEDBACK": {
        let feedback = (event as any).feedback;
        if (typeof feedback !== "string") feedback = "";
        session = {
          ...session,
          synthesis: {
            ...(session.synthesis ?? {
              patternSummary: null,
              operateBest: null,
              loseEnergy: null,
              identitySummary: null,
              marketTitle: null,
              titleExplanation: null,
              lastTitleFeedback: null,
            }),
            lastTitleFeedback: feedback,
          },
        };
        storeSet(session);
        return { ok: true, session };
      }

      case "SUBMIT_JOB_TEXT": {
        const jobText = (event as any).jobText
        if (typeof jobText !== "string" || jobText.trim().length === 0) {
          return bad("MISSING_REQUIRED_FIELD", "jobText must be a non-empty string")
        }
        if (!session.personVector.values || !session.personVector.locked) {
          return bad("JOB_ENCODING_INCOMPLETE", "Person vector must be encoded before job ingest")
        }

        let roleVector: any = null
        try {
          const ingest = ingestJob(jobText.trim())
          roleVector = ingest.roleVector as any
        } catch (e: any) {
          return bad("BAD_REQUEST", String(e?.detail ?? e?.message ?? "Invalid job text"))
        }

        const to: CalibrationState = "JOB_INGEST"
        session = {
          ...session,
          job: { rawText: jobText.trim(), roleVector, completed: true },
          result: null,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "COMPUTE_ALIGNMENT_OUTPUT": {
        if (session.state !== "ALIGNMENT_OUTPUT") {
          return bad("INVALID_EVENT_FOR_STATE", `Event ${event.type} not allowed in state ${session.state}`)
        }
        const job = session.job;
        if (!job || !job.completed || !job.rawText || job.rawText.trim().length === 0)
          return bad("JOB_REQUIRED", "Submit a job description first")
        if (!session.personVector.values) return bad("JOB_ENCODING_INCOMPLETE", "Missing person vector")

        const seam = runIntegrationSeam({
          jobText: job.rawText,
          experienceVector: session.personVector.values as any,
        })

        if (!seam.ok) {
          return bad("BAD_REQUEST", seam.error.message)
        }

        const contract = toResultContract({
          alignment: seam.result.alignment,
          skillMatch: seam.result.skillMatch,
          stretchLoad: seam.result.stretchLoad,
        })

        const to: CalibrationState = "TERMINAL_COMPLETE"
        session = {
          ...session,
          result: contract,
        }
        session = pushHistory({ ...session, state: to }, from, to, event.type)
        storeSet(session)
        return { ok: true, session }
      }

      case "ENCODING_COMPLETE": {
        // Kept for compatibility; encoding is now guarded + run as part of ENCODING_RITUAL ADVANCE.
        return bad("INVALID_EVENT_FOR_STATE", "ENCODING_COMPLETE is not a public event in v1 flow")
      }

      default:
        return bad("BAD_REQUEST", `Unknown event type: ${(event as any).type}`)
    }
  } catch (e: any) {
    return bad("INTERNAL", String(e?.message ?? "Unexpected error"))
  }
}