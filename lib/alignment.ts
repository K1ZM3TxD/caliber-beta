// Alignment Score Computation
// LOCKED FORMULA - DO NOT MODIFY

import { Vector, AlignmentResult } from './types';

/**
 * Computes the alignment score between person and role vectors.
 * 
 * For each dimension i:
 * d_i = abs(P_i - R_i)
 * S = count(d_i == 2)  // severe mismatches
 * M = count(d_i == 1)  // moderate mismatches
 * W = 1.0*S + 0.35*M
 * raw = 10 * (1 - W / 6)
 * Alignment = round(clamp(raw, 0, 10), 1)
 */
export function computeAlignment(
  personVector: Vector,
  roleVector: Vector
): AlignmentResult {
  const dimensions: (keyof Vector)[] = [
    'structural_maturity',
    'authority_scope',
    'revenue_orientation',
    'role_ambiguity',
    'breadth_vs_depth',
    'stakeholder_density',
  ];

  let severeMismatches = 0;
  let moderateMismatches = 0;

  for (const dim of dimensions) {
    const diff = Math.abs(personVector[dim] - roleVector[dim]);
    if (diff === 2) {
      severeMismatches++;
    } else if (diff === 1) {
      moderateMismatches++;
    }
  }

  const W = 1.0 * severeMismatches + 0.35 * moderateMismatches;
  const raw = 10 * (1 - W / 6);
  const clamped = Math.max(0, Math.min(10, raw));
  const score = Math.round(clamped * 10) / 10; // Round to 1 decimal place

  return {
    score,
    severeMismatches,
    moderateMismatches,
  };
}
