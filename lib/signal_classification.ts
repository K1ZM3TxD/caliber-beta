// lib/signal_classification.ts

export type AnchorOccurrence = {
  term: string;
  source: 'resume' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5';
  context_type: 'breakdown' | 'constraint_construction' | 'incentive_distortion' | 'neutral';
};

export type AnchorRecord = {
  term: string;
  totalCount: number;
  distinctSources: string[];
  contextCounts: {
    breakdown: number;
    constraint_construction: number;
    incentive_distortion: number;
    neutral: number;
  };
  classification: 'signal' | 'skill' | 'neutral';
  reason: string;
};

export type AnchorClassificationOutput = {
  signalAnchors: AnchorRecord[];
  skillAnchors: AnchorRecord[];
  neutralAnchors: AnchorRecord[];
};

/**
 * Deterministically classifies anchor terms into signal, skill, or neutral.
 * @param anchorTerms Array of anchor terms (from 6.0 extraction)
 * @param occurrences Array of AnchorOccurrence objects (one per anchor hit)
 * @returns AnchorClassificationOutput
 */
export function classifyAnchors(
  anchorTerms: string[],
  occurrences: AnchorOccurrence[]
): AnchorClassificationOutput {
  // Map term -> all its occurrences
  const termMap = new Map<string, AnchorOccurrence[]>();
  for (const term of anchorTerms) termMap.set(term, []);
  for (const occ of occurrences) {
    if (termMap.has(occ.term)) termMap.get(occ.term)!.push(occ);
  }

  const signalAnchors: AnchorRecord[] = [];
  const skillAnchors: AnchorRecord[] = [];
  const neutralAnchors: AnchorRecord[] = [];

  for (const term of anchorTerms) {
    const occs = termMap.get(term)!;
    const totalCount = occs.length;
    const sourcesSet = new Set<string>();
    const contextCounts = {
      breakdown: 0,
      constraint_construction: 0,
      incentive_distortion: 0,
      neutral: 0,
    };
    for (const occ of occs) {
      sourcesSet.add(occ.source);
      contextCounts[occ.context_type]++;
    }
    const distinctSources = Array.from(sourcesSet).sort();
    const hasBreakdown = contextCounts.breakdown > 0;
    const inResume = sourcesSet.has('resume');
    const qSources = ['q1', 'q2', 'q3', 'q4', 'q5'].filter(q => sourcesSet.has(q));
    let classification: 'signal' | 'skill' | 'neutral';
    let reason: string;

    if (hasBreakdown) {
      if (distinctSources.length >= 2 && (inResume || qSources.length > 0)) {
        if (!(distinctSources.length === 1 && inResume)) {
          classification = 'signal';
          reason = 'SIG_BREAKDOWN_X2PLUS';
        } else {
          classification = 'neutral';
          reason = 'NEU_BREAKDOWN_SINGLE_SOURCE';
        }
      } else {
        classification = 'neutral';
        reason = 'NEU_BREAKDOWN_SINGLE_SOURCE';
      }
    } else if (inResume) {
      classification = 'skill';
      reason = 'SK_RESUME_NO_BREAKDOWN';
    } else if (qSources.length > 0) {
      classification = 'neutral';
      reason = 'NEU_Q_ONLY';
    } else {
      classification = 'neutral';
      reason = 'NEU_NO_BREAKDOWN';
    }

    const record: AnchorRecord = {
      term,
      totalCount,
      distinctSources,
      contextCounts: { ...contextCounts },
      classification,
      reason,
    };
    if (classification === 'signal') signalAnchors.push(record);
    else if (classification === 'skill') skillAnchors.push(record);
    else neutralAnchors.push(record);
  }

  // Sort by totalCount DESC, then term ASC
  const sortFn = (a: AnchorRecord, b: AnchorRecord) => b.totalCount - a.totalCount || a.term.localeCompare(b.term);
  signalAnchors.sort(sortFn);
  skillAnchors.sort(sortFn);
  neutralAnchors.sort(sortFn);

  return { signalAnchors, skillAnchors, neutralAnchors };
}
