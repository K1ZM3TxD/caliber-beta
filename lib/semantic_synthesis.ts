// lib/semantic_synthesis.ts

type PersonVector6 = [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]

export async function generateSemanticSynthesis(args: {
  personVector: PersonVector6
  resumeText: string
  promptAnswers: Array<{ n: 1 | 2 | 3 | 4 | 5; answer: string }>
}): Promise<{
  identityContrast: string
  interventionContrast: string
  constructionLayer: string
  consequenceDrop?: string
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
    "Return JSON only. No markdown. No bullets. No extra keys.",
    "",
    "TASK:",
    "Generate semantically specific lines using resume + prompt answers, constrained to the locked 4-layer form.",
    "No praise. No motivational tone. No adjectives. No abstractions. No repetition across lines.",
    "",
    "OUTPUT JSON SCHEMA:",
    "{",
    '  "identityContrast": "You don’t just ... — you ....",',
    '  "interventionContrast": "When something isn’t working, you don’t ... — you ....",',
    '  "constructionLayer": "You <verb>, <verb>, and <verb>.",',
    '  "consequenceDrop": "You ... ." (optional, <= 7 words)',
    "}",
    "",
    "HARD RULES:",
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
    "- Prefer wording and nouns taken directly from resumeText and promptAnswers.",
    "- Reuse the user’s own terms (domain nouns, role language, artifacts) when available.",
    "- Avoid generic placeholders like “ship work” unless the user uses that phrase.",
    "",
    "INPUTS:",
    `personVector: ${JSON.stringify(args.personVector)}`,
    "",
    "resumeText:",
    args.resumeText || "",
    "",
    "promptAnswers:",
    JSON.stringify(args.promptAnswers || []),
  ].join("\n")

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

  if (!identityContrast || !interventionContrast || !constructionLayer) {
    throw new Error("OpenAI JSON missing required fields")
  }

  return { identityContrast, interventionContrast, constructionLayer, consequenceDrop }
}