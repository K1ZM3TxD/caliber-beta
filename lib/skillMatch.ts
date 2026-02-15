// Skill Match Computation
// LOCKED FORMULA - DO NOT MODIFY

import { ClassifiedRequirement, SkillMatchResult } from './types';

/**
 * Computes the Skill Match score from classified requirements.
 * 
 * grounded_effective = category=="grounded" AND scope_matched_outcome==true
 * otherwise:
 *   if category=="grounded" and scope_matched_outcome==false → treat as adjacent
 * 
 * Weights:
 *   grounded = 1.0
 *   adjacent = 0.5
 *   new = 0.0
 * 
 * raw = (1.0*G + 0.5*A + 0.0*N) / T
 * SkillMatch = round(10*raw, 1)
 * If T==0: SkillMatch = 5.0
 */
export function computeSkillMatch(
  classifiedRequirements: ClassifiedRequirement[]
): SkillMatchResult {
  const total = classifiedRequirements.length;

  if (total === 0) {
    return {
      score: 5.0,
      groundedCount: 0,
      adjacentCount: 0,
      newCount: 0,
      total: 0,
    };
  }

  let groundedCount = 0;
  let adjacentCount = 0;
  let newCount = 0;

  for (const req of classifiedRequirements) {
    if (req.category === 'grounded' && req.scope_matched_outcome) {
      groundedCount++;
    } else if (
      req.category === 'grounded' && !req.scope_matched_outcome ||
      req.category === 'adjacent'
    ) {
      adjacentCount++;
    } else if (req.category === 'new') {
      newCount++;
    }
  }

  const raw = (1.0 * groundedCount + 0.5 * adjacentCount + 0.0 * newCount) / total;
  const score = Math.round(10 * raw * 10) / 10; // Round to 1 decimal place

  return {
    score,
    groundedCount,
    adjacentCount,
    newCount,
    total,
  };
}
