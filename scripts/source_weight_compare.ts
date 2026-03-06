/**
 * Before/after comparison for source-weighted anchor scoring.
 * Run: npx tsx scripts/source_weight_compare.ts
 */
import { extractWeightedAnchors, scoreAllTitles, generateTitleRecommendation } from "../lib/title_scoring";

const REPRO_RESUME = `Jane Doe
Senior Product Manager
10+ years experience in SaaS, B2B, and enterprise software. Led cross-functional teams, managed product launches, and drove revenue growth at Acme Corp and BetaTech.`;
const REPRO_PROMPTS = [
  "Managing product launches and working with cross-functional teams felt most like me. I loved taking a product from concept to market, coordinating with engineering and design, and seeing the customer impact.",
  "Getting stuck in endless status meetings or administrative overhead drained me. When the work was about process for process sake instead of moving the product forward, I lost energy.",
  "People come to me for product strategy and decision-making. When there is ambiguity about what to build or how to prioritize, I am the one who helps the team navigate. I also help with stakeholder communication.",
  "I get excited by complex product challenges -- figuring out market fit, designing the go-to-market strategy, and making tough trade-off decisions. The entrepreneurial side of product management is what drives me.",
  "I research market trends and customer needs on the side. I maintain a personal system for tracking industry developments and competitive landscapes. I also mentor early-career PMs.",
];

const CHRIS_RESUME = `Product Development Manager | 7 years experience in SaaS and B2B
Led product development from market research through launch for enterprise software.
Built systems for evaluating market gaps and customer needs. Created SOPs for product
development workflows. Designed and maintained pitch decks and proposals for executive
stakeholders. Conducted feasibility studies for new product initiatives. Automated
internal workflows and reporting systems. Managed cross-functional product development
teams. Drove go-to-market strategy and customer discovery processes.`;
const CHRIS_PROMPTS = [
  "The product development work felt most like me -- identifying gaps in the market, designing systems to evaluate customer needs, and building proposals that connected market insights to product direction. I loved the process of taking a fuzzy customer need and turning it into a structured product development plan with clear feasibility criteria.",
  "Administrative work with no connection to product or customer outcomes drained me. When I was stuck in status meetings instead of designing systems or building workflows, I lost energy. I need the work to connect back to actual product development and market impact.",
  "People come to me when they need proposals, pitch decks, or feasibility studies -- anything that requires translating complex product development needs into clear, structured deliverables. I am also the person teams call when they need systems or SOPs for new workflows. Customer needs analysis is another area where people seek me out.",
  "I get excited by product development challenges that require designing new systems -- especially when there is a real market gap and customer need driving it. Building proposals and feasibility studies for products that could genuinely solve customer problems is exactly my kind of challenge. I love creating workflows that make the product development process repeatable.",
  "I build systems for everything -- meal planning workflows, home renovation SOPs, travel planning templates. I am always designing processes and creating structured approaches. I maintain several systems for tracking personal development goals and customer research for my side project.",
];

const THIN_RESUME = "I work in an office.";
const THIN_PROMPTS = ["I like helping people.", "Meetings are okay.", "I try to be organized."];

function run(label: string, resume: string, prompts: string[]) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(60)}`);

  const anchors = extractWeightedAnchors(resume, prompts);
  console.log(`\n  Anchors (${anchors.size}):`);
  const sorted = [...anchors.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of sorted) console.log(`    ${k.padEnd(20)} w=${v}`);

  const all = scoreAllTitles(resume, prompts);
  console.log(`\n  Top 10 titles:`);
  for (const t of all.slice(0, 10)) console.log(`    ${t.score.toFixed(1).padStart(4)}  ${t.title}`);

  const { candidates, recommendation } = generateTitleRecommendation(resume, prompts);
  console.log(`\n  Recommendation (top 3):`);
  for (let i = 0; i < candidates.length; i++) {
    console.log(`    ${(i + 1)}. ${candidates[i].score.toFixed(1)}  ${candidates[i].title}`);
  }
}

run("REPRO (Jane Doe)", REPRO_RESUME, REPRO_PROMPTS);
run("KNOWN-GOOD (Chris)", CHRIS_RESUME, CHRIS_PROMPTS);
run("THIN INPUT", THIN_RESUME, THIN_PROMPTS);
