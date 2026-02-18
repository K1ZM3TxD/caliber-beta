export type GuardInput = {
  identity: string
  intervention: string
  construction: string
  consequence?: string | null
  primaryDim: number
}

export type GuardOutput = {
  identity: string
  intervention: string
  construction: string
  consequence?: string | null
}

const ALLOWED_REPEAT = new Set(["you", "don't", "dont", "just", "when", "isn't", "isnt"])

const PRAISE_WORDS = [
  "best",
  "great",
  "strong",
  "exceptional",
  "amazing",
  "high-performing",
  "world-class",
  "excellent",
  "outstanding",
  "elite",
]

const BLACKLIST_PHRASES: Array<{ re: RegExp; replaceWith: string }> = [
  { re: /\boperating model\b/gi, replaceWith: "work plan" },
  { re: /\boperating structure\b/gi, replaceWith: "work plan" },
  { re: /\bframework\b/gi, replaceWith: "plan" },
  { re: /\bsynergies\b/gi, replaceWith: "handoffs" },
  { re: /\bscalable\b/gi, replaceWith: "repeatable" },
  { re: /\bleverage\b/gi, replaceWith: "use" },
  { re: /\bimpact\b/gi, replaceWith: "effect" },
  { re: /\bvalue\b/gi, replaceWith: "result" },
  { re: /\boptimize\b/gi, replaceWith: "tighten" },
  { re: /\bcadence\b/gi, replaceWith: "cycle" },
  { re: /\bsystems?\b/gi, replaceWith: "work" },
]

const SYNONYMS: Record<string, string[]> = {
  constraints: ["limits", "guardrails", "rules"],
  boundary: ["limit", "line"],
  boundaries: ["limits", "lines"],
  ownership: ["owner", "accountability"],
  decision: ["call", "choice"],
  decisions: ["calls", "choices"],
  measure: ["metric", "check"],
  measures: ["metrics", "checks"],
  scope: ["range", "surface"],
  thread: ["line", "path"],
  path: ["track", "line"],
  handoff: ["transfer", "pass"],
  handoffs: ["transfers", "passes"],
  cycle: ["loop", "round"],
  work: ["delivery", "execution"],
  plan: ["sequence", "outline"],
  route: ["send", "hand"],
}

const CONCRETE_VERBS = new Set([
  "notice",
  "map",
  "surface",
  "isolate",
  "name",
  "define",
  "test",
  "simplify",
  "tighten",
  "sequence",
  "clarify",
  "repair",
  "design",
  "build",
  "draft",
  "decide",
  "align",
  "measure",
])

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function stripPraise(text: string): string {
  let out = text
  for (const w of PRAISE_WORDS) {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi")
    out = out.replace(re, "")
  }
  return out.replace(/\s+/g, " ").trim()
}

function applyBlacklist(text: string): string {
  let out = text
  for (const { re, replaceWith } of BLACKLIST_PHRASES) out = out.replace(re, replaceWith)
  return out.replace(/\s+/g, " ").trim()
}

function words(text: string): string[] {
  const normalized = text.replace(/’/g, "'")
  return (normalized.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []).filter(Boolean)
}

function contentWords(text: string): string[] {
  return words(text).filter((w) => w.length >= 5 && !ALLOWED_REPEAT.has(w))
}

function replaceWordDeterministically(text: string, word: string, used: Set<string>): string {
  const key = word.toLowerCase()
  const candidates = SYNONYMS[key] ?? []
  const pick = candidates.find((c) => !used.has(c.toLowerCase()))
  if (!pick) return text
  used.add(pick.toLowerCase())
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi")
  return text.replace(re, pick)
}

function enforceConstruction(line: string, used: Set<string>, primaryDim: number): string {
  const m = line.trim().replace(/’/g, "'").match(/^You\s+([a-z]+),\s+([a-z]+),\s+and\s+([a-z]+)\.$/i)
  if (m) {
    const v1 = m[1].toLowerCase()
    const v2 = m[2].toLowerCase()
    const v3 = m[3].toLowerCase()
    if (CONCRETE_VERBS.has(v1) && CONCRETE_VERBS.has(v2) && CONCRETE_VERBS.has(v3)) {
      if (!used.has(v1) && !used.has(v2) && !used.has(v3)) {
        used.add(v1)
        used.add(v2)
        used.add(v3)
        return `You ${v1}, ${v2}, and ${v3}.`
      }
    }
  }

  const safeByDim: Record<number, [string, string, string]> = {
    0: ["notice", "sequence", "tighten"],
    1: ["map", "define", "decide"],
    2: ["measure", "test", "tighten"],
    3: ["clarify", "isolate", "decide"],
    4: ["simplify", "name", "sequence"],
    5: ["map", "align", "define"],
  }

  const fallback: [string, string, string] = safeByDim[primaryDim] ?? ["notice", "define", "decide"]
  const picked: string[] = []
  for (const v of fallback) {
    if (!used.has(v)) {
      used.add(v)
      picked.push(v)
    }
  }
  const final = (picked.length === 3 ? picked : ["notice", "define", "decide"]).slice(0, 3)
  used.add(final[0])
  used.add(final[1])
  used.add(final[2])
  return `You ${final[0]}, ${final[1]}, and ${final[2]}.`
}

