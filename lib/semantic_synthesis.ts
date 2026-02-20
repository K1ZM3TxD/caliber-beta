// lib/semantic_synthesis.ts

type PersonVector6 = [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]

const VERB_STOPWORDS = new Set<string>([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "done",
  "dont",
  "don’t",
  "for",
  "from",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "it’s",
  "just",
  "me",
  "might",
  "more",
  "most",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "she",
  "so",
  "some",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "too",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "without",
  "would",
  "you",
  "your",
  "youre",
  "you’re",
])

// Small deterministic synonym map used ONLY for the identityContrast verb rule.
const VERB_SYNONYMS: Record<string, string[]> = {
  build: ["create", "make", "craft", "assemble"],
  create: ["build", "make", "craft"],
  design: ["plan", "architect", "shape"],
  plan: ["design", "map"],
  map: ["plan", "chart"],
  debug: ["diagnose", "troubleshoot"],
  diagnose: ["debug", "troubleshoot"],
  fix: ["repair", "resolve"],
  repair: ["fix", "resolve"],
  improve: ["refine", "tighten"],
  refine: ["improve", "tighten"],
  reduce: ["cut", "lower", "shrink"],
  increase: ["raise", "grow", "expand"],
  lead: ["guide", "run"],
  run: ["lead", "operate"],
  manage: ["run", "own"],
  own: ["manage", "drive"],
  ship: ["deliver", "release", "launch"],
  launch: ["ship", "release"],
  write: ["draft", "author"],
  test: ["verify", "validate"],
  validate: ["test", "verify"],
  measure: ["track", "quantify"],
  track: ["measure", "monitor"],
}

const COMMON_VERBS = new Set<string>([
  // General action verbs (kept small + deterministic)
  "build",
  "create",
  "design",
  "plan",
  "map",
  "debug",
  "diagnose",
  "fix",
  "repair",
  "improve",
  "refine",
  "tighten",
  "reduce",
  "increase",
  "lead",
  "run",
  "manage",
  "own",
  "ship",
  "launch",
  "write",
  "draft",
  "test",
  "validate",
  "verify",
  "measure",
  "track",
  "monitor",
  "analyze",
  "audit",
  "review",
  "define",
  "clarify",
  "decide",
  "align",
  "sequence",
  "simplify",
  "surface",
  "isolate",
  "name",
  "support",
  "coordinate",
  "route",
  "deploy",
  "implement",
  "integrate",
  "migrate",
  "optimize", // note: may be blacklisted in synthesis content, but user text may contain it
  "deliver",
])

function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z]/g, "")
    .trim()
}

function baseVerbForm(raw: string): string {
  let w = normalizeToken(raw)
  if (!w) return ""
  if (VERB_STOPWORDS.has(w)) return ""
  // very light stemming (deterministic; no heavy NLP)
  if (w.length > 5 && w.endsWith("ies")) {
    w = w.slice(0, -3) + "y"
  } else if (w.length > 5 && w.endsWith("ing")) {
    w = w.slice(0, -3)
  } else if (w.length > 4 && w.endsWith("ed")) {
    w = w.slice(0, -2)
  } else if (w.length > 4 && w.endsWith("es")) {
    w = w.slice(0, -2)
  } else if (w.length > 3 && w.endsWith("s")) {
    w = w.slice(0, -1)
  }
  if (!w || VERB_STOPWORDS.has(w)) return ""
  return w
}

function tokenizeWords(text: string): string[] {
  if (!text) return []
  const m = text.match(/[A-Za-z’']+/g)
  return Array.isArray(m) ? m : []
}

function looksVerbLikeToken(raw: string): boolean {
  const t = normalizeToken(raw)
  if (!t || t.length < 3) return false
  if (VERB_STOPWORDS.has(t)) return false
  if (COMMON_VERBS.has(t)) return true
  if (t.endsWith("ed") || t.endsWith("ing")) return true
  return false
}

function extractTopUserVerbs(args: { promptAnswers: Array<{ n: 1 | 2 | 3 | 4 | 5; answer: string }>; resumeText: string }): string[] {
  const scores = new Map<string, number>()

  const bump = (token: string, weight: number) => {
    if (!token) return
    if (VERB_STOPWORDS.has(token)) return
    scores.set(token, (scores.get(token) ?? 0) + weight)
  }

  // Prompt answers (primary source, higher weight)
  for (const pa of args.promptAnswers || []) {
    const words = tokenizeWords(String(pa?.answer ?? ""))
    for (const w of words) {
      if (!looksVerbLikeToken(w)) continue
      const base = baseVerbForm(w)
      if (!base) continue
      bump(base, 3)
    }
  }

  // Resume text (secondary, lower weight)
  const resumeWords = tokenizeWords(String(args.resumeText ?? ""))
  for (const w of resumeWords) {
    if (!looksVerbLikeToken(w)) continue
    const base = baseVerbForm(w)
    if (!base) continue
    bump(base, 1)
  }

  const ranked = Array.from(scores.entries())
    .filter(([verb]) => verb.length >= 3 && !VERB_STOPWORDS.has(verb))
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      // deterministic tie-break
      return a[0].localeCompare(b[0])
    })
    .map(([verb]) => verb)

  return ranked.slice(0, 5)
}

