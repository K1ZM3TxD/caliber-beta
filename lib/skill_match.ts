// lib/skill_match.ts

export type TerrainClass = "grounded" | "adjacent" | "new"

export interface SkillMatchResult {
  terrain: TerrainClass
  baseScore: number
  authorityModifier: number
  finalScore: number
}

export function classifyTerrain(roleVector: number[], experienceVector: number[]): TerrainClass {
  if (roleVector.length !== 6 || experienceVector.length !== 6) {
    throw new Error("Invalid vector length")
  }

  let hasDiffEq1 = false

  for (let i = 0; i < 6; i++) {
    const d = roleVector[i] - experienceVector[i]

    if (d >= 2) return "new"
    if (d === 1) hasDiffEq1 = true
  }

  if (hasDiffEq1) return "adjacent"
  return "grounded"
}

export function computeBaseSkillScore(terrain: TerrainClass): number {
  if (terrain === "grounded") return 9
  if (terrain === "adjacent") return 6
  return 3
}

export function computeSkillMatch(
  roleVector: number[],
  experienceVector: number[]
): SkillMatchResult {
  if (roleVector.length !== 6 || experienceVector.length !== 6) {
    throw new Error("Invalid vector length")
  }

  const terrain = classifyTerrain(roleVector, experienceVector)
  const baseScore = computeBaseSkillScore(terrain)

  const authorityDelta = roleVector[1] - experienceVector[1]

  let authorityModifier = 0
  if (authorityDelta === 1) authorityModifier = -1
  else if (authorityDelta >= 2) authorityModifier = -2

  let finalScore = baseScore + authorityModifier

  if (finalScore < 0) finalScore = 0
  else if (finalScore > 10) finalScore = 10

  return {
    terrain,
    baseScore,
    authorityModifier,
    finalScore,
  }
}