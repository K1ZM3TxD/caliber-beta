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
    console.log("synthesis_source=fallback")
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
    "Generate semantically specific Pattern Synthesis backbone lines (Identity / Intervention / Construction / Consequence).",
    "Use the user's own domain nouns/phrases from resumeText and promptAnswers when available.",
    "No praise. No motivational tone. No therapy framing. No KPI framing. No capability/skill language.",
    "",
    "OUTPUT JSON (STRICT; EXACT KEYS ONLY):",
    "{",
    '  "identity_contrast": "string",',
    '  "intervention_contrast": "string",',
    '  "construction_layer": "string",',
    '  "conditional_consequence": "string"',
    "}",
    "",
    "HARD RULES:",
    "- identity_contrast must start with exactly: You don’t just",
    "- intervention_contrast must start with exactly: When something isn’t working,",
    "- construction_layer must match exactly: You <verb>, <verb>, and <verb>.",
    "- construction verbs must be chosen from this allowlist only:",
    `  ${allowedVerbs.join(", ")}`,
    "- conditional_consequence: <= 7 words (keep it tight).",
    "- Do not use any of these tokens/phrases (case-insensitive):",
    `  ${blacklistTokens.join(" | ")}`,
    "- Use concrete structural nouns (examples): scope, constraints, decisions, routing, ownership, measures, handoffs, tradeoffs.",
    "- Keep each line <= 120 characters.",
    "",
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
        content: "You are a constrained generator. Output JSON only. Follow the schema and hard rules exactly. Do not include commentary.",
      },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  }

  try {
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
      console.log("synthesis_source=fallback")
      throw new Error(`OpenAI error: ${resp.status} ${txt}`)
    }

    const data = (await resp.json()) as any
    const content = String(data?.choices?.[0]?.message?.content ?? "").trim()
    if (!content) {
      console.log("synthesis_source=fallback")
      throw new Error("OpenAI returned empty content")
    }

    let parsed: any = null
    try {
      parsed = JSON.parse(content)
    } catch {
      console.log("synthesis_source=fallback")
      throw new Error("OpenAI returned non-JSON content")
    }

    const identity_contrast = String(parsed?.identity_contrast ?? "").trim()
    const intervention_contrast = String(parsed?.intervention_contrast ?? "").trim()
    const construction_layer = String(parsed?.construction_layer ?? "").trim()
    const conditional_consequence = String(parsed?.conditional_consequence ?? "").trim()

    if (!identity_contrast || !intervention_contrast || !construction_layer || !conditional_consequence) {
      console.log("synthesis_source=fallback")
      throw new Error("OpenAI JSON missing required fields")
    }

    console.log("synthesis_source=llm")
    return {
      identityContrast: identity_contrast,
      interventionContrast: intervention_contrast,
      constructionLayer: construction_layer,
      consequenceDrop: conditional_consequence,
    }
  } catch (e) {
    // Ensure fallback trace is present even when upstream catches.
    if (String((e as any)?.message ?? "").trim().length === 0) console.log("synthesis_source=fallback")
    throw e
  }
}