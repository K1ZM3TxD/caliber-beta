/**
 * lib/title_scoring.ts
 *
 * Cluster-based deterministic title scoring.
 * Replaces the old ops-only TITLE_BANK with multi-cluster title definitions
 * covering ProductDev, DesignSystems, OpsProgram, ClientGrowth, and standalone titles.
 */

// ─── Text normalisation helpers ─────────────────────────────────────────────

const TITLE_STOPWORDS = new Set<string>([
  "the","and","for","with","from","this","that","have","has","had","will","into",
  "over","under","your","you","our","are","was","were","been","being","they","them",
  "their","there","here","what","when","where","which","who","whom","why","how",
  "can","could","should","would","may","might","not","but","also","than","then",
  "about","just","like","really","very","much","more","most","some","any","all",
  "each","every","both","few","many","other","such","only","own","same","too",
]);

const CANON_MAP: Record<string, string> = {
  designing: "design", designed: "design", designer: "design", designers: "design", designs: "design",
  building: "build", built: "build", builds: "build",
  needs: "need",
  workflows: "workflow",
  proposals: "proposal",
  automated: "automate", automation: "automate",
  systems: "system",
  processes: "process",
  customers: "customer",
  teams: "team",
  investigating: "investigate", investigation: "investigate", investigator: "investigate",
  vulnerabilities: "vulnerability",
  strategies: "strategy",
};

const COMPOUND_MAP: [RegExp, string][] = [
  [/\bteam[\s-]building\b/gi, "team"],
  [/\brelationship[\s-]building\b/gi, "relationship"],
  [/\bproblem[\s-]solving\b/gi, "problem"],
  [/\bcross[\s-]functional\b/gi, "cross_functional"],
  [/\bgo[\s-]to[\s-]market\b/gi, "market"],
];

export function normalizeCompounds(text: string): string {
  let out = text;
  for (const [pattern, replacement] of COMPOUND_MAP) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function stripSuffix(token: string): string {
  if (token.length < 5) return token;
  if (token.endsWith("ing") && token.length >= 6) {
    const base = token.slice(0, -3);
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2] && /[bcdfghlmnprst]/.test(base[base.length - 1])) {
      return base.slice(0, -1);
    }
    return base;
  }
  if (token.endsWith("ed") && token.length >= 5) {
    const base = token.slice(0, -2);
    if (base.length >= 2 && base[base.length - 1] === base[base.length - 2] && /[bcdfghlmnprst]/.test(base[base.length - 1])) {
      return base.slice(0, -1);
    }
    return base;
  }
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is") && token.length >= 5) {
    if (token.endsWith("ies") && token.length >= 5) {
      return token.slice(0, -3) + "y";
    }
    if (token.endsWith("es") && /(?:ch|sh|x|z)es$/.test(token)) {
      return token.slice(0, -2);
    }
    return token.slice(0, -1);
  }
  return token;
}

export function canonicalize(token: string): string {
  const mapped = CANON_MAP[token];
  if (mapped) return mapped;
  const stripped = stripSuffix(token);
  if (stripped !== token) {
    return CANON_MAP[stripped] ?? stripped;
  }
  return token;
}

