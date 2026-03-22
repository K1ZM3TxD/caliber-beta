// analysis/tailor_quality_validation.ts
// Regression script for tailor rewrite quality and guardrails
// Usage: node_modules/.bin/tsx analysis/tailor_quality_validation.ts

import { generateTailoredResume } from "../lib/tailor_store";

interface Fixture {
  name: string;
  resume: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  score: number;
  expect: {
    mustContain?: RegExp[];
    mustNot?: RegExp[];
  };
}

const FIXTURES: Fixture[] = [
  {
    name: "Jen - Weak Sales Grind (~6.5)",
    resume: [
      "Jen Smith",
      "Owner/Operator, Platform Sales",
      "- Built and managed a small business focused on customer service and platform-based sales.",
      "- Developed client relationships and managed day-to-day operations.",
      "- Responsible for sales, marketing, and customer support.",
      "- No direct experience in engineering-driven or technical sales environments.",
    ].join("\n"),
    jobTitle: "Sales Development Representative",
    company: "GrindCo",
    jobDescription:
      "Seeking a high-energy SDR to drive outbound sales in a fast-paced environment. Experience with technical sales, SaaS, or engineering-driven clients preferred. Quota-carrying experience a plus.",
    score: 6.5,
    expect: {
      mustNot: [/quota/i, /engineering[- ]?driven/i, /SaaS/i, /technical sales/i, /enterprise/i],
      mustContain: [/customer service/i, /platform[- ]?based sales/i],
    },
  },
  {
    name: "Jen - Strong Consultative Sales (7.2)",
    resume: [
      "Jen Smith",
      "Owner/Operator, Platform Sales",
      "- Built and managed a small business focused on customer service and platform-based sales.",
      "- Developed client relationships and managed day-to-day operations.",
      "- Responsible for sales, marketing, and customer support.",
      "- Consultative selling to SMB clients.",
    ].join("\n"),
    jobTitle: "Consultative Sales Specialist",
    company: "TechBridge",
    jobDescription:
      "Looking for a consultative sales specialist to drive platform adoption among SMB clients. Experience in platform sales, client relationship management, and consultative selling required.",
    score: 7.2,
    expect: {
      mustContain: [/consultative/i, /platform[- ]?sales/i, /client relationship/i],
      mustNot: [/enterprise/i, /quota/i, /engineering[- ]?driven/i],
    },
  },
  {
    name: "Non-Jen - General Guardrail (6.8, mismatched role)",
    resume: [
      "Alex Lee",
      "Retail Sales Associate",
      "- Provided customer service and managed POS transactions.",
      "- No technical or SaaS experience.",
    ].join("\n"),
    jobTitle: "Enterprise SaaS Account Executive",
    company: "Cloudify",
    jobDescription:
      "Seeking an AE to sell SaaS solutions to enterprise clients. Quota-carrying experience and technical sales background required.",
    score: 6.8,
    expect: {
      mustNot: [/enterprise/i, /SaaS/i, /technical sales/i, /quota/i],
      mustContain: [/customer service/i],
    },
  },
];

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function pass(msg: string) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}
function fail(msg: string) {
  console.log(`  ${RED}✗${RESET} ${msg}`);
}

async function runFixture(fix: Fixture) {
  console.log(`\n${BOLD}=== ${fix.name} ===${RESET}`);
  let fullOutput: string;
  try {
    fullOutput = await generateTailoredResume(
      fix.resume,
      fix.jobTitle,
      fix.company,
      fix.jobDescription,
      fix.score
    );
  } catch (e) {
    console.error(`${RED}ERROR: ${e instanceof Error ? e.message : e}${RESET}`);
    return;
  }

  // Split debug trace from resume text
  const debugMarker = /\r?\n===INTERNAL_DEBUG_TRACE===/;
  const match = fullOutput.match(debugMarker);
  let tailoredText = fullOutput;
  let debugTrace = "";
  if (match && match.index !== undefined) {
    tailoredText = fullOutput.slice(0, match.index).trim();
    debugTrace = fullOutput.slice(match.index + match[0].length).trim();
  }

  console.log(`\n${DIM}--- Tailored (first 400 chars) ---${RESET}`);
  console.log(tailoredText.slice(0, 400) + (tailoredText.length > 400 ? "…" : ""));

  if (debugTrace) {
    console.log(`\n${DIM}--- Debug Trace (first 400 chars) ---${RESET}`);
    console.log(debugTrace.slice(0, 400) + (debugTrace.length > 400 ? "…" : ""));
  } else {
    fail("No INTERNAL DEBUG TRACE found in output");
  }

  console.log(`\n${DIM}--- Guardrail checks ---${RESET}`);
  let passed = 0;
  let failed = 0;

  for (const re of fix.expect.mustContain ?? []) {
    if (re.test(tailoredText)) {
      pass(`mustContain ${re}`);
      passed++;
    } else {
      fail(`mustContain ${re} — NOT FOUND`);
      failed++;
    }
  }

  for (const re of fix.expect.mustNot ?? []) {
    if (!re.test(tailoredText)) {
      pass(`mustNot ${re}`);
      passed++;
    } else {
      fail(`mustNot ${re} — FOUND (guardrail violation)`);
      failed++;
    }
  }

  console.log(
    `\n  Result: ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : ""}${failed} failed${RESET}`
  );
}

(async () => {
  console.log(`${BOLD}Tailor Quality Validation${RESET}`);
  console.log("─".repeat(50));
  for (const fix of FIXTURES) {
    await runFixture(fix);
  }
  console.log("\n" + "─".repeat(50));
  console.log("Done.\n");
})();