function identityContrastHasRequiredVerb(args: { identityContrast: string; requiredVerbs: string[] }): boolean {
  const required = (args.requiredVerbs || []).filter(Boolean)
  if (required.length === 0) return true // nothing to enforce

  const tokens = tokenizeWords(args.identityContrast).map((w) => baseVerbForm(w)).filter(Boolean)
  const tokenSet = new Set(tokens)

  for (const v of required) {
    const vv = baseVerbForm(v) || normalizeToken(v)
    if (vv && tokenSet.has(vv)) return true

    const syns = VERB_SYNONYMS[vv] ?? VERB_SYNONYMS[normalizeToken(v)] ?? []
    for (const s of syns) {
      const ss = baseVerbForm(s) || normalizeToken(s)
      if (ss && tokenSet.has(ss)) return true
    }
  }

  return false
}

export async function generateSemanticSynthesis(args: {
  personVector: PersonVector6
  resumeText: string
  promptAnswers: Array<{ n: 1 | 2 | 3 | 4 | 5; answer: string }>
  operateBestDims: number[]
  loseEnergyDims: number[]
  dimensionNames: string[]
  fix?: { errors: string[]; previousJson: any }
}): Promise<{
  identityContrast: string
  interventionContrast: string
  constructionLayer: string
  consequenceDrop?: string
  operate_best_bullets: string[]
  lose_energy_bullets: string[]
}> {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim()
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY")
  }

  const model = (process.env.OPENAI_MODEL_SEMANTIC_SYNTHESIS || "gpt-4o-mini").trim()
  const temperature = Number.parseFloat(process.env.OPENAI_TEMP_SEMANTIC_SYNTHESIS || "0.25")
  const temp = Number.isFinite(temperature) ? Math.max(0, Math.min(1, temperature)) : 0.25

  const allowedVerbs = [
    "notice",
    "surface",
    "map",
    "isolate",
    "name",
    "define",
    "clarify",
    "tighten",
    "sequence",
    "test",
    "simplify",
    "decide",
    "design",
    "build",
    "repair",
    "align",
    "measure",
  ]

  const blacklistTokens = [
    "cadence",
    "operating structure",
    "operating model",
    "leverage",
    "impact",
    "value",
    "optimize",
    "synergy",
    "scalable",
    "framework",
    "system’s",
    "system's",
  ]

  const userPrompt = [
    "Return JSON only. No markdown. No extra keys.",
    "",
    "TASK:",
    "Generate semantically specific lines using resume + prompt answers, constrained to the locked 4-layer form.",
    "Also generate 2 bullet lists constrained by deterministically selected dimensions.",
    "No praise. No motivational tone. No therapeutic framing. No KPI framing. No capability/skill language.",
    "",
    "OUTPUT JSON SCHEMA:",
    "{",
    '  "identityContrast": "You don’t just ... — you ....",',
    '  "interventionContrast": "When something isn’t working, you don’t ... — you ....",',
    '  "constructionLayer": "You <verb>, <verb>, and <verb>.",',
    '  "consequenceDrop": "You ... ." (optional, <= 7 words),',
    '  "operate_best_bullets": ["..."] (1–3 items),',
    '  "lose_energy_bullets": ["..."] (1–3 items)',
    "}",
    "",
    "HARD RULES (SYNTHESIS LINES):",
    "- identityContrast must start with exactly: You don’t just",
    "- interventionContrast must start with exactly: When something isn’t working,",
    "- constructionLayer must match exactly: You <verb>, <verb>, and <verb>.",
    "- construction verbs must be chosen from this allowlist only:",
    `  ${allowedVerbs.join(", ")}`,
    "- Do not use any of these tokens/phrases (case-insensitive):",
    `  ${blacklistTokens.join(" | ")}`,
    "- Use concrete structural nouns: scope, constraints, decisions, routing, ownership, measures, handoffs, tradeoffs.",
    "- Keep each line <= 120 characters.",
    "- Avoid repeating the same content word (>=5 chars) across lines.",
    "",
    "ANCHOR REQUIREMENTS (MANDATORY):",
    "- First (internally), select 3–6 CONCRETE lexical anchors from resumeText + promptAnswers.",
    "  - At least 1 anchor must be a NOUN PHRASE (e.g., a role/title, domain object, artifact, system name, process name).",
    "  - At least 1 anchor must be a VERB PHRASE (e.g., 'debugged X', 'built Y', 'reduced Z', 'mapped A to B').",
    "- Then write the 4 synthesis lines and the bullets USING those anchors.",
    "- Across the 4 synthesis lines, ensure at least 1 anchor noun phrase AND at least 1 anchor verb phrase appear verbatim (or near-verbatim).",
    "- Do NOT output the anchors list. Anchor selection is internal only.",
    "",
    "ANTI-GENERIC RULE (MANDATORY):",
    "- Do NOT use generic role archetypes or business-speak unless the phrase appears verbatim in resumeText or promptAnswers.",
    "- Examples of banned generic archetypes unless present in user text:",
    '  "user-focused experiences" | "identify gaps in the market" | "drive impact" | "deliver value" | "enhance engagement"',
    "- If an idea cannot be expressed with anchors from user text, choose different anchors; do not invent abstractions.",
    "",
    "HARD RULES (BULLETS):",
    "- Each bullet is ONE sentence, <= 16 words.",
    "- Structural/environment statements only (not personality labels).",
    "- No praise language. No motivational tone. No therapy framing. No KPI framing.",
    "- No identity labeling (avoid “you are / you’re”).",
    "- No capability/skill language (no skills/tools/readiness).",
    "- Keep vocabulary within the user’s band (do not sound more educated than the user; tighten <= ~15%).",
    "",
    "DIMENSION CONSTRAINT (DETERMINISTIC SOURCE OF TRUTH):",
    `dimensionNames (index -> name): ${JSON.stringify(args.dimensionNames)}`,
    `operateBestDims (indices): ${JSON.stringify(args.operateBestDims)}`,
    `loseEnergyDims (indices): ${JSON.stringify(args.loseEnergyDims)}`,
    "Use ONLY these dimensions as the structural basis for the bullets.",
    "",
    args.fix
      ? [
          "FIX MODE:",
          "Your previous JSON failed validation. Re-emit JSON with the SAME keys only.",
          "Validation errors:",
          ...args.fix.errors.map((e) => `- ${e}`),
          "Previous JSON (for reference):",
          JSON.stringify(args.fix.previousJson ?? {}),
          "",
        ].join("\n")
      : "",
    "INPUTS:",
    `personVector: ${JSON.stringify(args.personVector)}`,
    "",
    "resumeText:",
    args.resumeText || "",
    "",
    "promptAnswers:",
    JSON.stringify(args.promptAnswers || []),
  ]
    .filter(Boolean)
    .join("\n")

  const body = {
    model,
    temperature: temp,
    messages: [
      {
        role: "system",
        content:
          "You are a constrained generator. Output JSON only. Follow the schema and hard rules exactly. Do not include commentary.",
      },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "")
    throw new Error(`OpenAI error: ${resp.status} ${txt}`)
  }

  const data = (await resp.json()) as any
  const content = String(data?.choices?.[0]?.message?.content ?? "").trim()
  if (!content) throw new Error("OpenAI returned empty content")

  let parsed: any = null
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error("OpenAI returned non-JSON content")
  }

  const identityContrast = String(parsed?.identityContrast ?? "").trim()
  const interventionContrast = String(parsed?.interventionContrast ?? "").trim()
  const constructionLayer = String(parsed?.constructionLayer ?? "").trim()
  const consequenceDropRaw = parsed?.consequenceDrop == null ? undefined : String(parsed.consequenceDrop).trim()
  const consequenceDrop = consequenceDropRaw && consequenceDropRaw.length > 0 ? consequenceDropRaw : undefined

  const operate_best_bullets = Array.isArray(parsed?.operate_best_bullets)
    ? parsed.operate_best_bullets.map((x: any) => String(x ?? "").trim()).filter(Boolean)
    : []
  const lose_energy_bullets = Array.isArray(parsed?.lose_energy_bullets)
    ? parsed.lose_energy_bullets.map((x: any) => String(x ?? "").trim()).filter(Boolean)
    : []

  if (!identityContrast || !interventionContrast || !constructionLayer) {
    throw new Error("OpenAI JSON missing required fields")
  }

  // New validation rule: identityContrast must contain at least one high-signal user verb (or synonym).
  const extractedVerbs = extractTopUserVerbs({ promptAnswers: args.promptAnswers || [], resumeText: args.resumeText || "" })
  console.log("[caliber] synthesis_verbs_extracted", { verbs: extractedVerbs })

  if (!identityContrastHasRequiredVerb({ identityContrast, requiredVerbs: extractedVerbs })) {
    console.warn("[caliber] synthesis_identity_first_line_verb_rule_failed", {
      verbs: extractedVerbs,
      identityContrast: identityContrast.slice(0, 160),
    })
    throw new Error(
      `Semantic synthesis validation failed: identityContrast must contain a user verb (or synonym). verbs=${JSON.stringify(extractedVerbs)}`,
    )
  }

  return { identityContrast, interventionContrast, constructionLayer, consequenceDrop, operate_best_bullets, lose_energy_bullets }
}