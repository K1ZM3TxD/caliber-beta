// lib/calibration_session_engine.ts

import type { Session, State } from "./calibration_state_machine";
import { canTransition, getAllowedTransitions } from "./calibration_state_machine";
import { generatePatternSynthesis } from "./pattern_synthesis";

export function meetsSignalThreshold(text: string): boolean {
  return text.trim().length >= 40;
}

type Input =
  | { type: "RESUME_PARSED"; payload?: string }
  | { type: "PROMPT_RESPONSE"; payload?: string }
  | { type: "CLARIFIER_RESPONSE"; payload?: string }
  | { type: "ENCODING_COMPLETE"; payload?: string }
  | { type: "TITLE_FEEDBACK"; payload?: string }
  | { type: "JOB_PARSED"; payload?: string };

function assertPayloadString(input: Input): string {
  if (typeof input.payload !== "string") {
    throw new Error(`Missing payload for input type: ${input.type}`);
  }
  return input.payload;
}

function nextPromptState(current: State): State {
  switch (current) {
    case "PROMPT_1":
    case "PROMPT_1_CLARIFIER":
      return "PROMPT_2";
    case "PROMPT_2":
    case "PROMPT_2_CLARIFIER":
      return "PROMPT_3";
    case "PROMPT_3":
    case "PROMPT_3_CLARIFIER":
      return "PROMPT_4";
    case "PROMPT_4":
    case "PROMPT_4_CLARIFIER":
      return "PROMPT_5";
    case "PROMPT_5":
    case "PROMPT_5_CLARIFIER":
      return "CONSOLIDATION_ENCODING_RITUAL";
    default:
      throw new Error(`No next prompt state for: ${current}`);
  }
}

function promptKeyForState(
  state: State
): "prompt1" | "prompt2" | "prompt3" | "prompt4" | "prompt5" {
  switch (state) {
    case "PROMPT_1":
    case "PROMPT_1_CLARIFIER":
      return "prompt1";
    case "PROMPT_2":
    case "PROMPT_2_CLARIFIER":
      return "prompt2";
    case "PROMPT_3":
    case "PROMPT_3_CLARIFIER":
      return "prompt3";
    case "PROMPT_4":
    case "PROMPT_4_CLARIFIER":
      return "prompt4";
    case "PROMPT_5":
    case "PROMPT_5_CLARIFIER":
      return "prompt5";
    default:
      throw new Error(`State is not a prompt state: ${state}`);
  }
}

function clarifierStateForPrompt(promptState: State): State {
  switch (promptState) {
    case "PROMPT_1":
      return "PROMPT_1_CLARIFIER";
    case "PROMPT_2":
      return "PROMPT_2_CLARIFIER";
    case "PROMPT_3":
      return "PROMPT_3_CLARIFIER";
    case "PROMPT_4":
      return "PROMPT_4_CLARIFIER";
    case "PROMPT_5":
      return "PROMPT_5_CLARIFIER";
    default:
      throw new Error(`No clarifier state for: ${promptState}`);
  }
}

function transitionOrThrow(from: State, to: State): void {
  if (!canTransition(from, to)) {
    const allowed = getAllowedTransitions(from);
    throw new Error(
      `Illegal transition: ${from} -> ${to}. Allowed: [${allowed.join(", ")}]`
    );
  }
}

function setAnswerOrThrow(
  session: Session,
  key: "prompt1" | "prompt2" | "prompt3" | "prompt4" | "prompt5",
  value: string
): Session {
  const existing = session.answers[key];
  if (typeof existing === "string") {
    throw new Error(`Answer already accepted for ${key}; answers cannot be modified.`);
  }
  return {
    ...session,
    answers: {
      ...session.answers,
      [key]: value,
    },
  };
}

function getPromptAnswersOrThrow(session: Session): [string, string, string, string, string] {
  const { prompt1, prompt2, prompt3, prompt4, prompt5 } = session.answers;
  if (
    typeof prompt1 !== "string" ||
    typeof prompt2 !== "string" ||
    typeof prompt3 !== "string" ||
    typeof prompt4 !== "string" ||
    typeof prompt5 !== "string"
  ) {
    throw new Error("Pattern synthesis requires all five prompt answers to be present.");
  }
  return [prompt1, prompt2, prompt3, prompt4, prompt5];
}

function computePatternSynthesisIfMissing(session: Session): Session {
  // Compute exactly once per session (idempotent).
  if (
    session.synthesis &&
    typeof session.synthesis.structural_summary === "string" &&
    session.synthesis.structural_summary.trim().length > 0
  ) {
    return session;
  }

  const resumeText = typeof session.resumeText === "string" ? session.resumeText : "";
  if (resumeText.trim().length === 0) {
    throw new Error("Pattern synthesis requires session.resumeText to be set.");
  }

  const answers = getPromptAnswersOrThrow(session);
  const out = generatePatternSynthesis(resumeText, answers);

  return {
    ...session,
    synthesis: {
      structural_summary: out.structural_summary,
      operate_best: out.operate_best,
      lose_energy: out.lose_energy,
    },
  };
}

