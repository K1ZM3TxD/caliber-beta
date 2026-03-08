#!/usr/bin/env npx tsx
/**
 * scripts/title_scoring_smoke.ts
 *
 * Regression smoke test for cluster-based title scoring.
 * Imports from the real lib/title_scoring.ts to avoid stale inlined logic.
 *
 * Verifies:
 *   1.  Design/product-heavy input → design cluster titles >= 7.0
 *   2.  Ops-heavy input → ops titles dominate, design titles don't inflate
 *   3.  Empty/thin input → no title exceeds 5.0
 *   3b. Generic/weak answers → no title exceeds 5.0
 *   4.  Chris: product-dev dominant → >=8.0 top, all top 3 >= 7.0
 *   5.  Chris × OpsProgram → unrelated cluster stays < 7.0
 *   6.  Determinism: identical inputs → identical outputs
 *   7.  Recommendation pack structure (Chris)
 *   8.  Anchor normalization unit checks
 *   9.  Jen: ClientGrowth / CreativeOps cluster → top title >= 7.0
 *   10. Chris × ClientGrowth regression → stays low
 *   11. Fabio: SecurityAnalysis cluster → top title >= 7.0
 *   12. Fabio × non-security clusters stay low
 *
 * Run: npx tsx scripts/title_scoring_smoke.ts
 */

import {
  extractWeightedAnchors,
  scoreTitles,
  scoreAllTitles,
  generateTitleRecommendation,
  canonicalize,
  normalizeCompounds,
  extractBroadTokens,
} from "../lib/title_scoring.ts";

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

const JEN_RESUME = `Summary Self-motivated go-getter with over 10 years of experience in sales. Known for
exceptional customer service and executing sales strategies that produce results. Natural
proclivity to understanding technology and how to sell to clients. Excellent at building
alliances and partnerships with customers, prospects and colleagues. Experience Gracer-West
Holdings Salem OR Estate Manager 01/2021 Present Maintained and managed a large household
and complex of upscale properties for a private client. Role included accounting managing
staff coordinating events overseeing new projects and setting up a successful rental property.
Responsible for working with owner to execute an overall plan for all properties. Developed
acute business skills in computers finance planning and organization. Set a service standard
of excellence while on the premises and produced amazing results for client. SOYOUU LLC
Keizer OR Owner 01/2013 01/2023 Operated a successful college textbook business for 10 years.
Cultivated relationships that were pivotal in understanding how to deliver superior customer
service. Achieved over 95% positive customer reviews. Experience with building lucrative
products and marketing them to consumers. Skills Customer service Communication skills Computer
literacy Leadership Outside Sales Analytical Thinking Knowledge of Main Sales Platforms
Advertising Negotiation Active Listening Prospect Communication Identifying Client Needs
Product Demonstrations Jennifer Bellini`;

const JEN_PROMPTS = [
  "making marketing materials, design materials. building sops, automations and tools for business. Developing scripts and pitch decks. working directly with customers and understanding their desires and then building solutions around them.",
  "endless sales cycles, jumping from one task to another, not being able to go deep on something, jumping from in home, to cold calls, to pitch decks, to scripts to meetings. I want to feel completed with my work. ship something see how it takes and iterate. sales feels like always chasing the same win",
  "everything i mentioned in prompt 1, and guidance, empathy, listening and good instincts about people and business direction.",
  "discovering bottlenecks and creating strategies to break them. designing beautiful materials for people to look at and engage with. and building tools and automations that make the business run more efficiently.",
  "App building, interior design, songwriting, producing",
];

