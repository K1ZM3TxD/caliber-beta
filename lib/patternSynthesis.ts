// Pattern Synthesis (Deterministic Formatting)
// NO LLM CALLS - Pure deterministic logic

import { Vector, PatternSynthesisResult, AlignmentResult } from './types';

/**
 * Generates pattern synthesis from person vector and alignment result.
 * Returns structured output with NO LLM calls:
 * 1. Title Hypothesis (2-4 words, role-agnostic, structural)
 * 2. Pattern Summary (exactly 3 sentences, declarative, no hedging)
 * 3. Where You Operate Best (3-5 bullets, ≤8 words each, structural, signal-weighted)
 * 4. Where You Lose Energy (3-5 bullets, ≤8 words each, mirrored opposition, signal-weighted)
 * 5. Structural Tensions (if S ≥ 1, surface contradiction as adaptation-load driver)
 */
export function generatePatternSynthesis(
  personVector: Vector,
  alignmentResult: AlignmentResult
): PatternSynthesisResult {
  // Title Hypothesis - based on dominant characteristics
  const titleHypothesis = generateTitleHypothesis(personVector);

  // Pattern Summary - 3 sentences based on vector profile
  const patternSummary = generatePatternSummary(personVector);

  // Where You Operate Best - 3-5 bullets
  const operateBest = generateOperateBest(personVector);

  // Where You Lose Energy - 3-5 bullets (mirrored opposition)
  const loseEnergy = generateLoseEnergy(personVector);

  // Structural Tensions - only if severe mismatches exist
  const structuralTensions =
    alignmentResult.severeMismatches >= 1
      ? generateStructuralTensions(alignmentResult.severeMismatches)
      : null;

  return {
    titleHypothesis,
    patternSummary,
    operateBest,
    loseEnergy,
    structuralTensions,
  };
}

function generateTitleHypothesis(vector: Vector): string {
  const { structural_maturity, breadth_vs_depth } = vector;

  if (structural_maturity === 2 && breadth_vs_depth === 2) {
    return 'Enterprise Systems Architect';
  } else if (structural_maturity === 2) {
    return 'Strategic Organizational Leader';
  } else if (breadth_vs_depth === 2) {
    return 'Cross-Functional Integrator';
  } else if (structural_maturity === 0 && breadth_vs_depth === 0) {
    return 'Specialist Executor';
  } else {
    return 'Tactical Operations Lead';
  }
}

function generatePatternSummary(vector: Vector): string {
  const sentences: string[] = [];

  // Sentence 1: Structural maturity
  if (vector.structural_maturity === 2) {
    sentences.push(
      'You thrive in structured, established environments with clear processes.'
    );
  } else if (vector.structural_maturity === 1) {
    sentences.push(
      'You operate effectively in moderately defined organizational contexts.'
    );
  } else {
    sentences.push(
      'You excel in fluid, emerging environments requiring rapid adaptation.'
    );
  }

  // Sentence 2: Authority and scope
  if (vector.authority_scope === 2 && vector.stakeholder_density === 2) {
    sentences.push(
      'Your strength lies in managing broad organizational influence across multiple stakeholders.'
    );
  } else if (vector.authority_scope === 2) {
    sentences.push('You demonstrate capability in high-authority decision-making roles.');
  } else if (vector.authority_scope === 0) {
    sentences.push('You perform best with clearly defined individual contribution scope.');
  } else {
    sentences.push('You balance execution ownership with collaborative decision-making.');
  }

  // Sentence 3: Breadth vs depth
  if (vector.breadth_vs_depth === 2) {
    sentences.push('Your pattern shows strength in integrating across diverse domains.');
  } else if (vector.breadth_vs_depth === 1) {
    sentences.push('You blend specialized expertise with cross-functional awareness.');
  } else {
    sentences.push('Your focus centers on deep technical or functional mastery.');
  }

  return sentences.join(' ');
}

function generateOperateBest(vector: Vector): string[] {
  const bullets: string[] = [];

  if (vector.structural_maturity === 2) {
    bullets.push('Established processes and systems');
  } else if (vector.structural_maturity === 0) {
    bullets.push('Ambiguous, fast-changing environments');
  }

  if (vector.authority_scope === 2) {
    bullets.push('High autonomy decision-making');
  } else if (vector.authority_scope === 0) {
    bullets.push('Clear direction and defined boundaries');
  }

  if (vector.revenue_orientation === 2) {
    bullets.push('Direct revenue impact visibility');
  }

  if (vector.breadth_vs_depth === 2) {
    bullets.push('Cross-functional integration challenges');
  } else if (vector.breadth_vs_depth === 0) {
    bullets.push('Deep technical specialization');
  }

  if (vector.stakeholder_density === 2) {
    bullets.push('Multi-stakeholder alignment contexts');
  }

  // Ensure 3-5 bullets
  if (bullets.length < 3) {
    if (vector.role_ambiguity === 0) {
      bullets.push('Well-defined role parameters');
    } else if (vector.role_ambiguity === 2) {
      bullets.push('Role boundary flexibility');
    }
  }

  return bullets.slice(0, 5);
}

function generateLoseEnergy(vector: Vector): string[] {
  const bullets: string[] = [];

  // Mirror opposition from operateBest
  if (vector.structural_maturity === 2) {
    bullets.push('Undefined processes, constant pivots');
  } else if (vector.structural_maturity === 0) {
    bullets.push('Rigid hierarchies, slow change');
  }

  if (vector.authority_scope === 2) {
    bullets.push('Micro-management and approval layers');
  } else if (vector.authority_scope === 0) {
    bullets.push('Ambiguous ownership and accountability');
  }

  if (vector.revenue_orientation === 0) {
    bullets.push('Unclear business impact connection');
  }

  if (vector.breadth_vs_depth === 2) {
    bullets.push('Narrow functional silos');
  } else if (vector.breadth_vs_depth === 0) {
    bullets.push('Surface-level generalist demands');
  }

  if (vector.stakeholder_density === 0) {
    bullets.push('Excessive meeting and alignment overhead');
  }

  // Ensure 3-5 bullets
  if (bullets.length < 3) {
    if (vector.role_ambiguity === 0) {
      bullets.push('Constantly shifting priorities');
    } else if (vector.role_ambiguity === 2) {
      bullets.push('Rigid job descriptions');
    }
  }

  return bullets.slice(0, 5);
}

function generateStructuralTensions(severeMismatches: number): string {
  return `This role presents ${severeMismatches} fundamental structural ${
    severeMismatches === 1 ? 'mismatch' : 'mismatches'
  } with your operating pattern, requiring sustained adaptation energy.`;
}