function shouldOmitConsequence(consequence: string, identity: string, intervention: string, blacklistRe: RegExp): boolean {
  if (blacklistRe.test(consequence)) return true

  const c = new Set(contentWords(consequence))
  const i = new Set(contentWords(identity))
  const v = new Set(contentWords(intervention))

  let overlap = 0
  for (const w of c) if (i.has(w) || v.has(w)) overlap += 1
  if (overlap >= 2) return true

  const wc = words(consequence).length
  if (wc > 7) return true

  return false
}

export function validateAndRepairSynthesisLines(input: GuardInput): GuardOutput {
  let identity = applyBlacklist(stripPraise(input.identity))
  let intervention = applyBlacklist(stripPraise(input.intervention))
  let construction = applyBlacklist(stripPraise(input.construction))
  let consequence = input.consequence ? applyBlacklist(stripPraise(input.consequence)) : null

  const used = new Set<string>()
  construction = enforceConstruction(construction, used, input.primaryDim)

  for (let pass = 0; pass < 2; pass += 1) {
    identity = applyBlacklist(stripPraise(identity))
    intervention = applyBlacklist(stripPraise(intervention))
    construction = applyBlacklist(stripPraise(construction))
    consequence = consequence ? applyBlacklist(stripPraise(consequence)) : null

    const blacklistAny = new RegExp(
      [
        "cadence",
        "leverage",
        "impact",
        "value",
        "optimize",
        "synergies",
        "scalable",
        "operating model",
        "operating structure",
        "system",
        "systems",
        "framework",
      ].join("|"),
      "i",
    )

    if (consequence && shouldOmitConsequence(consequence, identity, intervention, blacklistAny)) consequence = null

    const lines = [identity, intervention, construction, ...(consequence ? [consequence] : [])]
    const seen = new Map<string, number>()
    const usedSyn = new Set<string>()

    for (let li = 0; li < lines.length; li += 1) {
      const toks = contentWords(lines[li])
      for (const t of toks) {
        const n = (seen.get(t) ?? 0) + 1
        seen.set(t, n)
        if (n > 1 && li > 0) lines[li] = replaceWordDeterministically(lines[li], t, usedSyn)
      }
    }

    identity = lines[0] ?? identity
    intervention = lines[1] ?? intervention
    construction = lines[2] ?? construction
    consequence = consequence ? (lines[3] ?? consequence) : null

    if (consequence && shouldOmitConsequence(consequence, identity, intervention, blacklistAny)) consequence = null

    identity = applyBlacklist(identity)
    intervention = applyBlacklist(intervention)
    construction = applyBlacklist(construction)
    consequence = consequence ? applyBlacklist(consequence) : null
  }

  const blacklistAnyFinal = new RegExp(
    [
      "cadence",
      "leverage",
      "impact",
      "value",
      "optimize",
      "synergies",
      "scalable",
      "operating model",
      "operating structure",
      "system",
      "systems",
      "framework",
    ].join("|"),
    "i",
  )

  const finalLines = [identity, intervention, construction, ...(consequence ? [consequence] : [])]
  if (blacklistAnyFinal.test(finalLines.join(" "))) {
    const safeByDim: Record<number, GuardOutput> = {
      0: {
        identity: "You don't just ship work — you sequence constraints.",
        intervention: "When something isn't working, you don't push harder — you tighten limits.",
        construction: "You notice, sequence, and tighten.",
        consequence: null,
      },
      1: {
        identity: "You don't just support decisions — you define owners.",
        intervention: "When something isn't working, you don't take over — you clarify calls.",
        construction: "You map, define, and decide.",
        consequence: null,
      },
      2: {
        identity: "You don't just hit targets — you protect metrics.",
        intervention: "When something isn't working, you don't argue — you test incentives.",
        construction: "You measure, test, and tighten.",
        consequence: null,
      },
      3: {
        identity: "You don't just follow a plan — you hold scope.",
        intervention: "When something isn't working, you don't adapt silently — you reject drift.",
        construction: "You clarify, isolate, and decide.",
        consequence: null,
      },
      4: {
        identity: "You don't just learn quickly — you pick one path.",
        intervention: "When something isn't working, you don't add options — you simplify.",
        construction: "You simplify, name, and sequence.",
        consequence: null,
      },
      5: {
        identity: "You don't just coordinate stakeholders — you map handoffs.",
        intervention: "When something isn't working, you don't reply to everyone — you set a route.",
        construction: "You map, align, and define.",
        consequence: null,
      },
    }
    return safeByDim[input.primaryDim] ?? safeByDim[0]
  }

  return { identity, intervention, construction, consequence }
}