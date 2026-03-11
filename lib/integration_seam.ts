// lib/integration_seam.ts

import { ingestJob, isJobIngestError, type JobIngestObject, type JobIngestDimensionKey } from "@/lib/job_ingest"
import { computeAlignmentScore } from "@/lib/alignment_score"
import { computeSkillMatch, type SkillMatchResult } from "@/lib/skill_match"
import { computeStretchLoad, type StretchLoadResult } from "@/lib/stretch_load"
import { checkRealmGuard, REALM_CAP } from "@/lib/realm_guard"

import { dispatchCalibrationEvent } from "@/lib/calibration_machine"
import type { CalibrationEvent, CalibrationSession } from "@/lib/calibration_types"

export type IntegrationErrorCode =
  | "BAD_REQUEST"
  | "MISSING_JOB_TEXT"
  | "MISSING_EXPERIENCE_VECTOR"
  | "INVALID_EXPERIENCE_VECTOR"
  | "UNABLE_TO_EXTRACT_ANY_SIGNAL"
  | "INCOMPLETE_DIMENSION_COVERAGE"
  | "INTERNAL"

export type IntegrationError = {
  code: IntegrationErrorCode
  message: string
}

export type IntegrationInput = {
  jobText: string
  experienceVector: number[]
  resumeText?: string
  promptAnswers?: string[]
}

export type AlignmentOutput = {
  score: number
  explanation: string
  signals?: any
  supports_fit: string[]
  stretch_factors: string[]
  bottom_line_2s: string
}

export type IntegrationSeamOk = {
  ok: true
  result: {
    alignment: AlignmentOutput
    skillMatch: SkillMatchResult
    stretchLoad: StretchLoadResult
  }
}

export type IntegrationSeamErr = {
  ok: false
  error: IntegrationError
}

export type IntegrationSeamResult = IntegrationSeamOk | IntegrationSeamErr

function isValidExperienceVector(v: unknown): v is number[] {
  if (!Array.isArray(v)) return false
  if (v.length !== 6) return false
  for (const n of v) {
    if (typeof n !== "number") return false
    if (n < 0 || n > 2) return false
  }
  return true
}

const DIMENSION_LABELS: Record<JobIngestDimensionKey, string> = {
  structuralMaturity: "Structural Maturity",
  authorityScope: "Authority Scope",
  revenueOrientation: "Revenue Orientation",
  roleAmbiguity: "Role Ambiguity",
  breadthVsDepth: "Breadth vs Depth",
  stakeholderDensity: "Stakeholder Density",
}

function formatIncompleteCoverageMessage(meta: unknown, fallbackDetail: string): string {
  try {
    const missing = (meta as any)?.missingDimensions
    if (!Array.isArray(missing) || missing.length === 0) return fallbackDetail

    const labels: string[] = []
    for (const key of missing) {
      if (typeof key !== "string") continue
      const label = (DIMENSION_LABELS as any)[key]
      if (typeof label === "string" && label.length > 0) labels.push(label)
    }

    if (labels.length === 0) return fallbackDetail

    // Deterministic output order: preserve the encoder's missingDimensions order.
    return `Insufficient signal in dimensions: ${labels.join(", ")}`
  } catch {
    return fallbackDetail
  }
}

