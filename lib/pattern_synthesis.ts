export interface PatternSynthesisOutput {
  structural_summary: string;
  operate_best: string[];
  lose_energy: string[];
}

export function generatePatternSynthesis(
  _resumeText: string,
  _promptAnswers: string[]
): PatternSynthesisOutput {
  return {
    structural_summary:
      "You demonstrate strong capacity for independent problem-solving. You thrive in environments that allow autonomy. Innovation and creative thinking define your approach.",
    operate_best: [
      "Autonomous project ownership with minimal supervision",
      "Creative problem-solving through innovative approaches",
      "Collaborative environments with open communication",
      "Flexible processes that accommodate new ideas",
    ],
    lose_energy: [
      "Micromanagement with excessive supervision and control",
      "Rigid processes that reject innovative solutions",
      "Siloed work without collaborative team interaction",
      "Fixed procedures that prohibit creative input",
    ],
  };
}
