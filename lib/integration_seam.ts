// lib/integration_seam.ts

import { ingestJob, isJobIngestError, type JobIngestObject, type JobIngestDimensionKey } from "@/lib/job_ingest"
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

export type IntegrationSeamOk = {
  ok: true
  result: {
    // NOTE: until a separate Alignment engine module exists in /lib,
    // we treat the job ingestion/encoding output as the “alignment-side” raw output
    // for integration smoke purposes. No blending occurs.
    alignment: JobIngestObject
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

    // ---- Skill Match (delegated) ----
    const skillMatch = computeSkillMatch(ingestResult.roleVector, experienceVector)

    // ---- Stretch Load (delegated; inverse of Skill Match) ----
    const stretchLoad = computeStretchLoad(skillMatch.finalScore)

    return {
      ok: true,
      result: {
        alignment: ingestResult,
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