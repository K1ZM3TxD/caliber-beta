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

export interface CalibrationError {
  code:
    | "SESSION_NOT_FOUND"
    | "MISSING_REQUIRED_FIELD"
    | "BAD_REQUEST"
    | "INVALID_EVENT_FOR_STATE"
    | "JOB_REQUIRED"
    | "JOB_ENCODING_INCOMPLETE"
    | "INTERNAL"
    | "RITUAL_NOT_READY"
    | "PROMPT_FROZEN"
    | "INSUFFICIENT_SIGNAL_AFTER_CLARIFIER"
  message: string
}

export type CalibrationEvent = { type: string; sessionId?: string; [key: string]: any }

interface PromptSlot {
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

export interface CalibrationSession {
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
    values: number[] | null
    locked: boolean
  }
  encodingRitual: {
    completed: boolean
  }
  consolidationRitual: {
    startedAtIso: string | null
    lastTickAtIso: string | null
    progressPct: number
    step: number
    message: string | null
    completed: boolean
  }
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

    // Anchor metrics
    anchor_overlap_score?: number
    missing_anchor_count?: number
    missing_anchor_terms?: string[]
  } | null
  job: {
    rawText: string | null
    roleVector: any
    completed: boolean
  }
  result: any | null
  history: {
    at: string
    from: CalibrationState
    to: CalibrationState
    event: string
  }[]
}