const FABIO_RESUME = `Fabio Bellini Keizer, Oregon Professional Summary As an OSOC Security Analyst and dedicated cybersecurity professional, I specialize in penetration testing, vulnerability assessment, and security risk mitigation. I bring a strong focus on protecting organizational assets through the design and implementation of comprehensive security measures. With hands-on experience in tools such as Kali Linux, Active Directory, and Python, I'm proficient in red team operations and network security auditing. My background includes serving as an assistant instructor, mentoring students through practical cybersecurity training programs. I've also completed personal projects including building a custom penetration testing lab with Raspberry Pi and developing Arduino-based hardware solutions that reflect my technical creativity and problem-solving skills. In addition to my technical expertise, I have a diverse professional background, having owned and managed an online retail business and held leadership roles in the hospitality industry. Technical Skills Penetration Testing Cybersecurity Network Security Active Directory Red Team Android Kali Linux HTML Python Language Microsoft 365 Licenses & Certifications CNPen Certified Network Pentester eCPPT Certified Professional Penetration Tester PNPT Practical Network Penetration Tester CompTIA Security+ CE Certification Certified Penetration Tester Education OSCP Bootcamp Evolve Academy Certificate of Completion Active Defense & Cyber Deception SOC Core Skills Red Team Fundamentals for Active Directory API Security Fundamentals Practical Ethical Hacking Professional Experience OSOC Security Analyst May 2024 - present Evolve Security Perform continuous penetration testing to proactively identify and exploit vulnerabilities across networks, web applications, and internal systems. Correlate findings with SOC threat intelligence to prioritize and escalate risks. Automate reconnaissance and exploitation workflows. Provide regular reports and real-time alerts to stakeholders. Assistant Instructor Jan 2024 - present Evolve Academy Guide students toward achieving learning objectives. Implement additional guidance resources and technical exercises. Perform 1-on-1 weekly interviews with students. Assist other assistants and lead instructors with assessments. Owner Jan 2019 - Jan 2022 Athletes Best Equipment Online Clothing Store Tasting Room Lead May 2016 - Nov 2018 Alexana Estate Vineyard & Winery`;

const FABIO_PROMPTS = [
  "The part that felt most like me was investigating problems, connecting technical details, and turning them into something clear and actionable. I enjoy digging into issues, understanding what is really happening, and then communicating that in a way others can use to make decisions.",
  "What drained me fastest was repetitive work that required a lot of manual effort but did not involve much analysis, problem-solving, or improvement. I can do it when needed, but I am at my best when I am solving problems, finding patterns, and helping move work forward in a meaningful way.",
  "People often come to me to help make sense of technical situations, especially when something is unclear, urgent, or needs to be explained well. I am usually the person they ask when they need someone to investigate, organize the details, and turn complexity into a clear next step.",
  "I find complex challenges exciting when they require investigation, critical thinking, and a structured approach. If there is a difficult problem with moving parts, and I can break it down, validate the details, and work toward a practical solution, that energizes me rather than overwhelms me.",
  "I am best at work that sits at the intersection of analysis, problem-solving, and communication. I take complex or messy situations, figure out what matters, and turn that into something useful, whether that is a solution, a recommendation, or a clear path forward.",
];

// ─── Test harness ───

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

// ─── Test 1: Design/product profile ───
console.log("\n=== Test 1: Design/Product Profile ===");
const designResults = scoreTitles(DESIGN_PRODUCT_RESUME, DESIGN_PRODUCT_PROMPTS);
printResults("Top 3 titles", designResults);
const designProductTitles = ["Product Designer", "UX Design Strategist", "Design Operations Lead", "Design Program Manager", "Brand Systems Designer"];
const topDesignTitle = designResults.find(r => designProductTitles.includes(r.title));
assert("At least one design/product title in top 3", !!topDesignTitle, `Got: ${designResults.map(r => r.title).join(", ")}`);
assert("Design/product title scores >= 7.0", (topDesignTitle?.score ?? 0) >= 7.0, `Top design title: ${topDesignTitle?.title} = ${topDesignTitle?.score}`);
const topDesignScore = designResults[0]?.score ?? 0;
assert("Top title scores >= 7.0", topDesignScore >= 7.0, `Top score: ${topDesignScore}`);

// ─── Test 2: Ops profile ───
console.log("\n=== Test 2: Ops Profile ===");
const opsResults = scoreTitles(OPS_RESUME, OPS_PROMPTS);
printResults("Top 3 titles", opsResults);
const opsTitles = ["Program Operations Lead", "Operations Manager", "Program Manager", "Process Improvement Lead", "Project Delivery Manager"];
const topOpsTitle = opsResults.find(r => opsTitles.includes(r.title));
assert("Top title is an ops title", opsTitles.includes(opsResults[0]?.title ?? ""), `Top: ${opsResults[0]?.title}`);
assert("Top ops title scores >= 7.0", (topOpsTitle?.score ?? 0) >= 7.0, `Top ops: ${topOpsTitle?.title} = ${topOpsTitle?.score}`);
const opsDesignInTop = opsResults.filter(r => designProductTitles.includes(r.title));
const opsDesignMax = opsDesignInTop.length > 0 ? Math.max(...opsDesignInTop.map(r => r.score)) : 0;
assert("Design titles don't dominate ops profile", opsDesignMax < (topOpsTitle?.score ?? 0), `Design max: ${opsDesignMax}, Ops top: ${topOpsTitle?.score}`);

