// lib/result_contract.ts
// Milestone 6.2 — Signal vs Skill Classification + Scoring Integration

import type { SkillMatchResult } from "@/lib/skill_match"
import type { StretchLoadResult } from "@/lib/stretch_load"
import type { AlignmentSignals } from "@/lib/alignment_score"
import { extractLexicalAnchors } from "@/lib/anchor_extraction"

// ======== Constants ========
const STRUCTURAL_NOTE_ALIGNMENT_THRESHOLD = 4.0
const STRUCTURAL_NOTE_SKILLMATCH_THRESHOLD = 7.0
const SIGNAL_ANCHOR_CAP = 10
const SKILL_ANCHOR_CAP = 14
const BREAKDOWN_PROMPT_INDEX: 1 | 2 | 3 | 4 | 5 = 2

// ======== Types ========
type SourceTag = "resume" | "q1" | "q2" | "q3" | "q4" | "q5"
type ContextType = "breakdown" | "neutral"

type TermClassification = {
  term: string
  frequency: number
  breakdownPresence: boolean
  distinctContextCount: number
}

// ======== Result Contract Type ========
export type CaliberResultContract = {
  // New signal/skill classification
  signalAnchors: string[]
  skillAnchors: string[]
  signalAlignment: number    // 0–100
  skillCoverage: number      // 0–100
  stretchLoad: number        // 0–100 (v2 weighted)
  compositeAlignment: number // 0–100
  structuralNote: string | null
  signalWeight: number
  skillWeight: number
  signalDensity: number
  // Legacy fields for backward compatibility
  alignment: number      // 0–10, 1 decimal (from vector alignment)
  skillMatch: number     // 0–10, 1 decimal (from terrain classification)
  meta: {
    version: "v1"
    computedAt: string
  }
  // Internal debug fields (hidden by default)
  _debug?: {
    alignmentSignals: AlignmentSignals
    skillMatchDetails: SkillMatchResult
    stretchLoadDetails: StretchLoadResult
  }
}

// ======== Scoring Context ========
export type ScoringContext = {
  resumeText: string
  promptAnswers: Record<1 | 2 | 3 | 4 | 5, string>
  jobText: string
}

// ======== Utility Functions ========
function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function hasWholeWord(text: string, term: string): boolean {
  const hay = String(text ?? "")
  const needle = String(term ?? "").trim()
  if (!needle) return false
  const re = new RegExp(`\\b${escapeRegex(needle)}\\b`, "i")
  return re.test(hay)
}

// ======== Signal/Skill Classification ========
// Rule: A term is Signal-Dominant iff:
// 1) Appears in breakdown context
// AND 2) Appears in at least one additional DISTINCT context
// Else => Skill-Dominant
// Resume-only repetition MUST NEVER become signal

function classifyAnchors(context: ScoringContext): {
  signalAnchors: TermClassification[]
  skillAnchors: TermClassification[]
} {
  const resumeText = String(context.resumeText ?? "")
  const promptAnswers = context.promptAnswers
  
  const q1 = String(promptAnswers[1] ?? "")
  const q2 = String(promptAnswers[2] ?? "")
  const q3 = String(promptAnswers[3] ?? "")
  const q4 = String(promptAnswers[4] ?? "")
  const q5 = String(promptAnswers[5] ?? "")
  
  // Build contexts with tags
  const contexts: Array<{ source: SourceTag; context_type: ContextType; text: string }> = [
    { source: "resume", context_type: "neutral", text: resumeText },
    { source: "q1", context_type: BREAKDOWN_PROMPT_INDEX === 1 ? "breakdown" : "neutral", text: q1 },
    { source: "q2", context_type: BREAKDOWN_PROMPT_INDEX === 2 ? "breakdown" : "neutral", text: q2 },
    { source: "q3", context_type: BREAKDOWN_PROMPT_INDEX === 3 ? "breakdown" : "neutral", text: q3 },
    { source: "q4", context_type: BREAKDOWN_PROMPT_INDEX === 4 ? "breakdown" : "neutral", text: q4 },
    { source: "q5", context_type: BREAKDOWN_PROMPT_INDEX === 5 ? "breakdown" : "neutral", text: q5 },
  ]
  
  // Extract all anchors from combined text
  const promptAnswersText = [q1, q2, q3, q4, q5].join("\n")
  const anchorOutput = extractLexicalAnchors({ resumeText, promptAnswersText })
  const allTerms = anchorOutput.combined
  
  // Classify each term
  const signalCandidates: TermClassification[] = []
  const skillCandidates: TermClassification[] = []
  
  for (const entry of allTerms) {
    const term = entry.term
    
    // Find which contexts contain this term
    const presentInContexts = contexts.filter(ctx => hasWholeWord(ctx.text, term))
    const distinctContextCount = presentInContexts.length
    const breakdownPresence = presentInContexts.some(ctx => ctx.context_type === "breakdown")
    
    const classification: TermClassification = {
      term,
      frequency: entry.count,
      breakdownPresence,
      distinctContextCount,
    }
    
    // Signal-Dominant: breakdown + at least one other distinct context
    const isSignalDominant = breakdownPresence && distinctContextCount >= 2
    
    if (isSignalDominant) {
      signalCandidates.push(classification)
    } else {
      skillCandidates.push(classification)
    }
  }
  
  // Sort signal candidates: breakdown_presence desc, freq desc, term asc
  signalCandidates.sort((a, b) => {
    if (a.breakdownPresence !== b.breakdownPresence) return a.breakdownPresence ? -1 : 1
    if (b.frequency !== a.frequency) return b.frequency - a.frequency
    return a.term.localeCompare(b.term)
  })
  
  // Sort skill candidates: freq desc, term asc
  skillCandidates.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency
    return a.term.localeCompare(b.term)
  })
  
  // Apply caps
  const signalAnchors = signalCandidates.slice(0, SIGNAL_ANCHOR_CAP)
  const skillAnchors = skillCandidates.slice(0, SKILL_ANCHOR_CAP)
  
  return { signalAnchors, skillAnchors }
}

