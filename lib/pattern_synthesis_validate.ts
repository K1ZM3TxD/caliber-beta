import type { PatternSynthesisOutput } from "./pattern_synthesis";

export function validatePatternSynthesis(output: PatternSynthesisOutput): void {
  // structural_summary has exactly 3 sentences (count by ., !, ? terminators; ignore empty fragments)
  const parts = output.structural_summary
    .trim()
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length !== 3) {
    throw new Error(
      `Pattern synthesis validation failed: structural_summary must have exactly 3 sentences (found ${parts.length}).`
    );
  }

  // operate_best.length === 4
  if (output.operate_best.length !== 4) {
    throw new Error(
      `Pattern synthesis validation failed: operate_best must have exactly 4 items (found ${output.operate_best.length}).`
    );
  }

  // lose_energy.length === 4
  if (output.lose_energy.length !== 4) {
    throw new Error(
      `Pattern synthesis validation failed: lose_energy must have exactly 4 items (found ${output.lose_energy.length}).`
    );
  }

  // Each bullet in both arrays has ≤ 8 words (split on whitespace)
  const checkBullets = (
    label: "operate_best" | "lose_energy",
    bullets: string[]
  ) => {
    for (let i = 0; i < bullets.length; i++) {
      const wordCount = bullets[i].trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 8) {
        throw new Error(
          `Pattern synthesis validation failed: ${label}[${i}] must have ≤ 8 words (found ${wordCount}).`
        );
      }
    }
  };

  checkBullets("operate_best", output.operate_best);
  checkBullets("lose_energy", output.lose_energy);
}