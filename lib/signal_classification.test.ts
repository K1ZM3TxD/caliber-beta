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

// Milestone 6.3: Anti-Abstraction Enforcement
import { detectAbstractionDrift } from './abstraction_drift';

describe('detectAbstractionDrift (Milestone 6.3)', () => {
    it('drift term triggers abstraction_flag=true and reason != NONE when term NOT in anchorTerms', () => {
      const anchorTerms = ['foo', 'bar'];
      const text = 'She is a visionary leader and a guru.';
      const out = detectAbstractionDrift({ text, anchorTerms });
      expect(out.abstraction_flag).toBe(true);
      expect(out.drift_terms).toEqual(['guru', 'leader', 'visionary']); // ASC order
      expect(out.reason).not.toBe('NONE');
    });

    it('drift term does NOT trigger if the term IS in anchorTerms', () => {
      const anchorTerms = ['visionary', 'foo'];
      const text = 'A visionary leader.';
      const out = detectAbstractionDrift({ text, anchorTerms });
      expect(out.abstraction_flag).toBe(false);
      expect(out.drift_terms).not.toContain('visionary');
      expect(out.reason).toBe('NONE');
    });

    it('drift_terms ordering is deterministic', () => {
      const anchorTerms = ['foo'];
      const text = 'A leader, guru, and visionary.';
      const out = detectAbstractionDrift({ text, anchorTerms });
      expect(out.drift_terms).toEqual(['guru', 'leader', 'visionary']); // ASC order
    });

    // Kernel validator outcome and retry injection test
    it('validator triggers retry and injects REMOVE DRIFT TERMS directive', () => {
      const calibrationMachine = require('./calibration_machine');
      const validateAndRepairSynthesisOnce = calibrationMachine.validateAndRepairSynthesisOnce;
      const anchorTerms = ['foo'];
      const personVector = [0,1,2,1,0,2];
      const signals = { charLen: 100, hasBullets: true, hasDates: true, hasTitles: true };
      // 3+ lines, exact structure and drift term for validator
      const patternSummary = "You don't just execute — you operate as a visionary leader.\nWhen something isn't working, you don't push harder — you tighten constraints.\nYou notice, clarify, and sequence.";
      const result = validateAndRepairSynthesisOnce(patternSummary, personVector, signals, { log: true, anchorTerms });
      expect(result.outcome).toBe('RETRY_REQUIRED');
      expect(result.patternSummary).toContain('REMOVE DRIFT TERMS: guru, leader, visionary');
    });

    it('validator outcome changes appropriately on drift (no silent PASS)', () => {
      const calibrationMachine = require('./calibration_machine');
      const validateAndRepairSynthesisOnce = calibrationMachine.validateAndRepairSynthesisOnce;
      const anchorTerms = ['foo'];
      const personVector = [0,1,2,1,0,2];
      const signals = { charLen: 100, hasBullets: true, hasDates: true, hasTitles: true };
      // 3+ lines, exact structure and drift term for validator
      const patternSummary = "You don't just execute — you operate as a visionary leader.\nWhen something isn't working, you don't push harder — you tighten constraints.\nYou notice, clarify, and sequence.";
      // First pass triggers retry
      const result1 = validateAndRepairSynthesisOnce(patternSummary, personVector, signals, { log: true, anchorTerms });
      expect(result1.outcome).toBe('RETRY_REQUIRED');
      // Second pass triggers fallback
      const result2 = validateAndRepairSynthesisOnce(patternSummary, personVector, signals, { log: true, anchorTerms });
      expect(result2.outcome).toBe('FALLBACK_STRUCTURE_INVALID');
    });
  it('archetype drift term triggers abstraction_flag', () => {
    const anchorTerms = ['foo', 'bar'];
    const text = 'She is a visionary leader and a guru.';
    const out = detectAbstractionDrift({ text, anchorTerms });
    expect(out.abstraction_flag).toBe(true);
    expect(out.drift_terms).toContain('visionary');
    expect(out.drift_terms).toContain('guru');
    expect(out.reason).toBe('ABS_ARCHETYPE_TERM');
  });

  it('praise term triggers abstraction_flag and praise_flag', () => {
    const anchorTerms = ['foo', 'bar'];
    const text = 'Her performance was outstanding and exceptional.';
    const out = detectAbstractionDrift({ text, anchorTerms });
    expect(out.abstraction_flag).toBe(true);
    expect(out.praise_flag).toBe(true);
    expect(out.drift_terms).toContain('outstanding');
    expect(out.drift_terms).toContain('exceptional');
    expect(out.reason).toBe('ABS_PRAISE');
  });

  it('identity inflation triggers abstraction_flag', () => {
    const anchorTerms = ['foo', 'bar'];
    const text = 'A true self-starter and quick learner.';
    const out = detectAbstractionDrift({ text, anchorTerms });
    expect(out.abstraction_flag).toBe(true);
    expect(out.drift_terms).toContain('self-starter');
    expect(out.drift_terms).toContain('quick learner');
    expect(out.reason).toBe('ABS_IDENTITY_INFLATION');
  });

  it('drift term present in anchorTerms does NOT trigger abstraction_flag', () => {
    const anchorTerms = ['visionary', 'foo'];
    const text = 'A visionary leader.';
    const out = detectAbstractionDrift({ text, anchorTerms });
    expect(out.abstraction_flag).toBe(false);
    expect(out.drift_terms).not.toContain('visionary');
    expect(out.reason).toBe('NONE');
  });

  it('purely mechanical, anchor-grounded output does NOT trigger abstraction_flag', () => {
    const anchorTerms = ['map', 'define', 'repair'];
    const text = 'You map, define, and repair.';
    const out = detectAbstractionDrift({ text, anchorTerms });
    expect(out.abstraction_flag).toBe(false);
    expect(out.drift_terms.length).toBe(0);
    expect(out.reason).toBe('NONE');
  });

  it('deterministic: identical input → identical flags + reasons', () => {
    const anchorTerms = ['foo', 'bar'];
    const text = 'She is a visionary leader and a guru.';
    const out1 = detectAbstractionDrift({ text, anchorTerms });
    const out2 = detectAbstractionDrift({ text, anchorTerms });
    expect(out1).toEqual(out2);
  });
});
