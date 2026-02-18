// lib/calibration_types.ts

import type { CaliberResultContract } from "@/lib/result_contract"

export type CalibrationState =
  | "RESUME_INGEST"
  | "PROMPT_1"
  | "PROMPT_1_CLARIFIER"
  | "PROMPT_2"
  | "PROMPT_2_CLARIFIER"
  | "PROMPT_3"
  | "PROMPT_3_CLARIFIER"
  | "PROMPT_4"
  | "PROMPT_4_CLARIFIER"
  | "PROMPT_5"
  | "PROMPT_5_CLARIFIER"
  | "CONSOLIDATION_PENDING"
  | "CONSOLIDATION_RITUAL"
  | "ENCODING_RITUAL"
  | "PATTERN_SYNTHESIS"
  | "TITLE_HYPOTHESIS"
  | "TITLE_DIALOGUE"
  | "JOB_INGEST"
  | "ALIGNMENT_OUTPUT"
  | "TERMINAL_COMPLETE"

export type BadRequestCode =
  // Generic normalized codes (needed for deterministic API contract)
  | "BAD_REQUEST"
  | "INTERNAL"
  // Existing calibration codes
  | "INVALID_EVENT_FOR_STATE"
  | "FORBIDDEN_TRANSITION"
  | "SESSION_NOT_FOUND"
  | "MISSING_REQUIRED_FIELD"
  | "PROMPT_FROZEN"
  | "INSUFFICIENT_SIGNAL_AFTER_CLARIFIER"
  | "JOB_REQUIRED"
  | "JOB_ENCODING_INCOMPLETE"
  | "RITUAL_NOT_READY"

export type CalibrationError = { code: BadRequestCode; message: string }

export type PromptSlot = {
  question: string
  answer: string | null
  accepted: boolean
  frozen: boolean
  clarifier: {
    asked: boolean
    question: string | null
    answer: string | null
  }
}

export type ConsolidationRitual = {
  startedAtIso: string | null
  lastTickAtIso: string | null
  progressPct: number
  step: number
  message: string | null
  completed: boolean
}

export type CalibrationSession = {
  sessionId: string
  state: CalibrationState

  resume: {
    rawText: string | null
    completed: boolean
    signals: {
      charLen: number
      hasBullets: boolean
      hasDates: boolean
      hasTitles: boolean
    } | null
  }

  prompts: {
    1: PromptSlot
    2: PromptSlot
    3: PromptSlot
    4: PromptSlot
    5: PromptSlot
  }

  personVector: {
    values: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] | null
    locked: boolean
  }

  encodingRitual: {
    completed: boolean
  }

  consolidationRitual: ConsolidationRitual

  synthesis: {
    // Pattern synthesis (structural, no tone)
    patternSummary: string | null
    operateBest: string[] | null
    loseEnergy: string[] | null

    // Title hypothesis
    identitySummary: string | null
    marketTitle: string | null
    titleExplanation: string | null

    // Title dialogue
    lastTitleFeedback: string | null
  } | null

  job: {
    rawText: string | null
    roleVector: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] | null
    completed: boolean
  }

  result: CaliberResultContract | null

  history: Array<{
    at: string
    from: CalibrationState
    to: CalibrationState
    event: string
  }>
}

export type CalibrationEvent =
  | { type: "CREATE_SESSION" }
  | { type: "SUBMIT_RESUME"; sessionId: string; resumeText: string }
  | { type: "SUBMIT_PROMPT_ANSWER"; sessionId: string; answer: string }
  | { type: "SUBMIT_PROMPT_CLARIFIER_ANSWER"; sessionId: string; answer: string }
  | { type: "ENCODING_COMPLETE"; sessionId: string }
  | { type: "TITLE_FEEDBACK"; sessionId: string; feedback: string }
  | { type: "SUBMIT_JOB_TEXT"; sessionId: string; jobText: string }
  | { type: "ADVANCE"; sessionId: string }
  | { type: "COMPUTE_ALIGNMENT_OUTPUT"; sessionId: string }