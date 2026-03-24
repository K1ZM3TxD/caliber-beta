#!/usr/bin/env node
/**
 * Execution Evidence Gate Validation — Post-implementation simulation test (v0.9.29)
 *
 * Validates the execution-evidence guardrail logic against scenarios that cover:
 *   1. Domain-locked ecosystem detection (Salesforce, SAP, ServiceNow — 3 of 7)
 *   2. Stack/tool execution pattern detection (Python, Java, React, Django, "write code" — 5 of 31)
 *   3. Score cap enforcement (score > 7.0, no evidence → capped to 7.0)
 *   4. Silent path (score already ≤ 7.0 → guardrail does not trigger)
 *   5. Evidence bypass (resume contains matching keywords → guardrail silent)
 *
 * Pure-logic reimplementation — no TS compilation required.
 * Constants and logic mirror lib/work_mode.ts exactly.
 *
 * Usage: node analysis/execution_evidence_gate_validation.js
 */

"use strict";

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, testName, detail) {
  if (condition) {
    passCount++;
  } else {
    failCount++;
    failures.push({ test: testName, detail: detail || "" });
    console.error(`  FAIL: ${testName}${detail ? " — " + detail : ""}`);
  }
}

function section(title) {
  console.log(`\n═══ ${title} ═══`);
}

// ─── Inline constants — must match lib/work_mode.ts ──────────────────────────

const EXECUTION_EVIDENCE_CAP = 7.0;
const STACK_EXECUTION_THRESHOLD = 4;

// Domain-locked ecosystems (7 total; we exercise 3: Salesforce, SAP, ServiceNow)
const DOMAIN_LOCKED_ECOSYSTEMS = [
  {
    name: "Salesforce",
    jobPatterns: [
      { pattern: /\bsalesforce\b/i, weight: 2, label: "Salesforce" },
      { pattern: /\bCPQ\b/i, weight: 3, label: "CPQ" },
      { pattern: /\b[Aa]pex\b/, weight: 3, label: "Apex" },
      { pattern: /\bSOQL\b/, weight: 3, label: "SOQL" },
      { pattern: /\b(lightning|LWC)\b/i, weight: 2, label: "Lightning/LWC" },
      { pattern: /\bquote[- ]?to[- ]?cash\b/i, weight: 3, label: "quote-to-cash" },
      { pattern: /\b(sales cloud|service cloud)\b/i, weight: 2, label: "Sales/Service Cloud" },
    ],
    evidencePattern: /\b(salesforce|CPQ|apex|SOQL|lightning|LWC|quote[- ]?to[- ]?cash|sales cloud|service cloud)\b/i,
    threshold: 4,
  },
  {
    name: "SAP",
    jobPatterns: [
      { pattern: /\bSAP\b/, weight: 2, label: "SAP" },
      { pattern: /\bABAP\b/i, weight: 3, label: "ABAP" },
      { pattern: /\bS\/4\s*HANA\b/i, weight: 3, label: "S/4HANA" },
      { pattern: /\bHANA\b/, weight: 2, label: "HANA" },
      { pattern: /\bSAP\s+(MM|SD|FI|CO|PP|HCM|BW)\b/, weight: 3, label: "SAP module" },
    ],
    evidencePattern: /\b(SAP|ABAP|S\/4\s*HANA|HANA)\b/i,
    threshold: 4,
  },
  {
    name: "Oracle",
    jobPatterns: [
      { pattern: /\boracle\b/i, weight: 2, label: "Oracle" },
      { pattern: /\bPL\/SQL\b/i, weight: 3, label: "PL/SQL" },
      { pattern: /\boracle\s+(ERP|HCM|Cloud|E-Business|Fusion)\b/i, weight: 3, label: "Oracle platform" },
    ],
    evidencePattern: /\b(oracle|PL\/SQL)\b/i,
    threshold: 4,
  },
  {
    name: "ServiceNow",
    jobPatterns: [
      { pattern: /\bServiceNow\b/i, weight: 3, label: "ServiceNow" },
      { pattern: /\bITSM\b/, weight: 2, label: "ITSM" },
      { pattern: /\bITOM\b/, weight: 2, label: "ITOM" },
    ],
    evidencePattern: /\b(ServiceNow|ITSM|ITOM)\b/i,
    threshold: 4,
  },
  {
    name: "Workday",
    jobPatterns: [
      { pattern: /\bWorkday\b/i, weight: 3, label: "Workday" },
      { pattern: /\bWorkday\s+(HCM|Financials|Integration)\b/i, weight: 3, label: "Workday module" },
    ],
    evidencePattern: /\bWorkday\b/i,
    threshold: 4,
  },
  {
    name: "NetSuite",
    jobPatterns: [
      { pattern: /\bNetSuite\b/i, weight: 3, label: "NetSuite" },
      { pattern: /\bSuiteScript\b/i, weight: 3, label: "SuiteScript" },
      { pattern: /\bSuiteFlow\b/i, weight: 2, label: "SuiteFlow" },
    ],
    evidencePattern: /\b(NetSuite|SuiteScript|SuiteFlow)\b/i,
    threshold: 4,
  },
  {
    name: "Dynamics 365",
    jobPatterns: [
      { pattern: /\bDynamics\s*365\b/i, weight: 3, label: "Dynamics 365" },
      { pattern: /\bD365\b/, weight: 3, label: "D365" },
      { pattern: /\bMicrosoft\s+Dynamics\b/i, weight: 2, label: "Microsoft Dynamics" },
    ],
    evidencePattern: /\b(Dynamics\s*365|D365|Microsoft\s+Dynamics)\b/i,
    threshold: 4,
  },
];