export function runIntegrationSeam(input: IntegrationInput): IntegrationSeamResult {
  try {
    const jobText = input?.jobText
    const experienceVector = (input as any)?.experienceVector

    if (typeof jobText !== "string" || jobText.trim().length === 0) {
      return {
        ok: false,
        error: { code: "MISSING_JOB_TEXT", message: "jobText is required and must be a non-empty string" },
      }
    }

    if (experienceVector === undefined) {
      return {
        ok: false,
        error: { code: "MISSING_EXPERIENCE_VECTOR", message: "experienceVector is required" },
      }
    }

    if (!isValidExperienceVector(experienceVector)) {
      return {
        ok: false,
        error: {
          code: "INVALID_EXPERIENCE_VECTOR",
          message: "experienceVector must be an array of 6 numbers in range 0–2",
        },
      }
    }

    // ---- Ingest / encode (delegated) ----
    const ingestResult = ingestJob(jobText)

    // ---- Alignment Score (person vs role vector) ----
    const alignmentResult = computeAlignmentScore({
      personVector: experienceVector as [0|1|2, 0|1|2, 0|1|2, 0|1|2, 0|1|2, 0|1|2],
      roleVector: ingestResult.roleVector as [0|1|2, 0|1|2, 0|1|2, 0|1|2, 0|1|2, 0|1|2],
    })

    // ---- Skill Match (delegated) ----
    const skillMatch = computeSkillMatch(ingestResult.roleVector, experienceVector)

    // ---- Stretch Load (delegated; inverse of Skill Match) ----
    const stretchLoad = computeStretchLoad(skillMatch.finalScore)

    // ---- Build supports_fit / stretch_factors from dimension distances ----
    // Score-aware framing: distance=1 reads as proximity (support) when
    // the overall score is ≥ 5, and as gap (stretch) when < 5.
    const distances = alignmentResult.signals.distances
    const score = alignmentResult.score
    const dimKeys: JobIngestDimensionKey[] = [
      "structuralMaturity", "authorityScope", "revenueOrientation",
      "roleAmbiguity", "breadthVsDepth", "stakeholderDensity",
    ]
    const supports_fit: string[] = []
    const stretch_factors: string[] = []
    for (let i = 0; i < 6; i++) {
      const label = DIMENSION_LABELS[dimKeys[i]]
      if (distances[i] === 0) {
        supports_fit.push(`${label}: strong alignment between your pattern and role demands.`)
      } else if (distances[i] === 1) {
        if (score >= 5) {
          supports_fit.push(`${label}: near-aligned — close to role demands with minor stretch.`)
        } else {
          stretch_factors.push(`${label}: mild gap — role asks for slightly more than demonstrated.`)
        }
      } else {
        stretch_factors.push(`${label}: significant gap — role demands exceed demonstrated level.`)
      }
    }

    // Empty-supports guard: for scores ≥ 3, ensure at least one support when
    // mild-gap dimensions exist but none qualified as supports above.
    if (supports_fit.length === 0 && score >= 3 && stretch_factors.length > 0) {
      const mildIdx = stretch_factors.findIndex(s => s.includes("mild gap"))
      if (mildIdx !== -1) {
        const label = stretch_factors[mildIdx].split(":")[0]
        stretch_factors.splice(mildIdx, 1)
        supports_fit.push(`${label}: closest area of alignment — near role demands.`)
      }
    }

    // ---- Realm guardrail: cap score for out-of-realm jobs ----
    const realmCheck = checkRealmGuard({
      jobText,
      resumeText: input.resumeText,
      promptAnswers: input.promptAnswers,
    })
    if (realmCheck.capped) {
      alignmentResult.score = Math.min(alignmentResult.score, REALM_CAP)
    }

    // ---- Bottom line (coherent with supports/stretch balance) ----
    const severeCount = alignmentResult.signals.severeContradictions
    const mildCount = alignmentResult.signals.mildTensions
    let bottom_line_2s: string
    if (realmCheck.capped) {
      bottom_line_2s = `This role falls outside your calibrated realm. Some transferable traits may apply, but it is not a direct pattern match.`
    } else if (severeCount > 0 && supports_fit.length === 0) {
      bottom_line_2s = `Structural mismatch in ${severeCount} dimension(s). This role demands capabilities beyond your demonstrated pattern.`
    } else if (severeCount > 0) {
      bottom_line_2s = `${supports_fit.length} area(s) of alignment, but ${severeCount} significant gap(s) require growth beyond your current pattern.`
    } else if (stretch_factors.length > 0) {
      bottom_line_2s = `Solid foundation with ${stretch_factors.length} area(s) of stretch. Manageable growth required.`
    } else if (mildCount > 0 && score < 8) {
      bottom_line_2s = `Near-aligned across all dimensions. Your pattern is close to this role with minor growth areas.`
    } else {
      bottom_line_2s = `Strong structural alignment across all dimensions. Your pattern fits this role well.`
    }

    return {
      ok: true,
      result: {
        alignment: {
          score: alignmentResult.score,
          explanation: alignmentResult.explanation,
          signals: alignmentResult.signals,
          supports_fit,
          stretch_factors,
          bottom_line_2s,
        },
        skillMatch,
        stretchLoad,
      },
    }
  } catch (err: unknown) {
    // Normalize known ingest errors into typed seam errors (no raw throws escape)
    if (isJobIngestError(err)) {
      const code = (err as any).code as IntegrationErrorCode;
      const detail = (err as any).detail as string;
      const meta = (err as any).meta;
      // Only treat UNABLE_TO_EXTRACT_ANY_SIGNAL as fatal
      if (code === "UNABLE_TO_EXTRACT_ANY_SIGNAL") {
        return {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: detail,
          },
        };
      }

      // Preserve strict behavior; map other ingest errors through unchanged
      if (code === "MISSING_JOB_TEXT") {
        return { ok: false, error: { code: "BAD_REQUEST", message: detail } }
      }

      return {
        ok: false,
        error: {
          code: code,
          message: detail,
        },
      }
    }

    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Unexpected internal error",
      },
    }
  }
}

// --------------------------
// Calibration Flow (Milestone 5.1)
// Server-authoritative deterministic state machine entry point.
// --------------------------

export type CalibrationDispatchOk = { ok: true; session: CalibrationSession }
export type CalibrationDispatchErr = { ok: false; error: { code: string; message: string } }
export type CalibrationDispatchResult = CalibrationDispatchOk | CalibrationDispatchErr

export async function dispatchCalibration(event: CalibrationEvent): Promise<CalibrationDispatchResult> {
  const res = await dispatchCalibrationEvent(event)
  if (!res.ok) {
    return { ok: false, error: { code: res.error.code, message: res.error.message } }
  }
  return { ok: true, session: res.session }
}