// ─── Test 3: Thin/empty input ───
console.log("\n=== Test 3: Thin Input ===");
const thinResults = scoreTitles(THIN_INPUT_RESUME, THIN_INPUT_PROMPTS);
printResults("Top 3 titles", thinResults);
const thinMax = Math.max(...thinResults.map(r => r.score));
assert("No title exceeds 5.0 on thin input", thinMax <= 5.0, `Max: ${thinMax}`);

// ─── Test 3b: Generic/weak answers ───
console.log("\n=== Test 3b: Generic/Weak Answers ===");
const GENERIC_WEAK_PROMPTS = [
  "I help projects move forward.",
  "I communicate and stay organized.",
  "I'm adaptable and support my team.",
  "I manage tasks and people.",
  "I deliver results and execute plans."
];
const genericResults = scoreTitles(THIN_INPUT_RESUME, GENERIC_WEAK_PROMPTS);
printResults("Top 3 titles (generic)", genericResults);
const genericMax = Math.max(...genericResults.map(r => r.score));
assert("No title exceeds 5.0 for generic/weak answers", genericMax <= 5.0, `Max: ${genericMax}`);

// ─── Test 4: Chris-like product development dominant profile ───
console.log("\n=== Test 4: Product-Dev Dominant Profile (Chris-like) ===");
const chrisResults = scoreTitles(CHRIS_RESUME, CHRIS_PROMPTS);
printResults("Top 3 titles", chrisResults);
const chrisTopScore = chrisResults[0]?.score ?? 0;
assert("At least one title scores >= 8.0", chrisTopScore >= 8.0, `Top: ${chrisResults[0]?.title} = ${chrisResults[0]?.score}`);
const chrisMinTop3 = chrisResults.reduce((min, r) => Math.min(min, r.score), 10);
assert("All top 3 Chris titles >= 7.0", chrisMinTop3 >= 7.0, `Min top-3 score: ${chrisMinTop3}`);
const chrisAllScores = scoreAllTitles(CHRIS_RESUME, CHRIS_PROMPTS);
const prodDevTitles = ["Product Development Lead", "Technical Product Manager", "Product Operations Lead", "Product Strategy Lead", "Implementation Manager"];
const chrisProdAbove7 = chrisAllScores.filter(r => prodDevTitles.includes(r.title) && r.score >= 7.0);
assert(">=4 ProductDev titles at >=7.0 for Chris", chrisProdAbove7.length >= 4, `Got ${chrisProdAbove7.length}: ${chrisProdAbove7.map(r => `${r.title}=${r.score}`).join(", ")}`);

// ─── Test 5: Unrelated clusters stay < 7 for Chris ───
console.log("\n=== Test 5: Unrelated Cluster Check (Chris) ===");
const opsClusterNames = ["Program Operations Lead", "Operations Manager", "Program Manager", "Project Delivery Manager", "Process Improvement Lead"];
const chrisOpsScores = chrisAllScores.filter(r => opsClusterNames.includes(r.title));
const chrisOpsMax = chrisOpsScores.reduce((max, r) => Math.max(max, r.score), 0);
printResults("Chris OpsProgram cluster scores", chrisOpsScores);
assert("OpsProgram titles stay < 7.0 for Chris", chrisOpsMax < 7.0, `OpsProgram max: ${chrisOpsMax}`);

// ─── Test 6: Determinism ───
console.log("\n=== Test 6: Determinism ===");
const run1 = scoreTitles(DESIGN_PRODUCT_RESUME, DESIGN_PRODUCT_PROMPTS);
const run2 = scoreTitles(DESIGN_PRODUCT_RESUME, DESIGN_PRODUCT_PROMPTS);
const identical = JSON.stringify(run1) === JSON.stringify(run2);
assert("Identical inputs produce identical outputs", identical);

// ─── Test 7: Recommendation pack structure (Chris) ───
console.log("\n=== Test 7: Recommendation Pack (Chris) ===");
{
  const rec = generateTitleRecommendation(CHRIS_RESUME, CHRIS_PROMPTS);
  const primary = rec.recommendation.primary_title;
  console.log(`  Primary: ${primary.title} (${primary.score})`);
  console.log(`  Adjacent: ${rec.recommendation.adjacent_titles.map(a => `${a.title}(${a.score})`).join(", ") || "(none)"}`);
  assert("Primary title exists", !!primary.title);
  assert("Primary score >= 7.0", primary.score >= 7.0, `Got ${primary.score}`);
  assert("Adjacent count 0-2", rec.recommendation.adjacent_titles.length >= 0 && rec.recommendation.adjacent_titles.length <= 2, `Got ${rec.recommendation.adjacent_titles.length}`);
  assert("why_primary has evidence", rec.recommendation.why_primary.length >= 1, `Got ${rec.recommendation.why_primary.length} bullets`);
  assert("titles array populated", (rec.recommendation.titles?.length ?? 0) >= 1, `Got ${rec.recommendation.titles?.length ?? 0} titles`);
}

