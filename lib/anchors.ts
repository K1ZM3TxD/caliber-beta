// lib/anchors.ts

export type AnchorsInput = {
  resumeText: string
  promptAnswers: string[]
  clarifierAnswers?: string[]
}

export type AnchorsOutput = {
  verbs_top: string[]
  nouns_top: string[]
}

const CONCRETE_VERBS = new Set([
  "design",
  "build",
  "draft",
  "define",
  "isolate",
  "clarify",
  "sequence",
  "tighten",
  "map",
  "repair",
  "measure",
  "align",
  "decide",
  "create",
  "automate",
  "delegate",
  "prototype",
  "test",
  "simplify",
  "stabilize",
  "structure",
  "architect",
])

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "so",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "as",
  "at",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "you",
  "your",
  "i",
  "we",
  "they",
  "he",
  "she",
  "it",
  "that",
  "this",
  "these",
  "those",
])

// Phrase boosts (these are multi-word, so we score them separately)
const PHRASE_BOOSTS = new Map<string, number>([
  ["pitch deck", 10],
  ["pitch decks", 10],
  ["call script", 10],
  ["call scripts", 10],
  ["workflows", 10],
  ["sop", 10],
  ["sops", 10],
  ["protocol", 10],
  ["delegation", 10],
  ["architecture", 10],
  ["constraints", 10],
  ["incentives", 10],
])

function safeTokens(text: string): string[] {
  const m = text.match(/[a-z]+(?:'[a-z]+)?/gi)
  if (!m) return []
  return m
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
}

// Very small phrase matcher: counts occurrences of the phrase in normalized text.
function countPhrase(haystackLower: string, phraseLower: string): number {
  if (!phraseLower || phraseLower.length < 3) return 0
  let idx = 0
  let count = 0
  while (true) {
    idx = haystackLower.indexOf(phraseLower, idx)
    if (idx === -1) break
    count += 1
    idx += phraseLower.length
  }
  return count
}

export function extractAnchors(args: AnchorsInput): AnchorsOutput {
  const resumeText = typeof args.resumeText === "string" ? args.resumeText : ""
  const promptAnswers = Array.isArray(args.promptAnswers) ? args.promptAnswers : []
  const clarifierAnswers = Array.isArray(args.clarifierAnswers) ? args.clarifierAnswers : []

  const allText = [resumeText, ...promptAnswers, ...clarifierAnswers].join(" ").trim()
  const lower = allText.toLowerCase()

  const tokens = safeTokens(allText)

  const verbCount = new Map<string, number>()
  const nounCount = new Map<string, number>()

  for (const token of tokens) {
    if (CONCRETE_VERBS.has(token)) {
      verbCount.set(token, (verbCount.get(token) ?? 0) + 1)
      continue
    }
    if (token.length >= 5) {
      nounCount.set(token, (nounCount.get(token) ?? 0) + 1)
    }
  }

  // Apply phrase boosts by adding to nounCount for the phrase itself (not tokenized)
  const boosted = new Map<string, number>()
  for (const [noun, c] of nounCount.entries()) boosted.set(noun, c)

  for (const [phrase, boost] of PHRASE_BOOSTS.entries()) {
    const hits = countPhrase(lower, phrase)
    if (hits <= 0) continue
    boosted.set(phrase, (boosted.get(phrase) ?? 0) + hits * boost)
  }

  const verbs_top = Array.from(verbCount.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([v]) => v)

  const nouns_top = Array.from(boosted.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([n]) => n)

  return { verbs_top, nouns_top }
}