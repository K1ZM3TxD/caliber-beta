// lib/realm_guard.ts
// Out-of-realm score cap.  Prevents jobs that clearly fall outside the user's
// calibrated career realm from receiving inflated Caliber scores.
//
// Design:
//   1. Tokenize job text and user profile (resume + prompt answers) using
//      the same canonicalization pipeline as title_scoring.
//   2. Check whether the job text is dominated by vocabulary from a known
//      non-professional domain (hospitality, food service, manual labor, etc.)
//      that has zero meaningful overlap with the user's profile vocabulary.
//   3. Return { capped, reason } so the caller in integration_seam can clamp.

import { canonicalize, normalizeCompounds } from "@/lib/title_scoring"

// ── Constants ───────────────────────────────────────────────────────────────

export const REALM_CAP = 5

// Stop-words stripped during tokenization (mirrors title_scoring approach)
const STOP = new Set<string>([
  "the","and","for","with","from","this","that","have","has","had","will","into",
  "over","under","your","you","our","are","was","were","been","being","they","them",
  "their","there","here","what","when","where","which","who","whom","why","how",
  "can","could","should","would","may","might","not","but","also","than","then",
  "about","just","like","really","very","much","more","most","some","any","all",
  "each","every","both","few","many","other","such","only","own","same","too",
])

// ── Out-of-realm domain vocabularies ────────────────────────────────────────
// Each entry is a set of canonicalized terms that strongly signal a job is in
// a domain outside the calibrated professional clusters (ProductDev,
// DesignSystems, OpsProgram, ClientGrowth, SecurityAnalysis, CreativeOps).

const OUT_OF_REALM_DOMAINS: { name: string; terms: Set<string>; titlePatterns: RegExp[] }[] = [
  {
    name: "hospitality",
    terms: new Set([
      "bartend", "bartender", "server", "waiter", "waitress", "hostess", "host",
      "busser", "barista", "cocktail", "beer", "wine", "mixology",
      "restaurant", "dining", "food", "beverage", "kitchen", "cook", "chef",
      "sous", "prep", "dishwasher", "catering", "banquet",
      "hotel", "resort", "front desk", "concierge", "housekeeping", "valet",
      "hospitality", "guest", "tips", "tipping", "shift", "shifts",
    ]),
    titlePatterns: [
      /\b(?:bartend(?:er|ing)?|server|waiter|waitress|host(?:ess)?|busser|barista)\b/i,
      /\b(?:sous\s+chef|line\s+cook|prep\s+cook|executive\s+chef|pastry\s+chef|head\s+chef)\b/i,
      /\b(?:dishwasher|catering|banquet)\b/i,
      /\b(?:housekeeper|housekeeping|concierge|valet|bellhop|doorman|front\s+desk\s+agent)\b/i,
    ],
  },
  {
    name: "retail_manual",
    terms: new Set([
      "cashier", "stocker", "shelf", "shelves", "register", "checkout",
      "warehouse", "forklift", "picker", "packer", "loader", "unload",
      "janitor", "custodian", "landscaping", "mowing", "plumber", "electrician",
      "carpenter", "welder", "machinist", "assembler", "laborer",
    ]),
    titlePatterns: [
      /\b(?:cashier|stocker|shelf|checkout\s+clerk)\b/i,
      /\b(?:warehouse\s+(?:associate|worker)|forklift\s+(?:operator|driver))\b/i,
      /\b(?:janitor|custodian|landscap(?:er|ing)|plumber|electrician|carpenter|welder|machinist)\b/i,
    ],
  },
  {
    name: "clinical_hands_on",
    terms: new Set([
      "nurse", "nursing", "rn", "lpn", "cna", "phlebotomy", "phlebotomist",
      "paramedic", "emt", "dental", "hygienist", "orthodont", "radiolog",
      "surgeon", "anesthesi", "pharmacist", "pharmacy", "technician",
      "patient", "bedside", "triage", "icu", "nicu",
    ]),
    titlePatterns: [
      /\b(?:registered\s+nurse|LPN|CNA|phlebotomist|paramedic|EMT)\b/i,
      /\b(?:dental\s+hygienist|orthodontist|radiolog(?:ist|y\s+tech))\b/i,
      /\b(?:surgeon|anesthesiologist|pharmacist|pharmacy\s+tech)\b/i,
    ],
  },
  {
    name: "transportation",
    terms: new Set([
      "driver", "driving", "cdl", "trucker", "trucking", "dispatch",
      "courier", "delivery", "route", "haul", "freight",
      "pilot", "aviation", "flight", "cabin", "crew",
    ]),
    titlePatterns: [
      /\b(?:truck\s+driver|CDL\s+driver|delivery\s+driver|bus\s+driver|courier)\b/i,
      /\b(?:pilot|flight\s+attendant|cabin\s+crew)\b/i,
    ],
  },
]

