// lib/anchor_classification.ts

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
 * @param occurrences Array of AnchorOccurrence objects (one per anchor hit)
 * @returns AnchorClassificationOutput
 */
export function classifyAnchors(occurrences: AnchorOccurrence[]): AnchorClassificationOutput {
  const termMap = new Map<string, { sources: Set<string>; contextCounts: Record<string, number>; total: number }>();

  for (const occ of occurrences) {
    if (!termMap.has(occ.term)) {
      termMap.set(occ.term, {
        sources: new Set(),
        contextCounts: { breakdown: 0, constraint_construction: 0, incentive_distortion: 0, neutral: 0 },
        total: 0,
      });
    }
    const entry = termMap.get(occ.term)!;
    entry.sources.add(occ.source);
    entry.contextCounts[occ.context_type]++;
    entry.total++;
  }

  const signalAnchors: AnchorRecord[] = [];
  const skillAnchors: AnchorRecord[] = [];
  const neutralAnchors: AnchorRecord[] = [];

  for (const [term, entry] of termMap.entries()) {
    const sources = Array.from(entry.sources).sort();
    const c = entry.contextCounts;
    const totalCount = entry.total;
    const hasBreakdown = c.breakdown > 0;
    const inResume = entry.sources.has('resume');
    const qSources = ['q1', 'q2', 'q3', 'q4', 'q5'].filter(q => entry.sources.has(q));
    let classification: 'signal' | 'skill' | 'neutral';
    let reason: string;

    // Signal: breakdown context + at least one other distinct source
    if (hasBreakdown) {
      if (sources.length >= 2 && (inResume || qSources.length > 0)) {
        // Must be breakdown + at least one other source (resume or Q)
        if (!(sources.length === 1 && inResume)) {
          classification = 'signal';
          reason = 'SIG_BREAKDOWN_X2PLUS';
        } else {
          // Breakdown but only in resume (should not happen, but fallback)
          classification = 'neutral';
          reason = 'NEU_BREAKDOWN_SINGLE_SOURCE';
        }
      } else {
        // Breakdown but only in one source
        classification = 'neutral';
        reason = 'NEU_BREAKDOWN_SINGLE_SOURCE';
      }
    } else if (inResume) {
      // Skill: appears in resume, but not in breakdown
      classification = 'skill';
      reason = 'SK_RESUME_NO_BREAKDOWN';
    } else if (qSources.length > 0) {
      // Q-only, no breakdown
      classification = 'neutral';
      reason = 'NEU_Q_ONLY';
    } else {
      // No breakdown, not in resume, not in Qs
      classification = 'neutral';
      reason = 'NEU_NO_BREAKDOWN';
    }

    const record: AnchorRecord = {
      term,
      totalCount,
      distinctSources: sources,
      contextCounts: {
        breakdown: c.breakdown,
        constraint_construction: c.constraint_construction,
        incentive_distortion: c.incentive_distortion,
        neutral: c.neutral,
      },
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
