export type CalibrationPromptIndex = 1 | 2 | 3 | 4 | 5

export const CALIBRATION_PROMPTS: Record<CalibrationPromptIndex, string> = {
  1: "In your most recent role, what part of the work felt most like you?",
  2: "What part of the role drained you fastest?",
  3: "What do others come to you for that isn’t necessarily in your job description?",
  4: "What type of challenge feels exciting rather than overwhelming?",
  5: "Outside of work, what do you spend time practicing, improving, or maintaining? 2–4 bullets.",
} as const

export function getCalibrationPrompt(n: CalibrationPromptIndex): string {
  return CALIBRATION_PROMPTS[n]
}