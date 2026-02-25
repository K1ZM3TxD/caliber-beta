// lib/alignment_signal_score.test.ts
import { classifyAnchors } from './signal_classification';
import { computeSignalWeightedAlignment } from './alignment_signal_score';

describe('Signal-Weighted Alignment Scoring', () => {
  it('signal-only: all matched', () => {
    const anchorTerms = ['foo', 'bar'];
    const occurrences = [
      { term: 'foo', source: 'resume', context_type: 'breakdown' },
      { term: 'foo', source: 'q1', context_type: 'breakdown' },
      { term: 'bar', source: 'q2', context_type: 'breakdown' },
      { term: 'bar', source: 'q3', context_type: 'breakdown' },
    ];
    const classification = classifyAnchors(anchorTerms, occurrences);
    const text = 'foo bar';
    const breakdown = computeSignalWeightedAlignment(classification, text);
    expect(breakdown.signalScore).toBe(1);
    expect(breakdown.skillScore).toBe(0);
    expect(breakdown.alignmentScore).toBe(0.75);
  });

  it('skill-only: all matched', () => {
    const anchorTerms = ['foo', 'bar'];
    const occurrences = [
      { term: 'foo', source: 'resume', context_type: 'neutral' },
      { term: 'bar', source: 'resume', context_type: 'neutral' },
    ];
    const classification = classifyAnchors(anchorTerms, occurrences);
    const text = 'foo bar';
    const breakdown = computeSignalWeightedAlignment(classification, text);
    expect(breakdown.signalScore).toBe(0);
    expect(breakdown.skillScore).toBe(1);
    expect(breakdown.alignmentScore).toBe(0.25);
  });

  it('mixed: signal low, skill high', () => {
    const anchorTerms = ['foo', 'bar', 'baz'];
    const occurrences = [
      { term: 'foo', source: 'resume', context_type: 'breakdown' },
      { term: 'foo', source: 'q1', context_type: 'breakdown' },
      { term: 'bar', source: 'resume', context_type: 'neutral' },
      { term: 'baz', source: 'resume', context_type: 'neutral' },
    ];
    const classification = classifyAnchors(anchorTerms, occurrences);
    const text = 'foo bar baz';
    const breakdown = computeSignalWeightedAlignment(classification, text);
    // Only foo is signal, bar+baz are skill
    expect(breakdown.signalScore).toBe(1);
    expect(breakdown.skillScore).toBe(1);
    expect(breakdown.alignmentScore).toBe(1);
  });

  it('mixed: skill high, signal low', () => {
    const anchorTerms = ['foo', 'bar', 'baz'];
    const occurrences = [
      { term: 'foo', source: 'resume', context_type: 'breakdown' },
      { term: 'foo', source: 'q1', context_type: 'breakdown' },
      { term: 'bar', source: 'resume', context_type: 'neutral' },
      { term: 'baz', source: 'resume', context_type: 'neutral' },
    ];
    const classification = classifyAnchors(anchorTerms, occurrences);
    const text = 'bar baz'; // signal (foo) not matched
    const breakdown = computeSignalWeightedAlignment(classification, text);
    expect(breakdown.signalScore).toBe(0);
    expect(breakdown.skillScore).toBe(1);
    expect(breakdown.alignmentScore).toBe(0.25);
  });

  it('zero-signal, zero-skill', () => {
    const anchorTerms = ['foo'];
    const occurrences = [];
    const classification = classifyAnchors(anchorTerms, occurrences);
    const text = '';
    const breakdown = computeSignalWeightedAlignment(classification, text);
    expect(breakdown.signalScore).toBe(0);
    expect(breakdown.skillScore).toBe(0);
    expect(breakdown.alignmentScore).toBe(0);
  });

  it('case-insensitive, whole-word matching', () => {
    const anchorTerms = ['Plan', 'plant'];
    const occurrences = [
      { term: 'Plan', source: 'resume', context_type: 'breakdown' },
      { term: 'plant', source: 'resume', context_type: 'neutral' },
    ];
    const classification = classifyAnchors(anchorTerms, occurrences);
    const text = 'The PLAN and the plant.';
    const breakdown = computeSignalWeightedAlignment(classification, text);
    expect(breakdown.signalScore).toBe(1);
    expect(breakdown.skillScore).toBe(1);
    expect(breakdown.alignmentScore).toBe(1);
  });
});
