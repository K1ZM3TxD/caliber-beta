// Job sub-object for session
export interface CalibrationJob {
  rawText: string;
  roleVector: any | null;
  completed: boolean;
}
// Canonical shared types for the calibration flow.
// (Matches usage in lib/calibration_machine.ts and API routes.)

// All possible state strings used in calibration_machine
export type CalibrationState =
  | "RESUME_INGEST"
  | "PROMPT_1"
  | "PROMPT_2"
  | "PROMPT_3"
  | "PROMPT_4"
  | "PROMPT_5"
  | "PROMPT_1_CLARIFIER"
  | "PROMPT_2_CLARIFIER"
  | "PROMPT_3_CLARIFIER"
  | "PROMPT_4_CLARIFIER"
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
  | "PROCESSING"
  | "ERROR";

// Error type for machine and API
export type CalibrationError = {
  code:
    | "SESSION_NOT_FOUND"
    | "INVALID_EVENT_FOR_STATE"
    | "UNSUPPORTED_FILE_TYPE"
    | "JOB_REQUIRED"
    | "INTERNAL"
    | string;
  message: string;
};

// Discriminated union of all event types used in calibration_machine and API
// NOTE: /api/calibration/resume-upload submits { type: "SUBMIT_RESUME", sessionId, resumeText }
export type CalibrationEvent =
  | { type: "CREATE_SESSION" }
  | { type: "SUBMIT_RESUME"; sessionId: string; resumeText: string }
  | { type: "SUBMIT_PROMPT_ANSWER"; sessionId: string; answer: string }
  | { type: "SUBMIT_PROMPT_CLARIFIER_ANSWER"; sessionId: string; answer: string }
  | { type: "TITLE_FEEDBACK"; sessionId: string; feedback: string }
  | { type: "ADVANCE"; sessionId: string }
  | { type: "SUBMIT_JOB_TEXT"; sessionId: string; jobText: string }
  | { type: "COMPUTE_ALIGNMENT_OUTPUT"; sessionId: string }
  | { type: "RESET_SESSION"; sessionId: string }
  | { type: "ENCODING_COMPLETE"; sessionId: string };

// History entry for session
// NOTE: calibration_machine.pushHistory stores { at: nowIso(), ..., event: string }
export interface CalibrationHistoryEntry {
  at: string; // ISO timestamp
  from: CalibrationState;
  to: CalibrationState;
  event: string; // event.type (stored as string)
}

// Resume signals structure (machine treats this as nullable)
export type ResumeSignals =
  | { charLen: number; hasBullets: boolean; hasDates: boolean; hasTitles: boolean }
  | null
  | undefined;

// Resume object
export interface CalibrationResume {
  rawText: string;
  signals: ResumeSignals;
}

// Prompt slot structure
export interface CalibrationPromptSlot {
  accepted: boolean;
  answer: string;
  frozen?: boolean;
  clarifier?: {
    asked?: boolean;
    answer: string;
  };
}

// Prompts object keyed 1..5 (machine indexes session.prompts[i])
export type CalibrationPrompts = {
  [key: number]: CalibrationPromptSlot;
};

// Person vector structure (machine uses 6 dims of 0|1|2)
export interface CalibrationPersonVector {
  values: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] | null;
  locked: boolean;
}

// Encoding ritual structure
export interface CalibrationEncodingRitual {
  completed: boolean;
}

// Consolidation ritual (scripts assert progressPct exists during CONSOLIDATION_RITUAL)
export interface CalibrationConsolidationRitual {
  progressPct: number;
  step?: number;
  startedAtIso?: string | null;
  lastTickAtIso?: string | null;
  completedAtIso?: string | null;
  message?: string | null;
  completed?: boolean;
}

// Synthesis payload (scripts assert these exist)
export interface CalibrationSynthesis {
  patternSummary: string | null;
  operateBest: string[] | null;
  loseEnergy: string[] | null;

  // Optional title fields (kept for compatibility if present)
  identitySummary?: string | null;
  marketTitle?: string | null;
  titleExplanation?: string | null;
  lastTitleFeedback?: string | null;
  titleCandidates?: Array<{ title: string; score: number }>;

  // Optional anchor metrics fields (kept for compatibility)
  anchor_overlap_score?: number;
  missing_anchor_count?: number;
  missing_anchor_terms?: string[];
}

// Main session interface used by calibration_machine/store
export interface CalibrationSession {
  sessionId: string;
  state: CalibrationState;
  history: CalibrationHistoryEntry[];

  resume: CalibrationResume;
  prompts: CalibrationPrompts;

  personVector: CalibrationPersonVector;
  encodingRitual: CalibrationEncodingRitual;

  // Optional sub-objects used in some states
  consolidationRitual?: CalibrationConsolidationRitual;
  synthesis?: CalibrationSynthesis;
  job?: CalibrationJob;

  // Result object (shape defined elsewhere)
  result?: any;
}