// ======== Signal Extraction (for title generation) ========
export type SignalExtractionInput = {
  resumeText: string
  promptAnswers: Record<1 | 2 | 3 | 4 | 5, string>
}

/**
 * extractSignalAnchors — Extract signal-dominant terms without requiring job text.
 * Used for generating suggested titles before job description is provided.
 */
export function extractSignalAnchors(input: SignalExtractionInput): string[] {
  const resumeText = String(input.resumeText ?? "")
  const promptAnswers = input.promptAnswers
  
  const q1 = String(promptAnswers[1] ?? "")
  const q2 = String(promptAnswers[2] ?? "")
  const q3 = String(promptAnswers[3] ?? "")
  const q4 = String(promptAnswers[4] ?? "")
  const q5 = String(promptAnswers[5] ?? "")
  
  // Build contexts with tags
  const contexts: Array<{ source: SourceTag; context_type: ContextType; text: string }> = [
    { source: "resume", context_type: "neutral", text: resumeText },
    { source: "q1", context_type: BREAKDOWN_PROMPT_INDEX === 1 ? "breakdown" : "neutral", text: q1 },
    { source: "q2", context_type: BREAKDOWN_PROMPT_INDEX === 2 ? "breakdown" : "neutral", text: q2 },
    { source: "q3", context_type: BREAKDOWN_PROMPT_INDEX === 3 ? "breakdown" : "neutral", text: q3 },
    { source: "q4", context_type: BREAKDOWN_PROMPT_INDEX === 4 ? "breakdown" : "neutral", text: q4 },
    { source: "q5", context_type: BREAKDOWN_PROMPT_INDEX === 5 ? "breakdown" : "neutral", text: q5 },
  ]
  
  // Extract all anchors from combined text
  const promptAnswersText = [q1, q2, q3, q4, q5].join("\n")
  const anchorOutput = extractLexicalAnchors({ resumeText, promptAnswersText })
  const allTerms = anchorOutput.combined
  
  // Classify each term
  const signalCandidates: TermClassification[] = []
  
  for (const entry of allTerms) {
    const term = entry.term
    
    // Find which contexts contain this term
    const presentInContexts = contexts.filter(ctx => hasWholeWord(ctx.text, term))
    const distinctContextCount = presentInContexts.length
    const breakdownPresence = presentInContexts.some(ctx => ctx.context_type === "breakdown")
    
    // Signal-Dominant: breakdown + at least one other distinct context
    const isSignalDominant = breakdownPresence && distinctContextCount >= 2
    
    if (isSignalDominant) {
      signalCandidates.push({
        term,
        frequency: entry.count,
        breakdownPresence,
        distinctContextCount,
      })
    }
  }
  
  // Sort: breakdown_presence desc, freq desc, term asc
  signalCandidates.sort((a, b) => {
    if (a.breakdownPresence !== b.breakdownPresence) return a.breakdownPresence ? -1 : 1
    if (b.frequency !== a.frequency) return b.frequency - a.frequency
    return a.term.localeCompare(b.term)
  })
  
  // Apply cap and return terms only
  return signalCandidates.slice(0, SIGNAL_ANCHOR_CAP).map(x => x.term)
}

// ======== Title Generation ========
const TITLE_TEMPLATES = [
  "{verb} {noun}",
  "{noun} {verb}er",
  "Senior {noun} {verb}er",
  "{noun} Lead",
  "{verb} Specialist",
]

