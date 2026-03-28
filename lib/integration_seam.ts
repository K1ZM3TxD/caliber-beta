// lib/integration_seam.ts

import { ingestJob, isJobIngestError, type JobIngestObject, type JobIngestDimensionKey } from "@/lib/job_ingest"
import { computeAlignmentScore } from "@/lib/alignment_score"
import { computeSkillMatch, type SkillMatchResult } from "@/lib/skill_match"
import { computeStretchLoad, type StretchLoadResult } from "@/lib/stretch_load"

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

/**
 * Build a specific stretch gap explanation using actual evidence phrases extracted
 * from the job text for this dimension. Makes "why is this not higher?" legible —
 * especially when strong broad fit is capped by missing specialist/domain substrate.
 *
 * Falls back to severity-aware generic text when no evidence is available.
 */
function buildStretchGap(
  label: string,
  key: JobIngestDimensionKey,
  evidence: string[],
  distance: number,
  roleLevel: number,
  personLevel: number,
): string {
  // Take the first evidence phrase and cap to 50 chars to stay sidecard-compact.
  const raw = evidence.length > 0 ? evidence[0].trim() : ""
  const snippet = raw.length > 50 ? raw.slice(0, 47) + "…" : raw
  const roleHigher = roleLevel > personLevel

  if (snippet) {
    switch (key) {
      case "breadthVsDepth":
        return roleLevel === 0
          ? `${label}: role requires specialist depth (e.g. "${snippet}") — deeper craft than your demonstrated pattern.`
          : `${label}: role expects broad multi-domain span (e.g. "${snippet}") — wider coverage than your demonstrated pattern.`
      case "structuralMaturity":
        return roleHigher
          ? `${label}: role requires a more formal/structured environment (e.g. "${snippet}") — beyond your demonstrated process maturity.`
          : `${label}: role is less structured than your demonstrated pattern (e.g. "${snippet}") — may underutilize your operational maturity.`
      case "authorityScope":
        return roleHigher
          ? `${label}: role carries broader decision authority (e.g. "${snippet}") — more leadership scope than your demonstrated pattern.`
          : `${label}: role has narrower authority scope (e.g. "${snippet}") — may underutilize your demonstrated leadership experience.`
      case "revenueOrientation":
        return roleHigher
          ? `${label}: role carries direct revenue ownership (e.g. "${snippet}") — more commercial accountability than your demonstrated pattern.`
          : `${label}: role is less revenue-facing than your pattern (e.g. "${snippet}") — commercial skills may be underutilized.`
      case "roleAmbiguity":
        return roleHigher
          ? `${label}: role involves high ambiguity (e.g. "${snippet}") — less defined structure than your demonstrated working style.`
          : `${label}: role is more structured than your demonstrated ambiguity tolerance (e.g. "${snippet}").`
      case "stakeholderDensity":
        return roleHigher
          ? `${label}: role requires complex stakeholder coordination (e.g. "${snippet}") — denser cross-functional demands than demonstrated.`
          : `${label}: role has lighter stakeholder demands (e.g. "${snippet}") than your demonstrated pattern.`
    }
  }

  // No evidence available — severity-aware generic fallback.
  return distance >= 2
    ? `${label}: significant gap — role demands in this area exceed your demonstrated level.`
    : `${label}: mild gap — role asks for slightly more than your demonstrated level.`
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
    // For gaps, use actual dimension evidence from the job text so stretch
    // factors explain the specific missing substrate (answers "why not higher?").
    const distances = alignmentResult.signals.distances
    const score = alignmentResult.score
    const roleVec = ingestResult.roleVector
    const dimKeys: JobIngestDimensionKey[] = [
      "structuralMaturity", "authorityScope", "revenueOrientation",
      "roleAmbiguity", "breadthVsDepth", "stakeholderDensity",
    ]
    const supports_fit: string[] = []
    const stretch_factors: string[] = []
    for (let i = 0; i < 6; i++) {
      const key = dimKeys[i]
      const label = DIMENSION_LABELS[key]
      const evidence = ingestResult.dimensionEvidence[key]?.evidence ?? []
      const roleLevel = (roleVec[i] ?? 1) as number
      const personLevel = (experienceVector[i] ?? 1) as number
      if (distances[i] === 0) {
        supports_fit.push(`${label}: strong alignment between your pattern and role demands.`)
      } else if (distances[i] === 1) {
        // Only treat near-aligned as a support when the score is truly ceiling-approaching.
        // Below 8.5 (the "strong-but-not-ceiling" range), surface the gap explicitly so the
        // user can see WHY the score stopped where it did ("why is this not higher?").
        if (score >= 8.5) {
          supports_fit.push(`${label}: near-aligned — close to role demands with minor stretch.`)
        } else {
          stretch_factors.push(buildStretchGap(label, key, evidence, 1, roleLevel, personLevel))
        }
      } else {
        stretch_factors.push(buildStretchGap(label, key, evidence, 2, roleLevel, personLevel))
      }
    }

    // Empty-supports guard: for scores ≥ 3, ensure at least one support when
    // all dimensions have some gap but none qualified as supports above.
    // Promote the first distance=1 stretch item to a near-aligned support.
    if (supports_fit.length === 0 && score >= 3 && stretch_factors.length > 0) {
      // Find a stretch item that came from a distance=1 gap (not distance=2 "significant gap")
      const nearAlignedIdx = stretch_factors.findIndex(
        s => !s.includes("significant gap") && !s.includes("exceed your demonstrated")
      )
      const promoteIdx = nearAlignedIdx !== -1 ? nearAlignedIdx : 0
      const label = stretch_factors[promoteIdx].split(":")[0]
      stretch_factors.splice(promoteIdx, 1)
      supports_fit.push(`${label}: closest area of alignment — near role demands.`)
    }

    // ---- Bottom line (coherent with supports/stretch balance) ----
    const severeCount = alignmentResult.signals.severeContradictions
    const mildCount = alignmentResult.signals.mildTensions
    let bottom_line_2s: string
    if (severeCount > 0 && supports_fit.length === 0) {
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