export function extractBroadTokens(text: string): Map<string, number> {
  const compounded = normalizeCompounds(String(text ?? ""));
  const cleaned = compounded.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return new Map();
  const tokens = cleaned.split(" ");
  const counts = new Map<string, number>();
  for (const raw of tokens) {
    const t = canonicalize(raw);
    if (t.length < 3) continue;
    if (TITLE_STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const result = new Map<string, number>();
  for (const [term, count] of counts) {
    if (count >= 2) result.set(term, count);
  }
  return result;
}

export function extractWeightedAnchors(resumeText: string, promptAnswers: string[]): Map<string, number> {
  const combinedText = [resumeText, ...promptAnswers].filter(Boolean).join("\n");
  const allTokens = extractBroadTokens(combinedText);

  const toWordSet = (text: string): Set<string> => {
    const compounded = normalizeCompounds(String(text ?? ""));
    return new Set(
      compounded.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
        .map(canonicalize)
        .filter(t => t.length >= 3 && !TITLE_STOPWORDS.has(t))
    );
  };
  const resumeWords = toWordSet(resumeText);
  const promptWordSets = promptAnswers.map(toWordSet);

  // Retain single-mention terms that are in the scoring vocabulary.
  // These are domain-significant tokens (e.g. "development", "system") that
  // appeared only once in the combined text and were dropped by the count>=2
  // gate in extractBroadTokens. They enter at count=3 because a single mention
  // of a domain-relevant term carries stronger signal than generic vocabulary.
  for (const wordSet of [resumeWords, ...promptWordSets]) {
    for (const term of wordSet) {
      if (!allTokens.has(term) && SCORING_VOCAB.has(term)) {
        allTokens.set(term, 3);
      }
    }
  }

  // Source-weighted scoring: prompt answers (explicit preference signals)
  // carry more influence than resume text (historical role vocabulary).
  const RESUME_SOURCE_WEIGHT = 1.0;
  const PROMPT_SOURCE_WEIGHT = 2.5;

  const weighted = new Map<string, number>();
  for (const [term, rawCount] of allTokens) {
    let base = Math.min(4, rawCount);
    let sourceWeight = 0;
    if (resumeWords.has(term)) sourceWeight += RESUME_SOURCE_WEIGHT;
    let inPrompt = false;
    for (const pSet of promptWordSets) {
      if (pSet.has(term)) { sourceWeight += PROMPT_SOURCE_WEIGHT; inPrompt = true; }
    }
    // Prompt-only terms get a half-step base lift (2→3) to reflect
    // explicit user signal; terms also in resume are unaffected.
    if (inPrompt && base < 4 && !resumeWords.has(term)) base = Math.min(4, base + 1);
    const bonus = Math.min(2, Math.max(0, Math.floor(sourceWeight / PROMPT_SOURCE_WEIGHT)));
    const weight = Math.min(5, base + bonus);
    weighted.set(term, weight);
  }
  return weighted;
}

// ─── Cluster-based title definitions ────────────────────────────────────────

type TitleCluster = {
  name: string;
  core: string[];
  titles: Array<{
    title: string;
    unique: string[];
    optional: string[];
  }>;
};

const TITLE_CLUSTERS: TitleCluster[] = [
  {
    name: "ProductDev",
    core: ["product", "development", "system", "process"],
    titles: [
      { title: "Product Development Lead", unique: ["customer", "market"], optional: ["proposal", "feasibility", "launch", "sop", "design"] },
      { title: "Technical Product Manager", unique: ["team", "technical"], optional: ["delivery", "architecture", "integration", "launch"] },
      { title: "Product Operations Lead", unique: ["operations", "workflow"], optional: ["tracking", "reporting", "sop", "documentation"] },
      { title: "Product Strategy Lead", unique: ["market", "planning"], optional: ["customer", "research", "team", "launch"] },
      { title: "Implementation Manager", unique: ["client", "workflow"], optional: ["onboarding", "documentation", "sop", "team"] },
    ],
  },
  {
    name: "DesignSystems",
    core: ["design", "system", "workflow", "process"],
    titles: [
      { title: "Product Designer", unique: ["product", "research"], optional: ["users", "testing", "feedback", "documentation"] },
      { title: "UX Design Strategist", unique: ["research", "users"], optional: ["strategy", "testing", "documentation", "need"] },
      { title: "Design Operations Lead", unique: ["team", "operations"], optional: ["documentation", "standards", "tracking", "coordination"] },
      { title: "Design Program Manager", unique: ["team", "management"], optional: ["coordination", "planning", "delivery", "standards"] },
      { title: "Brand Systems Designer", unique: ["brand", "team"], optional: ["standards", "identity", "visual", "documentation", "guidelines"] },
    ],
  },
  {
    name: "OpsProgram",
    core: ["operations", "management", "team", "process"],
    titles: [
      { title: "Program Operations Lead", unique: ["program", "tracking"], optional: ["planning", "execution", "reporting", "stakeholders"] },
      { title: "Operations Manager", unique: ["reporting", "compliance"], optional: ["performance", "scheduling", "budget", "tracking"] },
      { title: "Program Manager", unique: ["program", "delivery"], optional: ["execution", "coordination", "budget", "stakeholders"] },
      { title: "Project Delivery Manager", unique: ["project", "planning"], optional: ["budget", "execution", "reporting", "delivery"] },
      { title: "Process Improvement Lead", unique: ["execution", "tracking"], optional: ["improvement", "efficiency", "documentation", "standards"] },
    ],
  },
  {
    name: "ClientGrowth",
    core: ["customer", "sale", "client"],
    titles: [
      { title: "Client Success Manager", unique: ["retention", "onboard"], optional: ["relationship", "collaboration", "stakeholder", "strategy", "tool", "service"] },
      { title: "Partnerships Manager", unique: ["partnership", "alliance"], optional: ["relationship", "collaboration", "stakeholder", "strategy", "project", "service"] },
      { title: "Business Development Manager", unique: ["pipeline", "negotiation"], optional: ["relationship", "strategy", "stakeholder", "project", "ownership"] },
      { title: "Community & Growth Lead", unique: ["community", "growth"], optional: ["relationship", "collaboration", "tool", "project", "ownership"] },
      { title: "Account Manager", unique: ["account", "renewal"], optional: ["relationship", "stakeholder", "strategy", "project", "collaboration", "service"] },
    ],
  },
  {
    name: "SecurityAnalysis",
    core: ["security", "technical", "analysis"],
    titles: [
      { title: "Security Analyst", unique: ["risk", "network"], optional: ["vulnerability", "assessment", "cybersecurity", "penetration", "system", "investigate"] },
      { title: "Cybersecurity Specialist", unique: ["network", "vulnerability"], optional: ["penetration", "risk", "system", "assessment", "tool", "cybersecurity", "test"] },
      { title: "Security Operations Lead", unique: ["team", "risk"], optional: ["network", "system", "vulnerability", "operations", "assessment", "cybersecurity"] },
      { title: "Technical Security Consultant", unique: ["solution", "risk"], optional: ["client", "assessment", "system", "vulnerability", "investigate", "cybersecurity"] },
      { title: "Threat & Vulnerability Analyst", unique: ["vulnerability", "risk"], optional: ["network", "assessment", "penetration", "system", "investigate", "cybersecurity"] },
    ],
  },
  {
    name: "CreativeOps",
    core: ["design", "business", "tool"],
    titles: [
      { title: "Marketing Operations Manager", unique: ["market", "strategy"], optional: ["automate", "sop", "material", "customer", "campaign", "sale"] },
      { title: "Creative Operations Lead", unique: ["material", "automate"], optional: ["sop", "market", "strategy", "workflow", "customer", "pitch"] },
      { title: "Sales Enablement Specialist", unique: ["sale", "customer"], optional: ["pitch", "script", "sop", "deck", "strategy", "material"] },
      { title: "Business Operations Designer", unique: ["automate", "sop"], optional: ["market", "strategy", "workflow", "customer", "material", "process"] },
      { title: "Brand & Content Strategist", unique: ["market", "material"], optional: ["customer", "strategy", "communication", "sale", "automate", "campaign"] },
    ],
  },
];

const STANDALONE_SIGS: Array<{ title: string; required: string[]; optional: string[] }> = [
  {
    title: "Solutions Consultant",
    required: ["client", "solutions", "proposal", "process", "customer", "feasibility"],
    optional: ["consulting", "delivery", "engagement", "management", "team"],
  },
];

// Derived flat structures
type Sig = { required: string[]; optional: string[] };
const TITLE_BANK: string[] = [];
const SIGS: Record<string, Sig> = {};
for (const cluster of TITLE_CLUSTERS) {
  for (const t of cluster.titles) {
    TITLE_BANK.push(t.title);
    SIGS[t.title] = {
      required: [...cluster.core, ...t.unique],
      optional: t.optional,
    };
  }
}
for (const t of STANDALONE_SIGS) {
  TITLE_BANK.push(t.title);
  SIGS[t.title] = { required: t.required, optional: t.optional };
}

// Scoring vocabulary: all terms used in any title signature.
// Used to retain single-mention domain terms during anchor extraction.
const SCORING_VOCAB = new Set<string>();
for (const sig of Object.values(SIGS)) {
  for (const t of sig.required) SCORING_VOCAB.add(t);
  for (const t of sig.optional) SCORING_VOCAB.add(t);
}

const ACTION_ARTIFACT_PAIRS: [string, string][] = [
  ["design", "system"],
  ["create", "sop"],
  ["automate", "workflow"],
  ["pitch", "deck"],
  ["feasibility", "study"],
  ["customer", "need"],
  ["client", "outcome"],
  ["build", "relationship"],
  ["penetration", "test"],
  ["vulnerability", "assessment"],
  ["investigate", "risk"],
  ["partnership", "alliance"],
  ["sale", "strategy"],
];

const HIGH_SPECIFICITY_ANCHORS = new Set<string>([
  "sop", "feasibility", "incentives", "automate", "workflow",
  "pitch", "deck", "study", "proposal", "methodology", "compliance",
  "architecture", "stakeholders", "onboarding", "documentation",
  "retention", "onboard", "partnership", "pipeline", "renewal",
  "alliance", "negotiation", "community",
  "cybersecurity", "penetration", "vulnerability", "assessment", "risk",
]);

// ─── Scoring engine ─────────────────────────────────────────────────────────

interface EnrichedCandidate {
  title: string;
  score: number;
  _reqCov: number;
  _matchedPairs: string[];
  _matchedReq: string[];
  _missing: string[];
}

const TITLE_TO_CLUSTER = new Map<string, string>();
for (const cluster of TITLE_CLUSTERS) {
  for (const t of cluster.titles) {
    TITLE_TO_CLUSTER.set(t.title, cluster.name);
  }
}

const DOMAIN_GROUNDING: Record<string, string[]> = {
  SecurityAnalysis: ["security", "cybersecurity", "penetration", "vulnerability", "network", "risk", "soc", "analyst", "technical"],
  CreativeOps: ["marketing", "sale", "customer", "pitch", "deck", "script", "automate", "sop", "material", "business", "design"],
  ClientGrowth: ["client", "customer", "relationship", "sale", "service", "partnership", "alliance", "retention", "account", "negotiation", "community"],
  ProductDev: ["product", "development", "market", "launch", "technical", "system", "workflow", "process"],
  DesignSystems: ["design", "system", "workflow", "research", "users", "documentation", "brand"],
  OpsProgram: ["operations", "management", "program", "project", "tracking", "reporting", "execution", "planning"],
};

function detectPrimaryClusters(anchorMap: Map<string, number>): string[] {
  const clusterScores = new Map<string, number>();
  for (const [cluster, terms] of Object.entries(DOMAIN_GROUNDING)) {
    let score = 0;
    for (const term of terms) {
      score += anchorMap.get(term) ?? 0;
    }
    clusterScores.set(cluster, score);
  }

  const sorted = [...clusterScores.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[1] ?? 0;
  if (top === 0) return [];
  return sorted.filter(([, s]) => s >= Math.max(3, top * 0.5)).map(([name]) => name);
}

function applyGroundingPenalty(candidates: EnrichedCandidate[], anchorMap: Map<string, number>): EnrichedCandidate[] {
  const primaryClusters = detectPrimaryClusters(anchorMap);
  if (primaryClusters.length === 0) return candidates;

  const trustedAdjacencies = new Set<string>([
    "SecurityAnalysis->OpsProgram",
    "OpsProgram->SecurityAnalysis",
    "CreativeOps->ClientGrowth",
    "ClientGrowth->CreativeOps",
    "ProductDev->DesignSystems",
    "DesignSystems->ProductDev",
  ]);

  return candidates.map((c) => {
    const cluster = TITLE_TO_CLUSTER.get(c.title);
    if (!cluster) return c;
    if (primaryClusters.includes(cluster)) return c;

    const isTrustedAdjacent = primaryClusters.some((p) => trustedAdjacencies.has(`${p}->${cluster}`));
    const penalty = isTrustedAdjacent ? 0.6 : (c.score >= 7 ? 1.6 : 1.0);
    const adjusted = Math.max(0, Math.round((c.score - penalty) * 10) / 10);
    return { ...c, score: adjusted };
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function selectTwoPlusOne(candidates: EnrichedCandidate[]): EnrichedCandidate[] {
  if (candidates.length <= 3) return candidates;

  const primary = candidates[0];
  const primaryCluster = TITLE_TO_CLUSTER.get(primary.title);
  const strongPool = candidates.filter((c) => c.score >= 7.0);

  const second = strongPool.find((c) => c.title !== primary.title && TITLE_TO_CLUSTER.get(c.title) === primaryCluster)
    ?? strongPool.find((c) => c.title !== primary.title)
    ?? candidates.find((c) => c.title !== primary.title)
    ?? primary;

  const selected = new Set<string>([primary.title, second.title]);

  const adjacent = candidates.find((c) => {
    if (selected.has(c.title)) return false;
    const cluster = TITLE_TO_CLUSTER.get(c.title);
    if (!cluster || cluster === primaryCluster) return false;
    return c.score >= Math.max(6.2, primary.score - 1.8);
  })
    ?? candidates.find((c) => !selected.has(c.title));

  const out = [primary, second];
  if (adjacent) out.push(adjacent);
  return out.slice(0, 3);
}

function scoreEnriched(anchorMap: Map<string, number>): EnrichedCandidate[] {
  return TITLE_BANK.map(title => {
    const sig = SIGS[title];
    if (!sig) return { title, score: 0, _reqCov: 0, _matchedPairs: [], _matchedReq: [], _missing: [] };

    let reqHit = 0, reqTotal = 0;
    const matchedReq: string[] = [];
    const missingReq: string[] = [];
    for (const term of sig.required) {
      reqTotal += 5;
      const w = anchorMap.get(term);
      if (w !== undefined) { reqHit += w; matchedReq.push(term); }
      else missingReq.push(term);
    }
    const reqCov = reqTotal > 0 ? Math.min(1.0, reqHit / reqTotal) : 0;

    const allSigTerms = new Set([...sig.required, ...sig.optional]);
    let pairsHit = 0;
    const matchedPairs: string[] = [];
    for (const [a, b] of ACTION_ARTIFACT_PAIRS) {
      if (anchorMap.has(a) && anchorMap.has(b)) {
        if (allSigTerms.has(a) || allSigTerms.has(b)) {
          pairsHit++;
          matchedPairs.push(`${a}+${b}`);
        }
      }
    }
    const pairBonus = Math.min(0.8, pairsHit * 0.2);

    let hasSpecificity = matchedPairs.length > 0;
    if (!hasSpecificity) {
      for (const term of allSigTerms) {
        if (HIGH_SPECIFICITY_ANCHORS.has(term) && anchorMap.has(term)) {
          hasSpecificity = true;
          break;
        }
      }
    }

    // Calibration: relax caps, boost pairBonus, allow more strong titles
    let calibratedPairBonus = Math.min(1.2, pairsHit * 0.3); // boost pair bonus
    let raw = 10 * reqCov + calibratedPairBonus;
    // Relaxed caps for strong profiles
    if (raw >= 9.0 && reqCov < 0.82) raw = Math.min(raw, 8.8);
    if (raw >= 8.0 && reqCov < 0.72) raw = Math.min(raw, 7.8);
    if (raw >= 9.5 && !hasSpecificity) raw = Math.min(raw, 9.3);
    // Stricter thin input protection: cap scores for generic/low-signal answers
    const anchorCount = anchorMap.size;
    // Heuristic: if anchor count is low OR anchors are mostly generic/common terms, treat as thin
    const GENERIC_TERMS = new Set([
      "help", "project", "move", "forward", "communicate", "organized", "adaptable", "coding", "meetings", "debugging", "features", "writing", "code", "team", "work", "support", "manage", "tasks", "people", "process", "deliver", "execute", "plan", "coordinate", "develop", "improve", "learn", "grow", "handle", "assist", "contribute", "participate", "collaborate", "flexible", "reliable", "responsible", "detail", "oriented", "efficient", "effective", "positive", "attitude", "hardworking", "dedicated", "motivated", "professional", "experience", "skills", "knowledge", "background", "role", "position", "industry", "field", "area", "business", "company", "organization", "client", "customer", "service", "support", "goal", "objective", "result", "outcome", "success", "failure", "challenge", "problem", "solution", "opportunity", "strength", "weakness", "interest", "passion", "enthusiasm", "drive", "energy", "focus", "commitment", "initiative", "ownership", "leadership", "follow", "direction", "guidance", "instruction", "feedback", "review", "assessment", "evaluation", "analysis", "report", "presentation", "meeting", "discussion", "conversation", "communication", "relationship", "interaction", "collaboration", "cooperation", "coordination", "integration", "implementation", "execution", "delivery", "completion", "achievement", "accomplishment", "recognition", "reward", "promotion", "advancement", "progress", "development", "growth", "learning", "education", "training", "mentoring", "coaching", "supporting", "helping", "assisting", "guiding", "leading", "following", "managing", "organizing", "planning", "scheduling", "tracking", "monitoring", "controlling", "directing", "supervising", "overseeing", "administering", "coordinating", "facilitating", "enabling", "empowering", "encouraging", "motivating", "inspiring", "influencing", "persuading", "negotiating", "mediating", "resolving", "solving", "handling", "dealing", "addressing", "responding", "reacting", "adapting", "adjusting", "changing", "improving", "enhancing", "optimizing", "streamlining", "simplifying", "innovating", "creating", "designing", "building", "developing", "producing", "generating", "initiating", "starting", "beginning", "launching", "implementing", "executing", "delivering", "completing", "finishing", "ending", "concluding", "closing", "terminating", "ceasing", "stopping", "pausing", "halting", "interrupting", "delaying", "postponing", "deferring", "suspending", "canceling", "abandoning", "withdrawing", "retreating", "reversing", "undoing", "removing", "eliminating", "reducing", "minimizing", "maximizing", "expanding", "extending", "broadening", "deepening", "strengthening", "weakening", "diminishing", "decreasing", "increasing", "raising", "lowering", "lifting", "dropping", "falling", "rising", "climbing", "descending", "moving", "traveling", "journeying", "exploring", "discovering", "learning", "knowing", "understanding", "comprehending", "grasping", "realizing", "recognizing", "identifying", "noticing", "observing", "watching", "seeing", "looking", "viewing", "examining", "inspecting", "checking", "testing", "verifying", "validating", "confirming", "approving", "accepting", "rejecting", "declining", "refusing", "denying", "ignoring", "overlooking", "missing", "forgetting", "remembering", "recalling", "reminding", "notifying", "informing", "reporting", "communicating", "expressing", "stating", "saying", "telling", "speaking", "talking", "discussing", "conversing", "chatting", "corresponding", "writing", "typing", "reading", "listening", "hearing", "understanding", "comprehending", "learning", "knowing", "realizing", "recognizing", "identifying", "noticing", "observing", "watching", "seeing", "looking", "viewing", "examining", "inspecting", "checking", "testing", "verifying", "validating", "confirming", "approving", "accepting", "rejecting", "declining", "refusing", "denying", "ignoring", "overlooking", "missing", "forgetting", "remembering", "recalling", "reminding", "notifying", "informing", "reporting", "communicating", "expressing", "stating", "saying", "telling", "speaking", "talking", "discussing", "conversing", "chatting", "corresponding", "writing", "typing", "reading", "listening", "hearing"]);
    let genericCount = 0;
    for (const term of anchorMap.keys()) {
      if (GENERIC_TERMS.has(term)) genericCount++;
    }
    // If anchor count is low OR most anchors are generic, treat as thin
    const isThinInput = (anchorCount < 8) || (anchorCount > 0 && genericCount / anchorCount > 0.6);
    let score = Math.max(0, Math.min(9.9, Math.round(raw * 10) / 10));
    if (isThinInput && score > 5.0) score = 5.0;
    return { title, score, _reqCov: reqCov, _matchedPairs: matchedPairs, _matchedReq: matchedReq, _missing: missingReq };
  }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/**
 * Score all titles and return top 5.
 */
export function scoreTitles(resumeText: string, promptAnswers: string[]): Array<{ title: string; score: number }> {
  const anchorMap = extractWeightedAnchors(resumeText, promptAnswers);
  const grounded = applyGroundingPenalty(scoreEnriched(anchorMap), anchorMap);
  const selected = selectTwoPlusOne(grounded);
  return selected.map(({ title, score }) => ({ title, score }));
}

/**
 * Score all titles (not just top 5) for cross-cluster analysis.
 */
export function scoreAllTitles(resumeText: string, promptAnswers: string[]): Array<{ title: string; score: number }> {
  const anchorMap = extractWeightedAnchors(resumeText, promptAnswers);
  const enriched = applyGroundingPenalty(scoreEnriched(anchorMap), anchorMap);
  return enriched.map(({ title, score }) => ({ title, score }));
}

// ─── Title recommendation pack ──────────────────────────────────────────────

export interface TitleRecommendation {
  primary_title: { title: string; score: number };
  adjacent_titles: Array<{ title: string; score: number }>;
  why_primary: string[];
  why_not_adjacent: string[];
  titles?: Array<{
    title: string;
    fit_0_to_10: number;
    summary_2s?: string;
    bullets_3?: [string, string, string];
  }>;
}

/**
 * Build a full title recommendation from resume + prompt answers.
 * Returns the top-5 candidates plus a structured recommendation pack
 * with deterministic why_primary / why_not_adjacent evidence.
 */
export function generateTitleRecommendation(
  resumeText: string,
  promptAnswers: string[]
): { candidates: Array<{ title: string; score: number }>; recommendation: TitleRecommendation } {
  const anchorMap = extractWeightedAnchors(resumeText, promptAnswers);
  const enriched = applyGroundingPenalty(scoreEnriched(anchorMap), anchorMap);
  const top3 = selectTwoPlusOne(enriched);

  const primary = top3[0];
  const topScore = primary.score;

  // Adjacent: include one cross-cluster credible opportunity if available.
  const adjacentPrimaryCluster = TITLE_TO_CLUSTER.get(primary.title);
  const adjacent = top3.slice(1).filter((c) => {
    const cCluster = TITLE_TO_CLUSTER.get(c.title);
    return c.score >= 6.2 && (!!adjacentPrimaryCluster ? cCluster !== adjacentPrimaryCluster : true);
  }).slice(0, 1);

  // why_primary: describe matched anchors deterministically
  const whyPrimary: string[] = [];
    const primaryCluster = TITLE_TO_CLUSTER.get(primary.title);
    if (primaryCluster) {
      whyPrimary.push(`Grounded cluster: ${primaryCluster}`);
    }
  if (primary._matchedReq.length > 0) {
    whyPrimary.push(`Matched anchors: ${primary._matchedReq.join(", ")}`);
  }
  if (primary._matchedPairs.length > 0) {
    whyPrimary.push(`Action-artifact pairs: ${primary._matchedPairs.join(", ")}`);
  }
  if (whyPrimary.length === 0) {
    whyPrimary.push(`Score ${primary.score}/9.9 based on anchor coverage (${Math.round(primary._reqCov * 100)}%)`);
  }

  // why_not_adjacent: describe missing anchors for titles outside the adjacent set
  const whyNotAdjacent: string[] = [];
  const adjacentTitles = new Set(adjacent.map(a => a.title));
  for (const c of top3.slice(1)) {
    if (adjacentTitles.has(c.title)) continue;
    if (c._missing.length > 0) {
      whyNotAdjacent.push(`${c.title}: missing anchors ${c._missing.join(", ")}`);
    } else if (c.score < 7.0) {
      whyNotAdjacent.push(`${c.title}: score ${c.score} below threshold`);
    }
  }

  // Build per-title enrichment for UI expand/collapse
  const enrichedTitles = top3.map((c) => {
    const summaryParts: string[] = [];
    if (c._matchedReq.length > 0) {
      const signalNames = c._matchedReq.slice(0, 4).join(", ");
      summaryParts.push(`Your background lines up on ${c._matchedReq.length} key area${c._matchedReq.length > 1 ? "s" : ""}: ${signalNames}.`);
    }
    if (c._matchedPairs.length > 0) {
      const pairNames = c._matchedPairs.map(p => p.replace("+", " with ")).join(", ");
      summaryParts.push(`We see direct experience in ${pairNames}.`);
    } else if (c._reqCov >= 0.7) {
      summaryParts.push(`Strong overlap across what this role typically requires.`);
    }
    if (summaryParts.length === 0) {
      summaryParts.push(`Solid overall alignment based on your experience.`);
    }
    const summary_2s = summaryParts.join(" ");

    const rawBullets: string[] = [];
    if (c._matchedReq.length > 0) {
      rawBullets.push(`Strongest signals: ${c._matchedReq.join(", ")}`);
    }
    if (c._matchedPairs.length > 0) {
      rawBullets.push(`Hands-on experience: ${c._matchedPairs.map(p => p.replace("+", " → ")).join(", ")}`);
    }
    if (c._missing.length > 0) {
      rawBullets.push(`Areas to grow: ${c._missing.join(", ")}`);
    } else if (rawBullets.length < 3 && c._reqCov > 0) {
      rawBullets.push(`${Math.round(c._reqCov * 100)}% alignment with typical requirements`);
    }
    // Pad to exactly 3 or truncate
    while (rawBullets.length < 3) rawBullets.push("");
    const bullets_3 = rawBullets.slice(0, 3) as [string, string, string];

    return {
      title: c.title,
      fit_0_to_10: c.score,
      summary_2s,
      bullets_3: bullets_3.some(b => b.length > 0) ? bullets_3 : undefined,
    };
  });

  return {
    candidates: top3.map(({ title, score }) => ({ title, score })),
    recommendation: {
      primary_title: { title: primary.title, score: primary.score },
      adjacent_titles: adjacent.map(({ title, score }) => ({ title, score })),
      why_primary: whyPrimary,
      why_not_adjacent: whyNotAdjacent,
      titles: enrichedTitles,
    },
  };
}
