// lib/result_contract.ts

import type { JobIngestObject } from "@/lib/job_ingest"
import type { SkillMatchResult } from "@/lib/skill_match"
import type { StretchLoadResult } from "@/lib/stretch_load"

export type CaliberResultContract = {
  alignment: {
    score: number // 0–10
    explanation: string // structural, not emotional
    signals?: any
  }
  skillMatch: {
    score: number // 0–10
    band?: string
    explanation: string
    details?: any
  }
  stretchLoad: {
    value: number // inverse of skillMatch.score (existing engine output)
    band: string
    explanation?: string
  }
  meta: {
    version: "v1"
    computedAt: string
  }
}

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x)
}

function assertRange0to10(name: string, n: number): { ok: true } | { ok: false; message: string } {
  if (!isNumber(n)) return { ok: false, message: `${name} must be a finite number` }
  if (n < 0 || n > 10) return { ok: false, message: `${name} must be in range 0–10` }
  return { ok: true }
}

function isJobIngestObject(x: any): x is JobIngestObject {
  return (
    x &&
    typeof x === "object" &&
    typeof x.jobText === "string" &&
    typeof x.normalizedText === "string" &&
    Array.isArray(x.roleVector) &&
    x.roleVector.length === 6
  )
}

function isSkillMatchResult(x: any): x is SkillMatchResult {
  return (
    x &&
    typeof x === "object" &&
    typeof x.terrain === "string" &&
    isNumber(x.baseScore) &&
    isNumber(x.authorityModifier) &&
    isNumber(x.finalScore)
  )
}

function isStretchLoadResult(x: any): x is StretchLoadResult {
  return x && typeof x === "object" && typeof x.band === "string" && isNumber(x.numeric) && typeof x.explanation === "string"
}

function skillMatchExplanationFromExistingFields(sm: SkillMatchResult): string {
  // Minimal, deterministic text derived only from existing fields.
  // No score recomputation, no blending, no engine reinterpretation beyond labeling terrain.
  if (sm.terrain === "grounded") return "Grounded terrain: role demands match demonstrated structure and scope."
  if (sm.terrain === "adjacent") return "Adjacent terrain: role demands exceed experience in at least one dimension by one level."
  return "New terrain: role demands exceed experience in at least one dimension by two or more levels."
}

function alignmentFromRaw(rawAlignment: unknown): { score: number; explanation: string; signals?: any } | null {
  // If a future Alignment engine exists and already returns score/explanation, pass-through.
  const a: any = rawAlignment
  if (a && typeof a === "object" && isNumber(a.score) && typeof a.explanation === "string") {
    const r = assertRange0to10("alignment.score", a.score)
    if (!r.ok) return null
    return {
      score: a.score,
      explanation: a.explanation,
      signals: a.signals,
    }
  }

  // Current baseline: alignment-side output is deterministic ingest/encoding.
  // We MUST NOT invent a new alignment algorithm here.
  // So we publish a stable placeholder score (0) with explicit explanation, and include signals.
  if (isJobIngestObject(a)) {
    return {
      score: 0,
      explanation: "Alignment score not computed in v1; returning deterministic job structural encoding only.",
      signals: {
        roleVector: a.roleVector,
        dimensionEvidence: a.dimensionEvidence,
      },
    }
  }

  return null
}

export function toResultContract(raw: {
  alignment: unknown
  skillMatch: unknown
  stretchLoad: unknown
}): CaliberResultContract {
  const computedAt = new Date().toISOString()

  const alignment = alignmentFromRaw(raw.alignment)
  if (!alignment) {
    throw new Error("Contract validation failed: missing or invalid alignment output")
  }

  const smAny: any = raw.skillMatch
  if (!isSkillMatchResult(smAny)) {
    throw new Error("Contract validation failed: missing or invalid skillMatch output")
  }
  const smScoreCheck = assertRange0to10("skillMatch.score", smAny.finalScore)
  if (!smScoreCheck.ok) {
    throw new Error(`Contract validation failed: ${smScoreCheck.message}`)
  }

  const slAny: any = raw.stretchLoad
  if (!isStretchLoadResult(slAny)) {
    throw new Error("Contract validation failed: missing or invalid stretchLoad output")
  }
  const slValueCheck = assertRange0to10("stretchLoad.value", slAny.numeric)
  if (!slValueCheck.ok) {
    throw new Error(`Contract validation failed: ${slValueCheck.message}`)
  }

  // Validate inverse relationship WITHOUT recomputing (just checking consistency).
  // stretchLoad engine already computes numeric = 10 - skillMatchScore.
  // We only validate the existing output matches this invariant.
  const expected = 10 - smAny.finalScore
  if (Math.abs(slAny.numeric - expected) > 1e-9) {
    throw new Error("Contract validation failed: stretchLoad.value does not match stretch load engine output invariant")
  }

  return {
    alignment: {
      score: alignment.score,
      explanation: alignment.explanation,
      signals: alignment.signals,
    },
    skillMatch: {
      score: smAny.finalScore,
      band: smAny.terrain,
      explanation: skillMatchExplanationFromExistingFields(smAny),
      details: smAny,
    },
    stretchLoad: {
      value: slAny.numeric,
      band: slAny.band,
      explanation: slAny.explanation,
    },
    meta: {
      version: "v1",
      computedAt,
    },
  }
}