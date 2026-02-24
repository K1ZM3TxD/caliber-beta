const MIN_OVERLAP = 0.35

export type OperateBestValidatorOutcome =
  | "PASS"
  | "FALLBACK_ANCHOR_FAILURE"
  | "FALLBACK_BLACKLIST_PHRASE"

export type OperateBestFallbackReason = "anchor_failure" | "blacklist_phrase"

export type OperateBestValidationResult = {
  validator_outcome: OperateBestValidatorOutcome
  fallback_reason?: OperateBestFallbackReason
  anchor_overlap_score: number
  missing_anchor_count: number
  praise_flag: boolean
  abstraction_flag: boolean
  drift_term_count: number
}

type OperateBestLogFields = OperateBestValidationResult & {
  synthesis_source: string
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function countWholeWordMatches(text: string, terms: string[]): { overlapCount: number; missing: string[] } {
  const hay = (text || "").toLowerCase()
  let overlapCount = 0
  const missing: string[] = []

  for (const rawTerm of terms) {
    const term = String(rawTerm || "").trim().toLowerCase()
    if (!term) continue
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i")
    if (re.test(hay)) overlapCount += 1
    else missing.push(term)
  }

  return { overlapCount, missing }
}

function detectDriftFlags(s: string): { praise_flag: boolean; abstraction_flag: boolean; drift_terms: string[] } {
  const normalized = (s || "").toLowerCase()

  const praiseList = ["inspiring", "impressive", "exceptional", "outstanding", "remarkable", "amazing", "fantastic", "brilliant", "world-class", "stellar"]
  const abstractionList = ["visionary", "thought leader", "changemaker", "trailblazer", "rockstar", "guru", "ninja", "unicorn", "authentic self", "passion", "purpose", "destiny", "calling"]

  const driftSet = new Set<string>()
  let praiseFlag = false
  let abstractionFlag = false

  for (const term of praiseList) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i")
    if (re.test(normalized)) {
      praiseFlag = true
      driftSet.add(term)
    }
  }

  for (const term of abstractionList) {
    const re = new RegExp(`\\b${escapeRegex(term)}\\b`, "i")
    if (re.test(normalized)) {
      abstractionFlag = true
      driftSet.add(term)
    }
  }

  return {
    praise_flag: praiseFlag,
    abstraction_flag: abstractionFlag,
    drift_terms: Array.from(driftSet).sort(),
  }
}

export function validateOperateBestBullets(
  operateBestBullets: string[],
  anchorTerms: string[],
  blacklistTokens: readonly string[],
): OperateBestValidationResult {
  const normalizedBullets = Array.isArray(operateBestBullets)
    ? operateBestBullets.map((x) => String(x || "").trim()).filter(Boolean)
    : []

  const joined = normalizedBullets.join(" ")
  const normalizedAnchorTerms = Array.from(new Set((anchorTerms ?? []).map((x) => String(x || "").trim().toLowerCase()).filter(Boolean))).sort()

  const overlap = countWholeWordMatches(joined, normalizedAnchorTerms)
  const anchor_overlap_score = normalizedAnchorTerms.length > 0 ? overlap.overlapCount / normalizedAnchorTerms.length : 0
  const missing_anchor_count = overlap.missing.length

  const drift = detectDriftFlags(joined)

  const blacklistHit = (blacklistTokens ?? []).some((token) => {
    const t = String(token || "").trim().toLowerCase()
    if (!t) return false
    const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "i")
    return re.test(joined)
  })

  if (blacklistHit) {
    return {
      validator_outcome: "FALLBACK_BLACKLIST_PHRASE",
      fallback_reason: "blacklist_phrase",
      anchor_overlap_score,
      missing_anchor_count,
      praise_flag: drift.praise_flag,
      abstraction_flag: drift.abstraction_flag,
      drift_term_count: drift.drift_terms.length,
    }
  }

  if (anchor_overlap_score < MIN_OVERLAP) {
    return {
      validator_outcome: "FALLBACK_ANCHOR_FAILURE",
      fallback_reason: "anchor_failure",
      anchor_overlap_score,
      missing_anchor_count,
      praise_flag: drift.praise_flag,
      abstraction_flag: drift.abstraction_flag,
      drift_term_count: drift.drift_terms.length,
    }
  }

  return {
    validator_outcome: "PASS",
    anchor_overlap_score,
    missing_anchor_count,
    praise_flag: drift.praise_flag,
    abstraction_flag: drift.abstraction_flag,
    drift_term_count: drift.drift_terms.length,
  }
}

export function formatOperateBestLogLine(fields: OperateBestLogFields): string {
  const parts = [
    `synthesis_source=${String(fields.synthesis_source || "unknown")}`,
    "bullet_group=operateBest",
    `validator_outcome=${fields.validator_outcome}`,
  ]

  if (fields.fallback_reason) {
    parts.push(`fallback_reason=${fields.fallback_reason}`)
  }

  parts.push(`anchor_overlap_score=${fields.anchor_overlap_score.toFixed(2)}`)
  parts.push(`missing_anchor_count=${fields.missing_anchor_count}`)
  parts.push(`praise_flag=${fields.praise_flag ? "true" : "false"}`)
  parts.push(`abstraction_flag=${fields.abstraction_flag ? "true" : "false"}`)
  parts.push(`drift_term_count=${fields.drift_term_count}`)

  return parts.join(" ")
}
