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
      "Based on your experience and responses, you demonstrate a strong capacity for independent problem-solving and creative thinking. You thrive in environments that allow autonomy and value innovation.",
    operate_best: [
      "Autonomous project ownership with minimal supervision",
      "Creative problem-solving and innovative approaches",
      "Collaborative environments with open communication",
    ],
    lose_energy: [
      "Micromanagement and excessive oversight",
      "Rigid, unchanging processes without room for improvement",
      "Siloed work without team collaboration",
    ],
  };
}
