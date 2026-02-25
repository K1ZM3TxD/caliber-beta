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

/**
 * Fixed allowlist of valid job title templates.
 * NEVER generate titles by concatenating raw anchor tokens.
 * Each title is a complete, natural job title string.
 */
const TITLE_ALLOWLIST: readonly string[] = [
  // Systems / Operations track
  "Systems Analyst",
  "Operations Analyst",
  "Systems Operations Manager",
  "Operations Specialist",
  "Systems Administrator",
  // Process / Compliance track
  "Process Improvement Analyst",
  "Compliance Analyst",
  "Quality Assurance Specialist",
  "Process Engineer",
  "Standards Coordinator",
  // Implementation / Technical track
  "Implementation Specialist",
  "Technical Operations Manager",
  "Solutions Architect",
  "Integration Specialist",
  "Technical Lead",
  // Program / Strategy track
  "Program Coordinator",
  "Program Manager",
  "Strategy Analyst",
  "Business Operations Manager",
  "Account Operations Manager",
  // Neutral fallbacks (always valid)
  "Senior Specialist",
  "Operations Manager",
  "Project Coordinator",
  "Business Analyst",
  "Technical Specialist",
] as const

/**
 * Track definitions for lexical matching.
 * Each track has trigger patterns (regex-safe lowercase substrings) and associated title indices.
 */
interface TitleTrack {
  readonly name: string
  readonly triggers: readonly string[]
  readonly titleIndices: readonly number[] // indices into TITLE_ALLOWLIST
}

const TITLE_TRACKS: readonly TitleTrack[] = [
  {
    name: "systems_operations",
    triggers: ["system", "systems", "ops", "operations", "workflow", "process"],
    titleIndices: [0, 1, 2, 3, 4], // Systems/Operations titles
  },
  {
    name: "process_compliance",
    triggers: ["audit", "enforce", "compliance", "standard", "quality", "policy", "govern"],
    titleIndices: [5, 6, 7, 8, 9], // Process/Compliance titles
  },
  {
    name: "implementation",
    triggers: ["rebuild", "stabilize", "fix", "troubleshoot", "implement", "deploy", "integrate", "migrate"],
    titleIndices: [10, 11, 12, 13, 14], // Implementation/Technical titles
  },
  {
    name: "program_strategy",
    triggers: ["program", "strategy", "strategic", "coordinate", "plan", "lead", "manage", "direct"],
    titleIndices: [15, 16, 17, 18, 19], // Program/Strategy titles
  },
] as const

// Fallback title indices (neutral titles that work for any profile)
const FALLBACK_TITLE_INDICES: readonly number[] = [20, 21, 22, 23, 24]

/**
 * generateSuggestedTitles — Generate 5 deterministic job title suggestions from signal anchors.
 * 
 * Algorithm:
 * 1. Match signalAnchors against track trigger patterns (lexical only)
 * 2. Score each title template by how many trigger groups it matches
 * 3. Tie-break by template string ascending (deterministic)
 * 4. Deduplicate and fill with fallbacks if needed
 * 5. Return exactly 5 unique titles
 * 
 * Rules:
 * - Uses signal anchor terms ONLY (no skill anchors)
 * - Deterministic: same inputs => same outputs
 * - Always returns exactly 5 valid job titles from the allowlist
 * - Never concatenates raw anchor tokens
 */
export function generateSuggestedTitles(signalAnchors: string[]): string[] {
  // Normalize anchors to lowercase for matching
  const normalizedAnchors = signalAnchors.map(a => a.toLowerCase())
  
  // Score each track by how many of its triggers match signal anchors
  const trackScores: Map<number, number> = new Map() // trackIndex -> match count
  
  for (let trackIdx = 0; trackIdx < TITLE_TRACKS.length; trackIdx++) {
    const track = TITLE_TRACKS[trackIdx]
    let matchCount = 0
    
    for (const trigger of track.triggers) {
      // Check if any anchor contains this trigger
      for (const anchor of normalizedAnchors) {
        if (anchor.includes(trigger)) {
          matchCount++
          break // Count each trigger once
        }
      }
    }
    
    trackScores.set(trackIdx, matchCount)
  }
  
  // Build scored list of title indices
  // Each title gets the score of its track, or 0 if no track matches
  const titleScores: Array<{ index: number; score: number; title: string }> = []
  const seenTitles = new Set<string>()
  
  // Add titles from tracks that matched (sorted by track score descending)
  const sortedTracks = Array.from(trackScores.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => {
      // Sort by score descending, then by track index ascending for determinism
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0] - b[0]
    })
  
  for (const [trackIdx, score] of sortedTracks) {
    const track = TITLE_TRACKS[trackIdx]
    for (const titleIdx of track.titleIndices) {
      const title = TITLE_ALLOWLIST[titleIdx]
      if (!seenTitles.has(title)) {
        seenTitles.add(title)
        titleScores.push({ index: titleIdx, score, title })
      }
    }
  }
  
  // Sort by score descending, then by title string ascending for determinism
  titleScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.title.localeCompare(b.title)
  })
  
  // Take top 5, filling with fallbacks if needed
  const result: string[] = []
  
  for (const { title } of titleScores) {
    if (result.length >= 5) break
    result.push(title)
  }
  
  // Fill remaining slots with fallbacks
  for (const fallbackIdx of FALLBACK_TITLE_INDICES) {
    if (result.length >= 5) break
    const title = TITLE_ALLOWLIST[fallbackIdx]
    if (!result.includes(title)) {
      result.push(title)
    }
  }
  
  return result.slice(0, 5)
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
