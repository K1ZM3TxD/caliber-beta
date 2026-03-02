#!/usr/bin/env npx ts-node
/**
 * scripts/title_scoring_smoke.ts
 *
 * Deterministic smoke test for cluster-based title scoring.
 * Verifies:
 *   1. Design/product-heavy input → design cluster titles >= 7.0
 *   2. Ops-heavy input → ops titles dominate, design titles don't inflate
 *   3. Empty/thin input → no title exceeds 5.0
 *   4. Product-dev dominant profile (Chris-like) → >=5 titles at >=7.0
 *   5. Unrelated clusters stay < 7.0 for Chris
 *   6. Determinism: identical inputs → identical outputs
 *
 * Run: npx ts-node scripts/title_scoring_smoke.ts
 */

// Inline the scoring functions so this runs without Next.js module resolution.
// We mirror the exact logic from lib/calibration_machine.ts.

const _TITLE_STOPWORDS = new Set<string>([
  "the","and","for","with","from","this","that","have","has","had","will","into",
  "over","under","your","you","our","are","was","were","been","being","they","them",
  "their","there","here","what","when","where","which","who","whom","why","how",
  "can","could","should","would","may","might","not","but","also","than","then",
  "about","just","like","really","very","much","more","most","some","any","all",
  "each","every","both","few","many","other","such","only","own","same","too",
]);

