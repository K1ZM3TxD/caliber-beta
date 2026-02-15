// Stretch Load Computation
// LOCKED FORMULA - DO NOT MODIFY

import { SkillMatchResult, StretchLoadResult } from './types';

/**
 * Computes the Stretch Load percentage.
 * 
 * StretchLoad = round(100 * (1 - raw_skill_match), 0)
 * Numeric only, no bands, no contextualization
 */
export function computeStretchLoad(
  skillMatchResult: SkillMatchResult
): StretchLoadResult {
  const rawSkillMatch = skillMatchResult.score / 10;
  const percentage = Math.round(100 * (1 - rawSkillMatch));

  return {
    percentage,
  };
}