function capitalize(s: string): string {
  if (!s) return ""
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * generateSuggestedTitles — Generate 5 deterministic job title suggestions from signal anchors.
 * 
 * Rules:
 * - Uses signal anchor terms only (no skill anchors)
 * - Deterministic: same inputs => same outputs
 * - Falls back to generic templates if insufficient anchors
 * - Returns exactly 5 unique titles
 */
export function generateSuggestedTitles(signalAnchors: string[]): string[] {
  // Extract verb-like and noun-like terms from signal anchors
  const verbLike: string[] = []
  const nounLike: string[] = []
  
  for (const term of signalAnchors) {
    const lower = term.toLowerCase()
    // Verb suffixes
    if (lower.endsWith("ing") || lower.endsWith("ed") || lower.endsWith("ize") || lower.endsWith("ise")) {
      verbLike.push(term)
    }
    // Noun suffixes
    else if (lower.endsWith("tion") || lower.endsWith("sion") || lower.endsWith("ment") || 
             lower.endsWith("ness") || lower.endsWith("ship") || lower.endsWith("ity") ||
             lower.endsWith("ance") || lower.endsWith("ence")) {
      nounLike.push(term)
    }
    // Default to noun if unclear
    else {
      nounLike.push(term)
    }
  }
  
  const titles: string[] = []
  const usedTitles = new Set<string>()
  
  // Generate titles using combinations
  for (let i = 0; i < TITLE_TEMPLATES.length && titles.length < 5; i++) {
    const template = TITLE_TEMPLATES[i]
    const verb = verbLike[i % Math.max(verbLike.length, 1)] ?? "Operations"
    const noun = nounLike[i % Math.max(nounLike.length, 1)] ?? "Systems"
    
    // Convert verb forms for role names
    let verbRoot = verb
    if (verbRoot.endsWith("ing")) {
      verbRoot = verbRoot.slice(0, -3)
    } else if (verbRoot.endsWith("ed")) {
      verbRoot = verbRoot.slice(0, -2)
    }
    
    let title = template
      .replace("{verb}", capitalize(verbRoot))
      .replace("{noun}", capitalize(noun))
    
    // Clean up awkward constructs
    title = title.replace(/er$/i, (match) => match) // keep -er suffix
    
    if (!usedTitles.has(title.toLowerCase())) {
      usedTitles.add(title.toLowerCase())
      titles.push(title)
    }
  }
  
  // Fallback if we don't have enough unique titles
  const fallbacks = [
    "Technical Lead",
    "Senior Specialist",
    "Operations Manager",
    "Systems Architect",
    "Strategy Consultant",
  ]
  
  for (const fb of fallbacks) {
    if (titles.length >= 5) break
    if (!usedTitles.has(fb.toLowerCase())) {
      usedTitles.add(fb.toLowerCase())
      titles.push(fb)
    }
  }
  
  return titles.slice(0, 5)
}

// ======== Scoring Functions ========
function computeSignalSkillScoring(context: ScoringContext): {
  signalAnchors: string[]
  skillAnchors: string[]
  signalAlignment: number
  skillCoverage: number
  stretchLoad: number
  compositeAlignment: number
  structuralNote: string | null
  signalWeight: number
  skillWeight: number
  signalDensity: number
} {
  const { signalAnchors: signalClassified, skillAnchors: skillClassified } = classifyAnchors(context)
  
  const signalAnchors = signalClassified.map(x => x.term)
  const skillAnchors = skillClassified.map(x => x.term)
  
  // Extract JD anchors for comparison
  const jobText = String(context.jobText ?? "")
  const jdAnchorOutput = extractLexicalAnchors({ resumeText: jobText, promptAnswersText: "" })
  const jdAnchorTerms = jdAnchorOutput.combined.map(x => x.term)
  const jdAnchorSet = new Set(jdAnchorTerms)
  
  // Build weight map for signal anchors
  const signalWeightByTerm = new Map<string, number>()
  for (const entry of signalClassified) {
    signalWeightByTerm.set(entry.term, entry.breakdownPresence ? 1.5 : 1.0)
  }
  
  // Compute signalAlignment (0-100): weighted overlap with JD
  let signalDenom = 0
  let signalNumerator = 0
  for (const term of signalAnchors) {
    const weight = signalWeightByTerm.get(term) ?? 1.0
    signalDenom += weight
    if (jdAnchorSet.has(term)) {
      signalNumerator += weight
    }
  }
  const signalAlignment = round2(clampPct(signalDenom > 0 ? (signalNumerator / signalDenom) * 100 : 0))
  
  // Compute skillCoverage (0-100): flat overlap with JD
  let skillMatchCount = 0
  for (const term of skillAnchors) {
    if (jdAnchorSet.has(term)) {
      skillMatchCount += 1
    }
  }
  const skillCoverage = round2(clampPct(skillAnchors.length > 0 ? (skillMatchCount / skillAnchors.length) * 100 : 0))
  
  // Compute stretchLoad (0-100): weighted missing anchors demanded by JD
  const signalSet = new Set(signalAnchors)
  const skillSet = new Set(skillAnchors)
  
  let totalDemandWeight = 0
  let missingDemandWeight = 0
  for (const jdTerm of jdAnchorTerms) {
    const isSignalTerm = signalSet.has(jdTerm)
    const isSkillTerm = skillSet.has(jdTerm)
    const weight = isSignalTerm ? 1.5 : 1.0
    const covered = isSignalTerm || isSkillTerm
    
    totalDemandWeight += weight
    if (!covered) {
      missingDemandWeight += weight
    }
  }
  const stretchLoad = round2(clampPct(totalDemandWeight > 0 ? (missingDemandWeight / totalDemandWeight) * 100 : 0))
  
  // Compute composite alignment with adaptive weighting
  const totalAnchors = signalAnchors.length + skillAnchors.length
  const signalDensityRaw = totalAnchors > 0 ? signalAnchors.length / totalAnchors : 0
  const signalDensity = round2(signalDensityRaw)
  
  let signalWeight = 0.5
  let skillWeight = 0.5
  if (signalDensityRaw >= 0.5) {
    signalWeight = 0.7
    skillWeight = 0.3
  } else if (signalDensityRaw >= 0.3) {
    signalWeight = 0.6
    skillWeight = 0.4
  }
  
  const compositeAlignment = round2(clampPct(
    signalAlignment * signalWeight + skillCoverage * skillWeight
  ))
  
  // Compute structural note:
  // Original: alignment <= 4.0 AND skillMatch >= 7.0
  // New parallel: signalAlignment <= 40 AND skillCoverage >= 70
  let structuralNote: string | null = null
  if (signalAlignment <= 40 && skillCoverage >= 70) {
    structuralNote = "Role matches prior experience. Core pattern is less central here."
  }
  
  // Log observability line
  console.log(
    `signal_anchor_count=${signalAnchors.length} skill_anchor_count=${skillAnchors.length} signal_density=${signalDensity.toFixed(2)} signal_alignment=${signalAlignment.toFixed(2)} skill_coverage=${skillCoverage.toFixed(2)} stretch_load=${stretchLoad.toFixed(2)} composite_alignment=${compositeAlignment.toFixed(2)}`
  )
  
  return {
    signalAnchors,
    skillAnchors,
    signalAlignment,
    skillCoverage,
    stretchLoad,
    compositeAlignment,
    structuralNote,
    signalWeight,
    skillWeight,
    signalDensity,
  }
}

// ======== Structural Note (Legacy Branch) ========
function computeLegacyStructuralNote(alignment: number, skillMatch: number): string | null {
  if (alignment <= STRUCTURAL_NOTE_ALIGNMENT_THRESHOLD && skillMatch >= STRUCTURAL_NOTE_SKILLMATCH_THRESHOLD) {
    return "Role matches prior experience. Pattern fit is low — this will likely drain energy over time."
  }
  return null
}

// ======== Main Contract Builder ========
export function toResultContract(
  raw: {
    alignment: { score: number; explanation: string; signals: AlignmentSignals }
    skillMatch: SkillMatchResult
    stretchLoad: StretchLoadResult
  },
  context: ScoringContext
): CaliberResultContract {
  const computedAt = new Date().toISOString()

  // Get legacy scores (with proper rounding)
  const alignmentScore = Math.round(raw.alignment.score * 10) / 10
  const skillMatchScore = Math.round(raw.skillMatch.finalScore * 10) / 10

  // Compute signal/skill classification and scoring
  const scoring = computeSignalSkillScoring(context)
  
  // Check legacy structural note and merge with new one
  const legacyStructuralNote = computeLegacyStructuralNote(alignmentScore, skillMatchScore)
  const finalStructuralNote = scoring.structuralNote ?? legacyStructuralNote

  return {
    // New signal/skill fields
    signalAnchors: scoring.signalAnchors,
    skillAnchors: scoring.skillAnchors,
    signalAlignment: scoring.signalAlignment,
    skillCoverage: scoring.skillCoverage,
    stretchLoad: scoring.stretchLoad,
    compositeAlignment: scoring.compositeAlignment,
    structuralNote: finalStructuralNote,
    signalWeight: scoring.signalWeight,
    skillWeight: scoring.skillWeight,
    signalDensity: scoring.signalDensity,
    // Legacy fields for backward compatibility
    alignment: alignmentScore,
    skillMatch: skillMatchScore,
    meta: {
      version: "v1",
      computedAt,
    },
    _debug: {
      alignmentSignals: raw.alignment.signals,
      skillMatchDetails: raw.skillMatch,
      stretchLoadDetails: raw.stretchLoad,
    },
  }
}
