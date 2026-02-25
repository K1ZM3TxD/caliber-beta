// lib/text_tokenize.test.ts
import { tokenizeWords } from './text_tokenize';

describe('tokenizeWords', () => {
  it('matches case-insensitive tokens', () => {
    const set = tokenizeWords('Plan PLAN plan');
    expect(set.has('plan')).toBe(true);
    expect(set.has('PLAN')).toBe(false); // always lowercased
  });

  it('does not match substrings', () => {
    const set = tokenizeWords('plant plan planned');
    expect(set.has('plan')).toBe(true);
    expect(set.has('plant')).toBe(true);
    expect(set.has('planned')).toBe(true);
    // Ensure no substring collision
    expect(set.has('pla')).toBe(false);
  });

  it('matches with punctuation boundaries', () => {
    const set = tokenizeWords('plan, plan. (plan)');
    expect(set.has('plan')).toBe(true);
  });

  it('handles Unicode word boundaries', () => {
    const set = tokenizeWords('naïve façade résumé');
    expect(set.has('naïve')).toBe(true);
    expect(set.has('façade')).toBe(true);
    expect(set.has('résumé')).toBe(true);
  });

  it('is deterministic', () => {
    const text = 'Plan, plant, naïve.';
    const set1 = tokenizeWords(text);
    const set2 = tokenizeWords(text);
    expect(Array.from(set1)).toEqual(Array.from(set2));
  });
});
