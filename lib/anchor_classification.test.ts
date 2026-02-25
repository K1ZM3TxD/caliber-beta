// lib/anchor_classification.test.ts
import { classifyAnchors, AnchorOccurrence, AnchorClassificationOutput } from './anchor_classification';

describe('classifyAnchors', () => {
  it('classifies signal: breakdown + resume', () => {
    const input: AnchorOccurrence[] = [
      { term: 'foo', source: 'resume', context_type: 'breakdown' },
      { term: 'foo', source: 'q1', context_type: 'breakdown' },
      { term: 'foo', source: 'resume', context_type: 'neutral' },
    ];
    const out = classifyAnchors(input);
    expect(out.signalAnchors.length).toBe(1);
    expect(out.signalAnchors[0].term).toBe('foo');
    expect(out.signalAnchors[0].classification).toBe('signal');
    expect(out.signalAnchors[0].reason).toBe('SIG_BREAKDOWN_X2PLUS');
  });

  it('classifies skill: resume only, no breakdown', () => {
    const input: AnchorOccurrence[] = [
      { term: 'bar', source: 'resume', context_type: 'neutral' },
      { term: 'bar', source: 'resume', context_type: 'constraint_construction' },
    ];
    const out = classifyAnchors(input);
    expect(out.skillAnchors.length).toBe(1);
    expect(out.skillAnchors[0].term).toBe('bar');
    expect(out.skillAnchors[0].classification).toBe('skill');
    expect(out.skillAnchors[0].reason).toBe('SK_RESUME_NO_BREAKDOWN');
  });

  it('classifies neutral: breakdown only in single source', () => {
    const input: AnchorOccurrence[] = [
      { term: 'baz', source: 'q2', context_type: 'breakdown' },
    ];
    const out = classifyAnchors(input);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].term).toBe('baz');
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_BREAKDOWN_SINGLE_SOURCE');
  });

  it('classifies neutral: Q-only, no breakdown', () => {
    const input: AnchorOccurrence[] = [
      { term: 'qux', source: 'q3', context_type: 'neutral' },
      { term: 'qux', source: 'q4', context_type: 'constraint_construction' },
    ];
    const out = classifyAnchors(input);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].term).toBe('qux');
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_Q_ONLY');
  });

  it('classifies neutral: no breakdown, not in resume, not in Qs', () => {
    const input: AnchorOccurrence[] = [
      { term: 'zap', source: 'resume', context_type: 'neutral' },
      { term: 'zap', source: 'resume', context_type: 'neutral' },
    ];
    // Remove resume, test for no Qs
    input[0].source = 'other' as any;
    input[1].source = 'other' as any;
    const out = classifyAnchors(input);
    expect(out.neutralAnchors.length).toBe(1);
    expect(out.neutralAnchors[0].term).toBe('zap');
    expect(out.neutralAnchors[0].classification).toBe('neutral');
    expect(out.neutralAnchors[0].reason).toBe('NEU_NO_BREAKDOWN');
  });

  it('sorts by totalCount DESC, then term ASC', () => {
    const input: AnchorOccurrence[] = [
      { term: 'a', source: 'resume', context_type: 'breakdown' },
      { term: 'b', source: 'resume', context_type: 'breakdown' },
      { term: 'b', source: 'q1', context_type: 'breakdown' },
      { term: 'a', source: 'q2', context_type: 'breakdown' },
      { term: 'a', source: 'q3', context_type: 'breakdown' },
    ];
    const out = classifyAnchors(input);
    expect(out.signalAnchors[0].term).toBe('a');
    expect(out.signalAnchors[1].term).toBe('b');
  });
});
