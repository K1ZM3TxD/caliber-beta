import type { PatternSynthesisOutput } from "./pattern_synthesis";

type PatternSynthesisValidationError = {
  name: "PatternSynthesisValidationError";
  code:
    | "SENTENCE_COUNT_NOT_3"
    | "OPERATE_BEST_BULLETS_NOT_4"
    | "LOSE_ENERGY_BULLETS_NOT_4"
    | "BULLET_WORDS_GT_8"
    | "NON_STRUCTURAL_LANGUAGE_DETECTED";
  detail: string;
  meta?: Record<string, any>;
};

function fail(
  code: PatternSynthesisValidationError["code"],
  detail: string,
  meta?: Record<string, any>
): never {
  const err: PatternSynthesisValidationError = {
    name: "PatternSynthesisValidationError",
    code,
    detail,
    ...(meta ? { meta } : {}),
  };
  throw err;
}

function countSentences(text: string): number {
  // Split on terminators and ignore empty fragments
  return text
    .trim()
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// v1 deterministic banned-terms check (structural language guardrail)
const BANNED_TERMS = [
  "feel",
  "feels",
  "feeling",
  "emotion",
  "emotional",
  "happy",
  "sad",
  "angry",
  "excited",
  "love",
  "hate",
  "passion",
  "motivated",
  "motivation",
  "stress",
  "stressed",
  "anxious",
  "anxiety",
  "depressed",
  "depression",
  "burnout",
  "tired",
  "fatigue",
  "drained",
  "energized",
];

function containsBannedTerm(text: string): { term: string } | null {
  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return { term };
  }
  return null;
}

export function validatePatternSynthesis(output: PatternSynthesisOutput): void {
  const sentences = countSentences(output.structural_summary);
  if (sentences !== 3) {
    fail(
      "SENTENCE_COUNT_NOT_3",
      `structural_summary must contain exactly 3 sentences; found ${sentences}.`,
      { found: sentences }
    );
  }

  if (output.operate_best.length !== 4) {
    fail(
      "OPERATE_BEST_BULLETS_NOT_4",
      `operate_best must have exactly 4 items; found ${output.operate_best.length}.`,
      { found: output.operate_best.length }
    );
  }

  if (output.lose_energy.length !== 4) {
    fail(
      "LOSE_ENERGY_BULLETS_NOT_4",
      `lose_energy must have exactly 4 items; found ${output.lose_energy.length}.`,
      { found: output.lose_energy.length }
    );
  }

  const checkBullets = (label: "operate_best" | "lose_energy", bullets: string[]) => {
    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i];

      const wc = wordCount(bullet);
      if (wc > 8) {
        fail(
          "BULLET_WORDS_GT_8",
          `${label}[${i}] must contain ≤ 8 words; found ${wc}.`,
          { label, index: i, found: wc }
        );
      }

      const banned = containsBannedTerm(bullet);
      if (banned) {
        fail(
          "NON_STRUCTURAL_LANGUAGE_DETECTED",
          `${label}[${i}] contains non-structural language (banned term: "${banned.term}").`,
          { label, index: i, term: banned.term }
        );
      }
    }
  };

  checkBullets("operate_best", output.operate_best);
  checkBullets("lose_energy", output.lose_energy);
}