





import type { CalibrationEvent, CalibrationSession, CalibrationState, CalibrationError } from "./calibration_types.js"
import { storeGet, storeSet } from "./calibration_store.js"
import { ingestJob, isJobIngestError } from "./job_ingest.js"
import { runIntegrationSeam, formatIncompleteCoverageMessage, DIMENSION_LABELS } from "./integration_seam.js"
import { toResultContract, extractSignalAnchors, generateSuggestedTitles } from "./result_contract.js"
import { generateSemanticSynthesis, SEMANTIC_SYNTHESIS_BLACKLIST_TOKENS } from "./semantic_synthesis.js"
import { extractLexicalAnchors } from "./anchor_extraction.js"
import { CALIBRATION_PROMPTS } from "./calibration_prompts.js"
import { formatOperateBestLogLine, validateOperateBestBullets } from "./operate_best_validator.js"

// Core logic extracted for pass control
function validateAndRepairSynthesisOnceCore(
  synthesisPatternSummary: string,
  personVector: PersonVector6,
  signals: ResumeSignals,
  opts: { log?: boolean } | undefined,
  pass: number
): { patternSummary: string; didRepair: boolean; outcome: ValidatorOutcome } {
  const shouldLog = Boolean(opts?.log)

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
    return null;
  }

  let lines = baseLines.slice(0, 4)
  let didRepair = false

  let outcome: ValidatorOutcome = "PASS";
  const before = joinSynthesisLines(lines)

  lines = lines.map((l) => stripPraiseAdjectives(l))
  lines = lines.map((l) => applyDeterministicTermReplacements(l))

  if (!isValidConstructionLine(lines[2] ?? "")) {
    lines[2] = rewriteConstructionLine(primaryDim)
    didRepair = true
  }

  lines = enforceConsequenceGate(lines)
  lines = enforceRepetitionControl(lines, primaryDim, signals)

  // Cadence starter checks (deferred safe-line replacement to pass 1)
  const starter0 = /^You\s+don['']t\s+just\s+/i.test(lines[0] ?? "")
  const starter1 = /^When\s+something\s+isn['']t\s+working,/i.test(lines[1] ?? "")

  if (!starter0 || !starter1) {
    if (pass === 0) {
      outcome = "RETRY_REQUIRED";
      if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=${didRepair}`);
      // On pass 0, return the original input (minimally normalized), not safe minimal lines
      return { patternSummary: synthesisPatternSummary, didRepair: false, outcome };
    } else {
      const safe = buildSafeMinimalLines(primaryDim, signals)
      lines = [safe[0], safe[1], safe[2]]
      didRepair = true
      outcome = "FALLBACK_STRUCTURE_INVALID";
      if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=true`);
      return finalize(joinSynthesisLines(lines), true, outcome)
    }
  }

  const hit = findFirstBlacklistMatch(lines)
  if (hit) {
    // Phrase-level hits are HARD-FAIL. (match contains whitespace)
    if (/\s/.test(hit.match)) {
      outcome = "FALLBACK_BLACKLIST_PHRASE";
      if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=true`);
      return finalize(safeFallback(), true, outcome);
    }
  }

  const anyBlacklist = Boolean(hit)
  const constructionOk = isValidConstructionLine(lines[2] ?? "")

  const contentWords = collectContentWords(lines)
  const counts = new Map<string, number>()
  // Core logic extracted for pass control
  function validateAndRepairSynthesisOnceCore(
    synthesisPatternSummary: string,
    personVector: PersonVector6,
    signals: ResumeSignals,
    opts: { log?: boolean } | undefined,
    pass: number
  ): { patternSummary: string; didRepair: boolean; outcome: ValidatorOutcome } {
    const shouldLog = Boolean(opts?.log)
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
      return null;
    }
    let lines = baseLines.slice(0, 4)
    let didRepair = false
    let outcome: ValidatorOutcome = "PASS";
    const before = joinSynthesisLines(lines)
    lines = lines.map((l) => stripPraiseAdjectives(l))
    lines = lines.map((l) => applyDeterministicTermReplacements(l))
    if (!isValidConstructionLine(lines[2] ?? "")) {
      lines[2] = rewriteConstructionLine(primaryDim)
      didRepair = true
    }
    lines = enforceConsequenceGate(lines)
    lines = enforceRepetitionControl(lines, primaryDim, signals)
    // Cadence starter checks (deferred safe-line replacement to pass 1)
    const starter0 = /^You\s+don['']t\s+just\s+/i.test(lines[0] ?? "")
    const starter1 = /^When\s+something\s+isn['']t\s+working,/i.test(lines[1] ?? "")
    if (!starter0 || !starter1) {
      if (pass === 0) {
        outcome = "RETRY_REQUIRED";
        if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=${didRepair}`);
        // On pass 0, return the original input (minimally normalized), not safe minimal lines
        return { patternSummary: synthesisPatternSummary, didRepair: false, outcome };
      } else {
        const safe = buildSafeMinimalLines(primaryDim, signals)
        lines = [safe[0], safe[1], safe[2]]
        didRepair = true
        outcome = "FALLBACK_STRUCTURE_INVALID";
        if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=true`);
        return finalize(joinSynthesisLines(lines), true, outcome)
      }
    }
    const hit = findFirstBlacklistMatch(lines)
    if (hit) {
      // Phrase-level hits are HARD-FAIL. (match contains whitespace)
      if (/\s/.test(hit.match)) {
        outcome = "FALLBACK_BLACKLIST_PHRASE";
        if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=true`);
        return finalize(safeFallback(), true, outcome);
      }
    }
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
    if (!anyBlacklist && constructionOk && !repeatBad) {
      const after = joinSynthesisLines(lines)
      if (after !== before) didRepair = true
      outcome = didRepair ? "REPAIR_APPLIED" : "PASS";
      if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=${didRepair}`);
      return finalize(after, didRepair, outcome)
    }
    // First pass: never hard-fallback for retryable issues except cadence (handled above)
    if (pass === 0) {
      outcome = "RETRY_REQUIRED";
      if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=${didRepair}`);
      return finalize(joinSynthesisLines(lines), didRepair, outcome)
    }
    // Second pass: fallback classification.
    if (pass === 1) {
      if (anyBlacklist) {
        outcome = "FALLBACK_ANCHOR_FAILURE";
      } else {
        outcome = "FALLBACK_STRUCTURE_INVALID";
      }
      if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=true`);
      return finalize(safeFallback(), true, outcome);
    }
    if (shouldLog) console.warn("[caliber] synthesis_source=fallback", { reason: "construction_invalid" })

    return finalize(safeFallback(), true, "FALLBACK_STRUCTURE_INVALID");
}


// Exported wrapper
function validateAndRepairSynthesisOnce(
  synthesisPatternSummary: string,
  personVector: PersonVector6,
  signals: ResumeSignals,
  opts?: { log?: boolean, pass?: number },
): { patternSummary: string; didRepair: boolean; outcome: ValidatorOutcome } {
  if (typeof opts?.pass === 'number') {
    // Deterministic single-pass mode for testing
    const pass = opts.pass;
    return validateAndRepairSynthesisOnceCore(synthesisPatternSummary, personVector, signals, opts, pass);
  } else {
    // Default: run both passes, return on first terminal outcome
    for (let pass = 0; pass < 2; pass += 1) {
      const result = validateAndRepairSynthesisOnceCore(synthesisPatternSummary, personVector, signals, opts, pass);
      // If terminal outcome, return
      if (result.outcome !== 'RETRY_REQUIRED') return result;
    }
    // If both passes return RETRY_REQUIRED, fallback
    return validateAndRepairSynthesisOnceCore(synthesisPatternSummary, personVector, signals, opts, 1);
  }
}



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
  | "FALLBACK_ANCHOR_FAILURE"
  | "FALLBACK_STRUCTURE_INVALID"
  | "FALLBACK_BLACKLIST_PHRASE"


  // First pass: never hard-fallback for retryable issues except cadence (handled above)
  if (pass === 0) {
    outcome = "RETRY_REQUIRED";
    if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=${didRepair}`);
    return finalize(joinSynthesisLines(lines), didRepair, outcome)
  }

  // Second pass: fallback classification.
  if (pass === 1) {
    if (anyBlacklist) {
      outcome = "FALLBACK_ANCHOR_FAILURE";
    } else {
      outcome = "FALLBACK_STRUCTURE_INVALID";
    }
    if (shouldLog) console.log(`[caliber] validator_outcome=${outcome} did_repair=true`);
    return finalize(safeFallback(), true, outcome);
  }
  if (shouldLog) console.warn("[caliber] synthesis_source=fallback", { reason: "construction_invalid" })
  return finalize(safeFallback(), true, "FALLBACK_STRUCTURE_INVALID")
}

