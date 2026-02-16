// lib/alignment_score.ts

export type AlignmentSignals = {
  personVector: number[]
  roleVector: number[]
  distances: number[]
  severeContradictions: number
  mildTensions: number
  penaltyWeight: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function computeAlignmentScore(args: {
  personVector: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]
  roleVector: [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]
}): { score: number; explanation: string; signals: AlignmentSignals } {
  const P = args.personVector
  const R = args.roleVector

  const d = [
    Math.abs(P[0] - R[0]),
    Math.abs(P[1] - R[1]),
    Math.abs(P[2] - R[2]),
    Math.abs(P[3] - R[3]),
    Math.abs(P[4] - R[4]),
    Math.abs(P[5] - R[5]),
  ]

  let S = 0
  let M = 0
  for (const di of d) {
    if (di === 2) S++
    else if (di === 1) M++
  }

  const n = 6
  const W = 1.0 * S + 0.35 * M
  const raw = 10 * (1 - W / n)
  const score = round1(clamp(raw, 0, 10))

  // Structural, non-emotional explanation; deterministic template.
  const explanation =
    S > 0
      ? `Structural fit shows ${S} severe contradiction(s) and ${M} mild tension(s) across 6 dimensions.`
      : M > 0
        ? `Structural fit shows ${M} mild tension(s) across 6 dimensions and no severe contradictions.`
        : `Structural fit shows no contradictions across 6 dimensions.`

  return {
    score,
    explanation,
    signals: {
      personVector: [...P],
      roleVector: [...R],
      distances: d,
      severeContradictions: S,
      mildTensions: M,
      penaltyWeight: W,
    },
  }
}