const _CANON_MAP: Record<string, string> = {
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

const _COMPOUND_MAP: [RegExp, string][] = [
  [/\bteam[\s-]building\b/gi, "team"],
  [/\brelationship[\s-]building\b/gi, "relationship"],
  [/\bproblem[\s-]solving\b/gi, "problem"],
  [/\bcross[\s-]functional\b/gi, "cross_functional"],
  [/\bgo[\s-]to[\s-]market\b/gi, "market"],
];
function normalizeCompounds(text: string): string {
  let out = text;
  for (const [pattern, replacement] of _COMPOUND_MAP) {
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
  const mapped = _CANON_MAP[token];
  if (mapped) return mapped;
  const stripped = stripSuffix(token);
  if (stripped !== token) {
    return _CANON_MAP[stripped] ?? stripped;
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
    if (_TITLE_STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const result = new Map<string, number>();
  for (const [term, count] of counts) {
    if (count >= 2) result.set(term, count);
  }
  return result;
}

function extractWeightedAnchors(resumeText: string, promptAnswers: string[]): Map<string, number> {
  const combinedText = [resumeText, ...promptAnswers].filter(Boolean).join("\n");
  const allTokens = extractBroadTokens(combinedText);

  const toWordSet = (text: string): Set<string> => {
    const compounded = normalizeCompounds(String(text ?? ""));
    return new Set(
      compounded.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
        .map(canonicalize)
        .filter(t => t.length >= 3 && !_TITLE_STOPWORDS.has(t))
    );
  };
  const resumeWords = toWordSet(resumeText);
  const promptWordSets = promptAnswers.map(toWordSet);

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

// ─── Cluster-based title definitions (mirrors calibration_machine.ts) ───

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
];

const STANDALONE_SIGS: Array<{ title: string; required: string[]; optional: string[] }> = [
  {
    title: "Solutions Consultant",
    required: ["client", "solutions", "proposal", "process", "customer", "feasibility"],
    optional: ["consulting", "delivery", "engagement", "management", "team"],
  },
];

// Derive flat structures
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

const ACTION_ARTIFACT_PAIRS: [string, string][] = [
  ["design", "system"],
  ["create", "sop"],
  ["automate", "workflow"],
  ["pitch", "decks"],
  ["feasibility", "studies"],
  ["customer", "need"],
];

const HIGH_SPECIFICITY_ANCHORS = new Set<string>([
  "sop", "feasibility", "incentives", "automate", "workflow",
  "pitch", "decks", "proposal", "methodology", "compliance",
  "architecture", "stakeholders", "onboarding", "documentation",
]);

function scoreTitles(resumeText: string, promptAnswers: string[]): Array<{ title: string; score: number }> {
  const anchorMap = extractWeightedAnchors(resumeText, promptAnswers);

  const scored = TITLE_BANK.map(title => {
    const sig = SIGS[title];
    if (!sig) return { title, score: 0 };
    let reqHit = 0, reqTotal = 0;
    for (const term of sig.required) {
      reqTotal += 5;
      const w = anchorMap.get(term);
      if (w !== undefined) reqHit += w;
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
    let raw = 10 * reqCov + pairBonus;
    if (raw >= 9.0 && reqCov < 0.88) raw = Math.min(raw, 8.9);
    if (raw >= 8.0 && reqCov < 0.78) raw = Math.min(raw, 7.9);
    if (raw >= 9.5 && !hasSpecificity) raw = Math.min(raw, 9.4);
    const score = Math.max(0, Math.min(9.9, Math.round(raw * 10) / 10));
    return { title, score };
  });

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, 5);
}

// Helper: score ALL titles (not just top 5) for cross-cluster checks
function scoreAllTitles(resumeText: string, promptAnswers: string[]): Array<{ title: string; score: number }> {
  const anchorMap = extractWeightedAnchors(resumeText, promptAnswers);
  const scored = TITLE_BANK.map(title => {
    const sig = SIGS[title];
    if (!sig) return { title, score: 0 };
    let reqHit = 0, reqTotal = 0;
    for (const term of sig.required) {
      reqTotal += 5;
      const w = anchorMap.get(term);
      if (w !== undefined) reqHit += w;
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
    let raw = 10 * reqCov + pairBonus;
    if (raw >= 9.0 && reqCov < 0.88) raw = Math.min(raw, 8.9);
    if (raw >= 8.0 && reqCov < 0.78) raw = Math.min(raw, 7.9);
    if (raw >= 9.5 && !hasSpecificity) raw = Math.min(raw, 9.4);
    const score = Math.max(0, Math.min(9.9, Math.round(raw * 10) / 10));
    return { title, score };
  });
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored;
}

// ─── Test fixtures ───

const DESIGN_PRODUCT_RESUME = `
Senior Product Designer | 8 years experience
Led design systems for enterprise SaaS products. Built and maintained component libraries,
design tokens, and documentation for cross-functional teams. Conducted user research and
usability testing. Created workflows and SOPs for design handoff. Managed design-to-dev
process across multiple product teams. Championed design systems thinking and built internal
tools for design operations. Facilitated design critiques and stakeholder reviews.
`;

const DESIGN_PRODUCT_PROMPTS = [
  "The part that felt most like me was building design systems — creating the underlying structure that helps product teams ship consistently. I loved the work of mapping patterns, documenting decisions, and making reusable components. My team relied on the systems I built to move faster. The design work itself mattered, but the systems work behind the design was where I thrived.",
  "Pixel-pushing one-off screens with no reusable system behind them drained me. When people treated design as decoration rather than systems work, I lost energy fast. Meetings where leadership wanted 'a quick design' without understanding the underlying process were exhausting.",
  "People come to me for process — how to structure design work, how to document decisions, how to set up workflows that actually stick. I'm the person the team calls when systems break down or when someone needs help bridging design and engineering. Research synthesis too — turning messy user research into clear patterns the team can act on.",
  "I get excited when someone says 'we need a system for this' — whether it's a design system, a workflow for handling research, or a process for cross-team collaboration. The challenge of building something reusable that makes other people's work better is what drives me. I love the intersection of design, systems, and people.",
  "I build systems that help teams do better design work. I create structure — documented processes, reusable components, clear workflows — so that product teams can ship with confidence. I bridge the gap between research, design, and engineering by making the invisible work visible. My work is about making the team's work work.",
];

const OPS_RESUME = `
Operations Manager | 12 years experience
Managed cross-functional operations teams of 15+ people. Led program delivery, process
improvement, and operational reporting for enterprise clients. Built tracking dashboards,
managed budgets, ensured compliance with SOX requirements. Led planning sessions and
coordinated delivery across multiple workstreams. Drove execution of quarterly OKRs.
`;

const OPS_PROMPTS = [
  "The operations side felt most like me — tracking progress, managing delivery timelines, making sure the team hit milestones. Program management and operations planning were my bread and butter.",
  "I was drained by creative work — anything where the process wasn't clear or the deliverables shifted. I need structure and clear execution paths.",
  "People come to me for program and operations coordination. When a team needs tracking, reporting, or someone to manage delivery across functions, they call me.",
  "I get excited by complex operations challenges — multiple teams, competing timelines, tight budgets. The planning and execution is what I love about management.",
  "I track, plan, coordinate, and deliver. I build operations processes that keep teams on track. My work is about execution, management, and making sure nothing falls through the cracks in program delivery.",
];

const THIN_INPUT_RESUME = "Software developer. 3 years.";
const THIN_INPUT_PROMPTS = ["I like coding.", "Meetings.", "Debugging.", "New features.", "Writing code."];

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

// ─── Run tests ───

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function printResults(label: string, results: Array<{ title: string; score: number }>) {
  console.log(`\n  ${label}:`);
  for (const r of results) {
    console.log(`    ${r.score.toFixed(1)}  ${r.title}`);
  }
}

// Test 1: Design/product profile
console.log("\n=== Test 1: Design/Product Profile ===");
const designResults = scoreTitles(DESIGN_PRODUCT_RESUME, DESIGN_PRODUCT_PROMPTS);
printResults("Top 5 titles", designResults);
const designProductTitles = ["Product Designer", "UX Design Strategist", "Design Operations Lead", "Design Program Manager", "Brand Systems Designer"];
const topDesignTitle = designResults.find(r => designProductTitles.includes(r.title));
assert("At least one design/product title in top 5", !!topDesignTitle, `Got: ${designResults.map(r => r.title).join(", ")}`);
assert("Design/product title scores >= 7.0", (topDesignTitle?.score ?? 0) >= 7.0, `Top design title: ${topDesignTitle?.title} = ${topDesignTitle?.score}`);
const topDesignScore = designResults[0]?.score ?? 0;
assert("Top title scores >= 7.0", topDesignScore >= 7.0, `Top score: ${topDesignScore}`);
// Cluster check: >=5 design-cluster titles at >=7
const designAllScores = scoreAllTitles(DESIGN_PRODUCT_RESUME, DESIGN_PRODUCT_PROMPTS);
const designClusterNames = TITLE_CLUSTERS.find(c => c.name === "DesignSystems")!.titles.map(t => t.title);
const designClusterAbove7 = designAllScores.filter(r => designClusterNames.includes(r.title) && r.score >= 7.0);
assert(">=5 DesignSystems titles at >=7.0 for design profile", designClusterAbove7.length >= 5, `Got ${designClusterAbove7.length}: ${designClusterAbove7.map(r => `${r.title}=${r.score}`).join(", ")}`);

// Test 2: Ops profile
console.log("\n=== Test 2: Ops Profile ===");
const opsResults = scoreTitles(OPS_RESUME, OPS_PROMPTS);
printResults("Top 5 titles", opsResults);
const opsTitles = ["Program Operations Lead", "Operations Manager", "Program Manager", "Process Improvement Lead", "Project Delivery Manager"];
const topOpsTitle = opsResults.find(r => opsTitles.includes(r.title));
assert("Top title is an ops title", opsTitles.includes(opsResults[0]?.title ?? ""), `Top: ${opsResults[0]?.title}`);
assert("Top ops title scores >= 7.0", (topOpsTitle?.score ?? 0) >= 7.0, `Top ops: ${topOpsTitle?.title} = ${topOpsTitle?.score}`);
// Design titles should NOT dominate for ops input
const opsDesignInTop = opsResults.filter(r => designProductTitles.includes(r.title));
const opsDesignMax = opsDesignInTop.length > 0 ? Math.max(...opsDesignInTop.map(r => r.score)) : 0;
assert("Design titles don't dominate ops profile", opsDesignMax < (topOpsTitle?.score ?? 0), `Design max: ${opsDesignMax}, Ops top: ${topOpsTitle?.score}`);
// Cluster check: >=1 ops-cluster title at >=7 (ops fixture is thinner than design/productdev)
const opsAllScores = scoreAllTitles(OPS_RESUME, OPS_PROMPTS);
const opsClusterNames = TITLE_CLUSTERS.find(c => c.name === "OpsProgram")!.titles.map(t => t.title);
const opsClusterAbove7 = opsAllScores.filter(r => opsClusterNames.includes(r.title) && r.score >= 7.0);
assert(">=1 OpsProgram title at >=7.0 for ops profile", opsClusterAbove7.length >= 1, `Got ${opsClusterAbove7.length}: ${opsClusterAbove7.map(r => `${r.title}=${r.score}`).join(", ")}`);

// Test 3: Thin/empty input
console.log("\n=== Test 3: Thin Input ===");
const thinResults = scoreTitles(THIN_INPUT_RESUME, THIN_INPUT_PROMPTS);
printResults("Top 5 titles", thinResults);
const thinMax = thinResults[0]?.score ?? 0;
assert("No title exceeds 5.0 on thin input", thinMax <= 5.0, `Max: ${thinMax}`);

// Test 4: Chris-like product development dominant profile
console.log("\n=== Test 4: Product-Dev Dominant Profile (Chris-like) ===");
const chrisResults = scoreTitles(CHRIS_RESUME, CHRIS_PROMPTS);
printResults("Top 5 titles", chrisResults);
const chrisTopScore = chrisResults[0]?.score ?? 0;
assert("At least one title scores >= 8.5", chrisTopScore >= 8.5, `Top: ${chrisResults[0]?.title} = ${chrisTopScore}`);
const chrisRelevantTitles = ["Product Development Lead", "Product Designer", "UX Design Strategist", "Implementation Manager", "Solutions Consultant", "Technical Product Manager", "Product Operations Lead", "Product Strategy Lead"];
const chrisRelevantTop = chrisResults.find(r => chrisRelevantTitles.includes(r.title));
assert("A relevant title is in top 5", !!chrisRelevantTop, `Got: ${chrisResults.map(r => r.title).join(", ")}`);
// All top 5 must be >= 7.0
const chrisMinTop5 = chrisResults.reduce((min, r) => Math.min(min, r.score), 10);
assert("All top 5 Chris titles >= 7.0", chrisMinTop5 >= 7.0, `Min top-5 score: ${chrisMinTop5}`);
// >=5 titles at >=7 from ProductDev cluster
const chrisAllScores = scoreAllTitles(CHRIS_RESUME, CHRIS_PROMPTS);
const prodDevClusterNames = TITLE_CLUSTERS.find(c => c.name === "ProductDev")!.titles.map(t => t.title);
const chrisProdAbove7 = chrisAllScores.filter(r => prodDevClusterNames.includes(r.title) && r.score >= 7.0);
assert(">=5 ProductDev titles at >=7.0 for Chris", chrisProdAbove7.length >= 5, `Got ${chrisProdAbove7.length}: ${chrisProdAbove7.map(r => `${r.title}=${r.score}`).join(", ")}`);

// Test 5: Unrelated clusters stay < 7 for Chris
console.log("\n=== Test 5: Unrelated Cluster Check (Chris) ===");
const chrisOpsScores = chrisAllScores.filter(r => opsClusterNames.includes(r.title));
const chrisOpsMax = chrisOpsScores.reduce((max, r) => Math.max(max, r.score), 0);
printResults("Chris OpsProgram cluster scores", chrisOpsScores);
assert("OpsProgram titles stay < 7.0 for Chris", chrisOpsMax < 7.0, `OpsProgram max: ${chrisOpsMax}`);

// Test 6: Determinism
console.log("\n=== Test 6: Determinism ===");
const run1 = scoreTitles(DESIGN_PRODUCT_RESUME, DESIGN_PRODUCT_PROMPTS);
const run2 = scoreTitles(DESIGN_PRODUCT_RESUME, DESIGN_PRODUCT_PROMPTS);
const identical = JSON.stringify(run1) === JSON.stringify(run2);
assert("Identical inputs produce identical outputs", identical);

// Test 7: Recommendation pack structure (inline mirror of generateTitleRecommendation)
console.log("\n=== Test 7: Recommendation Pack (Chris) ===");
{
  // Build enriched candidates with _missing and _matchedPairs
  const chrisAnchorMap = extractWeightedAnchors(CHRIS_RESUME, CHRIS_PROMPTS);
  const chrisEnriched = TITLE_BANK.map(title => {
    const sig = SIGS[title];
    if (!sig) return { title, score: 0, _reqCov: 0, _matchedPairs: [] as string[], _missing: [] as string[] };
    let reqHit = 0, reqTotal = 0;
    const missingReq: string[] = [];
    for (const term of sig.required) {
      reqTotal += 5;
      const w = chrisAnchorMap.get(term);
      if (w !== undefined) reqHit += w; else missingReq.push(term);
    }
    const reqCov = reqTotal > 0 ? Math.min(1.0, reqHit / reqTotal) : 0;
    const allSigTerms = new Set([...sig.required, ...sig.optional]);
    let pairsHit = 0;
    const matchedPairs: string[] = [];
    for (const [a, b] of ACTION_ARTIFACT_PAIRS) {
      if (chrisAnchorMap.has(a) && chrisAnchorMap.has(b) && (allSigTerms.has(a) || allSigTerms.has(b))) {
        pairsHit++; matchedPairs.push(`${a}+${b}`);
      }
    }
    const pairBonus = Math.min(0.8, pairsHit * 0.2);
    let hasSpec = matchedPairs.length > 0;
    if (!hasSpec) { for (const t of allSigTerms) { if (HIGH_SPECIFICITY_ANCHORS.has(t) && chrisAnchorMap.has(t)) { hasSpec = true; break; } } }
    let raw = 10 * reqCov + pairBonus;
    if (raw >= 9.0 && reqCov < 0.88) raw = Math.min(raw, 8.9);
    if (raw >= 8.0 && reqCov < 0.78) raw = Math.min(raw, 7.9);
    if (raw >= 9.5 && !hasSpec) raw = Math.min(raw, 9.4);
    const score = Math.max(0, Math.min(9.9, Math.round(raw * 10) / 10));
    return { title, score, _reqCov: reqCov, _matchedPairs: matchedPairs, _missing: missingReq };
  });
  chrisEnriched.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const top5 = chrisEnriched.slice(0, 5);
  const primary = top5[0];
  const topScore = primary.score;
  const adjacent = top5.slice(1).filter((c, i) => i < 2 && c.score >= 7.0 && (topScore - c.score) <= 0.8);

  console.log(`  Primary: ${primary.title} (${primary.score})`);
  console.log(`  Adjacent: ${adjacent.map(a => `${a.title}(${a.score})`).join(", ") || "(none)"}`);
  assert("Primary title exists", !!primary.title);
  assert("Primary score >= 7.0", primary.score >= 7.0, `Got ${primary.score}`);
  assert("Adjacent count 0-2", adjacent.length >= 0 && adjacent.length <= 2, `Got ${adjacent.length}`);
  // why_primary: should produce >= 2 bullets from anchors
  const primarySig = SIGS[primary.title];
  const matchedReq = primarySig ? primarySig.required.filter((t: string) => chrisAnchorMap.has(t)) : [];
  assert("why_primary has anchor evidence", matchedReq.length >= 2, `Matched req: ${matchedReq.join(", ")}`);
  // why_not_adjacent: excluded titles should have missing anchors
  const excluded = top5.filter(c => c.title !== primary.title && !adjacent.some(a => a.title === c.title));
  if (excluded.length > 0) {
    assert("why_not_adjacent has missing anchor evidence", excluded[0]._missing.length > 0 || excluded[0].score < 7.0,
      `Top excluded: ${excluded[0].title} missing=[${excluded[0]._missing.join(",")}] score=${excluded[0].score}`);
  }
}

// Test 8: Anchor normalization unit checks
console.log("\n=== Test 8: Anchor Normalization ===");
{
  // A) Morphology: suffix stripping
  assert("\"designing\" → \"design\"", canonicalize("designing") === "design", `Got: ${canonicalize("designing")}`);
  assert("\"designed\" → \"design\"", canonicalize("designed") === "design", `Got: ${canonicalize("designed")}`);
  assert("\"managed\" → \"manag\"", canonicalize("managed") === "manag", `Got: ${canonicalize("managed")}`);
  assert("\"tracking\" → \"track\"", canonicalize("tracking") === "track", `Got: ${canonicalize("tracking")}`);
  assert("\"planning\" → \"plan\"", canonicalize("planning") === "plan", `Got: ${canonicalize("planning")}`);
  assert("\"proposals\" → \"proposal\"", canonicalize("proposals") === "proposal", `Got: ${canonicalize("proposals")}`);
  assert("\"studies\" → \"study\"", canonicalize("studies") === "study", `Got: ${canonicalize("studies")}`);
  assert("\"strategies\" → \"strategy\"", canonicalize("strategies") === "strategy", `Got: ${canonicalize("strategies")}`);
  // Safety: short tokens and -ss/-us/-is preserved
  assert("\"less\" unchanged", canonicalize("less") === "less", `Got: ${canonicalize("less")}`);
  assert("\"process\" unchanged (no -ss strip)", canonicalize("process") === "process", `Got: ${canonicalize("process")}`);

  // B) Compound normalization
  const compounded1 = normalizeCompounds("We focused on team building and problem-solving");
  assert("\"team building\" normalized", compounded1.includes("team") && !compounded1.includes("team building"), `Got: ${compounded1}`);
  assert("\"problem-solving\" normalized", compounded1.includes("problem") && !compounded1.includes("problem-solving"), `Got: ${compounded1}`);

  // C) End-to-end: "designing systems" yields "design" anchor
  const designAnchors = extractBroadTokens("I spent time designing systems and designing better workflows for the team. Designing systems was my focus.");
  assert("\"designing systems\" → design anchor present", designAnchors.has("design"), `Anchors: ${[...designAnchors.keys()].join(", ")}`);
  assert("\"designing systems\" → system anchor present", designAnchors.has("system"), `Anchors: ${[...designAnchors.keys()].join(", ")}`);

  // D) End-to-end: "team building" yields "team" anchor
  const teamAnchors = extractBroadTokens("I love team building. Team building is core to my work. Relationship-building matters too.");
  assert("\"team building\" → team anchor present", teamAnchors.has("team"), `Anchors: ${[...teamAnchors.keys()].join(", ")}`);
}

// Summary
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All title scoring smoke tests passed.");
}