async function buildSemanticPatternSummary(session: CalibrationSession, v: PersonVector6): Promise<{ patternSummary: string; anchor_overlap_score: number; missing_anchor_count: number; missing_anchor_terms: string[] }> {
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

let fallbackMetrics = { anchor_overlap_score: 0, missing_anchor_count: 0, missing_anchor_terms: [] as string[] }

const tryOnce = async (): Promise<{ patternSummary: string; anchor_overlap_score: number; missing_anchor_count: number; missing_anchor_terms: string[] } | null> => {
  const promptAnswersText = promptAnswers.map(p => p.answer).join("\n")
  const anchors = extractLexicalAnchors({ resumeText, promptAnswersText })

  const anchorsText = anchors.combined
    .slice(0, 12)
    .map(a => `${a.term}(${a.count})`)
    .join(", ")

  const semantic = await generateSemanticSynthesis({
    personVector: v,
    resumeText,
    promptAnswers,
    lexicalAnchorsText: anchorsText
  } as any)

  const { anchor_overlap_score, missing_anchor_count, missing_anchor_terms } = semantic
  fallbackMetrics = { anchor_overlap_score, missing_anchor_count, missing_anchor_terms }

  const lines: string[] = [
    String(semantic.identityContrast ?? "").trim(),
    String(semantic.interventionContrast ?? "").trim(),
    String(semantic.constructionLayer ?? "").trim(),
  ]

  if (coherenceStrong(v) && typeof semantic.consequenceDrop === "string" && semantic.consequenceDrop.trim().length > 0) {
    lines.push(semantic.consequenceDrop.trim())
  }

  const raw = joinSynthesisLines(lines)
  const repaired = validateAndRepairSynthesisOnce(raw, v, signals, { log: true })

  if (repaired.outcome === "RETRY_REQUIRED") return null
  return { patternSummary: repaired.patternSummary, anchor_overlap_score, missing_anchor_count, missing_anchor_terms }
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
  return { patternSummary: joinSynthesisLines([safe[0], safe[1], safe[2]]), ...fallbackMetrics }
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
  let synthesis_source: "llm" | "fallback" = "llm"
  let anchor_overlap_score = 0
  let missing_anchor_count = 0
  let missing_anchor_terms: string[] = []
  try {
    const built = await buildSemanticPatternSummary(session, v)
    patternSummary = built.patternSummary
    anchor_overlap_score = built.anchor_overlap_score
    missing_anchor_count = built.missing_anchor_count
    missing_anchor_terms = built.missing_anchor_terms
  } catch {
    patternSummary = buildDeterministicPatternSummary(v)
    synthesis_source = "fallback"
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

  const promptAnswersText = [1, 2, 3, 4, 5]
    .map((i) => {
      const slot = session.prompts[i as 1 | 2 | 3 | 4 | 5]
      if (typeof slot?.answer === "string" && slot.answer.trim().length > 0) return slot.answer.trim()
      if (typeof slot?.clarifier?.answer === "string" && slot.clarifier.answer.trim().length > 0) return slot.clarifier.answer.trim()
      return ""
    })
    .filter(Boolean)
    .join("\n")

  const resumeText = typeof session.resume.rawText === "string" ? session.resume.rawText : ""
  const anchorTerms = extractLexicalAnchors({ resumeText, promptAnswersText }).combined.slice(0, 24).map((x) => x.term)

  const operateBestValidation = validateOperateBestBullets(
    operateBest,
    anchorTerms,
    SEMANTIC_SYNTHESIS_BLACKLIST_TOKENS,
  )
  console.log(formatOperateBestLogLine({ ...operateBestValidation, synthesis_source }))

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
      suggestedTitles: session.synthesis?.suggestedTitles ?? null,
      anchor_overlap_score,
      missing_anchor_count,
      missing_anchor_terms,
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
      rawText: null,
      completed: false,
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
    synthesis: null,
    job: { rawText: null, roleVector: null, completed: false },
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

    const allowErr = ensureAllowed(session, event.type)
    if (allowErr) return allowErr

    const from = session.state

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
            completed: true,
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
          if (!session.resume.completed) return bad("MISSING_REQUIRED_FIELD", "Resume must be submitted before advancing")
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
          const r = session.consolidationRitual
          const lastTick = r.lastTickAtIso ? new Date(r.lastTickAtIso).getTime() : 0
          const now = Date.now()
          const deltaMs = now - lastTick

          const stepAdvance = deltaMs >= 450 ? 1 : 0
          const nextStep = r.step + stepAdvance
          const nextPct = clampPct(r.progressPct + stepAdvance * 20)

          const messages = [
            "Consolidating signal…",
            "Encoding structural traits…",
            "Normalizing constraints…",
            "Locking person-vector…",
            "Preparing synthesis…",
          ]

          const nextMessage = messages[Math.min(nextStep, messages.length - 1)] ?? "Working…"

          const nextRitual = {
            ...r,
            startedAtIso: r.startedAtIso ?? nowIso(),
            lastTickAtIso: nowIso(),
            step: nextStep,
            progressPct: nextPct,
            message: nextMessage,
            completed: nextPct >= 100,
          }

          // If not complete, remain in CONSOLIDATION_RITUAL (no state change).
          if (!nextRitual.completed) {
            session = { ...session, consolidationRitual: nextRitual }
            storeSet(session)
            return { ok: true, session }
          }

          // Ritual completes -> move to ENCODING_RITUAL (externally visible).
          const to: CalibrationState = "ENCODING_RITUAL"
          let next: CalibrationSession = {
            ...session,
            state: to,
            consolidationRitual: nextRitual,
            encodingRitual: { completed: false },
          }
          next = pushHistory(next, from, to, event.type)
          storeSet(next)
          return { ok: true, session: next }
        }

        if (session.state === "ENCODING_RITUAL") {
          // Single visible step: ENCODING_RITUAL -> PATTERN_SYNTHESIS.
          // Do encoding exactly once, then transition ONE state.
          // NOTE: Semantic synthesis is FROZEN for Calibration Core First milestone.
          // We skip synthesizeOnce() — no narrative pattern summary is computed.
          let next = encodePersonVectorOnce(session)
          // FROZEN: next = await synthesizeOnce(next)

          const to: CalibrationState = "PATTERN_SYNTHESIS"
          next = pushHistory({ ...next, state: to }, from, to, event.type)
          storeSet(next)
          return { ok: true, session: next }
        }

        if (session.state === "PATTERN_SYNTHESIS") {
          const to: CalibrationState = "TITLE_HYPOTHESIS"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "TITLE_HYPOTHESIS") {
          // Compute suggested titles from signal anchors
          const resumeText = session.resume.rawText ?? ""
          const promptAnswers: Record<1 | 2 | 3 | 4 | 5, string> = {
            1: session.prompts[1]?.answer ?? "",
            2: session.prompts[2]?.answer ?? "",
            3: session.prompts[3]?.answer ?? "",
            4: session.prompts[4]?.answer ?? "",
            5: session.prompts[5]?.answer ?? "",
          }
          const signalAnchors = extractSignalAnchors({ resumeText, promptAnswers })
          const suggestedTitles = generateSuggestedTitles(signalAnchors)
          
          const to: CalibrationState = "TITLE_DIALOGUE"
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
                suggestedTitles: null,
              }),
              suggestedTitles,
            },
          }
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
        }

        if (session.state === "TITLE_DIALOGUE" || session.state === "JOB_INGEST") {
          if (!session.job.completed || !session.job.roleVector || !session.personVector.values) {
            return bad("JOB_REQUIRED", "Submit a job description before advancing")
          }
          const to: CalibrationState = "ALIGNMENT_OUTPUT"
          session = pushHistory({ ...session, state: to }, from, to, event.type)
          storeSet(session)
          return { ok: true, session }
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
        if (!meetsSignal(trimmed) && !slot.clarifier.asked) {
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
        const feedback = (event as any).feedback
        if (typeof feedback !== "string") return bad("MISSING_REQUIRED_FIELD", "feedback must be a string")
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
              suggestedTitles: null,
            }),
            lastTitleFeedback: feedback,
          },
        }
        storeSet(session)
        return { ok: true, session }
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
        } catch (e: unknown) {
          // Handle INCOMPLETE_DIMENSION_COVERAGE with formatted message and missingDimensions
          if (isJobIngestError(e) && e.code === "INCOMPLETE_DIMENSION_COVERAGE") {
            const meta = e.meta
            const missingKeys = Array.isArray(meta?.missingDimensions) ? meta.missingDimensions : []
            
            // Observability: single-line log once per attempt
            console.log(`job_ingest_incomplete_coverage missing_dimensions=${missingKeys.join(",")} missing_count=${missingKeys.length}`)
            
            // Format human-readable message
            const message = formatIncompleteCoverageMessage(meta, e.detail)
            
            // Map keys to labels for UI
            const missingLabels: string[] = []
            for (const key of missingKeys) {
              const label = (DIMENSION_LABELS as Record<string, string>)[key]
              if (typeof label === "string") missingLabels.push(label)
            }
            
            return bad("BAD_REQUEST", message, missingLabels)
          }
          
          // Other job ingest errors
          const detail = isJobIngestError(e) ? e.detail : String((e as any)?.message ?? "Invalid job text")
          return bad("BAD_REQUEST", detail)
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
        if (!session.job.completed || !session.job.rawText) return bad("JOB_REQUIRED", "Submit a job description first")
        if (!session.personVector.values) return bad("JOB_ENCODING_INCOMPLETE", "Missing person vector")

        const seam = runIntegrationSeam({
          jobText: session.job.rawText,
          experienceVector: session.personVector.values as any,
        })

        if (!seam.ok) {
          return bad("BAD_REQUEST", seam.error.message)
        }

        const contract = toResultContract({
          alignment: seam.result.alignment,
          skillMatch: seam.result.skillMatch,
          stretchLoad: seam.result.stretchLoad,
        }, {
          resumeText: String(session.resume.rawText ?? ""),
          promptAnswers: {
            1: String(session.prompts[1]?.answer ?? ""),
            2: String(session.prompts[2]?.answer ?? ""),
            3: String(session.prompts[3]?.answer ?? ""),
            4: String(session.prompts[4]?.answer ?? ""),
            5: String(session.prompts[5]?.answer ?? ""),
          },
          jobText: String(session.job.rawText ?? ""),
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