// Stack/tool execution patterns (31 total; we exercise 5: Python, Java, React, Django, "write code")
const STACK_EXECUTION_JOB_PATTERNS = [
  { pattern: /\bpython\b/i, weight: 2, label: "Python" },
  { pattern: /\bjava\b/i, weight: 2, label: "Java" },
  { pattern: /\bjavascript\b/i, weight: 2, label: "JavaScript" },
  { pattern: /\btypescript\b/i, weight: 2, label: "TypeScript" },
  { pattern: /\bC\+\+\b/, weight: 2, label: "C++" },
  { pattern: /\bC#\b/, weight: 2, label: "C#" },
  { pattern: /\bgolang\b/i, weight: 2, label: "Golang" },
  { pattern: /\brust\b/i, weight: 2, label: "Rust" },
  { pattern: /\bruby\b/i, weight: 2, label: "Ruby" },
  { pattern: /\bPHP\b/i, weight: 2, label: "PHP" },
  { pattern: /\bswift\b/i, weight: 2, label: "Swift" },
  { pattern: /\bkotlin\b/i, weight: 2, label: "Kotlin" },
  { pattern: /\bscala\b/i, weight: 2, label: "Scala" },
  { pattern: /\breact\b/i, weight: 2, label: "React" },
  { pattern: /\bangular\b/i, weight: 2, label: "Angular" },
  { pattern: /\bvue(\.?js)?\b/i, weight: 2, label: "Vue" },
  { pattern: /\bdjango\b/i, weight: 2, label: "Django" },
  { pattern: /\bflask\b/i, weight: 2, label: "Flask" },
  { pattern: /\bspring\s*boot\b/i, weight: 2, label: "Spring Boot" },
  { pattern: /\b(\.NET|dotnet|ASP\.NET)\b/i, weight: 2, label: ".NET" },
  { pattern: /\brails\b/i, weight: 2, label: "Rails" },
  { pattern: /\bnode\.?js\b/i, weight: 2, label: "Node.js" },
  { pattern: /\blaravel\b/i, weight: 2, label: "Laravel" },
  { pattern: /\bnext\.?js\b/i, weight: 2, label: "Next.js" },
  { pattern: /\bwrite\s+code\b/i, weight: 3, label: "write code" },
  { pattern: /\bhands[- ]on\s+(coding|programming)\b/i, weight: 3, label: "hands-on coding" },
  { pattern: /\bcode\s+review\b/i, weight: 2, label: "code review" },
  { pattern: /\bcontribute\s+to\s+(the\s+)?codebase\b/i, weight: 3, label: "contribute to codebase" },
  { pattern: /\balgorithm(s|ic)?\b/i, weight: 2, label: "algorithms" },
  { pattern: /\bdata\s+structures?\b/i, weight: 2, label: "data structures" },
  { pattern: /\bproduction\s+code\b/i, weight: 3, label: "production code" },
];

const STACK_EVIDENCE_PATTERN =
  /\b(python|java|javascript|typescript|C\+\+|C#|golang|rust|ruby|PHP|swift|kotlin|scala|react|angular|vue|django|flask|spring|dotnet|\.NET|rails|node\.?js|laravel|next\.?js|software\s+engineer|software\s+developer|full[- ]stack\s+develop|frontend\s+develop|backend\s+develop|programmer|coding|wrote\s+code|code\s+review)\b/i;

// ─── Pure-logic reimplementation of detectExecutionEvidenceGap ───────────────

function round1(n) {
  return Math.round(n * 10) / 10;
}

function detectExecutionEvidenceGap(score, jobText, userEvidenceText) {
  const noTrigger = {
    triggered: false, categories: [], signals: [],
    missingEvidence: [], cap: null, adjustment: 0, reason: null,
  };

  if (score <= EXECUTION_EVIDENCE_CAP) return noTrigger;

  const categories = [];
  const allSignals = [];
  const missing = [];

  for (const eco of DOMAIN_LOCKED_ECOSYSTEMS) {
    let ecoScore = 0;
    const ecoSignals = [];
    for (const p of eco.jobPatterns) {
      if (p.pattern.test(jobText)) {
        ecoScore += p.weight;
        ecoSignals.push(p.label);
      }
    }
    if (ecoScore >= eco.threshold) {
      if (!eco.evidencePattern.test(userEvidenceText)) {
        categories.push("domain_locked");
        allSignals.push(...ecoSignals);
        missing.push(`${eco.name} ecosystem`);
      }
    }
  }

  let stackScore = 0;
  const stackSignals = [];
  for (const p of STACK_EXECUTION_JOB_PATTERNS) {
    if (p.pattern.test(jobText)) {
      stackScore += p.weight;
      stackSignals.push(p.label);
    }
  }
  if (stackScore >= STACK_EXECUTION_THRESHOLD) {
    if (!STACK_EVIDENCE_PATTERN.test(userEvidenceText)) {
      categories.push("stack_execution");
      allSignals.push(...stackSignals);
      missing.push("coding/stack execution evidence");
    }
  }

  if (categories.length === 0) return noTrigger;

  const cap = EXECUTION_EVIDENCE_CAP;
  const adjustment = round1(cap - score);
  const reason =
    `Execution evidence guardrail: categories=[${categories.join(", ")}], ` +
    `signals=[${allSignals.join(", ")}], ` +
    `missing=[${missing.join(", ")}]. ` +
    `Score capped from ${round1(score)} to ${cap}.`;

  return { triggered: true, categories, signals: allSignals, missingEvidence: missing, cap, adjustment, reason };
}

// ─── Minimal persona fixtures ─────────────────────────────────────────────────

// Chris: PM/product background — no coding or domain-locked ecosystem evidence
const CHRIS_RESUME = `
  Product Manager with 8 years experience defining roadmaps, conducting user research,
  writing PRDs, coordinating cross-functional launches, and leading stakeholder alignment.
  Background in product strategy and market analysis.
`;

// Marcus: Has Salesforce CRM experience
const MARCUS_RESUME = `
  Salesforce CRM administrator. CPQ configuration, Apex trigger development, SOQL queries.
  Managed Sales Cloud and Service Cloud instances. Quote-to-cash workflows.
`;

// Dev practitioner: has coding evidence
const DEV_RESUME = `
  Senior software engineer. 5 years of Python development, React front-end, Django REST APIs.
  Code reviews, production code ownership, algorithm design and data structures work.
`;

// ─── Job description stubs ─────────────────────────────────────────────────────

const SALESFORCE_CPQ_JOB = `
  Salesforce CPQ Architect. Must have hands-on Apex development, SOQL query optimization,
  Lightning/LWC component builds, and quote-to-cash configuration experience.
  salesforce CPQ certification preferred. Sales Cloud / Service Cloud knowledge required.
`;

const SAP_ABAP_JOB = `
  SAP ABAP Developer required. You will work extensively with SAP S/4 HANA and ABAP
  programming. HANA database experience. SAP FI module configuration. SAP MM knowledge.
`;

const SERVICENOW_ITSM_JOB = `
  ServiceNow Platform Developer. Deep ServiceNow ITSM configuration required.
  Scripting background for ServiceNow business rules. ITOM familiarity valued.
`;

const PYTHON_DEVELOPER_JOB = `
  Senior Python Developer. You will write code daily using Python, Django, and React.
  Hands-on coding and code review required. Must contribute to the codebase and
  understand algorithms and data structures. Java experience also valued.
`;

const SYSTEMS_PRODUCT_JOB = `
  Senior Product Manager for system integrations. Define requirements, work with
  engineering, conduct user research, manage roadmap. Cross-functional leadership.
  No coding required. Strong stakeholder management.
`;

// ─── Scenario 1: Domain-Locked Detection — Salesforce CPQ ───────────────────

function testSalesforceDomainLocked() {
  section("Domain-Locked Detection — Salesforce CPQ (ecosystem 1 of 3)");

  // 1a. Guardrail fires for user without Salesforce evidence
  const result = detectExecutionEvidenceGap(9.0, SALESFORCE_CPQ_JOB, CHRIS_RESUME);
  assert(result.triggered === true,
    "Salesforce CPQ × no-evidence → guardrail fires",
    `triggered=${result.triggered}`);
  assert(result.categories.includes("domain_locked"),
    "Salesforce CPQ → category is domain_locked",
    `categories=${JSON.stringify(result.categories)}`);
  assert(result.cap === 7.0,
    "Salesforce CPQ → cap value is 7.0",
    `cap=${result.cap}`);
  assert(result.adjustment < 0,
    "Salesforce CPQ → adjustment is negative",
    `adjustment=${result.adjustment}`);
  assert(result.missingEvidence.some(m => m.includes("Salesforce")),
    "Salesforce CPQ → missingEvidence contains 'Salesforce'",
    `missing=${JSON.stringify(result.missingEvidence)}`);

  // 1b. Evidence bypass: user with Salesforce experience is not blocked
  const resultWithEvidence = detectExecutionEvidenceGap(9.0, SALESFORCE_CPQ_JOB, MARCUS_RESUME);
  assert(resultWithEvidence.categories.includes("domain_locked") === false,
    "Salesforce CPQ × Salesforce-evidence → domain_locked NOT triggered",
    `categories=${JSON.stringify(resultWithEvidence.categories)}`);
}

// ─── Scenario 2: Domain-Locked Detection — SAP ABAP ─────────────────────────

function testSAPDomainLocked() {
  section("Domain-Locked Detection — SAP ABAP (ecosystem 2 of 3)");

  const result = detectExecutionEvidenceGap(8.0, SAP_ABAP_JOB, CHRIS_RESUME);
  assert(result.triggered === true,
    "SAP ABAP × no-evidence → guardrail fires",
    `triggered=${result.triggered}`);
  assert(result.categories.includes("domain_locked"),
    "SAP ABAP → category is domain_locked",
    `categories=${JSON.stringify(result.categories)}`);
  assert(result.missingEvidence.some(m => m.includes("SAP")),
    "SAP ABAP → missingEvidence contains 'SAP'",
    `missing=${JSON.stringify(result.missingEvidence)}`);

  // Evidence bypass: user mentions SAP/ABAP in profile
  const sapUser = "SAP ABAP developer. S/4HANA implementation. HANA database. SAP FI module.";
  const resultWithEvidence = detectExecutionEvidenceGap(8.0, SAP_ABAP_JOB, sapUser);
  assert(resultWithEvidence.categories.includes("domain_locked") === false,
    "SAP ABAP × SAP-evidence → domain_locked NOT triggered",
    `categories=${JSON.stringify(resultWithEvidence.categories)}`);
}

// ─── Scenario 3: Domain-Locked Detection — ServiceNow ITSM ──────────────────

function testServiceNowDomainLocked() {
  section("Domain-Locked Detection — ServiceNow ITSM (ecosystem 3 of 3)");

  const result = detectExecutionEvidenceGap(7.5, SERVICENOW_ITSM_JOB, CHRIS_RESUME);
  assert(result.triggered === true,
    "ServiceNow × no-evidence → guardrail fires",
    `triggered=${result.triggered}`);
  assert(result.categories.includes("domain_locked"),
    "ServiceNow → category is domain_locked",
    `categories=${JSON.stringify(result.categories)}`);
  assert(result.missingEvidence.some(m => m.includes("ServiceNow")),
    "ServiceNow → missingEvidence contains 'ServiceNow'",
    `missing=${JSON.stringify(result.missingEvidence)}`);
}

// ─── Scenario 4: Stack Execution Detection — Python/Django/React ────────────

function testStackExecutionDetection() {
  section("Stack Execution Detection — 5 patterns (Python, Java, React, Django, write code)");

  // Verify 5 individual patterns all match the Python developer JD
  const jd = PYTHON_DEVELOPER_JOB;
  const patternsToCheck = [
    { pattern: /\bpython\b/i, label: "Python" },
    { pattern: /\bjava\b/i, label: "Java" },
    { pattern: /\breact\b/i, label: "React" },
    { pattern: /\bdjango\b/i, label: "Django" },
    { pattern: /\bwrite\s+code\b/i, label: "write code" },
  ];
  for (const p of patternsToCheck) {
    assert(p.pattern.test(jd),
      `Pattern "${p.label}" matches Python developer JD`,
      `pattern=${p.pattern}`);
  }

  // Full guardrail fires for non-dev user
  const result = detectExecutionEvidenceGap(8.5, jd, CHRIS_RESUME);
  assert(result.triggered === true,
    "Python developer JD × PM-only resume → guardrail fires",
    `triggered=${result.triggered}`);
  assert(result.categories.includes("stack_execution"),
    "Python developer JD → category is stack_execution",
    `categories=${JSON.stringify(result.categories)}`);
  assert(result.cap === 7.0,
    "stack_execution → cap is 7.0",
    `cap=${result.cap}`);
}

// ─── Scenario 5: Score Cap Enforcement ──────────────────────────────────────

function testScoreCapEnforcement() {
  section("Score Cap Enforcement");

  // 5a. Score 9.0 → adjusted to 7.0 (adjustment = -2.0)
  const result90 = detectExecutionEvidenceGap(9.0, SALESFORCE_CPQ_JOB, CHRIS_RESUME);
  assert(result90.triggered === true,
    "score=9.0, Salesforce job, no evidence → triggered",
    `triggered=${result90.triggered}`);
  assert(result90.adjustment === round1(7.0 - 9.0),
    "score=9.0 → adjustment=-2.0",
    `adjustment=${result90.adjustment}, expected=${round1(7.0 - 9.0)}`);

  // 5b. Score 7.5 → adjusted to 7.0 (adjustment = -0.5)
  const result75 = detectExecutionEvidenceGap(7.5, SERVICENOW_ITSM_JOB, CHRIS_RESUME);
  assert(result75.triggered === true,
    "score=7.5, ServiceNow job, no evidence → triggered",
    `triggered=${result75.triggered}`);
  assert(result75.adjustment === round1(7.0 - 7.5),
    "score=7.5 → adjustment=-0.5",
    `adjustment=${result75.adjustment}, expected=${round1(7.0 - 7.5)}`);

  // 5c. Score 8.0 → adjusted to 7.0 (adjustment = -1.0)
  const result80 = detectExecutionEvidenceGap(8.0, SAP_ABAP_JOB, CHRIS_RESUME);
  assert(result80.triggered === true,
    "score=8.0, SAP job, no evidence → triggered",
    `triggered=${result80.triggered}`);
  assert(result80.adjustment === round1(7.0 - 8.0),
    "score=8.0 → adjustment=-1.0",
    `adjustment=${result80.adjustment}, expected=${round1(7.0 - 8.0)}`);
}

// ─── Scenario 6: Silent Path (score ≤ 7.0) ──────────────────────────────────

function testSilentPath() {
  section("Silent Path — score already at or below cap");

  // 6a. Score exactly 7.0 → no trigger
  const result70 = detectExecutionEvidenceGap(7.0, SALESFORCE_CPQ_JOB, CHRIS_RESUME);
  assert(result70.triggered === false,
    "score=7.0 → guardrail silent (boundary — not triggered)",
    `triggered=${result70.triggered}`);
  assert(result70.adjustment === 0,
    "score=7.0 → adjustment=0",
    `adjustment=${result70.adjustment}`);

  // 6b. Score 6.5 → no trigger
  const result65 = detectExecutionEvidenceGap(6.5, SALESFORCE_CPQ_JOB, CHRIS_RESUME);
  assert(result65.triggered === false,
    "score=6.5 → guardrail silent (below cap)",
    `triggered=${result65.triggered}`);

  // 6c. Score 5.0 → no trigger
  const result50 = detectExecutionEvidenceGap(5.0, PYTHON_DEVELOPER_JOB, CHRIS_RESUME);
  assert(result50.triggered === false,
    "score=5.0 → guardrail silent (well below cap)",
    `triggered=${result50.triggered}`);

  // 6d. Score 0.0 → no trigger
  const result00 = detectExecutionEvidenceGap(0.0, SALESFORCE_CPQ_JOB, CHRIS_RESUME);
  assert(result00.triggered === false,
    "score=0.0 → guardrail silent (floor)",
    `triggered=${result00.triggered}`);
}

// ─── Scenario 7: Evidence Bypass ─────────────────────────────────────────────

function testEvidenceBypass() {
  section("Evidence Bypass — resume contains matching keywords");

  // 7a. User with Salesforce CRM evidence → domain_locked does not fire
  const sfResult = detectExecutionEvidenceGap(9.0, SALESFORCE_CPQ_JOB, MARCUS_RESUME);
  assert(sfResult.categories.includes("domain_locked") === false,
    "Salesforce evidence in resume → domain_locked does not fire",
    `categories=${JSON.stringify(sfResult.categories)}`);

  // 7b. User with coding/dev evidence → stack_execution does not fire
  const devResult = detectExecutionEvidenceGap(9.0, PYTHON_DEVELOPER_JOB, DEV_RESUME);
  assert(devResult.categories.includes("stack_execution") === false,
    "Dev experience in resume → stack_execution does not fire",
    `categories=${JSON.stringify(devResult.categories)}`);

  // 7c. ServiceNow ITSM role + user lists ServiceNow in profile → no trigger
  const snUser = "ServiceNow administrator. ITSM platform configuration. ServiceNow scripting.";
  const snResult = detectExecutionEvidenceGap(8.0, SERVICENOW_ITSM_JOB, snUser);
  assert(snResult.categories.includes("domain_locked") === false,
    "ServiceNow evidence in resume → domain_locked does not fire",
    `categories=${JSON.stringify(snResult.categories)}`);

  // 7d. SAP ABAP role + user has SAP experience → no trigger
  const sapUser = "SAP ABAP developer. S/4HANA. HANA database. SAP SD configuration.";
  const sapResult = detectExecutionEvidenceGap(8.5, SAP_ABAP_JOB, sapUser);
  assert(sapResult.categories.includes("domain_locked") === false,
    "SAP evidence in resume → domain_locked does not fire",
    `categories=${JSON.stringify(sapResult.categories)}`);
}

// ─── Scenario 8: Non-Tech Job — Guardrail Silent ─────────────────────────────

function testNonTechJobSilent() {
  section("Non-Tech / General PM Job — guardrail always silent");

  // Generic product manager role: no ecosystem, no stack signals in JD
  const result90 = detectExecutionEvidenceGap(9.0, SYSTEMS_PRODUCT_JOB, CHRIS_RESUME);
  assert(result90.triggered === false,
    "Generic PM job (score=9.0) → guardrail silent (no job signals)",
    `triggered=${result90.triggered}, categories=${JSON.stringify(result90.categories)}`);

  const result80 = detectExecutionEvidenceGap(8.0, SYSTEMS_PRODUCT_JOB, CHRIS_RESUME);
  assert(result80.triggered === false,
    "Generic PM job (score=8.0) → guardrail silent",
    `triggered=${result80.triggered}`);
}

// ─── Scenario 9: Combined Categories ────────────────────────────────────────

function testCombinedCategories() {
  section("Combined Categories — job with both domain + stack signals");

  // A job that has both Salesforce signals AND Python/React coding requirements
  const hybridJD = `
    Salesforce CPQ Developer and Full-Stack Engineer. You will write code in Python and
    React while also building Apex triggers and SOQL queries in Salesforce. Lightning/LWC
    components required. CPQ certification preferred. Code review and production code ownership.
  `;

  const result = detectExecutionEvidenceGap(9.5, hybridJD, CHRIS_RESUME);
  assert(result.triggered === true,
    "Hybrid JD (Salesforce + Python) × no-evidence → triggered",
    `triggered=${result.triggered}`);
  assert(result.categories.includes("domain_locked"),
    "Hybrid JD → domain_locked detected",
    `categories=${JSON.stringify(result.categories)}`);
  assert(result.categories.includes("stack_execution"),
    "Hybrid JD → stack_execution also detected",
    `categories=${JSON.stringify(result.categories)}`);
  assert(result.cap === 7.0,
    "Combined categories → cap still 7.0",
    `cap=${result.cap}`);
}

// ─── Scenario 10: Constant Value Verification ────────────────────────────────

function testConstantValues() {
  section("Constant Value Verification");

  assert(EXECUTION_EVIDENCE_CAP === 7.0,
    "EXECUTION_EVIDENCE_CAP is 7.0",
    `value=${EXECUTION_EVIDENCE_CAP}`);
  assert(STACK_EXECUTION_THRESHOLD === 4,
    "STACK_EXECUTION_THRESHOLD is 4",
    `value=${STACK_EXECUTION_THRESHOLD}`);
  assert(DOMAIN_LOCKED_ECOSYSTEMS.length === 7,
    "DOMAIN_LOCKED_ECOSYSTEMS has 7 entries",
    `count=${DOMAIN_LOCKED_ECOSYSTEMS.length}`);
  assert(STACK_EXECUTION_JOB_PATTERNS.length === 31,
    "STACK_EXECUTION_JOB_PATTERNS has 31 entries",
    `count=${STACK_EXECUTION_JOB_PATTERNS.length}`);

  // Verify each of the 7 ecosystems is present by name
  const ecoNames = DOMAIN_LOCKED_ECOSYSTEMS.map(e => e.name);
  for (const name of ["Salesforce", "SAP", "Oracle", "ServiceNow", "Workday", "NetSuite", "Dynamics 365"]) {
    assert(ecoNames.includes(name),
      `Ecosystem "${name}" is present in DOMAIN_LOCKED_ECOSYSTEMS`,
      `found=${ecoNames.join(", ")}`);
  }
}

// ─── Run all scenarios ────────────────────────────────────────────────────────

testSalesforceDomainLocked();
testSAPDomainLocked();
testServiceNowDomainLocked();
testStackExecutionDetection();
testScoreCapEnforcement();
testSilentPath();
testEvidenceBypass();
testNonTechJobSilent();
testCombinedCategories();
testConstantValues();

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════════════════════════════╗");
console.log(`║  RESULTS: ${passCount} passed, ${failCount} failed`);
if (failCount === 0) {
  console.log("║  STATUS: ✓ ALL SCENARIOS PASS — execution evidence gate validated ║");
} else {
  console.log("║  STATUS: ✗ FAILURES DETECTED — see details above                 ║");
  console.log("╠══════════════════════════════════════════════════════════════════╣");
  for (const f of failures) {
    console.log(`║  FAIL: ${f.test}`);
    if (f.detail) console.log(`║        ${f.detail}`);
  }
}
console.log("╚══════════════════════════════════════════════════════════════════╝");

process.exit(failCount > 0 ? 1 : 0);
