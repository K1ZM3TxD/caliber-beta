// lib/signal_classification.adversarial.test.ts
import { classifyAnchors, AnchorOccurrence } from './signal_classification';

describe('Signal Classification — Adversarial Regression Matrix', () => {
  it('False Signal via Breakdown Single-Source', () => {
    const anchorTerms = ['foo'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'foo', source: 'q3', context_type: 'breakdown' },
      { term: 'foo', source: 'q3', context_type: 'breakdown' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_BREAKDOWN_SINGLE_SOURCE');
  });

  it('Resume Inflation', () => {
    const anchorTerms = ['bar'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'bar', source: 'resume', context_type: 'neutral' },
      { term: 'bar', source: 'resume', context_type: 'neutral' },
      { term: 'bar', source: 'q1', context_type: 'neutral' },
      { term: 'bar', source: 'q2', context_type: 'neutral' },
      { term: 'bar', source: 'q3', context_type: 'constraint_construction' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.skillAnchors.length).toBe(1);
    expect(out.skillAnchors[0].classification).toBe('skill');
    expect(out.skillAnchors[0].reason).toBe('SK_RESUME_NO_BREAKDOWN');
  });

  it('Q-only Drift', () => {
    const anchorTerms = ['baz'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'baz', source: 'q1', context_type: 'neutral' },
      { term: 'baz', source: 'q2', context_type: 'neutral' },
      { term: 'baz', source: 'q4', context_type: 'constraint_construction' },
      { term: 'baz', source: 'q2', context_type: 'incentive_distortion' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_Q_ONLY');
  });

  it('Breakdown + Cross-Source Minimal', () => {
    const anchorTerms = ['qux'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'qux', source: 'q2', context_type: 'breakdown' },
      { term: 'qux', source: 'resume', context_type: 'neutral' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.signalAnchors.length).toBe(1);
    expect(out.signalAnchors[0].classification).toBe('signal');
    expect(out.signalAnchors[0].reason).toBe('SIG_BREAKDOWN_X2PLUS');
  });

  it('Mixed Context Collision', () => {
    const anchorTerms = ['mux'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'mux', source: 'q1', context_type: 'constraint_construction' },
      { term: 'mux', source: 'q2', context_type: 'incentive_distortion' },
      { term: 'mux', source: 'q3', context_type: 'neutral' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toMatch(/^NEU/);
  });

  it('Case + Boundary Discipline', () => {
    const anchorTerms = ['plan', 'planning', 'plant'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'plan', source: 'resume', context_type: 'neutral' },
      { term: 'planning', source: 'resume', context_type: 'neutral' },
      { term: 'plant', source: 'resume', context_type: 'neutral' },
      { term: 'plan', source: 'q1', context_type: 'neutral' },
      { term: 'planning', source: 'q2', context_type: 'neutral' },
      { term: 'plant', source: 'q3', context_type: 'neutral' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.skillAnchors.length).toBe(3);
    expect(out.skillAnchors.map(r => r.term).sort()).toEqual(['plan', 'planning', 'plant']);
  });

  it('Zero-occurrence Stability', () => {
    const anchorTerms = ['zero', 'one'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'one', source: 'resume', context_type: 'neutral' },
    ];
    const out1 = classifyAnchors(anchorTerms, occurrences);
    const out2 = classifyAnchors(anchorTerms, occurrences);
    expect(out1).toEqual(out2); // Determinism
    const zero = out1.neutralAnchors.find(r => r.term === 'zero');
    expect(zero).toBeTruthy();
    expect(zero!.totalCount).toBe(0);
    expect(zero!.distinctSources).toEqual([]);
    expect(zero!.contextCounts).toEqual({
      breakdown: 0,
      constraint_construction: 0,
      incentive_distortion: 0,
      neutral: 0,
    });
    expect(zero!.classification).toBe('neutral');
    expect(zero!.reason).toBe('NEU_NO_BREAKDOWN');
  });

  it('Sorting is stable and deterministic', () => {
    const anchorTerms = ['a', 'b', 'c'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'a', source: 'resume', context_type: 'neutral' },
      { term: 'b', source: 'resume', context_type: 'neutral' },
      { term: 'b', source: 'resume', context_type: 'neutral' },
      { term: 'c', source: 'resume', context_type: 'neutral' },
      { term: 'c', source: 'resume', context_type: 'neutral' },
      { term: 'c', source: 'resume', context_type: 'neutral' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    const skillTerms = out.skillAnchors.map(r => r.term);
    expect(skillTerms).toEqual(['c', 'b', 'a']);
  });
});
