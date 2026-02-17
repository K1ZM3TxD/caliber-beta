// lib/calibration_state_machine.ts

export type State =
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
  | "CONSOLIDATION_ENCODING_RITUAL"
  | "PATTERN_SYNTHESIS"
  | "TITLE_HYPOTHESIS"
  | "TITLE_DIALOGUE_LOOP"
  | "JOB_INGEST"
  | "ALIGNMENT_OUTPUT";

export interface Session {
  currentState: State;
  resumeParsed: boolean;
  answers: {
    prompt1?: string;
    prompt2?: string;
    prompt3?: string;
    prompt4?: string;
    prompt5?: string;
  };
  clarifierUsed: {
    prompt1: boolean;
    prompt2: boolean;
    prompt3: boolean;
    prompt4: boolean;
    prompt5: boolean;
  };
  encodedPersonVector?: number[]; // length 6
  encodedRoleVector?: number[]; // length 6
  alignmentScore?: number;
  skillMatchScore?: number;
  stretchLoad?: number;
  titleDialogueIterations: number;
}

/**
 * Returns the strictly valid forward transitions from the given state.
 * - No skipping states.
 * - No synthesis before encoding (PATTERN_SYNTHESIS only after CONSOLIDATION_ENCODING_RITUAL).
 * - No backward transitions, except TITLE_DIALOGUE_LOOP self-loop.
 */
export function getAllowedTransitions(state: State): State[] {
  switch (state) {
    case "RESUME_INGEST":
      return ["PROMPT_1"];

    case "PROMPT_1":
      return ["PROMPT_1_CLARIFIER", "PROMPT_2"];
    case "PROMPT_1_CLARIFIER":
      return ["PROMPT_2"];

    case "PROMPT_2":
      return ["PROMPT_2_CLARIFIER", "PROMPT_3"];
    case "PROMPT_2_CLARIFIER":
      return ["PROMPT_3"];

    case "PROMPT_3":
      return ["PROMPT_3_CLARIFIER", "PROMPT_4"];
    case "PROMPT_3_CLARIFIER":
      return ["PROMPT_4"];

    case "PROMPT_4":
      return ["PROMPT_4_CLARIFIER", "PROMPT_5"];
    case "PROMPT_4_CLARIFIER":
      return ["PROMPT_5"];

    case "PROMPT_5":
      return ["PROMPT_5_CLARIFIER", "CONSOLIDATION_ENCODING_RITUAL"];
    case "PROMPT_5_CLARIFIER":
      return ["CONSOLIDATION_ENCODING_RITUAL"];

    case "CONSOLIDATION_ENCODING_RITUAL":
      return ["PATTERN_SYNTHESIS"];

    case "PATTERN_SYNTHESIS":
      return ["TITLE_HYPOTHESIS"];

    case "TITLE_HYPOTHESIS":
      return ["TITLE_DIALOGUE_LOOP"];

    case "TITLE_DIALOGUE_LOOP":
      return ["TITLE_DIALOGUE_LOOP", "JOB_INGEST"];

    case "JOB_INGEST":
      return ["ALIGNMENT_OUTPUT"];

    case "ALIGNMENT_OUTPUT":
      return [];

    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/**
 * Pure deterministic transition validator.
 */
export function canTransition(from: State, to: State): boolean {
  const allowed = getAllowedTransitions(from);
  return allowed.includes(to);
}