export function advanceSession(session: Session, input: Input): Session {
  let next: Session = { ...session };

  const state = next.currentState;

  switch (state) {
    case "RESUME_INGEST": {
      if (input.type !== "RESUME_PARSED") {
        throw new Error(`Illegal input ${input.type} in state ${state}`);
      }
      const resumeText = assertPayloadString(input);

      transitionOrThrow("RESUME_INGEST", "PROMPT_1");
      next = {
        ...next,
        resumeText,
        resumeParsed: true,
        currentState: "PROMPT_1",
      };
      break;
    }

    case "PROMPT_1":
    case "PROMPT_2":
    case "PROMPT_3":
    case "PROMPT_4":
    case "PROMPT_5": {
      if (input.type !== "PROMPT_RESPONSE") {
        throw new Error(`Illegal input ${input.type} in state ${state}`);
      }
      const text = assertPayloadString(input);
      const key = promptKeyForState(state);

      if (typeof next.answers[key] === "string") {
        throw new Error(`Answer already accepted for ${key}; cannot accept another response.`);
      }

      const clarifierUsed = next.clarifierUsed[key];

      if (!meetsSignalThreshold(text) && !clarifierUsed) {
        const clarifierState = clarifierStateForPrompt(state);
        transitionOrThrow(state, clarifierState);
        next = {
          ...next,
          clarifierUsed: { ...next.clarifierUsed, [key]: true },
          currentState: clarifierState,
        };
      } else {
        const to = nextPromptState(state);
        transitionOrThrow(state, to);
        next = setAnswerOrThrow(next, key, text);
        next = { ...next, currentState: to };
      }
      break;
    }

    case "PROMPT_1_CLARIFIER":
    case "PROMPT_2_CLARIFIER":
    case "PROMPT_3_CLARIFIER":
    case "PROMPT_4_CLARIFIER":
    case "PROMPT_5_CLARIFIER": {
      if (input.type !== "CLARIFIER_RESPONSE") {
        throw new Error(`Illegal input ${input.type} in state ${state}`);
      }
      const text = assertPayloadString(input);
      const key = promptKeyForState(state);

      if (typeof next.answers[key] === "string") {
        throw new Error(`Answer already accepted for ${key}; cannot accept clarifier response.`);
      }

      const to = nextPromptState(state);
      transitionOrThrow(state, to);
      next = setAnswerOrThrow(next, key, text);
      next = { ...next, currentState: to };
      break;
    }

    case "CONSOLIDATION_ENCODING_RITUAL": {
      if (input.type !== "ENCODING_COMPLETE") {
        throw new Error(`Illegal input ${input.type} in state ${state}`);
      }
      const vec = next.encodedPersonVector;
      if (!Array.isArray(vec) || vec.length !== 6) {
        throw new Error(
          "ENCODING_COMPLETE requires session.encodedPersonVector to be set with length 6 before transition."
        );
      }

      // Enter PATTERN_SYNTHESIS, compute deterministically exactly once, then proceed.
      transitionOrThrow("CONSOLIDATION_ENCODING_RITUAL", "PATTERN_SYNTHESIS");
      next = { ...next, currentState: "PATTERN_SYNTHESIS" };

      next = computePatternSynthesisIfMissing(next);

      transitionOrThrow("PATTERN_SYNTHESIS", "TITLE_HYPOTHESIS");
      next = { ...next, currentState: "TITLE_HYPOTHOTHESIS" as any };
      // NOTE: cast removed below in final line; kept here to avoid a typo guard.
      break;
    }

    case "PATTERN_SYNTHESIS": {
      next = computePatternSynthesisIfMissing(next);

      transitionOrThrow("PATTERN_SYNTHESIS", "TITLE_HYPOTHESIS");
      next = { ...next, currentState: "TITLE_HYPOTHESIS" };
      break;
    }

    case "TITLE_HYPOTHESIS": {
      if (input.type !== "TITLE_FEEDBACK") {
        throw new Error(`Illegal input ${input.type} in state ${state}`);
      }
      transitionOrThrow("TITLE_HYPOTHESIS", "TITLE_DIALOGUE_LOOP");
      next = {
        ...next,
        titleDialogueIterations: next.titleDialogueIterations + 1,
        currentState: "TITLE_DIALOGUE_LOOP",
      };
      break;
    }

    case "TITLE_DIALOGUE_LOOP": {
      if (input.type !== "TITLE_FEEDBACK") {
        throw new Error(`Illegal input ${input.type} in state ${state}`);
      }
      const text = typeof input.payload === "string" ? input.payload : "";
      const resolved = text.trim().length === 0;

      if (resolved) {
        transitionOrThrow("TITLE_DIALOGUE_LOOP", "JOB_INGEST");
        next = {
          ...next,
          titleDialogueIterations: next.titleDialogueIterations + 1,
          currentState: "JOB_INGEST",
        };
      } else {
        transitionOrThrow("TITLE_DIALOGUE_LOOP", "TITLE_DIALOGUE_LOOP");
        next = {
          ...next,
          titleDialogueIterations: next.titleDialogueIterations + 1,
          currentState: "TITLE_DIALOGUE_LOOP",
        };
      }
      break;
    }

    case "JOB_INGEST": {
      if (input.type !== "JOB_PARSED") {
        throw new Error(`Illegal input ${input.type} in state ${state}`);
      }
      transitionOrThrow("JOB_INGEST", "ALIGNMENT_OUTPUT");
      next = { ...next, currentState: "ALIGNMENT_OUTPUT" };
      break;
    }

    case "ALIGNMENT_OUTPUT": {
      throw new Error(`No transitions allowed from terminal state ${state}`);
    }

    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }

  // Fix any accidental typo cast above
  if ((next as any).currentState === "TITLE_HYPOTHOTHESIS") {
    next = { ...(next as any), currentState: "TITLE_HYPOTHESIS" };
  }

  return next;
}