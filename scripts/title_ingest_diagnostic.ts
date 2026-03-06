#!/usr/bin/env npx ts-node
/**
 * scripts/title_ingest_diagnostic.ts
 *
 * READ-ONLY diagnostic. No behavior changes.
 * Traces the full title-scoring pipeline for the regression repro case
 * and a known-good case, capturing evidence at every stage.
 *
 * Run: npx ts-node scripts/title_ingest_diagnostic.ts
 */

// ═══════════════════════════════════════════════════════════════════════════
// Inline exact production logic from lib/title_scoring.ts (including GENERIC_TERMS)
// ═══════════════════════════════════════════════════════════════════════════

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
};

const COMPOUND_MAP: [RegExp, string][] = [
  [/\bteam[\s-]building\b/gi, "team"],
  [/\brelationship[\s-]building\b/gi, "relationship"],
  [/\bproblem[\s-]solving\b/gi, "problem"],
  [/\bcross[\s-]functional\b/gi, "cross_functional"],
  [/\bgo[\s-]to[\s-]market\b/gi, "market"],
];

function normalizeCompounds(text: string): string {
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

function canonicalize(token: string): string {
  const mapped = CANON_MAP[token];
  if (mapped) return mapped;
  const stripped = stripSuffix(token);
  if (stripped !== token) {
    return CANON_MAP[stripped] ?? stripped;
  }
  return token;
}

function extractBroadTokens(text: string): Map<string, number> {
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

function buildWordSets(resumeText: string, promptAnswers: string[]) {
  const toWordSet = (text: string): Set<string> => {
    const compounded = normalizeCompounds(String(text ?? ""));
    return new Set(
      compounded.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
        .map(canonicalize)
        .filter(t => t.length >= 3 && !TITLE_STOPWORDS.has(t))
    );
  };
  return { resumeWords: toWordSet(resumeText), promptWordSets: promptAnswers.map(toWordSet) };
}

function computeWeighted(allTokens: Map<string, number>, resumeWords: Set<string>, promptWordSets: Set<string>[]): Map<string, number> {
  const sourceCount = new Map<string, number>();
  for (const [term] of allTokens) {
    let sources = 0;
    if (resumeWords.has(term)) sources++;
    for (const pSet of promptWordSets) {
      if (pSet.has(term)) sources++;
    }
    sourceCount.set(term, sources);
  }
  const weighted = new Map<string, number>();
  for (const [term, rawCount] of allTokens) {
    const base = Math.min(3, rawCount);
    const sources = sourceCount.get(term) ?? 1;
    const bonus = Math.min(2, Math.max(0, sources - 1));
    const weight = Math.min(5, base + bonus);
    weighted.set(term, weight);
  }
  return weighted;
}

function extractWeightedAnchorsOLD(resumeText: string, promptAnswers: string[]): Map<string, number> {
  const combinedText = [resumeText, ...promptAnswers].filter(Boolean).join("\n");
  const allTokens = extractBroadTokens(combinedText);
  const { resumeWords, promptWordSets } = buildWordSets(resumeText, promptAnswers);
  return computeWeighted(allTokens, resumeWords, promptWordSets);
}

function extractWeightedAnchors(resumeText: string, promptAnswers: string[]): Map<string, number> {
  const combinedText = [resumeText, ...promptAnswers].filter(Boolean).join("\n");
  const allTokens = extractBroadTokens(combinedText);
  const { resumeWords, promptWordSets } = buildWordSets(resumeText, promptAnswers);
  // NEW: Retain single-mention scoring-vocabulary terms (count=2 credibility)
  for (const wordSet of [resumeWords, ...promptWordSets]) {
    for (const term of wordSet) {
      if (!allTokens.has(term) && SCORING_VOCAB.has(term)) {
        allTokens.set(term, 2);
      }
    }
  }
  return computeWeighted(allTokens, resumeWords, promptWordSets);
}

// ─── Cluster-based title definitions (exact copy from lib/title_scoring.ts) ─

type TitleCluster = {
  name: string;
  core: string[];
  titles: Array<{ title: string; unique: string[]; optional: string[] }>;
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
    core: ["relationship", "client", "team", "outcome"],
    titles: [
      { title: "Client Success Manager", unique: ["retention", "onboard"], optional: ["collaboration", "stakeholder", "strategy", "tool"] },
      { title: "Partnerships Manager", unique: ["partnership", "alliance"], optional: ["collaboration", "stakeholder", "strategy", "project"] },
      { title: "Business Development Manager", unique: ["pipeline", "negotiation"], optional: ["strategy", "stakeholder", "project", "ownership"] },
      { title: "Community & Growth Lead", unique: ["community", "growth"], optional: ["collaboration", "tool", "project", "ownership"] },
      { title: "Account Manager", unique: ["account", "renewal"], optional: ["stakeholder", "strategy", "project", "collaboration"] },
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

type Sig = { required: string[]; optional: string[] };
const TITLE_BANK: string[] = [];
const SIGS: Record<string, Sig> = {};
for (const cluster of TITLE_CLUSTERS) {
  for (const t of cluster.titles) {
    TITLE_BANK.push(t.title);
    SIGS[t.title] = { required: [...cluster.core, ...t.unique], optional: t.optional };
  }
}
for (const t of STANDALONE_SIGS) {
  TITLE_BANK.push(t.title);
  SIGS[t.title] = { required: t.required, optional: t.optional };
}

// Scoring vocabulary: all terms used in any title signature
const SCORING_VOCAB = new Set<string>();
for (const sig of Object.values(SIGS)) {
  for (const t of sig.required) SCORING_VOCAB.add(t);
  for (const t of sig.optional) SCORING_VOCAB.add(t);
}

const ACTION_ARTIFACT_PAIRS: [string, string][] = [
  ["design", "system"],
  ["create", "sop"],
  ["automate", "workflow"],
  ["pitch", "decks"],
  ["feasibility", "studies"],
  ["customer", "need"],
  ["client", "outcome"],
  ["build", "relationship"],
];

const HIGH_SPECIFICITY_ANCHORS = new Set<string>([
  "sop", "feasibility", "incentives", "automate", "workflow",
  "pitch", "decks", "proposal", "methodology", "compliance",
  "architecture", "stakeholders", "onboarding", "documentation",
  "retention", "onboard", "partnership", "pipeline", "renewal",
  "alliance", "negotiation", "community",
]);

// ─── GENERIC_TERMS: exact copy from live scoreEnriched ──────────────────────
const GENERIC_TERMS = new Set([
  "help", "project", "move", "forward", "communicate", "organized", "adaptable", "coding", "meetings", "debugging", "features", "writing", "code", "team", "work", "support", "manage", "tasks", "people", "process", "deliver", "execute", "plan", "coordinate", "develop", "improve", "learn", "grow", "handle", "assist", "contribute", "participate", "collaborate", "flexible", "reliable", "responsible", "detail", "oriented", "efficient", "effective", "positive", "attitude", "hardworking", "dedicated", "motivated", "professional", "experience", "skills", "knowledge", "background", "role", "position", "industry", "field", "area", "business", "company", "organization", "client", "customer", "service", "support", "goal", "objective", "result", "outcome", "success", "failure", "challenge", "problem", "solution", "opportunity", "strength", "weakness", "interest", "passion", "enthusiasm", "drive", "energy", "focus", "commitment", "initiative", "ownership", "leadership", "follow", "direction", "guidance", "instruction", "feedback", "review", "assessment", "evaluation", "analysis", "report", "presentation", "meeting", "discussion", "conversation", "communication", "relationship", "interaction", "collaboration", "cooperation", "coordination", "integration", "implementation", "execution", "delivery", "completion", "achievement", "accomplishment", "recognition", "reward", "promotion", "advancement", "progress", "development", "growth", "learning", "education", "training", "mentoring", "coaching", "supporting", "helping", "assisting", "guiding", "leading", "following", "managing", "organizing", "planning", "scheduling", "tracking", "monitoring", "controlling", "directing", "supervising", "overseeing", "administering", "coordinating", "facilitating", "enabling", "empowering", "encouraging", "motivating", "inspiring", "influencing", "persuading", "negotiating", "mediating", "resolving", "solving", "handling", "dealing", "addressing", "responding", "reacting", "adapting", "adjusting", "changing", "improving", "enhancing", "optimizing", "streamlining", "simplifying", "innovating", "creating", "designing", "building", "developing", "producing", "generating", "initiating", "starting", "beginning", "launching", "implementing", "executing", "delivering", "completing", "finishing", "ending", "concluding", "closing", "terminating", "ceasing", "stopping", "pausing", "halting", "interrupting", "delaying", "postponing", "deferring", "suspending", "canceling", "abandoning", "withdrawing", "retreating", "reversing", "undoing", "removing", "eliminating", "reducing", "minimizing", "maximizing", "expanding", "extending", "broadening", "deepening", "strengthening", "weakening", "diminishing", "decreasing", "increasing", "raising", "lowering", "lifting", "dropping", "falling", "rising", "climbing", "descending", "moving", "traveling", "journeying", "exploring", "discovering", "learning", "knowing", "understanding", "comprehending", "grasping", "realizing", "recognizing", "identifying", "noticing", "observing", "watching", "seeing", "looking", "viewing", "examining", "inspecting", "checking", "testing", "verifying", "validating", "confirming", "approving", "accepting", "rejecting", "declining", "refusing", "denying", "ignoring", "overlooking", "missing", "forgetting", "remembering", "recalling", "reminding", "notifying", "informing", "reporting", "communicating", "expressing", "stating", "saying", "telling", "speaking", "talking", "discussing", "conversing", "chatting", "corresponding", "writing", "typing", "reading", "listening", "hearing", "understanding", "comprehending", "learning", "knowing", "realizing", "recognizing", "identifying", "noticing", "observing", "watching", "seeing", "looking", "viewing", "examining", "inspecting", "checking", "testing", "verifying", "validating", "confirming", "approving", "accepting", "rejecting", "declining", "refusing", "denying", "ignoring", "overlooking", "missing", "forgetting", "remembering", "recalling", "reminding", "notifying", "informing", "reporting", "communicating", "expressing", "stating", "saying", "telling", "speaking", "talking", "discussing", "conversing", "chatting", "corresponding", "writing", "typing", "reading", "listening", "hearing"
]);

// ═══════════════════════════════════════════════════════════════════════════
// Diagnostic scoring with full trace at every stage
// ═══════════════════════════════════════════════════════════════════════════

interface DiagCandidate {
  title: string;
  rawScore: number;        // before thin-input cap
  cappedScore: number;     // after thin-input cap
  reqCov: number;
  matchedReq: string[];
  missingReq: string[];
  matchedPairs: string[];
  pairsHit: number;
  calibratedPairBonus: number;
  rawComputed: number;     // 10*reqCov + calibratedPairBonus before caps
  cappedByReqCov: boolean;
  cappedBySpecificity: boolean;
  cappedByThinInput: boolean;
}

interface DiagResult {
  label: string;
  anchorCount: number;
  anchors: Array<{ term: string; weight: number; isGeneric: boolean }>;
  genericCount: number;
  genericRatio: number;
  isThinInput: boolean;
  thinInputRule: string;
  allCandidatesPreCap: DiagCandidate[];
  top3PreFilter: DiagCandidate[];
  highFitCandidates: DiagCandidate[];   // those >=7.0 after cap
  finalOutput: DiagCandidate[];         // what generateTitleRecommendation returns
  adjacentTitles: Array<{ title: string; score: number }>;
  collapsedToOne: boolean;
  collapseReason: string;
}

function runDiagnostic(label: string, resumeText: string, promptAnswers: string[]): DiagResult {
  const anchorMap = extractWeightedAnchors(resumeText, promptAnswers);
  const anchorCount = anchorMap.size;

  // Classify anchors
  let genericCount = 0;
  const anchors: Array<{ term: string; weight: number; isGeneric: boolean }> = [];
  for (const [term, weight] of anchorMap) {
    const isGeneric = GENERIC_TERMS.has(term);
    if (isGeneric) genericCount++;
    anchors.push({ term, weight, isGeneric });
  }
  anchors.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));

  const genericRatio = anchorCount > 0 ? genericCount / anchorCount : 0;
  const isThinInput = (anchorCount < 8) || (anchorCount > 0 && genericRatio > 0.6);
  let thinInputRule = "NOT_THIN";
  if (anchorCount < 8) thinInputRule = `ANCHOR_COUNT_LOW (${anchorCount} < 8)`;
  else if (genericRatio > 0.6) thinInputRule = `GENERIC_RATIO_HIGH (${(genericRatio * 100).toFixed(1)}% > 60%)`;

  // Score all titles with full trace
  const allCandidates: DiagCandidate[] = TITLE_BANK.map(title => {
    const sig = SIGS[title];
    if (!sig) return { title, rawScore: 0, cappedScore: 0, reqCov: 0, matchedReq: [], missingReq: [], matchedPairs: [], pairsHit: 0, calibratedPairBonus: 0, rawComputed: 0, cappedByReqCov: false, cappedBySpecificity: false, cappedByThinInput: false };

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

    let hasSpecificity = matchedPairs.length > 0;
    if (!hasSpecificity) {
      for (const term of allSigTerms) {
        if (HIGH_SPECIFICITY_ANCHORS.has(term) && anchorMap.has(term)) {
          hasSpecificity = true;
          break;
        }
      }
    }

    const calibratedPairBonus = Math.min(1.2, pairsHit * 0.3);
    const rawComputed = 10 * reqCov + calibratedPairBonus;
    let raw = rawComputed;
    let cappedByReqCov = false;
    let cappedBySpecificity = false;
    if (raw >= 9.0 && reqCov < 0.82) { raw = Math.min(raw, 8.8); cappedByReqCov = true; }
    if (raw >= 8.0 && reqCov < 0.72) { raw = Math.min(raw, 7.8); cappedByReqCov = true; }
    if (raw >= 9.5 && !hasSpecificity) { raw = Math.min(raw, 9.3); cappedBySpecificity = true; }

    let rawScore = Math.max(0, Math.min(9.9, Math.round(raw * 10) / 10));
    let cappedScore = rawScore;
    let cappedByThinInput = false;
    if (isThinInput && cappedScore > 5.0) {
      cappedScore = 5.0;
      cappedByThinInput = true;
    }

    return { title, rawScore, cappedScore, reqCov, matchedReq, missingReq, matchedPairs, pairsHit, calibratedPairBonus, rawComputed, cappedByReqCov, cappedBySpecificity, cappedByThinInput };
  });

  allCandidates.sort((a, b) => b.cappedScore - a.cappedScore || a.title.localeCompare(b.title));

  // Top 3 selection (mirrors generateTitleRecommendation)
  const highFit = allCandidates.filter(c => c.cappedScore >= 7.0).slice(0, 3);
  const top3 = highFit.length > 0 ? highFit : allCandidates.slice(0, 3);
  const highFitCandidates = highFit;

  // Adjacent titles (mirrors generateTitleRecommendation)
  const primary = top3[0];
  const topScore = primary.cappedScore;
  const adjacent = top3.slice(1).filter((_c, i) => i < 2 && top3[i + 1].cappedScore >= 7.0 && (topScore - top3[i + 1].cappedScore) <= 0.8);

  // Determine collapse reason
  let collapsedToOne = (top3.length <= 1) || (adjacent.length === 0 && top3.length > 1);
  let collapseReason = "NONE";
  if (top3.length <= 1) {
    collapseReason = "ONLY_1_CANDIDATE";
  } else if (isThinInput) {
    collapseReason = `THIN_INPUT_CAP: all scores capped to 5.0, no highFit (>=7.0) → fallback to top 3 by score, but adjacent filter requires >=7.0 → adjacent=[]`;
  } else if (highFit.length === 0) {
    collapseReason = `NO_HIGH_FIT: no candidates >=7.0 → fallback path, adjacent requires >=7.0`;
  } else if (adjacent.length === 0 && highFit.length === 1) {
    collapseReason = `ONLY_1_HIGH_FIT: only 1 candidate >=7.0`;
  } else if (adjacent.length === 0) {
    const secondScore = top3[1]?.cappedScore ?? 0;
    if (secondScore < 7.0) {
      collapseReason = `ADJACENT_BELOW_7: second candidate score ${secondScore} < 7.0 threshold`;
    } else if ((topScore - secondScore) > 0.8) {
      collapseReason = `ADJACENT_GAP: score gap ${(topScore - secondScore).toFixed(1)} > 0.8`;
    }
  }
  if (!collapsedToOne) collapseReason = "NONE";

  return {
    label,
    anchorCount,
    anchors,
    genericCount,
    genericRatio,
    isThinInput,
    thinInputRule,
    allCandidatesPreCap: allCandidates.slice(0, 10), // top 10 for inspection
    top3PreFilter: top3,
    highFitCandidates,
    finalOutput: top3,
    adjacentTitles: adjacent.map(c => ({ title: c.title, score: c.cappedScore })),
    collapsedToOne,
    collapseReason,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test inputs
// ═══════════════════════════════════════════════════════════════════════════

// REPRO CASE: fixture resume (short/real-world) + moderate-quality prompt answers
// This simulates what the failing ingest looks like
const REPRO_RESUME = `Jane Doe
Senior Product Manager
10+ years experience in SaaS, B2B, and enterprise software. Led cross-functional teams, managed product launches, and drove revenue growth at Acme Corp and BetaTech.`;

const REPRO_PROMPTS = [
  "Managing product launches and working with cross-functional teams felt most like me. I loved taking a product from concept to market, coordinating with engineering and design, and seeing the customer impact.",
  "Getting stuck in endless status meetings or administrative overhead drained me. When the work was about process for process's sake instead of moving the product forward, I lost energy.",
  "People come to me for product strategy and decision-making. When there's ambiguity about what to build or how to prioritize, I'm the one who helps the team navigate. I also help with stakeholder communication.",
  "I get excited by complex product challenges — figuring out market fit, designing the go-to-market strategy, and making tough trade-off decisions. The entrepreneurial side of product management is what drives me.",
  "I research market trends and customer needs on the side. I maintain a personal system for tracking industry developments and competitive landscapes. I also mentor early-career PMs.",
];

// KNOWN-GOOD: Chris-like input (from title_scoring_smoke.ts)
const CHRIS_RESUME = `
Product Development Manager | 7 years experience in SaaS and B2B
Led product development from market research through launch for enterprise software.
Built systems for evaluating market gaps and customer needs. Created SOPs for product
development workflows. Designed and maintained pitch decks and proposals for executive
stakeholders. Conducted feasibility studies for new product initiatives. Automated
internal workflows and reporting systems. Managed cross-functional product development
teams. Drove go-to-market strategy and customer discovery processes.
`;

const CHRIS_PROMPTS = [
  "The product development work felt most like me — identifying gaps in the market, designing systems to evaluate customer needs, and building proposals that connected market insights to product direction. I loved the process of taking a fuzzy customer need and turning it into a structured product development plan with clear feasibility criteria.",
  "Administrative work with no connection to product or customer outcomes drained me. When I was stuck in status meetings instead of designing systems or building workflows, I lost energy. I need the work to connect back to actual product development and market impact.",
  "People come to me when they need proposals, pitch decks, or feasibility studies — anything that requires translating complex product development needs into clear, structured deliverables. I'm also the person teams call when they need systems or SOPs for new workflows. Customer needs analysis is another area where people seek me out.",
  "I get excited by product development challenges that require designing new systems — especially when there's a real market gap and customer need driving it. Building proposals and feasibility studies for products that could genuinely solve customer problems is exactly my kind of challenge. I love creating workflows that make the product development process repeatable.",
  "I build systems for everything — meal planning workflows, home renovation SOPs, travel planning templates. I'm always designing processes and creating structured approaches. I maintain several systems for tracking personal development goals and customer research for my side project.",
];

// ═══════════════════════════════════════════════════════════════════════════
// Run diagnostics and print results
// ═══════════════════════════════════════════════════════════════════════════

function printDiag(d: DiagResult) {
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  DIAGNOSTIC: ${d.label}`);
  console.log(`${"═".repeat(72)}`);

  console.log(`\n  1) ANCHOR COUNT: ${d.anchorCount}`);
  console.log(`  2) GENERIC ANCHOR COUNT: ${d.genericCount}`);
  console.log(`  3) GENERIC RATIO: ${(d.genericRatio * 100).toFixed(1)}%`);
  console.log(`  4) isThinInput: ${d.isThinInput}`);
  console.log(`  5) THIN INPUT RULE: ${d.thinInputRule}`);

  console.log(`\n  ─── All anchors (term, weight, generic?) ───`);
  for (const a of d.anchors) {
    const flag = a.isGeneric ? " ← GENERIC" : "";
    console.log(`    ${a.term.padEnd(20)} weight=${a.weight}${flag}`);
  }

  console.log(`\n  ─── Top 10 candidates BEFORE thin-input cap (rawScore) ───`);
  for (const c of d.allCandidatesPreCap) {
    const caps: string[] = [];
    if (c.cappedByReqCov) caps.push("reqCov-cap");
    if (c.cappedBySpecificity) caps.push("specificity-cap");
    if (c.cappedByThinInput) caps.push("THIN-INPUT-CAP");
    const capStr = caps.length > 0 ? ` [${caps.join(", ")}]` : "";
    console.log(`    ${c.rawScore.toFixed(1)} → ${c.cappedScore.toFixed(1)}  ${c.title}  (reqCov=${(c.reqCov * 100).toFixed(0)}%, pairs=${c.pairsHit})${capStr}`);
    if (c.missingReq.length > 0) {
      console.log(`         missing: ${c.missingReq.join(", ")}`);
    }
    if (c.matchedReq.length > 0) {
      console.log(`         matched: ${c.matchedReq.join(", ")}`);
    }
  }

  console.log(`\n  ─── High-fit candidates (>=7.0 after cap) ───`);
  if (d.highFitCandidates.length === 0) {
    console.log(`    NONE — all titles below 7.0 after thin-input cap`);
  } else {
    for (const c of d.highFitCandidates) {
      console.log(`    ${c.cappedScore.toFixed(1)}  ${c.title}`);
    }
  }

  console.log(`\n  ─── Final output (top 3 / recommendation) ───`);
  for (const c of d.finalOutput) {
    console.log(`    ${c.cappedScore.toFixed(1)}  ${c.title}`);
  }
  console.log(`    Adjacent titles: ${d.adjacentTitles.length > 0 ? d.adjacentTitles.map(a => `${a.title} (${a.score})`).join(", ") : "NONE"}`);

  console.log(`\n  ─── COLLAPSE ANALYSIS ───`);
  console.log(`    Collapsed to single weak title: ${d.collapsedToOne}`);
  console.log(`    Collapse reason: ${d.collapseReason}`);

  // Count required signals present in anchors that are also in GENERIC_TERMS
  const allRequiredTerms = new Set<string>();
  for (const sig of Object.values(SIGS)) {
    for (const t of sig.required) allRequiredTerms.add(t);
  }
  const reqInGeneric: string[] = [];
  for (const a of d.anchors) {
    if (a.isGeneric && allRequiredTerms.has(a.term)) {
      reqInGeneric.push(a.term);
    }
  }
  if (reqInGeneric.length > 0) {
    console.log(`\n  ─── CRITICAL: Anchors that are BOTH required-for-scoring AND in GENERIC_TERMS ───`);
    console.log(`    ${reqInGeneric.join(", ")}`);
    console.log(`    These ${reqInGeneric.length} term(s) count AGAINST the input (as generic) while being REQUIRED for title scoring.`);
  }
}

function printCrossTermAnalysis() {
  // How many cluster-required or unique terms are also in GENERIC_TERMS?
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  CROSS-TERM COLLISION: required scoring terms in GENERIC_TERMS`);
  console.log(`${"═".repeat(72)}`);
  const collisions: Array<{ term: string; usedBy: string[] }> = [];
  for (const [title, sig] of Object.entries(SIGS)) {
    for (const term of sig.required) {
      if (GENERIC_TERMS.has(term)) {
        const existing = collisions.find(c => c.term === term);
        if (existing) { existing.usedBy.push(title); }
        else { collisions.push({ term, usedBy: [title] }); }
      }
    }
    for (const term of sig.optional) {
      if (GENERIC_TERMS.has(term)) {
        const existing = collisions.find(c => c.term === term);
        if (existing) { if (!existing.usedBy.includes(title + " (opt)")) existing.usedBy.push(title + " (opt)"); }
        else { collisions.push({ term, usedBy: [title + " (opt)"] }); }
      }
    }
  }
  collisions.sort((a, b) => b.usedBy.length - a.usedBy.length);
  console.log(`\n  ${collisions.length} terms appear in BOTH GENERIC_TERMS and title signatures:\n`);
  for (const c of collisions) {
    console.log(`    "${c.term}" — used by ${c.usedBy.length} title(s): ${c.usedBy.slice(0, 4).join(", ")}${c.usedBy.length > 4 ? " ..." : ""}`);
  }
}