// ── Tokenization ────────────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  const compounded = normalizeCompounds(String(text ?? ""))
  const cleaned = compounded.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) return new Set()
  const tokens = cleaned.split(" ")
  const result = new Set<string>()
  for (const raw of tokens) {
    const t = canonicalize(raw)
    if (t.length < 3) continue
    if (STOP.has(t)) continue
    result.add(t)
  }
  return result
}

// ── Core detection ──────────────────────────────────────────────────────────

export interface RealmGuardInput {
  jobText: string
  resumeText?: string
  promptAnswers?: string[]
}

export interface RealmGuardResult {
  capped: boolean
  domain: string | null
  reason: string | null
}

/**
 * Determine whether a job is outside the user's calibrated realm.
 *
 * Logic:
 *   1. Check if the job title matches a known out-of-realm title pattern.
 *   2. Check if the job text has significant vocabulary from a known
 *      out-of-realm domain (≥ 3 hits).
 *   3. If hits are found, check whether the user's own profile vocabulary
 *      ALSO overlaps with that domain (in which case the user may actually
 *      be calibrated for it — e.g. Fabio has hospitality background but is
 *      calibrated as SecurityAnalysis).
 *   4. If the user has no meaningful overlap with the out-of-realm domain,
 *      flag for capping.
 */
export function checkRealmGuard(input: RealmGuardInput): RealmGuardResult {
  const jobTokens = tokenize(input.jobText)
  const jobLower = input.jobText.toLowerCase()

  // Build user profile token set from resume + prompts
  const profileParts = [input.resumeText ?? "", ...(input.promptAnswers ?? [])].filter(Boolean)
  const profileTokens = tokenize(profileParts.join("\n"))

  for (const domain of OUT_OF_REALM_DOMAINS) {
    // Phase 1: title-pattern match (strong signal)
    const titleMatch = domain.titlePatterns.some(pat => pat.test(jobLower))

    // Phase 2: vocabulary overlap with out-of-realm domain
    let jobHits = 0
    for (const term of domain.terms) {
      if (jobTokens.has(term)) jobHits++
    }

    // Need either a title match + some vocabulary, or substantial vocabulary alone
    const triggered = (titleMatch && jobHits >= 2) || jobHits >= 4

    if (!triggered) continue

    // Phase 3: profile exemption — if the user's profile also overlaps
    // with this domain, they may be calibrated within it
    if (profileTokens.size > 0) {
      let profileHits = 0
      for (const term of domain.terms) {
        if (profileTokens.has(term)) profileHits++
      }
      // If the user has ≥ 3 terms from this out-of-realm domain in their
      // own profile, they might actually belong there → don't cap
      if (profileHits >= 3) continue
    }

    return {
      capped: true,
      domain: domain.name,
      reason: `Job is in the ${domain.name} domain which is outside the calibrated realm`,
    }
  }

  return { capped: false, domain: null, reason: null }
}
