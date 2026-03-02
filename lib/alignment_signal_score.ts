// lib/alignment_signal_score.ts
import { AnchorClassificationOutput, AnchorRecord } from './signal_classification';
import { tokenizeWords } from './text_tokenize';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function matchAnchor(term: string, text: string): boolean {
  const normalizedAnchor = term.normalize('NFKC').toLowerCase().trim();
  if (!normalizedAnchor) return false;

  // Single-word: use fast token-set lookup
  if (!/\s/.test(normalizedAnchor)) {
    const tokenSet = tokenizeWords(text);
    return tokenSet.has(normalizedAnchor);
  }

  // Multi-word: normalized phrase match (case-insensitive, collapse whitespace)
  const normalizedText = text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
  const escapedAnchor = normalizedAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\b|\\s)${escapedAnchor}(?:\\b|\\s|$)`, 'i');
  return re.test(normalizedText);
}

export type AlignmentSignalScoreBreakdown = {
  signalScore: number;
  skillScore: number;
  alignmentScore: number;
  matchedSignalCount: number;
  matchedSkillCount: number;
  signalCount: number;
  skillCount: number;
};

export function computeSignalWeightedAlignment(
  classification: AnchorClassificationOutput,
  text: string
): AlignmentSignalScoreBreakdown {
  const { signalAnchors, skillAnchors } = classification;
  let matchedSignalCount = 0;
  let matchedSkillCount = 0;

  for (const anchor of signalAnchors) {
    if (matchAnchor(anchor.term, text)) matchedSignalCount++;
  }
  for (const anchor of skillAnchors) {
    if (matchAnchor(anchor.term, text)) matchedSkillCount++;
  }

  const signalScore = signalAnchors.length > 0 ? matchedSignalCount / signalAnchors.length : 0;
  const skillScore = skillAnchors.length > 0 ? matchedSkillCount / skillAnchors.length : 0;

  // Renormalize: when one anchor set is empty, use the other set's score entirely
  let alignmentScore: number;
  if (signalAnchors.length === 0 && skillAnchors.length > 0) {
    alignmentScore = skillScore;
  } else if (skillAnchors.length === 0 && signalAnchors.length > 0) {
    alignmentScore = signalScore;
  } else {
    alignmentScore = clamp(signalScore * 0.75 + skillScore * 0.25, 0, 1);
  }

  // Log (single-line, machine-parseable)
  // alignment_signal_score=0.00 alignment_skill_score=0.00 alignment_score=0.00 signal_matched=# signal_total=# skill_matched=# skill_total=#
  // eslint-disable-next-line no-console
  console.log(
    `alignment_signal_score=${round2(signalScore)} alignment_skill_score=${round2(skillScore)} alignment_score=${round2(alignmentScore)} signal_matched=${matchedSignalCount} signal_total=${signalAnchors.length} skill_matched=${matchedSkillCount} skill_total=${skillAnchors.length}`
  );

  return {
    signalScore,
    skillScore,
    alignmentScore,
    matchedSignalCount,
    matchedSkillCount,
    signalCount: signalAnchors.length,
    skillCount: skillAnchors.length,
  };
}
