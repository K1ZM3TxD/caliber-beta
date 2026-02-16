// lib/integration_seam.ts

import { ingestJob, isJobIngestError, type JobIngestObject } from "@/lib/job_ingest"
import { computeSkillMatch, type SkillMatchResult } from "@/lib/skill_match"
import { computeStretchLoad, type StretchLoadResult } from "@/lib/stretch_load"

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
      return {
        ok: false,
        error: {
          code: err.code,
          message: err.detail,
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