// ── BEFORE / AFTER comparison helper ────

function runOldDiag(label: string, resumeText: string, promptAnswers: string[]): DiagResult {
  // Temporarily swap to OLD extraction
  const origExtract = extractWeightedAnchors;
  return runDiagnosticWith(label, resumeText, promptAnswers, extractWeightedAnchorsOLD);
}

function runDiagnosticWith(label: string, resumeText: string, promptAnswers: string[], extractFn: typeof extractWeightedAnchors): DiagResult {
  const anchorMap = extractFn(resumeText, promptAnswers);
  const anchorCount = anchorMap.size;
  let genericCount = 0;
  const anchors: Array<{ term: string; weight: number; isGeneric: boolean }> = [];
  for (const [term, weight] of anchorMap) {
    const isGeneric = GENERIC_TERMS.has(term);
    if (isGeneric) genericCount++;
    anchors.push({ term, weight, isGeneric });
  }
  anchors.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
  const genericRatio = anchorCount > 0 ? genericCount / anchorCount : 0;
  const isThinInput = (anchorCount < 8) || (anchorCount > 0 && genericRatio > 0.6);
  let thinInputRule = "NOT_THIN";
  if (anchorCount < 8) thinInputRule = `ANCHOR_COUNT_LOW (${anchorCount} < 8)`;
  else if (genericRatio > 0.6) thinInputRule = `GENERIC_RATIO_HIGH (${(genericRatio * 100).toFixed(1)}% > 60%)`;
  const allCandidates: DiagCandidate[] = TITLE_BANK.map(title => {
    const sig = SIGS[title];
    if (!sig) return { title, rawScore: 0, cappedScore: 0, reqCov: 0, matchedReq: [], missingReq: [], matchedPairs: [], pairsHit: 0, calibratedPairBonus: 0, rawComputed: 0, cappedByReqCov: false, cappedBySpecificity: false, cappedByThinInput: false };
    let reqHit = 0, reqTotal = 0;
    const matchedReq: string[] = [];
    const missingReq: string[] = [];
    for (const term of sig.required) {
      reqTotal += 5;
      const w = anchorMap.get(term);
      if (w !== undefined) { reqHit += w; matchedReq.push(term); } else missingReq.push(term);
    }
    const reqCov = reqTotal > 0 ? Math.min(1.0, reqHit / reqTotal) : 0;
    const allSigTerms = new Set([...sig.required, ...sig.optional]);
    let pairsHit = 0;
    const matchedPairs: string[] = [];
    for (const [a, b] of ACTION_ARTIFACT_PAIRS) {
      if (anchorMap.has(a) && anchorMap.has(b)) {
        if (allSigTerms.has(a) || allSigTerms.has(b)) { pairsHit++; matchedPairs.push(`${a}+${b}`); }
      }
    }
    let hasSpecificity = matchedPairs.length > 0;
    if (!hasSpecificity) { for (const term of allSigTerms) { if (HIGH_SPECIFICITY_ANCHORS.has(term) && anchorMap.has(term)) { hasSpecificity = true; break; } } }
    const calibratedPairBonus = Math.min(1.2, pairsHit * 0.3);
    const rawComputed = 10 * reqCov + calibratedPairBonus;
    let raw = rawComputed;
    let cappedByReqCov = false, cappedBySpecificity = false;
    if (raw >= 9.0 && reqCov < 0.82) { raw = Math.min(raw, 8.8); cappedByReqCov = true; }
    if (raw >= 8.0 && reqCov < 0.72) { raw = Math.min(raw, 7.8); cappedByReqCov = true; }
    if (raw >= 9.5 && !hasSpecificity) { raw = Math.min(raw, 9.3); cappedBySpecificity = true; }
    let rawScore = Math.max(0, Math.min(9.9, Math.round(raw * 10) / 10));
    let cappedScore = rawScore;
    let cappedByThinInput = false;
    if (isThinInput && cappedScore > 5.0) { cappedScore = 5.0; cappedByThinInput = true; }
    return { title, rawScore, cappedScore, reqCov, matchedReq, missingReq, matchedPairs, pairsHit, calibratedPairBonus, rawComputed, cappedByReqCov, cappedBySpecificity, cappedByThinInput };
  });
  allCandidates.sort((a, b) => b.cappedScore - a.cappedScore || a.title.localeCompare(b.title));
  const highFit = allCandidates.filter(c => c.cappedScore >= 7.0).slice(0, 3);
  const top3 = highFit.length > 0 ? highFit : allCandidates.slice(0, 3);
  const primary = top3[0];
  const topScore = primary.cappedScore;
  const adjacent = top3.slice(1).filter((_c, i) => i < 2 && top3[i + 1].cappedScore >= 7.0 && (topScore - top3[i + 1].cappedScore) <= 0.8);
  let collapsedToOne = (top3.length <= 1) || (adjacent.length === 0 && top3.length > 1);
  let collapseReason = "NONE";
  if (top3.length <= 1) collapseReason = "ONLY_1_CANDIDATE";
  else if (isThinInput) collapseReason = `THIN_INPUT_CAP`;
  else if (highFit.length === 0) collapseReason = `NO_HIGH_FIT`;
  else if (adjacent.length === 0 && highFit.length === 1) collapseReason = `ONLY_1_HIGH_FIT`;
  else if (adjacent.length === 0) {
    const secondScore = top3[1]?.cappedScore ?? 0;
    if (secondScore < 7.0) collapseReason = `ADJACENT_BELOW_7 (${secondScore})`;
    else if ((topScore - secondScore) > 0.8) collapseReason = `ADJACENT_GAP (${(topScore - secondScore).toFixed(1)})`;
  }
  if (!collapsedToOne) collapseReason = "NONE";
  return { label, anchorCount, anchors, genericCount, genericRatio, isThinInput, thinInputRule, allCandidatesPreCap: allCandidates.slice(0, 10), top3PreFilter: top3, highFitCandidates: highFit, finalOutput: top3, adjacentTitles: adjacent.map(c => ({ title: c.title, score: c.cappedScore })), collapsedToOne, collapseReason };
}

