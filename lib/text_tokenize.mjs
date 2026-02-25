// lib/text_tokenize.mjs
/**
 * Tokenizes text into a set of normalized, lowercased word tokens using Intl.Segmenter if available.
 * Falls back to a Unicode-aware regex if Intl.Segmenter is unavailable.
 */
export function tokenizeWords(text: string): Set<string> {
  const normalized = text.normalize('NFKC').toLowerCase();
  const tokens = new Set<string>();
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
    for (const { segment, isWordLike } of segmenter.segment(normalized)) {
      if (isWordLike && segment.length > 0) tokens.add(segment);
    }
    return tokens;
  }
  // Fallback: Unicode-aware regex for word chars
  const matches = normalized.match(/[\p{L}\p{N}_]+/gu);
  if (matches) {
    for (const m of matches) tokens.add(m);
  }
  return tokens;
}
