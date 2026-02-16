// scripts/skill_match_smoke.ts

import { computeSkillMatch } from "../lib/skill_match"

console.log(
  "CASE A (grounded, no authority stretch) expect: terrain grounded, baseScore 9, authorityModifier 0, finalScore 9",
  computeSkillMatch([1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1])
)

console.log(
  "CASE B (adjacent, diff==1 somewhere, no authority stretch) expect: terrain adjacent, baseScore 6, authorityModifier 0, finalScore 6",
  computeSkillMatch([2, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1])
)

console.log(
  "CASE C (new, diff>=2 somewhere, no authority stretch) expect: terrain new, baseScore 3, authorityModifier 0, finalScore 3",
  computeSkillMatch([3, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1])
)

console.log(
  "CASE D (authority stretch modifier applied at index 1) expect: terrain adjacent, baseScore 6, authorityModifier -1, finalScore 5",
  computeSkillMatch([1, 2, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1])
)