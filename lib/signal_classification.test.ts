// lib/signal_classification.test.ts
import { classifyAnchors, AnchorOccurrence } from './signal_classification';

describe('classifyAnchors (Milestone 6.2)', () => {
  it('resume-only repetition → SKILL', () => {
    const anchorTerms = ['foo'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'foo', source: 'resume', context_type: 'neutral' },
      { term: 'foo', source: 'resume', context_type: 'constraint_construction' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.skillAnchors.length).toBe(1);
    expect(out.skillAnchors[0].term).toBe('foo');
    expect(out.skillAnchors[0].classification).toBe('skill');
    expect(out.skillAnchors[0].reason).toBe('SK_RESUME_NO_BREAKDOWN');
  });

  it('breakdown only in single q → NEUTRAL', () => {
    const anchorTerms = ['bar'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'bar', source: 'q3', context_type: 'breakdown' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].term).toBe('bar');
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_BREAKDOWN_SINGLE_SOURCE');
  });

  it('breakdown + resume → SIGNAL', () => {
    const anchorTerms = ['baz'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'baz', source: 'resume', context_type: 'breakdown' },
      { term: 'baz', source: 'q1', context_type: 'breakdown' },
      { term: 'baz', source: 'resume', context_type: 'neutral' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.signalAnchors.length).toBe(1);
    expect(out.signalAnchors[0].term).toBe('baz');
    expect(out.signalAnchors[0].classification).toBe('signal');
    expect(out.signalAnchors[0].reason).toBe('SIG_BREAKDOWN_X2PLUS');
  });

  it('breakdown + another q → SIGNAL', () => {
    const anchorTerms = ['qux'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'qux', source: 'q2', context_type: 'breakdown' },
      { term: 'qux', source: 'q4', context_type: 'breakdown' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.signalAnchors.length).toBe(1);
    expect(out.signalAnchors[0].term).toBe('qux');
    expect(out.signalAnchors[0].classification).toBe('signal');
    expect(out.signalAnchors[0].reason).toBe('SIG_BREAKDOWN_X2PLUS');
  });

  it('resume + neutral q (no breakdown) → SKILL', () => {
    const anchorTerms = ['zap'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'zap', source: 'resume', context_type: 'neutral' },
      { term: 'zap', source: 'q2', context_type: 'neutral' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.skillAnchors.length).toBe(1);
    expect(out.skillAnchors[0].term).toBe('zap');
    expect(out.skillAnchors[0].classification).toBe('skill');
    expect(out.skillAnchors[0].reason).toBe('SK_RESUME_NO_BREAKDOWN');
  });

  it('q-only without breakdown → NEUTRAL', () => {
    const anchorTerms = ['mux'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'mux', source: 'q1', context_type: 'neutral' },
      { term: 'mux', source: 'q2', context_type: 'constraint_construction' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].term).toBe('mux');
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_Q_ONLY');
  });

  it('term in anchorTerms but zero occurrences → NEUTRAL', () => {
    const anchorTerms = ['zero'];
    const occurrences: AnchorOccurrence[] = [];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].term).toBe('zero');
    expect(out.neutralAnchors[0].totalCount).toBe(0);
    expect(out.neutralAnchors[0].distinctSources).toEqual([]);
    expect(out.neutralAnchors[0].contextCounts).toEqual({
      breakdown: 0,
      constraint_construction: 0,
      incentive_distortion: 0,
      neutral: 0,
    });
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_NO_BREAKDOWN');
  });

  it('sorts by totalCount DESC, then term ASC', () => {
    const anchorTerms = ['a', 'b'];
    const occurrences: AnchorOccurrence[] = [
      { term: 'a', source: 'resume', context_type: 'breakdown' },
      { term: 'b', source: 'resume', context_type: 'breakdown' },
      { term: 'b', source: 'q1', context_type: 'breakdown' },
      { term: 'a', source: 'q2', context_type: 'breakdown' },
      { term: 'a', source: 'q3', context_type: 'breakdown' },
    ];
    const out = classifyAnchors(anchorTerms, occurrences);
    expect(out.signalAnchors[0].term).toBe('a');
    expect(out.signalAnchors[1].term).toBe('b');
  });
});
