// lib/text_tokenize.ts
// Tokenizes text into a Set of normalized (NFKC, lowercase) whole-word tokens using Unicode property escapes.

export function tokenizeWords(text: string): Set<string> {
  // Normalize to NFKC
  const norm = text.normalize("NFKC");
  // Match all Unicode letters/numbers as tokens
  const matches = norm.match(/[\p{L}\p{N}]+/gu) || [];
  // Lowercase and filter out empty tokens
  const tokens = matches.map(t => t.toLowerCase()).filter(t => t.length > 0);
  return new Set(tokens);
}
