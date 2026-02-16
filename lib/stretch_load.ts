// lib/stretch_load.ts

export type StretchLoadBand = "low" | "moderate" | "high" | "severe"

export interface StretchLoadResult {
  band: StretchLoadBand
  numeric: number
  explanation: string
}

export function computeStretchLoad(finalSkillMatchScore: number): StretchLoadResult {
  if (finalSkillMatchScore < 0 || finalSkillMatchScore > 10) {
    throw new Error("Invalid Skill Match score")
  }

  let band: StretchLoadBand
  let explanation: string

  if (finalSkillMatchScore >= 8) {
    band = "low"
    explanation =
      "Minimal adaptation load. Execution terrain largely matches demonstrated authority and scope."
  } else if (finalSkillMatchScore >= 5) {
    band = "moderate"
    explanation =
      "Manageable adaptation load. Some structural expansion required across scope or authority."
  } else if (finalSkillMatchScore >= 3) {
    band = "high"
    explanation =
      "Significant adaptation load. Multiple dimensions require scope or authority expansion."
  } else {
    band = "severe"
    explanation =
      "Extreme adaptation load. Structural mismatch across core authority or scope dimensions."
  }

  let numeric = 10 - finalSkillMatchScore
  if (numeric < 0) numeric = 0
  else if (numeric > 10) numeric = 10

  return { band, numeric, explanation }
}