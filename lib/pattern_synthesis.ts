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
      "Your working pattern centers on autonomous execution within clearly defined structural boundaries. You operate best when scope is owned end-to-end and decision rights are explicit. Energy declines when authority is constrained but accountability remains high.",

    operate_best: [
      "Clear authority with defined ownership",
      "End-to-end scope control",
      "Structured autonomy within boundaries",
      "Direct stakeholder communication",
    ],

    lose_energy: [
      "Shared authority without ownership",
      "Fragmented scope without control",
      "Ambiguous autonomy without structure",
      "Layered communication through intermediaries",
    ],
  };
}