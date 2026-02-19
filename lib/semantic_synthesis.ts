// lib/semantic_synthesis.ts

type PersonVector6 = [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]

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

  return { identityContrast, interventionContrast, constructionLayer, consequenceDrop, operate_best_bullets, lose_energy_bullets }
}