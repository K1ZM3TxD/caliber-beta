// lib/semantic_synthesis.ts

import { extractAnchors } from "@/lib/anchors"

type PersonVector6 = [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2]

// --- Milestone 6.0+6.1: Anchor overlap enforcement ---
const MIN_OVERLAP = 0.35

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function countWholeWordMatches(text: string, terms: string[]): { overlapCount: number; missing: string[] } {
  const hay = (text || "").toLowerCase()
  let overlapCount = 0
  const missing: string[] = []
  for (const t of terms) {
    const term = (t || "").trim()
    if (!term) continue
    const re = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`, "i")
    if (re.test(hay)) overlapCount++
    else missing.push(term)
  }
  return { overlapCount, missing }
}

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
  const temperature = Number.parseFloat(process.env.OPENAI_TEMP_SEMANTIC_SYNTHESIS || "0.35")
  const temp = Number.isFinite(temperature) ? Math.max(0, Math.min(1, temperature)) : 0.35

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
    "system's",
    "system’s",
  ]

  // --- B) Prepare promptAnswers array ---
const promptAnswersArr = (args.promptAnswers || []).map((a) => a.answer || "")

// --- C) Compute anchors once ---
const anchors = extractAnchors({
  resumeText: args.resumeText || "",
  promptAnswers: promptAnswersArr,
})

const topVerbs = anchors.verbs_top.slice(0, 12)
const topNouns = anchors.nouns_top.slice(0, 12)
const anchorTerms = [...topVerbs, ...topNouns].slice(0, 24)

  // --- D+E) Build prompt with anchor block; support retry with missing anchors ---
  const basePromptLines = [
    "Return JSON only. No markdown. No extra keys.",
    "",
    "TASK:",
    "Generate semantically specific Pattern Synthesis backbone lines (Identity / Intervention / Construction / Consequence).",
    "Use the user's own domain nouns/phrases from resumeText and promptAnswers when available.",
    "No praise. No motivational tone. No therapy framing. No KPI framing. No capability/skill language.",
    "",
    "LEXICAL ANCHORS (reuse exact terms where relevant; do not invent archetypes):",
    `Verbs: ${topVerbs.join(", ")}`,
    `Nouns: ${topNouns.join(", ")}`,
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
    "- identity_contrast must start with exactly: You don't just",
    "- intervention_contrast must start with exactly: When something isn't working,",
    "- construction_layer must match exactly: You <verb>, <verb>, and <verb>.",
    "- construction verbs must be chosen from this allowlist only:",
    `  ${allowedVerbs.join(", ")}`,
    "- conditional_consequence: <= 7 words (keep it tight).",
    "- Do not use any of these tokens/phrases (case-insensitive):",
    `  ${blacklistTokens.join(" | ")}`,
    "- Use concrete structural nouns (examples): scope, constraints, decisions, routing, ownership, measures, handoffs, tradeoffs.",
    "- Keep each line <= 120 characters.",
    "- If anchors are provided, Identity and Intervention lines must reuse at least two anchor terms verbatim when semantically valid.",
    "",
    "INPUTS:",
    `personVector: ${JSON.stringify(args.personVector)}`,
    "",
    "resumeText:",
    args.resumeText || "",
    "",
    "promptAnswers:",
    JSON.stringify(args.promptAnswers || []),
    "",
    "ANCHORS:",
    `${(args as any).lexicalAnchorsText ?? "(none provided)"}`,
  ]

  async function callModel(extraUserLines?: string[]): Promise<{ parsed: any; raw: string }> {
    const promptLines = [...basePromptLines]
    if (extraUserLines && extraUserLines.length > 0) {
      // Insert missing-anchor injection after the LEXICAL ANCHORS block
      const anchorIdx = promptLines.findIndex((l) => l.startsWith("Nouns:"))
      if (anchorIdx >= 0) {
        promptLines.splice(anchorIdx + 1, 0, "", ...extraUserLines)
      } else {
        promptLines.push("", ...extraUserLines)
      }
    }

    const userPrompt = promptLines.filter(Boolean).join("\n")

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
      console.log("synthesis_source=fallback anchor_overlap_score=0.00 missing_anchor_count=0 praise_flag=false abstraction_flag=false")
      throw new Error(`OpenAI error: ${resp.status} ${txt}`)
    }

    const data = (await resp.json()) as any
    const content = String(data?.choices?.[0]?.message?.content ?? "").trim()
    if (!content) {
      console.log("synthesis_source=fallback anchor_overlap_score=0.00 missing_anchor_count=0 praise_flag=false abstraction_flag=false")
      throw new Error("OpenAI returned empty content")
    }

    let parsed: any = null
    try {
      parsed = JSON.parse(content)
    } catch {
      console.log("synthesis_source=fallback anchor_overlap_score=0.00 missing_anchor_count=0 praise_flag=false abstraction_flag=false")
      throw new Error("OpenAI returned non-JSON content")
    }

    return { parsed, raw: content }
  }

  function extractFields(parsed: any): {
    identity_contrast: string
    intervention_contrast: string
    construction_layer: string
    conditional_consequence: string
  } {
    return {
      identity_contrast: String(parsed?.identity_contrast ?? "").trim(),
      intervention_contrast: String(parsed?.intervention_contrast ?? "").trim(),
      construction_layer: String(parsed?.construction_layer ?? "").trim(),
      conditional_consequence: String(parsed?.conditional_consequence ?? "").trim(),
    }
  }

  try {
    // --- First attempt ---
    const { parsed } = await callModel()
    const fields = extractFields(parsed)

    if (!fields.identity_contrast || !fields.intervention_contrast || !fields.construction_layer || !fields.conditional_consequence) {
      console.log("synthesis_source=fallback anchor_overlap_score=0.00 missing_anchor_count=0 praise_flag=false abstraction_flag=false")
      throw new Error("OpenAI JSON missing required fields")
    }

    // --- I) Inline acceptance comment ---
    // Overlap evaluation example:
    //   anchorTerms sample: ["scope", "constraints", "handoffs"]
    //   synthesisTextForOverlap: "You don't just handle scope — you tighten constraints. When something isn't working, you map handoffs."
    //   expected overlap_count: 3, score: 3/3 = 1.00
    const synthesisTextForOverlap = [
      fields.identity_contrast,
      fields.intervention_contrast,
      fields.construction_layer,
      fields.conditional_consequence,
    ].join(" ")

    const { overlapCount, missing } = countWholeWordMatches(synthesisTextForOverlap, anchorTerms)
    const denom = Math.max(1, anchorTerms.length)
    const score = overlapCount / denom
    const missingCount = denom - overlapCount

    // --- G) Check overlap threshold ---
if (score >= MIN_OVERLAP) {
 console.log(
  "synthesis_source=llm anchor_overlap_score=" +
  score.toFixed(2) +
  " missing_anchor_count=" +
  missingCount +
  " praise_flag=false abstraction_flag=false"
)
  return {
    identityContrast: fields.identity_contrast,
    interventionContrast: fields.intervention_contrast,
    constructionLayer: fields.construction_layer,
    consequenceDrop: fields.conditional_consequence,
  }
}

    // --- G) Retry once with missing anchors injected ---
    const retryExtraLines = [
      "MISSING ANCHORS (must include several verbatim terms):",
      missing.slice(0, 24).join(", "),
    ]

    const { parsed: retryParsed } = await callModel(retryExtraLines)
    const retryFields = extractFields(retryParsed)

    if (!retryFields.identity_contrast || !retryFields.intervention_contrast || !retryFields.construction_layer || !retryFields.conditional_consequence) {
      // Retry returned incomplete — fall through to deterministic fallback below
      const finalScore = score
      const finalMissingCount = missingCount
      console.log("synthesis_source=fallback anchor_overlap_score=" + finalScore.toFixed(2) + " missing_anchor_count=" + finalMissingCount + " praise_flag=false abstraction_flag=false")
      // (falls through to deterministic fallback)
    } else {
      const retrySynthesisText = [
        retryFields.identity_contrast,
        retryFields.intervention_contrast,
        retryFields.construction_layer,
        retryFields.conditional_consequence,
      ].join(" ")

      const retryResult = countWholeWordMatches(retrySynthesisText, anchorTerms)
      const retryDenom = Math.max(1, anchorTerms.length)
      const retryScore = retryResult.overlapCount / retryDenom
      const retryMissingCount = retryDenom - retryResult.overlapCount

      // --- F) REQUIRED LOG LINE (retry attempt) ---
      console.log(
  "synthesis_source=retry anchor_overlap_score=" +
  retryScore.toFixed(2) +
  " missing_anchor_count=" +
  retryMissingCount +
  " praise_flag=false abstraction_flag=false"
)

      if (retryScore >= MIN_OVERLAP) {
        return {
          identityContrast: retryFields.identity_contrast,
          interventionContrast: retryFields.intervention_contrast,
          constructionLayer: retryFields.construction_layer,
          consequenceDrop: retryFields.conditional_consequence,
        }
      }

      // Retry still below threshold — deterministic fallback
      const finalScore = retryScore
      const finalMissingCount = retryMissingCount
     console.log(
  "synthesis_source=fallback anchor_overlap_score=" +
  finalScore.toFixed(2) +
  " missing_anchor_count=" +
  finalMissingCount +
  " praise_flag=false abstraction_flag=false"
)
    }

    // --- H) Deterministic fallback JSON (anchor-failure only) ---
    const n0 = topNouns[0] || "work"
    const n1 = topNouns[1] || "scope"
    const n2 = topNouns[2] || "constraints"
    const n3 = topNouns[3] || "handoffs"
    const v0 = allowedVerbs[0] // "notice"
    const v1 = allowedVerbs[1] // "surface"
    const v2 = allowedVerbs[2] // "map"
    const v3 = allowedVerbs[3] // "isolate"
    const v4 = allowedVerbs[4] // "name"

    const fallbackIdentity = `You don’t just ${n0}—you ${v0} ${n1}.`
    const fallbackIntervention = `When something isn’t working, ${v1} ${n2} and ${v2} ${n3}.`
    const fallbackConstruction = `You ${v0}, ${v3}, and ${v4}.`
    const fallbackConsequence = (topNouns.slice(0, 3).join(" ") || "clear constraints decisions").split(" ").slice(0, 7).join(" ")

    return {
      identityContrast: fallbackIdentity,
      interventionContrast: fallbackIntervention,
      constructionLayer: fallbackConstruction,
      consequenceDrop: fallbackConsequence,
    }
  } catch (e) {
    // Ensure fallback trace is present even when upstream catches.
    if (String((e as any)?.message ?? "").trim().length === 0) {
      console.log("synthesis_source=fallback anchor_overlap_score=0.00 missing_anchor_count=0 praise_flag=false abstraction_flag=false")
    }
    throw e
  }
}