// ─── Test 8: Anchor normalization unit checks ───
console.log("\n=== Test 8: Anchor Normalization ===");
{
  assert("\"designing\" → \"design\"", canonicalize("designing") === "design", `Got: ${canonicalize("designing")}`);
  assert("\"designed\" → \"design\"", canonicalize("designed") === "design", `Got: ${canonicalize("designed")}`);
  assert("\"managed\" → \"manag\"", canonicalize("managed") === "manag", `Got: ${canonicalize("managed")}`);
  assert("\"tracking\" → \"track\"", canonicalize("tracking") === "track", `Got: ${canonicalize("tracking")}`);
  assert("\"planning\" → \"plan\"", canonicalize("planning") === "plan", `Got: ${canonicalize("planning")}`);
  assert("\"proposals\" → \"proposal\"", canonicalize("proposals") === "proposal", `Got: ${canonicalize("proposals")}`);
  assert("\"studies\" → \"study\"", canonicalize("studies") === "study", `Got: ${canonicalize("studies")}`);
  assert("\"strategies\" → \"strategy\"", canonicalize("strategies") === "strategy", `Got: ${canonicalize("strategies")}`);
  assert("\"less\" unchanged", canonicalize("less") === "less", `Got: ${canonicalize("less")}`);
  assert("\"process\" unchanged (no -ss strip)", canonicalize("process") === "process", `Got: ${canonicalize("process")}`);

  const compounded1 = normalizeCompounds("We focused on team building and problem-solving");
  assert("\"team building\" normalized", compounded1.includes("team") && !compounded1.includes("team building"), `Got: ${compounded1}`);
  assert("\"problem-solving\" normalized", compounded1.includes("problem") && !compounded1.includes("problem-solving"), `Got: ${compounded1}`);

  const designAnchors = extractBroadTokens("I spent time designing systems and designing better workflows for the team. Designing systems was my focus.");
  assert("\"designing systems\" → design anchor present", designAnchors.has("design"), `Anchors: ${[...designAnchors.keys()].join(", ")}`);
  assert("\"designing systems\" → system anchor present", designAnchors.has("system"), `Anchors: ${[...designAnchors.keys()].join(", ")}`);

  const teamAnchors = extractBroadTokens("I love team building. Team building is core to my work. Relationship-building matters too.");
  assert("\"team building\" → team anchor present", teamAnchors.has("team"), `Anchors: ${[...teamAnchors.keys()].join(", ")}`);
}

// ─── Test 9: Jen — Client/relationship + CreativeOps profile ───
console.log("\n=== Test 9: Client/Relationship Profile (Jen) ===");
{
  const jenResults = scoreTitles(JEN_RESUME, JEN_PROMPTS);
  printResults("Top 3 titles (Jen)", jenResults);
  const jenTopTitle = jenResults[0];
  const clientGrowthTitles = ["Client Success Manager", "Partnerships Manager", "Business Development Manager", "Community & Growth Lead", "Account Manager"];
  const creativeOpsTitles = ["Marketing Operations Manager", "Creative Operations Lead", "Sales Enablement Specialist", "Business Operations Designer", "Brand & Content Strategist"];
  const jenValidTitles = [...clientGrowthTitles, ...creativeOpsTitles];
  assert("Top title is from ClientGrowth or CreativeOps cluster", jenValidTitles.includes(jenTopTitle?.title ?? ""), `Got: ${jenTopTitle?.title}`);
  assert("Top title scores >= 7.0", (jenTopTitle?.score ?? 0) >= 7.0, `Got: ${jenTopTitle?.score}`);
  const jenAllScores = scoreAllTitles(JEN_RESUME, JEN_PROMPTS);
  const jenStrongCount = jenAllScores.filter(r => jenValidTitles.includes(r.title) && r.score >= 7.0).length;
  assert(">=2 ClientGrowth/CreativeOps titles at >=7.0 for Jen", jenStrongCount >= 2, `Got ${jenStrongCount}`);
  const designClusterNames = ["Product Designer", "UX Design Strategist", "Design Operations Lead", "Design Program Manager", "Brand Systems Designer"];
  const jenDesignMax = jenAllScores.filter(r => designClusterNames.includes(r.title)).reduce((max, r) => Math.max(max, r.score), 0);
  assert("DesignSystems titles stay < 7.0 for Jen", jenDesignMax < 7.0, `DesignSystems max: ${jenDesignMax}`);
  const jenProdMax = jenAllScores.filter(r => prodDevTitles.includes(r.title)).reduce((max, r) => Math.max(max, r.score), 0);
  assert("ProductDev titles stay < 7.0 for Jen", jenProdMax < 7.0, `ProductDev max: ${jenProdMax}`);
}

