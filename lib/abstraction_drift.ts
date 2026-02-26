// lib/abstraction_drift.ts
// Milestone 6.3 — Anti-Abstraction Enforcement (Deterministic)

export type AbstractionDriftResult = {
  abstraction_flag: boolean;
  praise_flag: boolean;
  drift_terms: string[];
  reason: string;
};

const ARCHETYPE_TERMS = [
  'visionary', 'thought leader', 'guru', 'rockstar', 'ninja', 'wizard', 'superstar',
  'changemaker', 'trailblazer', 'innovator', 'game changer', 'influencer', 'evangelist',
  'architect', 'strategist', 'champion', 'ambassador', 'hero', 'prodigy', 'genius',
  'mastermind', 'pioneer', 'maven', 'sage', 'oracle', 'mentor', 'coach', 'leader',
  'expert', 'authority', 'specialist', 'consultant', 'advisor', 'advocate', 'enthusiast',
];

const PRAISE_TERMS = [
  'outstanding', 'exceptional', 'excellent', 'amazing', 'incredible', 'remarkable',
  'superb', 'fantastic', 'impressive', 'brilliant', 'stellar', 'unparalleled', 'unmatched',
  'unrivaled', 'world-class', 'top-notch', 'first-rate', 'best-in-class', 'award-winning',
  'acclaimed', 'renowned', 'celebrated', 'distinguished', 'prestigious', 'elite',
];

const IDENTITY_INFLATION_TERMS = [
  'self-starter', 'go-getter', 'team player', 'problem solver', 'quick learner',
  'hard worker', 'dedicated', 'passionate', 'driven', 'motivated', 'dynamic',
  'results-oriented', 'detail-oriented', 'goal-oriented', 'proactive', 'resourceful',
  'adaptable', 'collaborative', 'innovative', 'creative', 'dependable', 'reliable',
  'committed', 'enthusiastic', 'flexible', 'organized', 'responsible', 'versatile',
];


function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .match(/[a-z0-9\-']+/g) || [];
}

function normalizePhrase(s: string): string {
  return s.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function detectAbstractionDrift({
  text,
  anchorTerms,
}: {
  text: string;
  anchorTerms: string[];
}): AbstractionDriftResult {
  const tokens = tokenize(text);
  const normText = text.toLowerCase().normalize('NFKC');
  const anchorSet = new Set(anchorTerms.map(t => t.toLowerCase().normalize('NFKC')));
  const anchorPhraseSet = new Set(anchorTerms.map(normalizePhrase));
  let drift_terms: string[] = [];
  let reason = 'NONE';
  let abstraction_flag = false;
  let praise_flag = false;

  // Helper to collect drift terms for a category (phrase-level)
  function collectDrift(list: string[]): string[] {
    const found: string[] = [];
    for (const term of list) {
      const normTerm = normalizePhrase(term);
      if (anchorPhraseSet.has(normTerm)) continue;
      if (normText.includes(normTerm)) {
        const words = normTerm.split(' ');
        let skip = false;
        for (const word of words) {
          if (anchorSet.has(word)) {
            skip = true;
            break;
          }
        }
        if (!skip) found.push(term);
      }
    }
    return found.sort((a, b) => a.localeCompare(b)); // deterministic ordering
  }

  // Suppress abstraction_flag if any drift term from the full list is present in both the text and anchorTerms
  function hasAnchorDrift(termList: string[]): boolean {
    for (const term of termList) {
      const normTerm = normalizePhrase(term);
      if (anchorPhraseSet.has(normTerm) && normText.includes(normTerm)) {
        return true;
      }
    }
    return false;
  }

  if (
    hasAnchorDrift(ARCHETYPE_TERMS) ||
    hasAnchorDrift(PRAISE_TERMS) ||
    hasAnchorDrift(IDENTITY_INFLATION_TERMS)
  ) {
    drift_terms = [];
    abstraction_flag = false;
    praise_flag = false;
    reason = 'NONE';
  } else {
    const archetypeDrift = collectDrift(ARCHETYPE_TERMS);
    const praiseDrift = collectDrift(PRAISE_TERMS);
    const identityDrift = collectDrift(IDENTITY_INFLATION_TERMS);
    if (archetypeDrift.length > 0) {
      drift_terms = archetypeDrift;
      abstraction_flag = true;
      reason = 'ABS_ARCHETYPE_TERM';
    } else if (praiseDrift.length > 0) {
      drift_terms = praiseDrift;
      abstraction_flag = true;
      praise_flag = true;
      reason = 'ABS_PRAISE';
    } else if (identityDrift.length > 0) {
      drift_terms = identityDrift;
      abstraction_flag = true;
      reason = 'ABS_IDENTITY_INFLATION';
    }
  }

  return {
    abstraction_flag,
    praise_flag,
    drift_terms,
    reason,
  };
}
