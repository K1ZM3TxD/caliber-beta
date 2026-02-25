// lib/result_contract.ts
// Calibration Core First — Clean result contract

import type { SkillMatchResult } from "@/lib/skill_match"
import type { StretchLoadResult } from "@/lib/stretch_load"
import type { AlignmentSignals } from "@/lib/alignment_score"
import { extractLexicalAnchors } from "@/lib/anchor_extraction"

// ======== Constants ========
const STRUCTURAL_NOTE_ALIGNMENT_THRESHOLD = 4.0
const STRUCTURAL_NOTE_SKILLMATCH_THRESHOLD = 7.0
const VERB_CAP = 12
const NOUN_CAP = 12

// ======== Result Contract Type ========
export type CaliberResultContract = {
  anchors: {
    verbs: string[]
    nouns: string[]
  }
  alignment: number      // 0–10, 1 decimal
  skillMatch: number     // 0–10, 1 decimal
  stretchLoad: number    // 0–100 integer
  structuralNote: string | null
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

// ======== Structural Note Logic ========
// Trigger: Alignment <= 4.0 AND SkillMatch >= 7.0
// Meaning: role matches experience, but pattern fit is low → likely energy drain
function computeStructuralNote(alignment: number, skillMatch: number): string | null {
  if (alignment <= STRUCTURAL_NOTE_ALIGNMENT_THRESHOLD && skillMatch >= STRUCTURAL_NOTE_SKILLMATCH_THRESHOLD) {
    return "Role matches prior experience. Pattern fit is low — this will likely drain energy over time."
  }
  return null
}

// ======== Extract Anchors from Context ========
function extractAnchors(context: ScoringContext): { verbs: string[]; nouns: string[] } {
  const resumeText = String(context.resumeText ?? "")
  const promptAnswersText = [
    context.promptAnswers[1] ?? "",
    context.promptAnswers[2] ?? "",
    context.promptAnswers[3] ?? "",
    context.promptAnswers[4] ?? "",
    context.promptAnswers[5] ?? "",
  ].join("\n")

  const anchors = extractLexicalAnchors({ resumeText, promptAnswersText })

  // Deterministic ordering is already handled by extractLexicalAnchors (frequency desc, term asc)
  const verbs = anchors.verbs.slice(0, VERB_CAP).map((x) => x.term)
  const nouns = anchors.nouns.slice(0, NOUN_CAP).map((x) => x.term)

  return { verbs, nouns }
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

  // Extract anchors from person input
  const anchors = extractAnchors(context)

  // Get scores (with proper rounding)
  const alignmentScore = Math.round(raw.alignment.score * 10) / 10
  const skillMatchScore = Math.round(raw.skillMatch.finalScore * 10) / 10
  const stretchLoadPct = Math.round(raw.stretchLoad.numeric * 10) // Convert 0-10 to 0-100 percent

  // Compute structural note
  const structuralNote = computeStructuralNote(alignmentScore, skillMatchScore)

  // Log observability line
  console.log(
    `[caliber-result] alignment=${alignmentScore.toFixed(1)} skill_match=${skillMatchScore.toFixed(1)} stretch_load=${stretchLoadPct} structural_note=${structuralNote ? "triggered" : "none"} verbs=${anchors.verbs.length} nouns=${anchors.nouns.length}`
  )

  return {
    anchors,
    alignment: alignmentScore,
    skillMatch: skillMatchScore,
    stretchLoad: stretchLoadPct,
    structuralNote,
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