// ─── Test 10: Chris × ClientGrowth regression ───
console.log("\n=== Test 10: Chris × ClientGrowth Regression ===");
{
  const clientGrowthTitles = ["Client Success Manager", "Partnerships Manager", "Business Development Manager", "Community & Growth Lead", "Account Manager"];
  const chrisClientScores = chrisAllScores.filter(r => clientGrowthTitles.includes(r.title));
  printResults("Chris ClientGrowth scores", chrisClientScores);
  const chrisClientMax = chrisClientScores.reduce((max, r) => Math.max(max, r.score), 0);
  assert("ClientGrowth titles < 7.0 for Chris", chrisClientMax < 7.0, `ClientGrowth max: ${chrisClientMax}`);
}

// ─── Test 11: Fabio — SecurityAnalysis cluster ───
console.log("\n=== Test 11: Security Profile (Fabio) ===");
{
  const fabioResults = scoreTitles(FABIO_RESUME, FABIO_PROMPTS);
  printResults("Top 3 titles (Fabio)", fabioResults);
  const securityTitles = ["Security Analyst", "Cybersecurity Specialist", "Security Operations Lead", "Technical Security Consultant", "Threat & Vulnerability Analyst"];
  const fabioTopTitle = fabioResults[0];
  assert("Top title is from SecurityAnalysis cluster", securityTitles.includes(fabioTopTitle?.title ?? ""), `Got: ${fabioTopTitle?.title}`);
  assert("Top title scores >= 7.0", (fabioTopTitle?.score ?? 0) >= 7.0, `Got: ${fabioTopTitle?.score}`);
  const fabioAllScores = scoreAllTitles(FABIO_RESUME, FABIO_PROMPTS);
  const fabioSecAbove7 = fabioAllScores.filter(r => securityTitles.includes(r.title) && r.score >= 7.0);
  assert(">=3 SecurityAnalysis titles at >=7.0 for Fabio", fabioSecAbove7.length >= 3, `Got ${fabioSecAbove7.length}: ${fabioSecAbove7.map(r => `${r.title}=${r.score}`).join(", ")}`);
}

// ─── Test 12: Fabio × non-security clusters stay low ───
console.log("\n=== Test 12: Fabio × Non-Security Cluster Regression ===");
{
  const fabioAllScores = scoreAllTitles(FABIO_RESUME, FABIO_PROMPTS);
  const fabioProdScores = fabioAllScores.filter(r => prodDevTitles.includes(r.title));
  const fabioProdMax = fabioProdScores.reduce((max, r) => Math.max(max, r.score), 0);
  printResults("Fabio ProductDev scores", fabioProdScores);
  assert("ProductDev titles < 7.0 for Fabio", fabioProdMax < 7.0, `ProductDev max: ${fabioProdMax}`);
  const clientGrowthTitles = ["Client Success Manager", "Partnerships Manager", "Business Development Manager", "Community & Growth Lead", "Account Manager"];
  const fabioClientMax = fabioAllScores.filter(r => clientGrowthTitles.includes(r.title)).reduce((max, r) => Math.max(max, r.score), 0);
  assert("ClientGrowth titles < 7.0 for Fabio", fabioClientMax < 7.0, `ClientGrowth max: ${fabioClientMax}`);
  const designClusterNames = ["Product Designer", "UX Design Strategist", "Design Operations Lead", "Design Program Manager", "Brand Systems Designer"];
  const fabioDesignMax = fabioAllScores.filter(r => designClusterNames.includes(r.title)).reduce((max, r) => Math.max(max, r.score), 0);
  assert("DesignSystems titles < 7.0 for Fabio", fabioDesignMax < 7.0, `DesignSystems max: ${fabioDesignMax}`);
}

// ─── Summary ───
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All title scoring smoke tests passed.");
}
