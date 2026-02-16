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
  | "ENCODING_RITUAL"
  | "PATTERN_SYNTHESIS"
  | "TITLE_HYPOTHESIS"
  | "TITLE_DIALOGUE"
  | "ALIGNMENT_OUTPUT"
  | "TERMINAL_COMPLETE"

export type BadRequestCode =
  | "INVALID_EVENT_FOR_STATE"
  | "FORBIDDEN_TRANSITION"
  | "SESSION_NOT_FOUND"
  | "MISSING_REQUIRED_FIELD"
  | "PROMPT_FROZEN"
  | "INSUFFICIENT_SIGNAL_AFTER_CLARIFIER"

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

  synthesis: {
    titleHypothesis: string | null
    patternSummary: string | null
    operateBest: string[] | null
    loseEnergy: string[] | null
  } | null

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
  | { type: "ADVANCE"; sessionId: string }
  | { type: "COMPUTE_ALIGNMENT_OUTPUT"; sessionId: string }