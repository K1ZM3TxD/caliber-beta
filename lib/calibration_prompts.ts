export type CalibrationPromptIndex = 1 | 2 | 3 | 4 | 5

export const CALIBRATION_PROMPTS: Record<CalibrationPromptIndex, string> = {
  1: "In your most recent role, what part of the work felt most like you?",
  2: "Prompt 2: Describe the environments where you consistently lose time or momentum (structural factors only).",
  3: "Prompt 3: Describe the decisions you take ownership of and the decisions you escalate.",
  4: "Prompt 4: Describe the scope and complexity you handle without strain.",
  5: "Prompt 5: Describe the conditions you need for sustained energy and repeatable delivery.",
} as const

export function getCalibrationPrompt(n: CalibrationPromptIndex): string {
  return CALIBRATION_PROMPTS[n]
}