// ── Run ────

// REPRO: before (OLD) and after (NEW)
const reproOLD = runDiagnosticWith("REPRO — OLD extraction (count>=2 only)", REPRO_RESUME, REPRO_PROMPTS, extractWeightedAnchorsOLD);
const reproNEW = runDiagnosticWith("REPRO — NEW extraction (+ scoring-vocab singletons)", REPRO_RESUME, REPRO_PROMPTS, extractWeightedAnchors);
// KNOWN-GOOD: before and after
const chrisOLD = runDiagnosticWith("CHRIS — OLD extraction", CHRIS_RESUME, CHRIS_PROMPTS, extractWeightedAnchorsOLD);
const chrisNEW = runDiagnosticWith("CHRIS — NEW extraction", CHRIS_RESUME, CHRIS_PROMPTS, extractWeightedAnchors);
// THIN INPUT: before and after (should stay weak)
const THIN_RESUME = "Software developer. 3 years.";
const THIN_PROMPTS = ["I like coding.", "Meetings.", "Debugging.", "New features.", "Writing code."];
const thinOLD = runDiagnosticWith("THIN — OLD extraction", THIN_RESUME, THIN_PROMPTS, extractWeightedAnchorsOLD);
const thinNEW = runDiagnosticWith("THIN — NEW extraction", THIN_RESUME, THIN_PROMPTS, extractWeightedAnchors);

