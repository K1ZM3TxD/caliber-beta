// lib/anchor_extraction.ts

export type AnchorTerm = { term: string; count: number }
export type CombinedAnchorTerm = { term: string; count: number; kind: "verb" | "noun" }

export type ExtractLexicalAnchorsInput = {
  resumeText?: string
  promptAnswersText?: string
}

export type ExtractLexicalAnchorsOutput = {
  verbs: AnchorTerm[]
  nouns: AnchorTerm[]
  combined: CombinedAnchorTerm[]
}

// Small, hardcoded stoplist (v0). Keep deterministic + conservative.
const STOPWORDS = new Set<string>([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "have",
  "has",
  "had",
  "will",
  "into",
  "over",
  "under",
  "your",
  "you",
  "our",
  "are",
  "was",
  "were",
  "been",
  "being",
  "they",
  "them",
  "their",
  "there",
  "here",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "why",
  "how",
  "can",
  "could",
  "should",
  "would",
  "may",
  "might",
  "not",
  "but",
  "also",
  "than",
  "then",
 ])

const VERB_SUFFIXES = ["ing", "ed", "ize", "ise"]
const NOUN_SUFFIXES = ["tion", "sion", "ment", "ness", "ship", "ity", "ance", "ence"]

function normalizeToTokens(raw: string): string[] {
  const cleaned = String(raw ?? "")
    .toLowerCase()
    // Replace non-letters/numbers with spaces
    .replace(/[^a-z0-9]+/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()

  if (!cleaned) return []
  return cleaned.split(" ")
}

function isVerbToken(tok: string): boolean {
  for (const suf of VERB_SUFFIXES) {
    if (tok.endsWith(suf) && tok.length > suf.length) return true
  }
  return false
}

function isNounToken(tok: string): boolean {
  for (const suf of NOUN_SUFFIXES) {
    if (tok.endsWith(suf) && tok.length > suf.length) return true
  }
  return false
}

function countEligibleTokens(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tokens) {
    if (t.length < 3) continue
    if (STOPWORDS.has(t)) continue
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return counts
}

function sortTermsDeterministically(a: AnchorTerm, b: AnchorTerm): number {
  if (b.count !== a.count) return b.count - a.count
  // lexical asc
  if (a.term < b.term) return -1
  if (a.term > b.term) return 1
  return 0
}

/**
 * extractLexicalAnchors (Milestone 6.0)
 *
 * Determinism rules:
 * - Lowercase
 * - Replace non-letters/numbers with spaces
 * - Collapse whitespace
 * - Unigrams only
 * - min token length 3
 * - stoplist exclusion
 * - repetition threshold count>=2
 * - stable ordering: (count desc, term asc)
 * - combined ordering: verbs (sorted) then nouns (sorted)
 *
 * Verification-by-inspection example:
 *
 * resumeText:
 *   "I implemented routing. I implemented measurement. I improved documentation."
 * promptAnswersText:
 *   "I implemented routing and improved measurement; improved documentation."
 *
 * Expected (top 3):
 * verbs:
 *   - { term: "implemented", count: 3 }
 *   - { term: "improved", count: 3 }
 * nouns:
 *   - { term: "documentation", count: 2 }
 *   - { term: "measurement", count: 2 }
 */
export function extractLexicalAnchors(input: ExtractLexicalAnchorsInput): ExtractLexicalAnchorsOutput {
  const resumeText = typeof input?.resumeText === "string" ? input.resumeText : ""
  const promptAnswersText = typeof input?.promptAnswersText === "string" ? input.promptAnswersText : ""

  const tokens = normalizeToTokens([resumeText, promptAnswersText].filter(Boolean).join("\n"))
  const counts = countEligibleTokens(tokens)

  const verbs: AnchorTerm[] = []
  const nouns: AnchorTerm[] = []

  for (const [term, count] of counts.entries()) {
    if (count < 2) continue

    if (isVerbToken(term)) {
      verbs.push({ term, count })
      continue
    }

    if (isNounToken(term)) {
      nouns.push({ term, count })
      continue
    }
  }

  verbs.sort(sortTermsDeterministically)
  nouns.sort(sortTermsDeterministically)

  const combined: CombinedAnchorTerm[] = [
    ...verbs.map((x) => ({ ...x, kind: "verb" as const })),
    ...nouns.map((x) => ({ ...x, kind: "noun" as const })),
  ]

  return { verbs, nouns, combined }
}