function printBeforeAfter(label: string, before: DiagResult, after: DiagResult) {
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${label}`);
  console.log(`${"═".repeat(72)}`);

  // Anchor diff
  const beforeTerms = new Set(before.anchors.map(a => a.term));
  const afterTerms = new Set(after.anchors.map(a => a.term));
  const added = after.anchors.filter(a => !beforeTerms.has(a.term));
  const removed = before.anchors.filter(a => !afterTerms.has(a.term));

  console.log(`\n  ANCHOR MAP DIFF:`);
  console.log(`    Before: ${before.anchorCount} anchors`);
  console.log(`    After:  ${after.anchorCount} anchors`);
  if (added.length > 0) {
    console.log(`    ADDED (+${added.length}):`);
    for (const a of added) {
      const inScoringVocab = SCORING_VOCAB.has(a.term) ? " ← SCORING_VOCAB" : "";
      const isGeneric = a.isGeneric ? " (GENERIC)" : "";
      console.log(`      + "${a.term}" weight=${a.weight}${inScoringVocab}${isGeneric}`);
    }
  } else {
    console.log(`    No new anchors added.`);
  }
  if (removed.length > 0) {
    console.log(`    REMOVED (-${removed.length}):`);
    for (const r of removed) console.log(`      - "${r.term}" weight=${r.weight}`);
  }

  // Title output diff
  console.log(`\n  TOP TITLE CANDIDATES:`);
  console.log(`    ${"BEFORE".padEnd(42)} AFTER`);
  const maxLen = Math.max(before.finalOutput.length, after.finalOutput.length);
  for (let i = 0; i < maxLen; i++) {
    const b = before.finalOutput[i];
    const a = after.finalOutput[i];
    const bStr = b ? `${b.cappedScore.toFixed(1)}  ${b.title}` : "—";
    const aStr = a ? `${a.cappedScore.toFixed(1)}  ${a.title}` : "—";
    const changed = (b?.title !== a?.title || b?.cappedScore !== a?.cappedScore) ? " ←" : "";
    console.log(`    ${bStr.padEnd(42)} ${aStr}${changed}`);
  }

  console.log(`\n  ADJACENT TITLES:`);
  console.log(`    Before: ${before.adjacentTitles.length > 0 ? before.adjacentTitles.map(a => `${a.title} (${a.score})`).join(", ") : "NONE"}`);
  console.log(`    After:  ${after.adjacentTitles.length > 0 ? after.adjacentTitles.map(a => `${a.title} (${a.score})`).join(", ") : "NONE"}`);

  console.log(`\n  COLLAPSE STATUS:`);
  console.log(`    Before: collapsed=${before.collapsedToOne} reason=${before.collapseReason}`);
  console.log(`    After:  collapsed=${after.collapsedToOne} reason=${after.collapseReason}`);

  console.log(`\n  HIGH-FIT (>=7.0):`);
  console.log(`    Before: ${before.highFitCandidates.length} titles`);
  console.log(`    After:  ${after.highFitCandidates.length} titles`);
  if (after.highFitCandidates.length > 0) {
    for (const c of after.highFitCandidates) {
      console.log(`      ${c.cappedScore.toFixed(1)}  ${c.title} (reqCov=${(c.reqCov * 100).toFixed(0)}%, pairs=${c.pairsHit}, matched: ${c.matchedReq.join(", ")})`);
    }
  }

  // Thin-input status
  console.log(`\n  THIN INPUT:`);
  console.log(`    Before: isThin=${before.isThinInput} (${before.thinInputRule})`);
  console.log(`    After:  isThin=${after.isThinInput} (${after.thinInputRule})`);
}

printBeforeAfter("REPRO CASE — BEFORE / AFTER FIX", reproOLD, reproNEW);
printBeforeAfter("KNOWN-GOOD (CHRIS) — BEFORE / AFTER FIX", chrisOLD, chrisNEW);
printBeforeAfter("THIN INPUT — BEFORE / AFTER FIX (should stay weak)", thinOLD, thinNEW);

// Full anchor list for REPRO AFTER (for PM review)
console.log(`\n${"═".repeat(72)}`);
console.log(`  REPRO AFTER — Full anchor list`);
console.log(`${"═".repeat(72)}`);
for (const a of reproNEW.anchors) {
  const flag = a.isGeneric ? " GENERIC" : "";
  const sv = SCORING_VOCAB.has(a.term) ? " SCORING_VOCAB" : "";
  const wasNew = !new Set(reproOLD.anchors.map(x => x.term)).has(a.term) ? " ← NEW" : "";
  console.log(`  ${a.term.padEnd(20)} weight=${a.weight}${flag}${sv}${wasNew}`);
}

// Full top-10 for REPRO AFTER
console.log(`\n${"═".repeat(72)}`);
console.log(`  REPRO AFTER — Top 10 candidates (full detail)`);
console.log(`${"═".repeat(72)}`);
for (const c of reproNEW.allCandidatesPreCap) {
  const caps: string[] = [];
  if (c.cappedByReqCov) caps.push("reqCov-cap");
  if (c.cappedBySpecificity) caps.push("specificity-cap");
  if (c.cappedByThinInput) caps.push("THIN-INPUT-CAP");
  const capStr = caps.length > 0 ? ` [${caps.join(", ")}]` : "";
  console.log(`  ${c.rawScore.toFixed(1)} → ${c.cappedScore.toFixed(1)}  ${c.title}  (reqCov=${(c.reqCov * 100).toFixed(0)}%, pairs=${c.pairsHit})${capStr}`);
  if (c.missingReq.length > 0) console.log(`       missing: ${c.missingReq.join(", ")}`);
  if (c.matchedReq.length > 0) console.log(`       matched: ${c.matchedReq.join(", ")}`);
  if (c.matchedPairs.length > 0) console.log(`       pairs: ${c.matchedPairs.join(", ")}`);
}
